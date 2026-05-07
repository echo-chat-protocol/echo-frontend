/**
 * treeState.test.js
 *
 * Direct unit tests for treeState.js. The only WASM dependency is
 * generate_public_ephemeral_key, which is mocked with a deterministic
 * function so tests remain fast and predictable without real crypto.
 */
import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.atob) globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
if (!globalThis.btoa) globalThis.btoa = (bin) => Buffer.from(bin, 'binary').toString('base64');

// Flip the MSB of the private key to produce a deterministic, distinct "public" key.
// This lets installOwnLeafPrivateKey and initTreeFromRoster complete without WASM init.
vi.mock('@mascaro101/echo-protocol', () => ({
  default: vi.fn(async () => {}),
  generate_public_ephemeral_key: vi.fn((priv) => {
    const pub = new Uint8Array(32);
    pub.set(new Uint8Array(priv).slice(0, 32));
    pub[0] ^= 0x80;
    return pub;
  }),
}));

const { base64ToBytes, bytesToBase64 } = await import('../../helpers.js');
const {
  normalizeRoster,
  findLeafIndexForUser,
  leafCountFromRoster,
  leafCountFromNodes,
  computeLeafCount,
  cloneNode,
  resizeNodes,
  makeTreeFromPublicNodes,
  installOwnLeafPrivateKey,
  initTreeFromRoster,
  blankNodeAndPath,
  installLeafPublicKeysFromMemberInitKeys,
} = await import('../groupCrypto/treeState.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

const B64 = (fill) => bytesToBase64(new Uint8Array(32).fill(fill));

// Build a tree-node object with both keys set to fill-byte values.
function filledNode(fill) {
  return { publicKeyB64: B64(fill), privateKeyB64: B64(fill ^ 0x10) };
}

// Build a blank (null) node.
function blankNode() {
  return { publicKeyB64: null, privateKeyB64: null };
}

// ── normalizeRoster ───────────────────────────────────────────────────────────

describe('normalizeRoster', () => {
  it('returns an empty array for non-array input', () => {
    expect(normalizeRoster(null)).toEqual([]);
    expect(normalizeRoster(undefined)).toEqual([]);
    expect(normalizeRoster('bad')).toEqual([]);
  });

  it('filters out members with empty or null userId', () => {
    const roster = [
      { userId: 'alice', leafIndex: 0 },
      { userId: '',      leafIndex: 1 },
      { userId: null,    leafIndex: 2 },
      { userId: 'bob',   leafIndex: 3 },
    ];
    const result = normalizeRoster(roster);
    expect(result.map((m) => m.userId)).toEqual(['alice', 'bob']);
  });

  it('sorts members by leafIndex ascending', () => {
    const roster = [
      { userId: 'bob',   leafIndex: 2 },
      { userId: 'alice', leafIndex: 0 },
      { userId: 'carol', leafIndex: 1 },
    ];
    const result = normalizeRoster(roster);
    expect(result.map((m) => m.userId)).toEqual(['alice', 'carol', 'bob']);
  });

  it('falls back to array index when leafIndex is missing', () => {
    const roster = [{ userId: 'alice' }, { userId: 'bob' }];
    const result = normalizeRoster(roster);
    expect(result[0].leafIndex).toBe(0);
    expect(result[1].leafIndex).toBe(1);
  });

  it('defaults username to "Member" when absent', () => {
    const result = normalizeRoster([{ userId: 'alice', leafIndex: 0 }]);
    expect(result[0].username).toBe('Member');
  });

  it('preserves a valid leafSigningPubKeyB64 string', () => {
    const roster = [{ userId: 'alice', leafIndex: 0, leafSigningPubKeyB64: 'AAAA==' }];
    const result = normalizeRoster(roster);
    expect(result[0].leafSigningPubKeyB64).toBe('AAAA==');
  });

  it('coerces missing or empty leafSigningPubKeyB64 to null', () => {
    const r1 = normalizeRoster([{ userId: 'alice', leafIndex: 0 }]);
    expect(r1[0].leafSigningPubKeyB64).toBeNull();

    const r2 = normalizeRoster([{ userId: 'alice', leafIndex: 0, leafSigningPubKeyB64: '' }]);
    expect(r2[0].leafSigningPubKeyB64).toBeNull();
  });
});

// ── findLeafIndexForUser ──────────────────────────────────────────────────────

describe('findLeafIndexForUser', () => {
  const ROSTER = [
    { userId: 'alice', leafIndex: 0 },
    { userId: 'bob',   leafIndex: 2 },
  ];

  it('returns the correct leafIndex for a known userId', () => {
    expect(findLeafIndexForUser(ROSTER, 'alice')).toBe(0);
    expect(findLeafIndexForUser(ROSTER, 'bob')).toBe(2);
  });

  it('returns null for an unknown userId', () => {
    expect(findLeafIndexForUser(ROSTER, 'carol')).toBeNull();
  });

  it('returns null for null / undefined userId', () => {
    expect(findLeafIndexForUser(ROSTER, null)).toBeNull();
    expect(findLeafIndexForUser(ROSTER, undefined)).toBeNull();
  });
});

// ── leafCountFromRoster / leafCountFromNodes / computeLeafCount ───────────────

describe('leafCountFromRoster', () => {
  it('returns 0 for an empty roster', () => {
    expect(leafCountFromRoster([])).toBe(0);
  });

  it('returns max(leafIndex) + 1', () => {
    const roster = [
      { userId: 'a', leafIndex: 0 },
      { userId: 'b', leafIndex: 3 },
    ];
    expect(leafCountFromRoster(roster)).toBe(4); // 3 + 1
  });

  it('accounts for an extra leaf index when supplied', () => {
    const roster = [{ userId: 'a', leafIndex: 0 }];
    expect(leafCountFromRoster(roster, 5)).toBe(6); // max(0,5)+1
  });
});

describe('leafCountFromNodes', () => {
  it('returns 0 for an empty or non-array input', () => {
    expect(leafCountFromNodes([])).toBe(0);
    expect(leafCountFromNodes(null)).toBe(0);
  });

  it('computes (length+1)/2 rounded down', () => {
    // 3 nodes → 2 leaves (2n-1=3 → n=2)
    expect(leafCountFromNodes(new Array(3))).toBe(2);
    // 7 nodes → 4 leaves
    expect(leafCountFromNodes(new Array(7))).toBe(4);
    // 1 node → 1 leaf
    expect(leafCountFromNodes(new Array(1))).toBe(1);
  });
});

describe('computeLeafCount', () => {
  it('returns the maximum of roster-derived and node-derived counts', () => {
    const roster    = [{ userId: 'a', leafIndex: 0 }, { userId: 'b', leafIndex: 1 }];
    const treeNodes = new Array(7); // implies 4 leaves
    // roster says 2 leaves, nodes say 4 → max = 4
    expect(computeLeafCount({ roster, treeNodes })).toBe(4);
  });

  it('uses the roster count when it dominates', () => {
    const roster    = [{ userId: 'a', leafIndex: 0 }, { userId: 'b', leafIndex: 3 }]; // 4 leaves
    const treeNodes = new Array(1); // 1 node → 1 leaf
    expect(computeLeafCount({ roster, treeNodes })).toBe(4);
  });
});

// ── cloneNode / resizeNodes ───────────────────────────────────────────────────

describe('cloneNode', () => {
  it('preserves valid string keys', () => {
    const node   = { publicKeyB64: 'pub==', privateKeyB64: 'priv==' };
    const cloned = cloneNode(node);
    expect(cloned.publicKeyB64).toBe('pub==');
    expect(cloned.privateKeyB64).toBe('priv==');
  });

  it('coerces missing or non-string keys to null', () => {
    expect(cloneNode({}).publicKeyB64).toBeNull();
    expect(cloneNode({}).privateKeyB64).toBeNull();
    expect(cloneNode({ publicKeyB64: 42 }).publicKeyB64).toBeNull();
  });

  it('coerces empty-string keys to null', () => {
    expect(cloneNode({ publicKeyB64: '' }).publicKeyB64).toBeNull();
  });
});

describe('resizeNodes', () => {
  it('produces an array of exactly the requested width', () => {
    const result = resizeNodes([], 5);
    expect(result).toHaveLength(5);
  });

  it('copies existing nodes up to the new width', () => {
    const nodes  = [filledNode(0x01), filledNode(0x02)];
    const result = resizeNodes(nodes, 4);
    expect(result[0].publicKeyB64).toBe(nodes[0].publicKeyB64);
    expect(result[1].publicKeyB64).toBe(nodes[1].publicKeyB64);
  });

  it('fills new slots beyond the original length with null keys', () => {
    const result = resizeNodes([], 3);
    result.forEach((n) => {
      expect(n.publicKeyB64).toBeNull();
      expect(n.privateKeyB64).toBeNull();
    });
  });

  it('truncates when the new width is smaller than the existing length', () => {
    const nodes  = [filledNode(1), filledNode(2), filledNode(3)];
    const result = resizeNodes(nodes, 2);
    expect(result).toHaveLength(2);
    expect(result[0].publicKeyB64).toBe(nodes[0].publicKeyB64);
  });
});

// ── makeTreeFromPublicNodes ───────────────────────────────────────────────────

describe('makeTreeFromPublicNodes', () => {
  it('maps each public key into the correct array slot', () => {
    const pubs   = ['pubA==', null, 'pubB=='];
    const result = makeTreeFromPublicNodes(pubs);
    expect(result[0].publicKeyB64).toBe('pubA==');
    expect(result[1].publicKeyB64).toBeNull();
    expect(result[2].publicKeyB64).toBe('pubB==');
  });

  it('all private keys are null (public nodes carry no private key)', () => {
    const result = makeTreeFromPublicNodes(['pubA==', 'pubB==']);
    result.forEach((n) => expect(n.privateKeyB64).toBeNull());
  });

  it('merges private keys from currentNodes at the same index', () => {
    const pubs    = ['pubA==', 'pubB=='];
    const current = [{ publicKeyB64: 'oldPubA==', privateKeyB64: 'privA==' }, blankNode()];
    const result  = makeTreeFromPublicNodes(pubs, current);
    // Public key is overwritten from pubs; private key is carried over.
    expect(result[0].publicKeyB64).toBe('pubA==');
    expect(result[0].privateKeyB64).toBe('privA==');
    expect(result[1].privateKeyB64).toBeNull();
  });

  it('returns an empty array for non-array input', () => {
    expect(makeTreeFromPublicNodes(null)).toEqual([]);
    expect(makeTreeFromPublicNodes(undefined)).toEqual([]);
  });
});

// ── installOwnLeafPrivateKey ──────────────────────────────────────────────────

describe('installOwnLeafPrivateKey', () => {
  it('places private key and derived public key at leafNode(selfLeafIndex)', () => {
    const priv    = new Uint8Array(32).fill(0x11);
    const privB64 = bytesToBase64(priv);
    // leafNode(1) = 2 in a 4-leaf tree
    const nodes = Array.from({ length: 7 }, blankNode);

    installOwnLeafPrivateKey(nodes, 1, privB64);

    expect(nodes[2].privateKeyB64).toBe(privB64);
    expect(nodes[2].publicKeyB64).not.toBeNull();
    // The mock flips bit 7 of byte 0 to derive pub from priv.
    const expectedPub = new Uint8Array(priv);
    expectedPub[0] ^= 0x80;
    expect(nodes[2].publicKeyB64).toBe(bytesToBase64(expectedPub));
  });

  it('does not mutate any other nodes', () => {
    const nodes = Array.from({ length: 7 }, blankNode);
    installOwnLeafPrivateKey(nodes, 0, B64(0x22));
    // leafNode(0) = 0; all others stay blank.
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i].privateKeyB64).toBeNull();
    }
  });

  it('returns without mutating when selfLeafIndex is not an integer', () => {
    const nodes = Array.from({ length: 7 }, blankNode);
    installOwnLeafPrivateKey(nodes, null, B64(0x01));
    installOwnLeafPrivateKey(nodes, 'x',  B64(0x01));
    nodes.forEach((n) => expect(n.privateKeyB64).toBeNull());
  });

  it('returns without mutating when privKeyB64 is not a non-empty string', () => {
    const nodes = Array.from({ length: 7 }, blankNode);
    installOwnLeafPrivateKey(nodes, 0, '');
    installOwnLeafPrivateKey(nodes, 0, null);
    nodes.forEach((n) => expect(n.privateKeyB64).toBeNull());
  });

  it('returns without mutating when nodeIndex is out of bounds', () => {
    const nodes = Array.from({ length: 1 }, blankNode);
    // leafNode(5) = 10, which is >= nodes.length
    installOwnLeafPrivateKey(nodes, 5, B64(0x01));
    expect(nodes[0].privateKeyB64).toBeNull();
  });
});

