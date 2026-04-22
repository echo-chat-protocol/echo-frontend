/**
 * commitSigning.test.js
 *
 * Uses the real XEdDSA / X25519 WASM loaded synchronously via initSync so that
 * verify_signature actually validates cryptographic material instead of being
 * stubbed. This is the only file in the suite where the signing security
 * property is meaningfully exercised.
 */
import { webcrypto } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'

if (!globalThis.crypto) globalThis.crypto = webcrypto
if (!globalThis.atob) globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary')
if (!globalThis.btoa) globalThis.btoa = (bin) => Buffer.from(bin, 'binary').toString('base64')

// ── Real WASM mock ────────────────────────────────────────────────────────────
// We mock the package entry-point so Vitest does not attempt to fetch() the
// .wasm files, then hand back real function references from the sub-modules
// after initialising them synchronously with initSync.
vi.mock('@mascaro101/echo-protocol', async () => {
  const { readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')

  const xeddsa = await import('@mascaro101/echo-protocol/xeddsa.js')
  const x25519 = await import('@mascaro101/echo-protocol/x25519.js')

  xeddsa.initSync({
    module: readFileSync(resolve('node_modules/@mascaro101/echo-protocol/xeddsa_bg.wasm')),
  })
  x25519.initSync({
    module: readFileSync(resolve('node_modules/@mascaro101/echo-protocol/x25519_bg.wasm')),
  })

  return {
    default: vi.fn(async () => {}),
    // X25519 key utilities needed by generateLeafSigningKeypair
    generate_private_ephemeral_key: x25519.generate_private_ephemeral_key,
    generate_public_ephemeral_key: x25519.generate_public_ephemeral_key,
    hkdf_derive: x25519.hkdf_derive,
    // XEdDSA signing primitives
    derive_ed25519_keypair_from_x25519: xeddsa.derive_ed25519_keypair_from_x25519,
    convert_x25519_to_xeddsa: xeddsa.convert_x25519_to_xeddsa,
    compute_determenistic_nonce: xeddsa.compute_determenistic_nonce,
    compute_nonce_point: xeddsa.compute_nonce_point,
    compute_challenge_hash: xeddsa.compute_challenge_hash,
    compute_signature_scaler: xeddsa.compute_signature_scaler,
    compute_signature: xeddsa.compute_signature,
    verify_signature: xeddsa.verify_signature,
  }
})

const { base64ToBytes, bytesToBase64 } = await import('../../helpers.js')
const { generateLeafSigningKeypair, encodeCommitForSigning, signCommit, verifyCommit } =
  await import('../groupCrypto/commitSigning.js')

// ── Fixture builder ───────────────────────────────────────────────────────────

function makeCommit(overrides = {}) {
  return {
    groupId: 'group-test-1',
    epoch: 3,
    type: 'add',
    senderLeafIndex: 0,
    targetUserId: 'carol',
    leafCount: 3,
    senderSigningPubKeyB64: 'pubAlice==',
    roster: [
      { userId: 'alice', leafIndex: 0, leafSigningPubKeyB64: 'pubAlice==' },
      { userId: 'bob', leafIndex: 1, leafSigningPubKeyB64: 'pubBob==' },
    ],
    updatePath: [
      { nodeIndex: 0, publicKeyB64: 'node0pub==' },
      { nodeIndex: 1, publicKeyB64: 'node1pub==' },
    ],
    ...overrides,
  }
}

// ── generateLeafSigningKeypair ────────────────────────────────────────────────

describe('generateLeafSigningKeypair', () => {
  it('returns an object with leafSigningPrivKeyB64 and leafSigningPubKeyB64', async () => {
    const kp = await generateLeafSigningKeypair()
    expect(kp).toHaveProperty('leafSigningPrivKeyB64')
    expect(kp).toHaveProperty('leafSigningPubKeyB64')
  })

  it('both values are non-empty strings', async () => {
    const kp = await generateLeafSigningKeypair()
    expect(typeof kp.leafSigningPrivKeyB64).toBe('string')
    expect(typeof kp.leafSigningPubKeyB64).toBe('string')
    expect(kp.leafSigningPrivKeyB64.length).toBeGreaterThan(0)
    expect(kp.leafSigningPubKeyB64.length).toBeGreaterThan(0)
  })

  it('private key decodes to 32 bytes (X25519 scalar)', async () => {
    const kp = await generateLeafSigningKeypair()
    expect(base64ToBytes(kp.leafSigningPrivKeyB64)).toHaveLength(32)
  })

  it('public key decodes to 32 bytes (Ed25519 point derived from X25519)', async () => {
    const kp = await generateLeafSigningKeypair()
    expect(base64ToBytes(kp.leafSigningPubKeyB64)).toHaveLength(32)
  })

  it('successive calls produce distinct key material', async () => {
    const kp1 = await generateLeafSigningKeypair()
    const kp2 = await generateLeafSigningKeypair()
    expect(kp1.leafSigningPrivKeyB64).not.toBe(kp2.leafSigningPrivKeyB64)
    expect(kp1.leafSigningPubKeyB64).not.toBe(kp2.leafSigningPubKeyB64)
  })

  it('keypair can sign a commit and have it verified successfully', async () => {
    const kp = await generateLeafSigningKeypair()
    const commit = makeCommit()
    commit.signature = await signCommit(commit, kp.leafSigningPrivKeyB64)
    await expect(verifyCommit(commit, kp.leafSigningPubKeyB64)).resolves.toBeUndefined()
  })
})

// ── encodeCommitForSigning ────────────────────────────────────────────────────

describe('encodeCommitForSigning', () => {
  it('returns a non-empty Uint8Array', () => {
    const out = encodeCommitForSigning(makeCommit())
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out.length).toBeGreaterThan(0)
  })

  it('is deterministic: same logical commit → byte-identical output on repeated calls', () => {
    const commit = makeCommit()
    const a = encodeCommitForSigning(commit)
    const b = encodeCommitForSigning(commit)
    expect(Buffer.from(a)).toEqual(Buffer.from(b))
  })

  it('is stable under roster reordering: internal sort makes order irrelevant', () => {
    const fwd = makeCommit()
    const rev = makeCommit({ roster: [...fwd.roster].reverse() })
    expect(Buffer.from(encodeCommitForSigning(fwd))).toEqual(
      Buffer.from(encodeCommitForSigning(rev))
    )
  })

  // Table-driven: every field mutation must change the encoded bytes.
  const mutations = [
    ['type', { type: 'remove' }],
    ['epoch', { epoch: 99 }],
    ['senderLeafIndex', { senderLeafIndex: 2 }],
    ['senderSigningPubKeyB64', { senderSigningPubKeyB64: 'TAMPERED==' }],
    ['groupId', { groupId: 'different-group' }],
    ['targetUserId', { targetUserId: 'dave' }],
    ['leafCount', { leafCount: 7 }],
    [
      'roster userId',
      {
        roster: [
          { userId: 'mallory', leafIndex: 0, leafSigningPubKeyB64: 'pubAlice==' },
          { userId: 'bob', leafIndex: 1, leafSigningPubKeyB64: 'pubBob==' },
        ],
      },
    ],
    [
      'roster signing key',
      {
        roster: [
          { userId: 'alice', leafIndex: 0, leafSigningPubKeyB64: 'TAMPERED==' },
          { userId: 'bob', leafIndex: 1, leafSigningPubKeyB64: 'pubBob==' },
        ],
      },
    ],
    [
      'updatePath pubkey',
      {
        updatePath: [
          { nodeIndex: 0, publicKeyB64: 'TAMPERED==' },
          { nodeIndex: 1, publicKeyB64: 'node1pub==' },
        ],
      },
    ],
    [
      'updatePath nodeIndex',
      {
        updatePath: [
          { nodeIndex: 99, publicKeyB64: 'node0pub==' },
          { nodeIndex: 1, publicKeyB64: 'node1pub==' },
        ],
      },
    ],
  ]

  it.each(mutations)('changing %s produces different encoded bytes', (_label, overrides) => {
    const original = encodeCommitForSigning(makeCommit())
    const mutated = encodeCommitForSigning(makeCommit(overrides))
    expect(Buffer.from(original)).not.toEqual(Buffer.from(mutated))
  })

  it('handles undefined roster without throwing (treats as empty)', () => {
    expect(() => encodeCommitForSigning(makeCommit({ roster: undefined }))).not.toThrow()
  })

  it('handles null roster without throwing', () => {
    expect(() => encodeCommitForSigning(makeCommit({ roster: null }))).not.toThrow()
  })

  it('handles missing updatePath without throwing (treats as empty)', () => {
    expect(() => encodeCommitForSigning(makeCommit({ updatePath: undefined }))).not.toThrow()
  })

  it('empty roster and non-empty roster produce different bytes', () => {
    const empty = encodeCommitForSigning(makeCommit({ roster: [] }))
    const nonEmpty = encodeCommitForSigning(makeCommit())
    expect(Buffer.from(empty)).not.toEqual(Buffer.from(nonEmpty))
  })
})

