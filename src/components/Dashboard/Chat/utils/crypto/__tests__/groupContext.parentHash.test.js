/**
 * groupContext.parentHash.test.js
 *
 * Unit tests for computeNodeSubtreeHash and computeParentHash.
 *
 * These functions implement the parent-hash binding that closes the gap
 * where a sender could claim arbitrary parent public keys in an update path
 * without holding the corresponding private keys.
 *
 * All crypto is real WebCrypto SHA-256 — no WASM required.
 */
import { Buffer } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'

if (!globalThis.crypto) globalThis.crypto = webcrypto
if (!globalThis.atob) globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary')
if (!globalThis.btoa) globalThis.btoa = (bin) => Buffer.from(bin, 'binary').toString('base64')

const { bytesToBase64 } = await import('../../helpers.js')
const { computeNodeSubtreeHash, computeParentHash } = await import('../groupCrypto/groupContext.js')

function B64(fill) {
  return bytesToBase64(new Uint8Array(32).fill(fill))
}

function filledNode(fill) {
  return { publicKeyB64: B64(fill), privateKeyB64: null }
}

function blankNode() {
  return { publicKeyB64: null, privateKeyB64: null }
}

// ── computeNodeSubtreeHash ────────────────────────────────────────────────────

describe('computeNodeSubtreeHash — leaf nodes', () => {
  it('returns a 32-byte Uint8Array', async () => {
    const h = await computeNodeSubtreeHash([filledNode(0x01)], 0, 1)
    expect(h).toBeInstanceOf(Uint8Array)
    expect(h).toHaveLength(32)
  })

  it('is deterministic for the same inputs', async () => {
    const nodes = [filledNode(0x01)]
    const h1 = await computeNodeSubtreeHash(nodes, 0, 1)
    const h2 = await computeNodeSubtreeHash(nodes, 0, 1)
    expect(Buffer.from(h1)).toEqual(Buffer.from(h2))
  })

  it('blank leaf hashes to the fixed blank constant', async () => {
    const h = await computeNodeSubtreeHash([blankNode()], 0, 1)
    expect(h).toHaveLength(32)
  })

  it('blank leaf and filled leaf produce different hashes', async () => {
    const hBlank = await computeNodeSubtreeHash([blankNode()], 0, 1)
    const hFilled = await computeNodeSubtreeHash([filledNode(0x01)], 0, 1)
    expect(Buffer.from(hBlank)).not.toEqual(Buffer.from(hFilled))
  })

  it('two different leaf keys produce different hashes', async () => {
    const h1 = await computeNodeSubtreeHash([filledNode(0x01)], 0, 1)
    const h2 = await computeNodeSubtreeHash([filledNode(0x02)], 0, 1)
    expect(Buffer.from(h1)).not.toEqual(Buffer.from(h2))
  })

  it('out-of-bounds node index hashes to the blank constant', async () => {
    const hBlank = await computeNodeSubtreeHash([blankNode()], 0, 1)
    const hOob = await computeNodeSubtreeHash([], 99, 1)
    expect(Buffer.from(hBlank)).not.toEqual(Buffer.from(hOob))
    // Two different out-of-bounds indices hash to the same blank constant.
    const hOob2 = await computeNodeSubtreeHash([], 5, 2)
    expect(Buffer.from(hOob)).toEqual(Buffer.from(hOob2))
  })
})