// ── initTreeFromRoster ────────────────────────────────────────────────────────

describe('initTreeFromRoster', () => {
  const ALICE_PRIV = B64(0x01);
  const BOB_PUB    = B64(0x02);

  it('returns a node array of width nodeWidth(leafCount)', async () => {
    const roster = [
      { userId: 'alice', leafIndex: 0 },
      { userId: 'bob',   leafIndex: 1 },
    ];
    const nodes = await initTreeFromRoster(roster, 0, ALICE_PRIV, []);
    // 2 leaves → 3 nodes
    expect(nodes).toHaveLength(3);
  });

  it('places self private key at the correct leaf node (leafNode(selfLeafIndex))', async () => {
    const roster = [
      { userId: 'alice', leafIndex: 0 },
      { userId: 'bob',   leafIndex: 1 },
    ];
    const nodes = await initTreeFromRoster(roster, 0, ALICE_PRIV, []);
    // leafNode(0) = 0
    expect(nodes[0].privateKeyB64).toBe(ALICE_PRIV);
    expect(nodes[0].publicKeyB64).not.toBeNull();
  });

  it('installs member public init keys at correct leaf nodes', async () => {
    const roster = [
      { userId: 'alice', leafIndex: 0 },
      { userId: 'bob',   leafIndex: 1 },
    ];
    const memberInitKeys = [{ userId: 'bob', initKeyB64: BOB_PUB }];
    const nodes = await initTreeFromRoster(roster, 0, ALICE_PRIV, memberInitKeys);
    // leafNode(1) = 2
    expect(nodes[2].publicKeyB64).toBe(BOB_PUB);
    expect(nodes[2].privateKeyB64).toBeNull();
  });

  it('leaves a member leaf blank when no init key is available for them', async () => {
    const roster = [
      { userId: 'alice', leafIndex: 0 },
      { userId: 'bob',   leafIndex: 1 },
    ];
    const nodes = await initTreeFromRoster(roster, 0, ALICE_PRIV, []); // no init keys
    // leafNode(1) = 2 → should remain blank
    expect(nodes[2].publicKeyB64).toBeNull();
  });

  it('internal nodes are blank after construction (no keys derived yet)', async () => {
    const roster = [
      { userId: 'alice', leafIndex: 0 },
      { userId: 'bob',   leafIndex: 1 },
    ];
    const nodes = await initTreeFromRoster(roster, 0, ALICE_PRIV, []);
    // node index 1 is the only internal node in a 2-leaf tree
    expect(nodes[1].publicKeyB64).toBeNull();
  });
});

