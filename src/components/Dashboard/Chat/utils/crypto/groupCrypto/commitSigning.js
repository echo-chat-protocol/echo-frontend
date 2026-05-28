import { bytesToBase64, base64ToBytes } from '../../helpers.js'
import { SIG_COMMIT_DOMAIN, SIG_WELCOME_DOMAIN } from './labels.js'

const TEXT_ENCODER = new TextEncoder()

// Web Crypto JWK fields use base64url, while the app stores standard base64.
function base64urlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

// Convert standard bytes into base64url for JWK fields.
function bytesToBase64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// Generate and store one leaf signing keypair.
export async function generateLeafSigningKeypair() {
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
  const pubJwk = await crypto.subtle.exportKey('jwk', kp.publicKey)

  const seedBytes = base64urlToBytes(privJwk.d)
  const pubBytes = base64urlToBytes(pubJwk.x)

  // Store the seed and public key together so the private JWK can be rebuilt later.
  const privBytes = new Uint8Array(64)
  privBytes.set(seedBytes, 0)
  privBytes.set(pubBytes, 32)

  return {
    leafSigningPrivKeyB64: bytesToBase64(privBytes),
    leafSigningPubKeyB64: bytesToBase64(pubBytes),
  }
}

// Import the stored leaf signing private key into Web Crypto.
async function importSigningPrivKey(leafSigningPrivKeyB64) {
  const privBytes = base64ToBytes(leafSigningPrivKeyB64)
  const seedBytes = privBytes.slice(0, 32)
  const pubBytes = privBytes.slice(32, 64)
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'OKP', crv: 'Ed25519', d: bytesToBase64url(seedBytes), x: bytesToBase64url(pubBytes) },
    { name: 'Ed25519' },
    false,
    ['sign']
  )
}

// Import the stored leaf signing public key into Web Crypto.
async function importVerifyPubKey(leafSigningPubKeyB64) {
  const pubBytes = base64ToBytes(leafSigningPubKeyB64)
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'OKP', crv: 'Ed25519', x: bytesToBase64url(pubBytes) },
    { name: 'Ed25519' },
    false,
    ['verify']
  )
}

// Sign one byte string with a leaf signing key.
export async function signBytes(message, leafSigningPrivKeyB64) {
  const key = await importSigningPrivKey(leafSigningPrivKeyB64)
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key, message)
  return bytesToBase64(new Uint8Array(sig))
}

// Verify one signature with a leaf signing public key.
export async function verifyBytes(message, signatureB64, pubKeyB64) {
  const key = await importVerifyPubKey(pubKeyB64)
  const sigBytes = base64ToBytes(signatureB64)
  const valid = await crypto.subtle.verify({ name: 'Ed25519' }, key, sigBytes, message)
  if (!valid) throw new Error('Signature invalid')
}

// Encode bytes with a fixed 4-byte length prefix.
function encodeLengthPrefixed(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? [])
  const out = new Uint8Array(4 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length, false)
  out.set(data, 4)
  return out
}

