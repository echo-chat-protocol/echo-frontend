import { base64ToBytes } from '../../helpers.js'
import { level, left, right, nodeWidth } from './treemath.js'

const TEXT_ENCODER = new TextEncoder()

export async function sha256(bytes) {
  const buffer = await crypto.subtle.digest('SHA-256', bytes)
  return new Uint8Array(buffer)
}

// Deterministic hash over the public nodes of a tree.
// The input is the flat array returned by publicTreeSnapshot (nulls become empty string).
export async function computeTreeHash(treePublicNodes) {
  const canonical = (treePublicNodes ?? []).map((k) => k ?? '').join(',')
  return sha256(TEXT_ENCODER.encode(canonical))
}

// Encodes the full MLS GroupContext as a deterministic byte string.
// All fields are length-prefixed so the encoding is unambiguous.
export async function encodeGroupContext({
  groupId,
  epoch,
  cipherSuite,
  treeHash,
  confirmedTranscriptHash,
}) {
  const gidBytes = TEXT_ENCODER.encode(groupId)
  const csBytes = TEXT_ENCODER.encode(cipherSuite)

  const buf = new Uint8Array(
    4 + // epoch (uint32 big-endian)
      2 +
      gidBytes.length + // groupId
      2 +
      csBytes.length + // cipherSuite
      2 +
      treeHash.length + // treeHash
      2 +
      confirmedTranscriptHash.length // confirmedTranscriptHash
  )

  let o = 0
  buf[o++] = (epoch >>> 24) & 0xff
  buf[o++] = (epoch >>> 16) & 0xff
  buf[o++] = (epoch >>> 8) & 0xff
  buf[o++] = epoch & 0xff

  buf[o++] = (gidBytes.length >>> 8) & 0xff
  buf[o++] = gidBytes.length & 0xff
  buf.set(gidBytes, o)
  o += gidBytes.length

  buf[o++] = (csBytes.length >>> 8) & 0xff
  buf[o++] = csBytes.length & 0xff
  buf.set(csBytes, o)
  o += csBytes.length

  buf[o++] = (treeHash.length >>> 8) & 0xff
  buf[o++] = treeHash.length & 0xff
  buf.set(treeHash, o)
  o += treeHash.length

  buf[o++] = (confirmedTranscriptHash.length >>> 8) & 0xff
  buf[o++] = confirmedTranscriptHash.length & 0xff
  buf.set(confirmedTranscriptHash, o)

  return buf
}

// newConfirmedTH = SHA-256(prevConfirmedTH || commitBytes)
export async function advanceTranscriptHash(prevConfirmedTranscriptHash, commitBytes) {
  const combined = new Uint8Array(prevConfirmedTranscriptHash.length + commitBytes.length)
  combined.set(prevConfirmedTranscriptHash, 0)
  combined.set(commitBytes, prevConfirmedTranscriptHash.length)
  return sha256(combined)
}

// Deterministic epoch-0 starting point for the transcript hash.
export async function genesisTranscriptHash(groupId) {
  return sha256(TEXT_ENCODER.encode(`EchoMLS/v1/Genesis|${groupId}`))
}

// ---------------------------------------------------------------------------
// Parent-hash primitives
// ---------------------------------------------------------------------------

// Recursive Merkle-like hash of any subtree in the node array.
//
// Leaf:   SHA-256("EchoMLS/v1/leaf|"   || pubKeyBytes)
// Parent: SHA-256("EchoMLS/v1/parent|" || pubLen[2] || pubKey || leftHash || rightHash)
// Blank:  SHA-256("EchoMLS/v1/blank")
//
// Only publicKeyB64 is fed into the hash. The parent_hash extension field is
// stored separately in the update path (not inside the node), so nodes don't
// need to carry it for subtree hash computation.
export async function computeNodeSubtreeHash(nodes, nodeIndex, leafCount) {
  const enc = new TextEncoder()

  if (!Array.isArray(nodes) || nodeIndex >= nodeWidth(leafCount)) {
    return sha256(enc.encode('EchoMLS/v1/blank'))
  }

  if (level(nodeIndex) === 0) {
    const pubKeyB64 = nodes[nodeIndex]?.publicKeyB64 ?? null
    const prefix = enc.encode('EchoMLS/v1/leaf|')
    const pubBytes = pubKeyB64 ? base64ToBytes(pubKeyB64) : new Uint8Array(0)
    const buf = new Uint8Array(prefix.length + pubBytes.length)
    buf.set(prefix, 0)
    buf.set(pubBytes, prefix.length)
    return sha256(buf)
  }

  const [leftHash, rightHash] = await Promise.all([
    computeNodeSubtreeHash(nodes, left(nodeIndex), leafCount),
    computeNodeSubtreeHash(nodes, right(nodeIndex), leafCount),
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

// parent_hash(P) = SHA-256("EchoMLS/v1/phash|" || pub(P) || subtreeHash(sibling(P)))
//
// Binds the parent node's public key to the complete state of its copath sibling
// subtree at commit time. Any modification to the sibling subtree — or substitution
// of the parent key with one not derived from the path secret — invalidates this tag.
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