// ── blankNodeAndPath ──────────────────────────────────────────────────────────

describe('blankNodeAndPath', () => {
  //
  // 4-leaf tree layout (indices 0..6):
  //   leaves:   node 0 (leaf 0), node 2 (leaf 1), node 4 (leaf 2), node 6 (leaf 3)
  //   internal: node 1 (parent of 0,2), node 5 (parent of 4,6), node 3 (root)
  //

  it('blanks the target leaf node and every ancestor on its direct path to root', () => {
    // Leaf 0: leafNode(0)=0, directPath(0,4)=[1,3]
    const nodes = Array.from({ length: 7 }, (_, i) => filledNode(i));
    blankNodeAndPath(nodes, 0, 4);

    expect(nodes[0].publicKeyB64).toBeNull(); // leaf 0
    expect(nodes[1].publicKeyB64).toBeNull(); // ancestor
    expect(nodes[3].publicKeyB64).toBeNull(); // root (ancestor)
  });

  it('preserves all nodes not on the target leaf path', () => {
    const nodes = Array.from({ length: 7 }, (_, i) => filledNode(i));
    blankNodeAndPath(nodes, 0, 4);

    // Leaf 1 (node 2), leaf 2 (node 4), leaf 3 (node 6), node 5 should be untouched.
    expect(nodes[2].publicKeyB64).not.toBeNull();
    expect(nodes[4].publicKeyB64).not.toBeNull();
    expect(nodes[5].publicKeyB64).not.toBeNull();
    expect(nodes[6].publicKeyB64).not.toBeNull();
  });

  it('blanks the correct nodes for a non-zero leaf index', () => {
    // Leaf 2: leafNode(2)=4, directPath(4,4)=[5,3]
    const nodes = Array.from({ length: 7 }, (_, i) => filledNode(i));
    blankNodeAndPath(nodes, 2, 4);

    expect(nodes[4].publicKeyB64).toBeNull(); // leaf 2
    expect(nodes[5].publicKeyB64).toBeNull(); // ancestor
    expect(nodes[3].publicKeyB64).toBeNull(); // root

    // Unrelated nodes stay filled.
    expect(nodes[0].publicKeyB64).not.toBeNull();
    expect(nodes[1].publicKeyB64).not.toBeNull();
    expect(nodes[2].publicKeyB64).not.toBeNull();
    expect(nodes[6].publicKeyB64).not.toBeNull();
  });

  it('also blanks privateKeyB64 on all affected nodes', () => {
    const nodes = Array.from({ length: 7 }, (_, i) => filledNode(i));
    blankNodeAndPath(nodes, 0, 4);
    [0, 1, 3].forEach((idx) => expect(nodes[idx].privateKeyB64).toBeNull());
  });

  it('returns without mutating when leafIndex is not an integer', () => {
    const nodes    = Array.from({ length: 7 }, (_, i) => filledNode(i));
    const snapshot = nodes.map((n) => ({ ...n }));
    blankNodeAndPath(nodes, null, 4);
    blankNodeAndPath(nodes, 'x',  4);
    nodes.forEach((n, i) => {
      expect(n.publicKeyB64).toBe(snapshot[i].publicKeyB64);
    });
  });
});