// ── signCommit + verifyCommit ─────────────────────────────────────────────────

describe('signCommit + verifyCommit', () => {
  let kp

  beforeEach(async () => {
    kp = await generateLeafSigningKeypair()
  })

  it('valid signature resolves without throwing', async () => {
    const commit = makeCommit()
    commit.signature = await signCommit(commit, kp.leafSigningPrivKeyB64)
    await expect(verifyCommit(commit, kp.leafSigningPubKeyB64)).resolves.toBeUndefined()
  })

  it('signature is exactly 64 bytes (XEdDSA / Ed25519 format)', async () => {
    const commit = makeCommit()
    const sigB64 = await signCommit(commit, kp.leafSigningPrivKeyB64)
    expect(base64ToBytes(sigB64)).toHaveLength(64)
  })

  it('XEdDSA is deterministic: same key + same payload → identical signature', async () => {
    // XEdDSA uses a deterministic nonce derived from prefix + message,
    // so two calls with the same inputs must yield the same signature.
    const commit = makeCommit()
    const sig1 = await signCommit(commit, kp.leafSigningPrivKeyB64)
    const sig2 = await signCommit(commit, kp.leafSigningPrivKeyB64)
    expect(sig1).toBe(sig2)
  })

  it('signature created by a different keypair is rejected', async () => {
    const other = await generateLeafSigningKeypair()
    const commit = makeCommit()
    // Sign with 'other' but verify against kp — must fail.
    commit.signature = await signCommit(commit, other.leafSigningPrivKeyB64)
    await expect(verifyCommit(commit, kp.leafSigningPubKeyB64)).rejects.toThrow()
  })

  it('all-zero forged signature is rejected', async () => {
    const commit = makeCommit()
    commit.signature = bytesToBase64(new Uint8Array(64).fill(0x00))
    await expect(verifyCommit(commit, kp.leafSigningPubKeyB64)).rejects.toThrow()
  })

  it('arbitrary forged signature is rejected', async () => {
    const commit = makeCommit()
    commit.signature = bytesToBase64(new Uint8Array(64).fill(0xab))
    await expect(verifyCommit(commit, kp.leafSigningPubKeyB64)).rejects.toThrow()
  })

  // Table-driven: tampering any of these fields after signing must break verification.
  const payloadMutations = [
    ['type', { type: 'remove' }],
    ['epoch', { epoch: 999 }],
    ['senderLeafIndex', { senderLeafIndex: 5 }],
    ['senderSigningPubKeyB64', { senderSigningPubKeyB64: 'TAMPERED==' }],
    ['groupId', { groupId: 'evil-group' }],
    [
      'roster member',
      {
        roster: [
          { userId: 'mallory', leafIndex: 0, leafSigningPubKeyB64: 'evil==' },
          { userId: 'bob', leafIndex: 1, leafSigningPubKeyB64: 'pubBob==' },
        ],
      },
    ],
    [
      'updatePath publicKey',
      {
        updatePath: [{ nodeIndex: 0, publicKeyB64: 'injected==' }],
      },
    ],
  ]

  it.each(payloadMutations)(
    'modifying %s after signing invalidates the signature',
    async (_label, overrides) => {
      const original = makeCommit()
      original.signature = await signCommit(original, kp.leafSigningPrivKeyB64)
      const tampered = { ...original, ...overrides }
      await expect(verifyCommit(tampered, kp.leafSigningPubKeyB64)).rejects.toThrow()
    }
  )

  it('throws with explicit message when commit.signature is absent', async () => {
    const commit = makeCommit() // no .signature
    await expect(verifyCommit(commit, kp.leafSigningPubKeyB64)).rejects.toThrow(
      'Commit missing signature or signing pub key'
    )
  })

  it('throws with explicit message when senderSigningPubKeyB64 is null', async () => {
    const commit = makeCommit()
    commit.signature = await signCommit(commit, kp.leafSigningPrivKeyB64)
    await expect(verifyCommit(commit, null)).rejects.toThrow(
      'Commit missing signature or signing pub key'
    )
  })

  it('throws with explicit message when senderSigningPubKeyB64 is undefined', async () => {
    const commit = makeCommit()
    commit.signature = await signCommit(commit, kp.leafSigningPrivKeyB64)
    await expect(verifyCommit(commit, undefined)).rejects.toThrow(
      'Commit missing signature or signing pub key'
    )
  })
})
