import { base64ToBytes } from '../../helpers.js'
import { level, left, right, nodeWidth, root } from './treemath.js'

const TEXT_ENCODER = new TextEncoder()

// Hash one byte sequence with SHA-256.
export async function sha256(bytes) {
  const buffer = await crypto.subtle.digest('SHA-256', bytes)
  return new Uint8Array(buffer)
}

// Compute the starting transcript hash for a new group.
export async function genesisTranscriptHash() {
  return sha256(new Uint8Array(0))
}

const CIPHER_SUITE_CODES = {
  'ECHO-MLS/X25519_AES256GCM_SHA256': 0xff01,
}

// Map app cipher suite names to the numeric code used in the context bytes.
function cipherSuiteCode(str) {
  return CIPHER_SUITE_CODES[str] ?? 0xff01
}

// Serialize the fields that feed the MLS key schedule.
export function encodeGroupContext({
  groupId,
  epoch,
  cipherSuite,
  treeHash,
  confirmedTranscriptHash,
}) {
  const gidBytes = TEXT_ENCODER.encode(groupId)
  const cs = cipherSuiteCode(cipherSuite)

  const buf = new Uint8Array(
    2 + 2 + 2 + gidBytes.length + 8 + 2 + treeHash.length + 2 + confirmedTranscriptHash.length + 2
  )

  let o = 0

  buf[o++] = 0x00
  buf[o++] = 0x01

  buf[o++] = (cs >>> 8) & 0xff
  buf[o++] = cs & 0xff

  buf[o++] = (gidBytes.length >>> 8) & 0xff
  buf[o++] = gidBytes.length & 0xff
  buf.set(gidBytes, o)
  o += gidBytes.length

  buf[o++] = 0
  buf[o++] = 0
  buf[o++] = 0
  buf[o++] = 0
  buf[o++] = (epoch >>> 24) & 0xff
  buf[o++] = (epoch >>> 16) & 0xff
  buf[o++] = (epoch >>> 8) & 0xff
  buf[o++] = epoch & 0xff

  buf[o++] = (treeHash.length >>> 8) & 0xff
  buf[o++] = treeHash.length & 0xff
  buf.set(treeHash, o)
  o += treeHash.length

  buf[o++] = (confirmedTranscriptHash.length >>> 8) & 0xff
  buf[o++] = confirmedTranscriptHash.length & 0xff
  buf.set(confirmedTranscriptHash, o)
  o += confirmedTranscriptHash.length

  buf[o++] = 0x00
  buf[o++] = 0x00

  return buf
}

// Advance the confirmed transcript hash for one commit.
export async function advanceTranscriptHash(prevConfirmedTH, prevConfirmationTag, commitBytes) {
  // Hash the previous transcript state with the previous confirmation tag first.
  const interim = new Uint8Array(prevConfirmedTH.length + prevConfirmationTag.length)
  interim.set(prevConfirmedTH, 0)
  interim.set(prevConfirmationTag, prevConfirmedTH.length)
  const interimTH = await sha256(interim)

  // Then extend that value with the current commit bytes.
  const confirmed = new Uint8Array(interimTH.length + commitBytes.length)
  confirmed.set(interimTH, 0)
  confirmed.set(commitBytes, interimTH.length)
  return sha256(confirmed)
}

// Compute the root tree hash for a public tree snapshot.
export async function computeTreeHash(treePublicNodes, leafCount, leafData = {}) {
  if (!Array.isArray(treePublicNodes) || treePublicNodes.length === 0 || !leafCount) {
    return sha256(TEXT_ENCODER.encode('EchoMLS/v1/blank'))
  }
  const nodes = treePublicNodes.map((k) =>
    typeof k === 'string' && k.length > 0 ? { publicKeyB64: k } : { publicKeyB64: null }
  )
  const rootIdx = root(leafCount)
  return computeNodeSubtreeHash(nodes, rootIdx, leafCount, leafData)
}

// Leaves bind identity data when present. Parents bind both child hashes.
export async function computeNodeSubtreeHash(nodes, nodeIndex, leafCount, leafData = {}) {
  const enc = new TextEncoder()
  const w = nodeWidth(leafCount)

  if (!Array.isArray(nodes) || nodeIndex >= w) {
    if (level(nodeIndex) === 0) return sha256(enc.encode('EchoMLS/v1/blank'))
    return sha256(enc.encode('EchoMLS/v1/blank'))
  }

  if (level(nodeIndex) === 0) {
    const pubKeyB64 = nodes[nodeIndex]?.publicKeyB64 ?? null
    const prefix = enc.encode('EchoMLS/v1/leaf|')
    const pubBytes = pubKeyB64 ? base64ToBytes(pubKeyB64) : new Uint8Array(0)

    const leafIndex = nodeIndex / 2
    const identity = leafData[String(leafIndex)]
    let idBytes = new Uint8Array(0)
    if (identity?.userId && identity?.leafSigningPubKeyB64) {
      // Fold leaf identity into the leaf hash when it is available.
      idBytes = await sha256(enc.encode(`${identity.userId}|${identity.leafSigningPubKeyB64}`))
    }

    const buf = new Uint8Array(prefix.length + pubBytes.length + idBytes.length)
    buf.set(prefix, 0)
    buf.set(pubBytes, prefix.length)
    buf.set(idBytes, prefix.length + pubBytes.length)
    return sha256(buf)
  }

  const [leftHash, rightHash] = await Promise.all([
    computeNodeSubtreeHash(nodes, left(nodeIndex), leafCount, leafData),
    computeNodeSubtreeHash(nodes, right(nodeIndex), leafCount, leafData),
  ])

  const pubKeyB64 = nodes[nodeIndex]?.publicKeyB64 ?? null
  const prefix = enc.encode('EchoMLS/v1/parent|')
  const pubBytes = pubKeyB64 ? base64ToBytes(pubKeyB64) : new Uint8Array(0)
  const buf = new Uint8Array(prefix.length + 2 + pubBytes.length + 32 + 32)
  let o = 0
  buf.set(prefix, o)
  o += prefix.length
  buf[o++] = (pubBytes.length >>> 8) & 0xff
  buf[o++] = pubBytes.length & 0xff
  buf.set(pubBytes, o)
  o += pubBytes.length
  buf.set(leftHash, o)
  o += 32
  buf.set(rightHash, o)
  return sha256(buf)
}

// Bind one path node to its sibling subtree hash.
export async function computeParentHash(nodePubBytes, siblingSubtreeHash) {
  const prefix = TEXT_ENCODER.encode('EchoMLS/v1/phash|')
  const buf = new Uint8Array(prefix.length + nodePubBytes.length + siblingSubtreeHash.length)
  let o = 0
  buf.set(prefix, o)
  o += prefix.length
  buf.set(nodePubBytes, o)
  o += nodePubBytes.length
  buf.set(siblingSubtreeHash, o)
  return sha256(buf)
}