// ── installLeafPublicKeysFromMemberInitKeys ───────────────────────────────────

describe('installLeafPublicKeysFromMemberInitKeys', () => {
  const ROSTER = [
    { userId: 'alice', leafIndex: 0 },
    { userId: 'bob',   leafIndex: 1 },
    { userId: 'carol', leafIndex: 2 },
  ];

  it('installs a public key into the correct leaf node for each member with an init key', () => {
    const nodes = Array.from({ length: 5 }, blankNode); // 3 leaves → 5 nodes
    const memberInitKeys = [
      { userId: 'alice', initKeyB64: B64(0xA1) },
      { userId: 'carol', initKeyB64: B64(0xC1) },
    ];

    installLeafPublicKeysFromMemberInitKeys(nodes, ROSTER, memberInitKeys);

    // leafNode(0)=0 (alice), leafNode(1)=2 (bob), leafNode(2)=4 (carol)
    expect(nodes[0].publicKeyB64).toBe(B64(0xA1));
    expect(nodes[4].publicKeyB64).toBe(B64(0xC1));
  });

  it('leaves a node blank when no init key exists for that member', () => {
    const nodes = Array.from({ length: 5 }, blankNode);
    installLeafPublicKeysFromMemberInitKeys(nodes, ROSTER, [
      { userId: 'alice', initKeyB64: B64(0xA1) },
      // bob intentionally omitted
    ]);
    expect(nodes[2].publicKeyB64).toBeNull(); // bob's leaf
  });

  it('does not overwrite an existing privateKeyB64 when installing a public key', () => {
    const nodes = Array.from({ length: 5 }, blankNode);
    nodes[0] = { publicKeyB64: null, privateKeyB64: B64(0xFF) }; // alice already has privKey

    installLeafPublicKeysFromMemberInitKeys(nodes, ROSTER, [
      { userId: 'alice', initKeyB64: B64(0xA1) },
    ]);

    expect(nodes[0].publicKeyB64).toBe(B64(0xA1));
    expect(nodes[0].privateKeyB64).toBe(B64(0xFF)); // preserved
  });

  it('does not mutate unrelated node slots (internal nodes remain blank)', () => {
    const nodes = Array.from({ length: 5 }, blankNode);
    installLeafPublicKeysFromMemberInitKeys(nodes, ROSTER, [
      { userId: 'alice', initKeyB64: B64(0xA1) },
    ]);
    // Internal node at index 1 must be untouched.
    expect(nodes[1].publicKeyB64).toBeNull();
  });

  it('handles an empty memberInitKeys array without throwing', () => {
    const nodes = Array.from({ length: 5 }, blankNode);
    expect(() =>
      installLeafPublicKeysFromMemberInitKeys(nodes, ROSTER, []),
    ).not.toThrow();
  });

  it('skips entries in memberInitKeys that have no valid initKeyB64', () => {
    const nodes = Array.from({ length: 5 }, blankNode);
    installLeafPublicKeysFromMemberInitKeys(nodes, ROSTER, [
      { userId: 'alice', initKeyB64: '' },     // empty string → skip
      { userId: 'bob',   initKeyB64: null },   // null → skip
    ]);
    nodes.forEach((n) => expect(n.publicKeyB64).toBeNull());
  });
});