// Keep commit signing stable by encoding the same fields in the same order.
export function encodeCommitForSigning(commit) {
  const rosterStr = (commit.roster ?? [])
    .slice()
    .sort((a, b) => a.leafIndex - b.leafIndex)
    .map((m) => `${m.userId}:${m.leafIndex}:${m.leafSigningPubKeyB64 ?? ''}`)
    .join(',')
  const rosterBytes = encodeLengthPrefixed(TEXT_ENCODER.encode(rosterStr))

  const pathStr = (commit.updatePath ?? [])
    .map((e) => `${e.nodeIndex}:${e.publicKeyB64 ?? ''}`)
    .join(',')
  const pathBytes = encodeLengthPrefixed(TEXT_ENCODER.encode(pathStr))

  const treeStr = Array.from(
    { length: commit.treePublicNodes?.length ?? 0 },
    (_, i) => commit.treePublicNodes?.[i] ?? null
  )
    .map((k) => k ?? '')
    .join(',')
  const treeBytes = encodeLengthPrefixed(TEXT_ENCODER.encode(treeStr))

  const header = encodeLengthPrefixed(
    TEXT_ENCODER.encode(
      SIG_COMMIT_DOMAIN +
        `|${commit.groupId}` +
        `|${commit.epoch}` +
        `|${commit.type}` +
        `|${commit.senderLeafIndex}` +
        `|${commit.senderSigningPubKeyB64 ?? ''}` +
        `|${commit.targetUserId ?? ''}` +
        `|${commit.leafCount ?? ''}`
    )
  )

  const proposalRefsStr = (commit.proposalRefs ?? []).join(';')
  const proposalRefsBytes = encodeLengthPrefixed(TEXT_ENCODER.encode(proposalRefsStr))

  const message = new Uint8Array(
    header.length +
      rosterBytes.length +
      pathBytes.length +
      treeBytes.length +
      proposalRefsBytes.length
  )
  message.set(header, 0)
  message.set(rosterBytes, header.length)
  message.set(pathBytes, header.length + rosterBytes.length)
  message.set(treeBytes, header.length + rosterBytes.length + pathBytes.length)
  message.set(
    proposalRefsBytes,
    header.length + rosterBytes.length + pathBytes.length + treeBytes.length
  )
  return message
}

// Encode the signed part of a welcome message.
export function encodeWelcomeForSigning(welcome) {
  const header = encodeLengthPrefixed(
    TEXT_ENCODER.encode(
      SIG_WELCOME_DOMAIN +
        `|${welcome.groupId}` +
        `|${welcome.epoch}` +
        `|${welcome.cipherSuite ?? ''}` +
        `|${welcome.recipientUserId ?? ''}` +
        `|${welcome.recipientLeafIndex ?? ''}` +
        `|${welcome.senderLeafIndex ?? ''}` +
        `|${welcome.senderSigningPubKeyB64 ?? ''}`
    )
  )

  const gs = welcome.encryptedGroupSecrets ?? {}
  const gi = welcome.encryptedGroupInfo ?? {}
  const secretsStr = `${gs.encryptedB64 ?? ''}|${gs.ephPubB64 ?? ''}|${gs.nonceB64 ?? ''}`
  const infoStr = `${gi.encryptedB64 ?? ''}|${gi.nonceB64 ?? ''}`
  const payloadBytes = encodeLengthPrefixed(TEXT_ENCODER.encode(`${secretsStr}||${infoStr}`))

  const message = new Uint8Array(header.length + payloadBytes.length)
  message.set(header, 0)
  message.set(payloadBytes, header.length)
  return message
}

// Signatures cover the canonical byte encoding, not the raw JS object shape.
export async function signCommit(commit, leafSigningPrivKeyB64) {
  const message = encodeCommitForSigning(commit)
  return signBytes(message, leafSigningPrivKeyB64)
}

// Verify one signed commit.
export async function verifyCommit(commit, senderSigningPubKeyB64) {
  if (!commit.signature || !senderSigningPubKeyB64) {
    throw new Error('Commit missing signature or signing pub key')
  }
  const message = encodeCommitForSigning(commit)
  await verifyBytes(message, commit.signature, senderSigningPubKeyB64)
}

// Sign one welcome message.
export async function signWelcome(welcome, leafSigningPrivKeyB64) {
  const message = encodeWelcomeForSigning(welcome)
  return signBytes(message, leafSigningPrivKeyB64)
}

// Verify one signed welcome message.
export async function verifyWelcome(welcome, senderSigningPubKeyB64) {
  if (!welcome.signature || !senderSigningPubKeyB64) {
    throw new Error('Welcome missing signature or signing pub key')
  }
  const message = encodeWelcomeForSigning(welcome)
  await verifyBytes(message, welcome.signature, senderSigningPubKeyB64)
}