describe('computeNodeSubtreeHash — internal nodes (Merkle property)', () => {
  // 2-leaf tree layout: node 0 (leaf 0), node 1 (root/parent), node 2 (leaf 1)
  function twoLeafTree(fill0, fill1) {
    return [
      { publicKeyB64: B64(fill0), privateKeyB64: null }, // node 0: leaf 0
      { publicKeyB64: null, privateKeyB64: null }, // node 1: parent
      { publicKeyB64: B64(fill1), privateKeyB64: null }, // node 2: leaf 1
    ]
  }

  it('parent hash changes when left child key changes', async () => {
    const before = await computeNodeSubtreeHash(twoLeafTree(0x01, 0x02), 1, 2)
    const after = await computeNodeSubtreeHash(twoLeafTree(0x99, 0x02), 1, 2)
    expect(Buffer.from(before)).not.toEqual(Buffer.from(after))
  })

  it('parent hash changes when right child key changes', async () => {
    const before = await computeNodeSubtreeHash(twoLeafTree(0x01, 0x02), 1, 2)
    const after = await computeNodeSubtreeHash(twoLeafTree(0x01, 0x99), 1, 2)
    expect(Buffer.from(before)).not.toEqual(Buffer.from(after))
  })

  it('parent hash changes when the parent public key itself changes', async () => {
    const nodes1 = twoLeafTree(0x01, 0x02)
    const nodes2 = twoLeafTree(0x01, 0x02)
    nodes2[1] = { publicKeyB64: B64(0xaa), privateKeyB64: null } // different parent key
    const h1 = await computeNodeSubtreeHash(nodes1, 1, 2)
    const h2 = await computeNodeSubtreeHash(nodes2, 1, 2)
    expect(Buffer.from(h1)).not.toEqual(Buffer.from(h2))
  })

  it('a 4-leaf tree subtree hash propagates changes from any descendant', async () => {
    // 4-leaf tree: leaves at nodes 0,2,4,6; parents at 1,5; root at 3.
    const makeNodes = (leafFills) => [
      { publicKeyB64: B64(leafFills[0]), privateKeyB64: null }, // node 0: leaf 0
      { publicKeyB64: null, privateKeyB64: null }, // node 1: parent of 0,2
      { publicKeyB64: B64(leafFills[1]), privateKeyB64: null }, // node 2: leaf 1
      { publicKeyB64: null, privateKeyB64: null }, // node 3: root
      { publicKeyB64: B64(leafFills[2]), privateKeyB64: null }, // node 4: leaf 2
      { publicKeyB64: null, privateKeyB64: null }, // node 5: parent of 4,6
      { publicKeyB64: B64(leafFills[3]), privateKeyB64: null }, // node 6: leaf 3
    ]

    const base = makeNodes([0x01, 0x02, 0x03, 0x04])

    // Change leaf 0 → root hash must differ
    const changed0 = makeNodes([0x99, 0x02, 0x03, 0x04])
    expect(Buffer.from(await computeNodeSubtreeHash(base, 3, 4))).not.toEqual(
      Buffer.from(await computeNodeSubtreeHash(changed0, 3, 4))
    )

    // Change leaf 3 → root hash must differ
    const changed3 = makeNodes([0x01, 0x02, 0x03, 0x99])
    expect(Buffer.from(await computeNodeSubtreeHash(base, 3, 4))).not.toEqual(
      Buffer.from(await computeNodeSubtreeHash(changed3, 3, 4))
    )
  })

  it('leaf hash and same-key parent hash differ (domain separation)', async () => {
    const key = B64(0x42)
    const leaf = await computeNodeSubtreeHash([{ publicKeyB64: key }], 0, 1)
    const nodes = [{ publicKeyB64: B64(0x01) }, { publicKeyB64: key }, { publicKeyB64: B64(0x02) }]
    const parent = await computeNodeSubtreeHash(nodes, 1, 2)
    expect(Buffer.from(leaf)).not.toEqual(Buffer.from(parent))
  })
})

// ── computeParentHash ─────────────────────────────────────────────────────────

describe('computeParentHash', () => {
  const NODE_PUB = new Uint8Array(32).fill(0x11)
  const SIBLING_HASH = new Uint8Array(32).fill(0x22)

  it('returns a 32-byte Uint8Array', async () => {
    const ph = await computeParentHash(NODE_PUB, SIBLING_HASH)
    expect(ph).toBeInstanceOf(Uint8Array)
    expect(ph).toHaveLength(32)
  })

  it('is deterministic for the same inputs', async () => {
    const ph1 = await computeParentHash(NODE_PUB, SIBLING_HASH)
    const ph2 = await computeParentHash(NODE_PUB, SIBLING_HASH)
    expect(Buffer.from(ph1)).toEqual(Buffer.from(ph2))
  })

  it('different node public keys produce different parent hashes', async () => {
    const ph1 = await computeParentHash(new Uint8Array(32).fill(0x01), SIBLING_HASH)
    const ph2 = await computeParentHash(new Uint8Array(32).fill(0x02), SIBLING_HASH)
    expect(Buffer.from(ph1)).not.toEqual(Buffer.from(ph2))
  })

  it('different sibling subtree hashes produce different parent hashes', async () => {
    const ph1 = await computeParentHash(NODE_PUB, new Uint8Array(32).fill(0x01))
    const ph2 = await computeParentHash(NODE_PUB, new Uint8Array(32).fill(0x02))
    expect(Buffer.from(ph1)).not.toEqual(Buffer.from(ph2))
  })

  it('swapping node pub and sibling hash produces a different result (non-commutative)', async () => {
    const a = new Uint8Array(32).fill(0x11)
    const b = new Uint8Array(32).fill(0x22)
    const ph1 = await computeParentHash(a, b)
    const ph2 = await computeParentHash(b, a)
    expect(Buffer.from(ph1)).not.toEqual(Buffer.from(ph2))
  })

  it('computeParentHash(nodePub, subtreeHash(sibling)) changes when the sibling tree changes', async () => {
    const nodes = [
      { publicKeyB64: B64(0x01) }, // node 0: leaf 0 (sibling)
      { publicKeyB64: null }, // node 1: parent
      { publicKeyB64: B64(0x02) }, // node 2: leaf 1 (on update path)
    ]
    const nodePub = new Uint8Array(32).fill(0x77)
    const siblingHash1 = await computeNodeSubtreeHash(nodes, 0, 2)
    const ph1 = await computeParentHash(nodePub, siblingHash1)

    // Change the sibling's key
    const modified = [{ publicKeyB64: B64(0x99) }, { publicKeyB64: null }, nodes[2]]
    const siblingHash2 = await computeNodeSubtreeHash(modified, 0, 2)
    const ph2 = await computeParentHash(nodePub, siblingHash2)

    expect(Buffer.from(ph1)).not.toEqual(Buffer.from(ph2))
  })
})
