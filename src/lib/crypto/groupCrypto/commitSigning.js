import init, {
  generate_private_ephemeral_key,
  derive_ed25519_keypair_from_x25519,
  convert_x25519_to_xeddsa,
  compute_determenistic_nonce,
  compute_nonce_point,
  compute_challenge_hash,
  compute_signature_scaler,
  compute_signature,
  verify_signature,
} from '@mascaro101/echo-protocol'
import { bytesToBase64, base64ToBytes } from '../../helpers.js'

const TEXT_ENCODER = new TextEncoder()

// Key Generation
// Uses an X25519 pk as a leaf signing key
// The verifiable pk is the XEdDSA Ed25519 pk derived from it.

export async function generateLeafSigningKeypair() {
  await init()
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  const leafSigningPrivKey = generate_private_ephemeral_key(randomBytes)
  const leafSigningPubKey = derive_ed25519_keypair_from_x25519(leafSigningPrivKey)

  return {
    leafSigningPrivKeyB64: bytesToBase64(leafSigningPrivKey),
    leafSigningPubKeyB64: bytesToBase64(leafSigningPubKey),
  }
}

// Canonical encoding
// Deterministic byte encoding of the commit payload.

function encodeLengthPrefixed(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? [])
  const out = new Uint8Array(4 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length, false)
  out.set(data, 4)
  return out
}

export function encodeCommitForSigning(commit) {
  // 1. Canonicalize structured sections so order and separators are deterministic.
  const rosterStr = (commit.roster ?? [])
    .slice()
    .sort((a, b) => a.leafIndex - b.leafIndex)
    .map((m) => `${m.userId}:${m.leafIndex}:${m.leafSigningPubKeyB64 ?? ''}`)
    .join(',')
  const rosterBytes = encodeLengthPrefixed(TEXT_ENCODER.encode(rosterStr))

  // 2. Commit to update-path public keys only, not the encrypted secrets.
  const pathStr = (commit.updatePath ?? [])
    .map((e) => `${e.nodeIndex}:${e.publicKeyB64 ?? ''}`)
    .join(',')
  const pathBytes = encodeLengthPrefixed(TEXT_ENCODER.encode(pathStr))

  // Commit to the full tree snapshot so the relay cannot substitute non-path nodes.
  const treeStr = Array.from(
    { length: commit.treePublicNodes?.length ?? 0 },
    (_, index) => commit.treePublicNodes?.[index] ?? null
  )
    .map((k) => k ?? '')
    .join(',')
  const treeBytes = encodeLengthPrefixed(TEXT_ENCODER.encode(treeStr))

  // 3. Encode all critical fields in a fixed, deterministic format.
  const header = encodeLengthPrefixed(
    TEXT_ENCODER.encode(
      `EchoMLS/v1/CommitSig` +
        `|${commit.groupId}` +
        `|${commit.epoch}` +
        `|${commit.type}` +
        `|${commit.senderLeafIndex}` +
        `|${commit.senderSigningPubKeyB64 ?? ''}` +
        `|${commit.targetUserId ?? ''}` +
        `|${commit.leafCount ?? ''}`
    )
  )

  const message = new Uint8Array(
    header.length + rosterBytes.length + pathBytes.length + treeBytes.length
  )
  message.set(header, 0)
  message.set(rosterBytes, header.length)
  message.set(pathBytes, header.length + rosterBytes.length)
  message.set(treeBytes, header.length + rosterBytes.length + pathBytes.length)

  return message
}

// Sign

export async function signCommit(commit, leafSigningPrivKeyB64) {
  await init()

  const privKey = base64ToBytes(leafSigningPrivKeyB64)
  const message = encodeCommitForSigning(commit)

  const xeddsaKey = convert_x25519_to_xeddsa(privKey)
  const edPrivScaler = xeddsaKey.slice(0, 32)
  const prefix = xeddsaKey.slice(32, 64)
  const pubEdKey = derive_ed25519_keypair_from_x25519(privKey)

  const nonce = compute_determenistic_nonce(prefix, message)
  const noncePoint = compute_nonce_point(nonce)
  const challenge = compute_challenge_hash(noncePoint, pubEdKey, message)
  const sigScaler = compute_signature_scaler(nonce, challenge, edPrivScaler)
  const signature = compute_signature(noncePoint, sigScaler)

  return bytesToBase64(signature)
}

// Verify

export async function verifyCommit(commit, senderSigningPubKeyB64) {
  await init()

  if (!commit.signature || !senderSigningPubKeyB64) {
    throw new Error('Commit missing signature or signing pub key')
  }

  const pubKey = base64ToBytes(senderSigningPubKeyB64)
  const sigBytes = base64ToBytes(commit.signature)
  const message = encodeCommitForSigning(commit)

  const valid = verify_signature(sigBytes, message, pubKey)
  if (!valid) throw new Error('Commit signature invalid')
}
