/**
 * protocol.adversarial.group.test.js
 *
 * Adversarial / security regression tests for the group cryptographic state machine.
 *
 * CONTRACT: every test in this file asserts that the IMPLEMENTATION correctly
 * rejects malformed, replayed, tampered, or out-of-order inputs.
 * If any test fails → the implementation is broken, not the test.
 * Do not adjust expectations to make tests pass; fix the implementation.
 *
 * Tests labelled [BUG #N] document a known vulnerability that has NOT yet been
 * patched. They WILL FAIL until the corresponding fix is applied. Do not remove
 * or skip them — they are the acceptance criteria for each fix.
 */

import { Buffer } from 'node:buffer'
import { webcrypto, createCipheriv, createDecipheriv } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

if (!globalThis.crypto) globalThis.crypto = webcrypto
if (!globalThis.atob) globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary')
if (!globalThis.btoa) globalThis.btoa = (bin) => Buffer.from(bin, 'binary').toString('base64')

// ─── internal helpers (defined before vi.mock so factories can close over them) ─

function encodeText(value) {
  return new TextEncoder().encode(value)
}

function deriveBytes(length, ...parts) {
  const out = new Uint8Array(length)
  const sources = parts.map((p) => (p instanceof Uint8Array ? p : new Uint8Array(p)))
  for (let i = 0; i < length; i++) {
    let v = i
    for (const s of sources) v = (v + (s[i % s.length] || 0)) & 0xff
    out[i] = v
  }
  return out
}

function omitKey(object, key) {
  return Object.fromEntries(Object.entries(object).filter(([entryKey]) => entryKey !== key))
}

// ─── @mascaro101/echo-protocol mock ──────────────────────────────────────────
//
// Real AES-256-GCM via Node.js crypto so AEAD authentication actually fires.
// X25519 DH stubbed as XOR so pub == priv (init-key bytes serve as both).
// XEdDSA stubbed; verify_signature returns true by default so the happy path
// runs end-to-end. Individual tests override it with mockReturnValueOnce(false).

vi.mock('@mascaro101/echo-protocol', () => {
  const gcmEncrypt = (pt, key, nonce, aad) => {
    const c = createCipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce))
    c.setAAD(Buffer.from(aad))
    const enc = Buffer.concat([c.update(Buffer.from(pt)), c.final()])
    return new Uint8Array(Buffer.concat([enc, c.getAuthTag()]))
  }

  const gcmDecrypt = (ct, key, nonce, aad) => {
    const buf = Buffer.from(ct)
    const d = createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce))
    d.setAAD(Buffer.from(aad))
    d.setAuthTag(buf.subarray(buf.length - 16))
    return new Uint8Array(Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]))
  }

  const db = (len, ...parts) => {
    const out = new Uint8Array(len)
    const srcs = parts.map((p) => (p instanceof Uint8Array ? p : new Uint8Array(p)))
    for (let i = 0; i < len; i++) {
      let v = i
      for (const s of srcs) v = (v + (s[i % s.length] || 0)) & 0xff
      out[i] = v
    }
    return out
  }

  return {
    default: vi.fn(async () => {}),
    encrypt_aad_bytes: vi.fn((pt, key, nonce, aad) => gcmEncrypt(pt, key, nonce, aad)),
    decrypt_aad_bytes: vi.fn((ct, key, nonce, aad) => gcmDecrypt(ct, key, nonce, aad)),
    diffie_hellman: vi.fn((a, b) => new Uint8Array(32).map((_, i) => a[i] ^ b[i])),
    generate_private_ephemeral_key: vi.fn((rand) => new Uint8Array(rand).slice(0, 32)),
    generate_public_ephemeral_key: vi.fn((priv) => new Uint8Array(priv).slice(0, 32)),
    hkdf_derive: vi.fn((ikm, _s, info, len) => db(len, new Uint8Array(ikm), new Uint8Array(info))),
    hkdf_extract: vi.fn((salt, ikm) => db(32, new Uint8Array(salt), new Uint8Array(ikm))),
    hkdf_expand: vi.fn((prk, info, len) => db(len, new Uint8Array(prk), new Uint8Array(info))),
    derive_ed25519_keypair_from_x25519: vi.fn((priv) => new Uint8Array(priv).slice(0, 32)),
    convert_x25519_to_xeddsa: vi.fn((priv) => {
      const b = new Uint8Array(64)
      b.set(new Uint8Array(priv).slice(0, 32), 0)
      b.set(new Uint8Array(priv).slice(0, 32), 32)
      return b
    }),
    compute_determenistic_nonce: vi.fn((prefix, msg) =>
      db(32, new Uint8Array(prefix), new Uint8Array(msg))
    ),
    compute_nonce_point: vi.fn((nonce) => new Uint8Array(nonce).slice(0, 32)),
    compute_challenge_hash: vi.fn((R, A, M) =>
      db(32, new Uint8Array(R), new Uint8Array(A), new Uint8Array(M))
    ),
    compute_signature_scaler: vi.fn((n, c, s) =>
      db(32, new Uint8Array(n), new Uint8Array(c), new Uint8Array(s))
    ),
    compute_signature: vi.fn((R, s) => {
      const sig = new Uint8Array(64)
      sig.set(new Uint8Array(R).slice(0, 32), 0)
      sig.set(new Uint8Array(s).slice(0, 32), 32)
      return sig
    }),
    verify_signature: vi.fn(() => true),
  }
})

// ─── keySchedule mock ─────────────────────────────────────────────────────────
// Deterministic so any two callers with the same inputs produce identical secrets.

vi.mock('../keySchedule.js', () => ({
  advanceEpoch: vi.fn(async ({ initSecret, commitSecret, groupId, epoch }) => {
    const joinerSecret = deriveBytes(32, initSecret, commitSecret, encodeText('joiner'))
    const epochSecret = deriveBytes(32, joinerSecret, encodeText(`${groupId}|${epoch}|epoch`))
    return {
      epochSecret,
      applicationSecret: deriveBytes(32, epochSecret, encodeText('encryption')),
      senderDataSecret: deriveBytes(32, epochSecret, encodeText('sender_data')),
      externalSecret: deriveBytes(32, epochSecret, encodeText('external')),
      nextInitSecret: deriveBytes(32, epochSecret, encodeText('init')),
    }
  }),
  deriveEpochSecrets: vi.fn(async (joinerSecret, { groupId, epoch }) => {
    const epochSecret = deriveBytes(32, joinerSecret, encodeText(`${groupId}|${epoch}|epoch`))
    return {
      epochSecret,
      applicationSecret: deriveBytes(32, epochSecret, encodeText('encryption')),
      senderDataSecret: deriveBytes(32, epochSecret, encodeText('sender_data')),
      externalSecret: deriveBytes(32, epochSecret, encodeText('external')),
      nextInitSecret: deriveBytes(32, epochSecret, encodeText('init')),
    }
  }),
  deriveJoinerSecret: vi.fn(async (initSecret, commitSecret) =>
    deriveBytes(32, initSecret, commitSecret, encodeText('joiner'))
  ),
  deriveWelcomeSecret: vi.fn(async (joinerSecret) =>
    deriveBytes(32, joinerSecret, encodeText('welcome'))
  ),
  deriveWelcomeKeyAndNonce: vi.fn(async (welcomeSecret) => ({
    key: deriveBytes(32, welcomeSecret, encodeText('key')),
    nonce: deriveBytes(12, welcomeSecret, encodeText('nonce')),
  })),
  deriveSecret: vi.fn(async (secret, label) => deriveBytes(32, secret, encodeText(label))),
  expandWithLabel: vi.fn(async (secret, label, ctx, len) =>
    deriveBytes(len, secret, encodeText(label), ctx)
  ),
  deriveAppKeyAndNonce: vi.fn(async (appSec, leaf, gen) => ({
    key: deriveBytes(32, appSec, encodeText(`key|${leaf}|${gen}`)),
    nonce: deriveBytes(12, appSec, encodeText(`nonce|${leaf}|${gen}`)),
  })),
  ratchetAppSecret: vi.fn(async (appSec, leaf, gen) =>
    deriveBytes(32, appSec, encodeText(`secret|${leaf}|${gen}`))
  ),
  computeConfirmationTag: vi.fn(async (epochSecret, thBytes) =>
    deriveBytes(32, epochSecret, thBytes, encodeText('confirm'))
  ),
  verifyConfirmationTag: vi.fn(async () => {}),
  deriveSenderDataKeyAndNonce: vi.fn(async (senderDataSecret, ciphertextPrefix4) => {
    const ctx = new Uint8Array(ciphertextPrefix4).slice(0, 4)
    return {
      key: deriveBytes(32, senderDataSecret, encodeText('key'), ctx),
      nonce: deriveBytes(12, senderDataSecret, encodeText('nonce'), ctx),
    }
  }),
}))

// ─── EncryptedLocalDatabase mock (in-memory) ──────────────────────────────────

const _eldStore = new Map()

vi.mock('../../../../../../utils/storage/EncryptedLocalDatabase', () => ({
  default: {
    isUnlocked: vi.fn(() => true),
    storeMlsGroupState: vi.fn(async (id, rec) => {
      _eldStore.set(id, rec)
    }),
    getMlsGroupState: vi.fn(async (id) => _eldStore.get(id) ?? null),
  },
}))

// ─── module imports (after mocks) ─────────────────────────────────────────────

const { base64ToBytes, bytesToBase64 } = await import('../../helpers.js')
const protocol = await import('@mascaro101/echo-protocol')
const {
  applyCommit,
  buildAddCommit,
  buildInitialWelcomes,
  buildRemoveCommit,
  createNewGroupState,
  processWelcome,
} = await import('../groupCryptoProvider.js')
const { generateKeyPackage } = await import('../groupCrypto/keyPackage.js')
const { deriveWelcomeKeyAndNonce, deriveWelcomeSecret } = await import('../keySchedule.js')
const { makeCommitAadBytes, unwrapGroupKey } = await import('../groupCrypto/pathSecrets.js')
const { encodeCommitForSigning, encodeWelcomeForSigning, signCommit, signWelcome } =
  await import('../groupCrypto/commitSigning.js')

// ─── fixtures ─────────────────────────────────────────────────────────────────

const ALICE_KEY = bytesToBase64(new Uint8Array(32).fill(0x01))
const BOB_KEY = bytesToBase64(new Uint8Array(32).fill(0x02))
const CAROL_KEY = bytesToBase64(new Uint8Array(32).fill(0x03))

// Adding a member now requires a full signed KeyPackage (signing pubkey +
// credential). Mint a real one for Carol and carry her identity on the
// `newMember` object passed to buildAddCommit.
const CIPHER_SUITE = 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256'
const { keyPackage: CAROL_KP } = await generateKeyPackage({
  userId: 'carol',
  initKeyB64: CAROL_KEY,
  cipherSuite: CIPHER_SUITE,
})
const CAROL_MEMBER = {
  userId: 'carol',
  username: 'Carol',
  leafIndex: 2,
  leafSigningPubKeyB64: CAROL_KP.leafSigningPubKeyB64,
  credential: CAROL_KP.credential,
}
const MALLORY_KEY = bytesToBase64(new Uint8Array(32).fill(0xff))

const ALICE_BOB_ROSTER = [
  { userId: 'alice', username: 'Alice', leafIndex: 0 },
  { userId: 'bob', username: 'Bob', leafIndex: 1 },
]

const ALICE_BOB_INIT_KEYS = [
  { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
  { userId: 'bob', leafIndex: 1, initKeyB64: BOB_KEY },
]

const ALL_INIT_KEYS = [
  { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
  { userId: 'bob', leafIndex: 1, initKeyB64: BOB_KEY },
  { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
]

// Static commit object used by the encodeCommitForSigning unit tests.
// Kept separate from the full pipeline to ensure these tests stay pure and fast.
const BASE_COMMIT_OBJ = Object.freeze({
  groupId: 'test-group',
  epoch: 1,
  type: 'add',
  senderLeafIndex: 0,
  senderSigningPubKeyB64: 'YWxpY2U=',
  targetUserId: 'carol',
  leafCount: 4,
  roster: [
    { userId: 'alice', leafIndex: 0, leafSigningPubKeyB64: 'YWxpY2U=' },
    { userId: 'carol', leafIndex: 2, leafSigningPubKeyB64: 'Y2Fyb2w=' },
  ],
  updatePath: [
    { nodeIndex: 0, publicKeyB64: 'cHViMA==' },
    { nodeIndex: 4, publicKeyB64: 'cHViNA==' },
  ],
  treePublicNodes: ['YWxpY2U=', null, 'Y2Fyb2w=', null, 'cGFyZW50'],
})

// ─── helpers ──────────────────────────────────────────────────────────────────

async function epoch0(groupId) {
  const aliceState = await createNewGroupState({
    groupId,
    creatorUserId: 'alice',
    roster: ALICE_BOB_ROSTER,
    memberInitKeys: ALICE_BOB_INIT_KEYS,
  })

  const [bobWelcome] = await buildInitialWelcomes({
    creatorState: aliceState,
    roster: ALICE_BOB_ROSTER,
    memberInitKeys: [{ userId: 'bob', leafIndex: 1, initKeyB64: BOB_KEY }],
  })

  const bobState = await processWelcome({
    welcome: bobWelcome,
    selfUserId: 'bob',
    myInitPrivKeyB64: BOB_KEY,
  })

  return { aliceState, bobState, bobWelcome }
}

async function addCarolCommit(aliceState) {
  return buildAddCommit({
    state: aliceState,
    newMember: CAROL_MEMBER,
    memberInitKeys: ALL_INIT_KEYS,
  })
}

// Convenience: encode a commit to hex for byte-level comparison.
const toHex = (commit) => Buffer.from(encodeCommitForSigning(commit)).toString('hex')
const corruptBase64 = (value) => `${value.slice(0, -4)}AAAA`

async function readWelcomeGroupInfo(welcome, myInitPrivKeyB64) {
  const aadBytes = makeCommitAadBytes(welcome.groupId, welcome.epoch)
  const groupSecretsRaw = await unwrapGroupKey(
    welcome.encryptedGroupSecrets,
    myInitPrivKeyB64,
    aadBytes
  )
  const groupSecretsText = new TextDecoder('utf-8', { fatal: true }).decode(
    base64ToBytes(groupSecretsRaw)
  )
  const { joinerSecretB64 } = JSON.parse(groupSecretsText)
  const joinerSecret = base64ToBytes(joinerSecretB64)
  const welcomeSecret = await deriveWelcomeSecret(joinerSecret)
  const { key, nonce } = await deriveWelcomeKeyAndNonce(welcomeSecret)
  const encryptedGroupInfo = base64ToBytes(welcome.encryptedGroupInfo.encryptedB64)
  const groupInfoBytes = protocol.decrypt_aad_bytes(
    encryptedGroupInfo,
    key,
    nonce,
    new Uint8Array(0)
  )
  const groupInfo = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(groupInfoBytes))
  return { groupInfo, key, nonce }
}

async function tamperWelcomeGroupInfo({
  welcome,
  myInitPrivKeyB64,
  mutateGroupInfo,
  signerPrivKeyB64,
}) {
  const { groupInfo, key, nonce } = await readWelcomeGroupInfo(welcome, myInitPrivKeyB64)
  const mutatedGroupInfo = mutateGroupInfo(JSON.parse(JSON.stringify(groupInfo)))
  const encryptedGroupInfo = protocol.encrypt_aad_bytes(
    new TextEncoder().encode(JSON.stringify(mutatedGroupInfo)),
    key,
    nonce,
    new Uint8Array(0)
  )
  const tampered = {
    ...welcome,
    encryptedGroupInfo: {
      ...welcome.encryptedGroupInfo,
      encryptedB64: bytesToBase64(encryptedGroupInfo),
    },
  }
  if (signerPrivKeyB64) {
    tampered.signature = await signWelcome(tampered, signerPrivKeyB64)
  }
  return tampered
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  _eldStore.clear()
})

// ══════════════════════════════════════════════════════════════════════════════
// 1. applyCommit — epoch validation
//
// The state machine must accept ONLY epoch = currentEpoch + 1.
// Any other value (same, past, skipped-ahead, non-integer) is an attack vector.
// ══════════════════════════════════════════════════════════════════════════════

describe('applyCommit — epoch validation', () => {
  it('accepts a commit whose epoch is exactly currentEpoch + 1', async () => {
    const { aliceState, bobState } = await epoch0('ep-valid')
    const { commit } = await addCarolCommit(aliceState)
    await expect(
      applyCommit({ state: bobState, commit, myInitPrivKeyB64: BOB_KEY })
    ).resolves.not.toThrow()
  })

  it('rejects a commit that skips epochs (currentEpoch + 5)', async () => {
    const { aliceState, bobState } = await epoch0('ep-skip')
    const { commit } = await addCarolCommit(aliceState)
    const skipped = { ...commit, epoch: bobState.epoch + 5 }
    await expect(
      applyCommit({ state: bobState, commit: skipped, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow('Invalid commit epoch')
  })

  it('rejects a commit with the same epoch as the current state', async () => {
    const { aliceState, bobState } = await epoch0('ep-same')
    const { commit } = await addCarolCommit(aliceState)
    const stale = { ...commit, epoch: bobState.epoch }
    await expect(
      applyCommit({ state: bobState, commit: stale, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow('Invalid commit epoch')
  })

  it('rejects a commit from a past epoch (currentEpoch - 1)', async () => {
    const { aliceState, bobState } = await epoch0('ep-past')
    const { commit } = await addCarolCommit(aliceState)
    const past = { ...commit, epoch: bobState.epoch - 1 }
    await expect(
      applyCommit({ state: bobState, commit: past, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow('Invalid commit epoch')
  })

  it('rejects a non-integer epoch (float)', async () => {
    const { aliceState, bobState } = await epoch0('ep-float')
    const { commit } = await addCarolCommit(aliceState)
    await expect(
      applyCommit({ state: bobState, commit: { ...commit, epoch: 1.5 }, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow()
  })

  it('rejects a null epoch', async () => {
    const { aliceState, bobState } = await epoch0('ep-null')
    const { commit } = await addCarolCommit(aliceState)
    await expect(
      applyCommit({
        state: bobState,
        commit: { ...commit, epoch: null },
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })

  it('rejects a string epoch even if the numeric value is correct', async () => {
    const { aliceState, bobState } = await epoch0('ep-string')
    const { commit } = await addCarolCommit(aliceState)
    await expect(
      applyCommit({
        state: bobState,
        commit: { ...commit, epoch: String(bobState.epoch + 1) },
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })

  it('rejects a replay of the same valid commit applied a second time', async () => {
    const { aliceState, bobState } = await epoch0('ep-replay')
    const { commit } = await addCarolCommit(aliceState)

    // First application must succeed and advance the state.
    const advancedState = await applyCommit({
      state: bobState,
      commit,
      myInitPrivKeyB64: BOB_KEY,
    })

    // Second application of the SAME commit against the now-advanced state must fail.
    // (commit.epoch === 1, advancedState.epoch === 1 → epoch check rejects)
    await expect(
      applyCommit({ state: advancedState, commit, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow('Invalid commit epoch')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. applyCommit — structural validation
// ══════════════════════════════════════════════════════════════════════════════

describe('applyCommit — structural validation', () => {
  it('rejects a null commit', async () => {
    const { bobState } = await epoch0('struct-null')
    await expect(
      applyCommit({ state: bobState, commit: null, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow()
  })

  it('rejects a commit with roster omitted', async () => {
    const { aliceState, bobState } = await epoch0('struct-no-roster')
    const { commit } = await addCarolCommit(aliceState)
    const noRoster = omitKey(commit, 'roster')
    await expect(
      applyCommit({ state: bobState, commit: noRoster, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow()
  })

  it('rejects a commit with roster set to null', async () => {
    const { aliceState, bobState } = await epoch0('struct-null-roster')
    const { commit } = await addCarolCommit(aliceState)
    await expect(
      applyCommit({
        state: bobState,
        commit: { ...commit, roster: null },
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })

  it('rejects a commit with updatePath omitted', async () => {
    const { aliceState, bobState } = await epoch0('struct-no-path')
    const { commit } = await addCarolCommit(aliceState)
    const noPath = omitKey(commit, 'updatePath')
    await expect(
      applyCommit({ state: bobState, commit: noPath, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow()
  })

  it('rejects a commit with updatePath set to null', async () => {
    const { aliceState, bobState } = await epoch0('struct-null-path')
    const { commit } = await addCarolCommit(aliceState)
    await expect(
      applyCommit({
        state: bobState,
        commit: { ...commit, updatePath: null },
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. applyCommit — group ID validation (cross-group injection)
// ══════════════════════════════════════════════════════════════════════════════

describe('applyCommit — group ID validation', () => {
  it('rejects a commit intended for a different group', async () => {
    const { aliceState, bobState } = await epoch0('gid-mismatch')
    const { commit } = await addCarolCommit(aliceState)
    await expect(
      applyCommit({
        state: bobState,
        commit: { ...commit, groupId: 'evil-group' },
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow('Commit groupId mismatch')
  })

  it('rejects a commit with an empty groupId', async () => {
    const { aliceState, bobState } = await epoch0('gid-empty')
    const { commit } = await addCarolCommit(aliceState)
    await expect(
      applyCommit({
        state: bobState,
        commit: { ...commit, groupId: '' },
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })

  it('rejects a commit with a null groupId', async () => {
    const { aliceState, bobState } = await epoch0('gid-null')
    const { commit } = await addCarolCommit(aliceState)
    await expect(
      applyCommit({
        state: bobState,
        commit: { ...commit, groupId: null },
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. applyCommit — signature enforcement
// ══════════════════════════════════════════════════════════════════════════════

describe('applyCommit — signature enforcement', () => {
  it('rejects a commit with no signature field', async () => {
    const { aliceState, bobState } = await epoch0('sig-missing')
    const { commit } = await addCarolCommit(aliceState)
    const noSig = omitKey(commit, 'signature')
    await expect(
      applyCommit({ state: bobState, commit: noSig, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow()
  })

  it('rejects a commit with an empty string signature', async () => {
    const { aliceState, bobState } = await epoch0('sig-empty')
    const { commit } = await addCarolCommit(aliceState)
    await expect(
      applyCommit({
        state: bobState,
        commit: { ...commit, signature: '' },
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })

  it('rejects when the commit signature is corrupted', async () => {
    const { aliceState, bobState } = await epoch0('sig-bad-verify')
    const { commit } = await addCarolCommit(aliceState)
    await expect(
      applyCommit({
        state: bobState,
        commit: { ...commit, signature: corruptBase64(commit.signature) },
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })

  it('rejects a commit whose sender is absent from the local roster', async () => {
    const { aliceState, bobState } = await epoch0('sig-no-sender')
    const { commit } = await addCarolCommit(aliceState)
    const bobStateNoAlice = {
      ...bobState,
      tree: {
        ...bobState.tree,
        leafData: Object.fromEntries(
          Object.entries(bobState.tree.leafData).filter(([leafIndex]) => leafIndex !== '0')
        ),
      },
    }
    await expect(
      applyCommit({ state: bobStateNoAlice, commit, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow()
  })

  it("rejects when the sender's leafSigningPubKeyB64 is null in the roster", async () => {
    const { aliceState, bobState } = await epoch0('sig-null-sigkey')
    const { commit } = await addCarolCommit(aliceState)
    const bobStateNoKey = {
      ...bobState,
      tree: {
        ...bobState.tree,
        leafData: {
          ...bobState.tree.leafData,
          0: { ...bobState.tree.leafData['0'], leafSigningPubKeyB64: null },
        },
      },
    }
    await expect(
      applyCommit({ state: bobStateNoKey, commit, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow()
  })

  it('rejects when the commit-carried sender signing key differs from the trusted roster key', async () => {
    const { aliceState, bobState } = await epoch0('sig-key-mismatch')
    const { commit } = await addCarolCommit(aliceState)
    await expect(
      applyCommit({
        state: bobState,
        commit: { ...commit, senderSigningPubKeyB64: MALLORY_KEY },
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow('Commit sender signing pub key mismatch')
  })

  it('rejects when the commit signature does not match the sender key (forged signer)', async () => {
    const { aliceState, bobState } = await epoch0('sig-forged')
    const { commit } = await addCarolCommit(aliceState)
    const forgedCommit = {
      ...commit,
      signature: await signCommit(commit, bobState.leafSigningPrivKeyB64),
    }
    await expect(
      applyCommit({ state: bobState, commit: forgedCommit, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. encodeCommitForSigning — field coverage (pure unit tests)
//
// Each test verifies that a specific field is included in the byte string
// passed to the signing / verification function.  A field that does NOT
// change the encoding is NOT protected by the signature.
//
// Tests marked [BUG #2] will FAIL until fix #2 adds treePublicNodes to the
// signed content.  Do NOT remove or skip them.
// ══════════════════════════════════════════════════════════════════════════════

describe('encodeCommitForSigning — field coverage', () => {
  const BASELINE = toHex(BASE_COMMIT_OBJ)

  it('baseline produces a non-empty byte string', () => {
    expect(BASELINE.length).toBeGreaterThan(0)
  })

  it('two identical commits produce the same encoding (determinism)', () => {
    expect(toHex(BASE_COMMIT_OBJ)).toBe(BASELINE)
  })

  it('different groupId produces different encoding', () => {
    expect(toHex({ ...BASE_COMMIT_OBJ, groupId: 'other-group' })).not.toBe(BASELINE)
  })

  it('different epoch produces different encoding', () => {
    expect(toHex({ ...BASE_COMMIT_OBJ, epoch: 99 })).not.toBe(BASELINE)
  })

  it('different commit type produces different encoding', () => {
    expect(toHex({ ...BASE_COMMIT_OBJ, type: 'remove' })).not.toBe(BASELINE)
  })

  it('different senderLeafIndex produces different encoding', () => {
    expect(toHex({ ...BASE_COMMIT_OBJ, senderLeafIndex: 2 })).not.toBe(BASELINE)
  })

  it('different senderSigningPubKeyB64 produces different encoding', () => {
    expect(toHex({ ...BASE_COMMIT_OBJ, senderSigningPubKeyB64: MALLORY_KEY })).not.toBe(BASELINE)
  })

  it('different targetUserId produces different encoding', () => {
    expect(toHex({ ...BASE_COMMIT_OBJ, targetUserId: 'mallory' })).not.toBe(BASELINE)
  })

  it('different leafCount produces different encoding', () => {
    expect(toHex({ ...BASE_COMMIT_OBJ, leafCount: 8 })).not.toBe(BASELINE)
  })

  it('tampered roster member userId produces different encoding', () => {
    const roster = BASE_COMMIT_OBJ.roster.map((m, i) => (i === 0 ? { ...m, userId: 'mallory' } : m))
    expect(toHex({ ...BASE_COMMIT_OBJ, roster })).not.toBe(BASELINE)
  })

  it('tampered roster member leafIndex produces different encoding', () => {
    const roster = BASE_COMMIT_OBJ.roster.map((m, i) => (i === 0 ? { ...m, leafIndex: 99 } : m))
    expect(toHex({ ...BASE_COMMIT_OBJ, roster })).not.toBe(BASELINE)
  })

  it('tampered roster member leafSigningPubKeyB64 produces different encoding', () => {
    const roster = BASE_COMMIT_OBJ.roster.map((m, i) =>
      i === 0 ? { ...m, leafSigningPubKeyB64: MALLORY_KEY } : m
    )
    expect(toHex({ ...BASE_COMMIT_OBJ, roster })).not.toBe(BASELINE)
  })

  it('injected extra roster member produces different encoding', () => {
    const roster = [
      ...BASE_COMMIT_OBJ.roster,
      { userId: 'mallory', leafIndex: 9, leafSigningPubKeyB64: MALLORY_KEY },
    ]
    expect(toHex({ ...BASE_COMMIT_OBJ, roster })).not.toBe(BASELINE)
  })

  it('tampered updatePath entry publicKeyB64 produces different encoding', () => {
    const updatePath = BASE_COMMIT_OBJ.updatePath.map((e, i) =>
      i === 0 ? { ...e, publicKeyB64: MALLORY_KEY } : e
    )
    expect(toHex({ ...BASE_COMMIT_OBJ, updatePath })).not.toBe(BASELINE)
  })

  it('tampered updatePath entry nodeIndex produces different encoding', () => {
    const updatePath = BASE_COMMIT_OBJ.updatePath.map((e, i) =>
      i === 0 ? { ...e, nodeIndex: 99 } : e
    )
    expect(toHex({ ...BASE_COMMIT_OBJ, updatePath })).not.toBe(BASELINE)
  })

  it('injected extra updatePath entry produces different encoding', () => {
    const updatePath = [...BASE_COMMIT_OBJ.updatePath, { nodeIndex: 99, publicKeyB64: MALLORY_KEY }]
    expect(toHex({ ...BASE_COMMIT_OBJ, updatePath })).not.toBe(BASELINE)
  })

  /**
   * [BUG #2] treePublicNodes is NOT currently included in the signed content.
   *
   * A server-in-the-middle can replace any tree node that lies outside the
   * sender's update path without invalidating the commit signature.  Receivers
   * accept the commit and store a corrupted key tree, causing state divergence
   * and silent decryption failures in subsequent epochs.
   *
   * This test FAILS until fix #2 adds a treePublicNodes hash to
   * encodeCommitForSigning.
   */
  it('[BUG #2] tampered treePublicNodes (single node) must produce different encoding', () => {
    const treePublicNodes = BASE_COMMIT_OBJ.treePublicNodes.map((k, i) =>
      i === 2 ? MALLORY_KEY : k
    )
    expect(toHex({ ...BASE_COMMIT_OBJ, treePublicNodes })).not.toBe(BASELINE)
  })

  it('[BUG #2] tampered treePublicNodes (all nodes replaced) must produce different encoding', () => {
    const treePublicNodes = BASE_COMMIT_OBJ.treePublicNodes.map(() => MALLORY_KEY)
    expect(toHex({ ...BASE_COMMIT_OBJ, treePublicNodes })).not.toBe(BASELINE)
  })

  it('[BUG #2] null slot in treePublicNodes replaced with attacker key must produce different encoding', () => {
    const treePublicNodes = BASE_COMMIT_OBJ.treePublicNodes.map((k) =>
      k === null ? MALLORY_KEY : k
    )
    expect(toHex({ ...BASE_COMMIT_OBJ, treePublicNodes })).not.toBe(BASELINE)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. applyCommit — tree tampering detection (integration, [BUG #2])
//
// These tests build real commits from the pipeline and verify that
// encodeCommitForSigning produces different output when treePublicNodes is
// tampered on a real commit object.
//
// Because verify_signature is stubbed, these tests check signed-content
// sensitivity directly rather than expecting applyCommit to throw.
// They FAIL before fix #2 (same content → tamper undetectable by signature).
// They PASS after fix #2 (different content → tamper is caught in real crypto).
// ══════════════════════════════════════════════════════════════════════════════

describe('applyCommit — tree tampering detection [BUG #2]', () => {
  it('[BUG #2] substituting a non-path tree node changes the signed content', async () => {
    const { aliceState } = await epoch0('tree-det-1')
    const { commit } = await addCarolCommit(aliceState)

    const tamperedCommit = {
      ...commit,
      treePublicNodes: commit.treePublicNodes.map((k, i) => (i === 2 ? MALLORY_KEY : k)),
    }

    // FAILS before fix #2: encodeCommitForSigning ignores treePublicNodes → same output
    // PASSES after fix #2: treeHash differs → verifyCommit would reject in real crypto
    expect(toHex(commit)).not.toBe(toHex(tamperedCommit))
  })

  it('[BUG #2] replacing all tree nodes with attacker keys changes the signed content', async () => {
    const { aliceState } = await epoch0('tree-det-2')
    const { commit } = await addCarolCommit(aliceState)

    const tamperedCommit = {
      ...commit,
      treePublicNodes: commit.treePublicNodes.map(() => MALLORY_KEY),
    }

    expect(toHex(commit)).not.toBe(toHex(tamperedCommit))
  })

  it('[BUG #2] substituting a blank (null) node with an attacker key changes the signed content', async () => {
    const { aliceState } = await epoch0('tree-det-3')
    const { commit } = await addCarolCommit(aliceState)

    const tamperedCommit = {
      ...commit,
      treePublicNodes: commit.treePublicNodes.map((k) => (k === null ? MALLORY_KEY : k)),
    }

    expect(toHex(commit)).not.toBe(toHex(tamperedCommit))
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 7. processWelcome — structural validation
// ══════════════════════════════════════════════════════════════════════════════

describe('processWelcome — structural validation', () => {
  it('rejects a null welcome', async () => {
    await expect(
      processWelcome({ welcome: null, selfUserId: 'bob', myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow()
  })

  it('rejects a welcome with an empty groupId', async () => {
    const { bobWelcome } = await epoch0('wlc-empty-gid')
    await expect(
      processWelcome({
        welcome: { ...bobWelcome, groupId: '' },
        selfUserId: 'bob',
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })

  it('rejects a welcome with no encryptedGroupInfo (roster/tree are encrypted within it)', async () => {
    const { bobWelcome } = await epoch0('wlc-no-roster')
    await expect(
      processWelcome({
        welcome: { ...bobWelcome, encryptedGroupInfo: null },
        selfUserId: 'bob',
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })

  it('rejects a welcome with null encryptedGroupSecrets (joiner_secret cannot be unwrapped)', async () => {
    const { bobWelcome } = await epoch0('wlc-null-init')
    await expect(
      processWelcome({
        welcome: { ...bobWelcome, encryptedGroupSecrets: null },
        selfUserId: 'bob',
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })

  it('rejects a welcome with null encryptedGroupInfo (group context cannot be decrypted)', async () => {
    const { bobWelcome } = await epoch0('wlc-null-commit')
    await expect(
      processWelcome({
        welcome: { ...bobWelcome, encryptedGroupInfo: null },
        selfUserId: 'bob',
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })

  it('rejects a welcome with no signature field', async () => {
    const { bobWelcome } = await epoch0('wlc-no-sig')
    await expect(
      processWelcome({
        welcome: omitKey(bobWelcome, 'signature'),
        selfUserId: 'bob',
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow('Welcome missing signature or signing pub key')
  })

  it('rejects a welcome with no senderSigningPubKeyB64 field', async () => {
    const { bobWelcome } = await epoch0('wlc-no-sender-key')
    await expect(
      processWelcome({
        welcome: omitKey(bobWelcome, 'senderSigningPubKeyB64'),
        selfUserId: 'bob',
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow(`Welcome is missing senderSigningPubKeyB64 for group ${bobWelcome.groupId}`)
  })

  it('rejects when no private key is supplied', async () => {
    const { bobWelcome } = await epoch0('wlc-no-key')
    await expect(
      processWelcome({ welcome: bobWelcome, selfUserId: 'bob', myInitPrivKeyB64: null })
    ).rejects.toThrow()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 8. processWelcome — AEAD authentication
//
// The welcome secrets are wrapped with AES-256-GCM.  Any tampering with the
// ciphertext, the AAD-bound epoch, or the DH ephemeral key must cause a
// decryption failure.  The mock uses real AES-256-GCM so authentication
// actually fires.
// ══════════════════════════════════════════════════════════════════════════════

describe('processWelcome — AEAD authentication', () => {
  it('rejects when the wrong private key is used (wrong recipient)', async () => {
    const { bobWelcome } = await epoch0('wlc-wrong-key')
    // Carol uses her own init key to process Bob's welcome → DH output differs →
    // AES-GCM decryption fails.
    await expect(
      processWelcome({
        welcome: bobWelcome,
        selfUserId: 'carol',
        myInitPrivKeyB64: CAROL_KEY,
      })
    ).rejects.toThrow()
  })

  it('rejects when encryptedGroupSecrets ciphertext is tampered', async () => {
    const { bobWelcome } = await epoch0('wlc-tamper-init')
    const ct = Buffer.from(bobWelcome.encryptedGroupSecrets.encryptedB64, 'base64')
    ct[ct.length - 1] ^= 0xff // flip a byte inside the AES-GCM auth tag
    await expect(
      processWelcome({
        welcome: {
          ...bobWelcome,
          encryptedGroupSecrets: {
            ...bobWelcome.encryptedGroupSecrets,
            encryptedB64: ct.toString('base64'),
          },
        },
        selfUserId: 'bob',
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })

  it('rejects when encryptedGroupInfo ciphertext is tampered', async () => {
    const { bobWelcome } = await epoch0('wlc-tamper-commit')
    const ct = Buffer.from(bobWelcome.encryptedGroupInfo.encryptedB64, 'base64')
    ct[ct.length - 1] ^= 0xff
    await expect(
      processWelcome({
        welcome: {
          ...bobWelcome,
          encryptedGroupInfo: {
            ...bobWelcome.encryptedGroupInfo,
            encryptedB64: ct.toString('base64'),
          },
        },
        selfUserId: 'bob',
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })

  it('rejects when the ephemeral public key in encryptedGroupSecrets is substituted', async () => {
    const { bobWelcome } = await epoch0('wlc-sub-eph')
    // Swapping the ephemeral public key changes the DH output → different wrap key →
    // AES-GCM auth tag mismatch.
    await expect(
      processWelcome({
        welcome: {
          ...bobWelcome,
          encryptedGroupSecrets: { ...bobWelcome.encryptedGroupSecrets, ephPubB64: MALLORY_KEY },
        },
        selfUserId: 'bob',
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow()
  })
})

describe('processWelcome — signed metadata integrity', () => {
  it('rejects when the roster is substituted by the server', async () => {
    const { bobWelcome } = await epoch0('wlc-roster-sub')
    const tampered = await tamperWelcomeGroupInfo({
      welcome: bobWelcome,
      myInitPrivKeyB64: BOB_KEY,
      mutateGroupInfo: (groupInfo) => ({
        ...groupInfo,
        roster: [
          ...(groupInfo.roster ?? []),
          {
            userId: 'mallory',
            username: 'Mallory',
            leafIndex: 9,
            leafSigningPubKeyB64: MALLORY_KEY,
          },
        ],
      }),
    })
    expect(Buffer.from(encodeWelcomeForSigning(tampered))).not.toEqual(
      Buffer.from(encodeWelcomeForSigning(bobWelcome))
    )
    await expect(
      processWelcome({
        welcome: tampered,
        selfUserId: 'bob',
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow('Welcome signature invalid')
  })

  it('rejects when treePublicNodes are substituted by the server', async () => {
    const { bobWelcome } = await epoch0('wlc-tree-sub')
    const tampered = await tamperWelcomeGroupInfo({
      welcome: bobWelcome,
      myInitPrivKeyB64: BOB_KEY,
      mutateGroupInfo: (groupInfo) => {
        const treePublicNodes = [...(groupInfo.treePublicNodes ?? [])]
        treePublicNodes[0] = MALLORY_KEY
        return { ...groupInfo, treePublicNodes }
      },
    })
    expect(Buffer.from(encodeWelcomeForSigning(tampered))).not.toEqual(
      Buffer.from(encodeWelcomeForSigning(bobWelcome))
    )
    await expect(
      processWelcome({
        welcome: tampered,
        selfUserId: 'bob',
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow('Welcome signature invalid')
  })

  it('rejects when senderSigningPubKeyB64 does not match the roster sender entry', async () => {
    const { aliceState, bobWelcome } = await epoch0('wlc-sender-key-mismatch')
    const tampered = await tamperWelcomeGroupInfo({
      welcome: bobWelcome,
      myInitPrivKeyB64: BOB_KEY,
      mutateGroupInfo: (groupInfo) => ({
        ...groupInfo,
        senderSigningPubKeyB64: MALLORY_KEY,
      }),
      signerPrivKeyB64: aliceState.leafSigningPrivKeyB64,
    })
    await expect(
      processWelcome({
        welcome: tampered,
        selfUserId: 'bob',
        myInitPrivKeyB64: BOB_KEY,
      })
    ).rejects.toThrow('Welcome sender signing pub key mismatch')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 9. buildRemoveCommit — post-remove isolation invariants
//
// After a member is removed, they must not share epoch secrets with the group.
// ══════════════════════════════════════════════════════════════════════════════

describe('buildRemoveCommit — post-remove isolation', () => {
  async function removeScenario(groupId) {
    const { aliceState, bobState } = await epoch0(`${groupId}-base`)

    const {
      commit: addCommit,
      welcome: carolWelcome,
      nextState: aliceState1,
    } = await addCarolCommit(aliceState)

    const bobState1 = await applyCommit({
      state: bobState,
      commit: addCommit,
      myInitPrivKeyB64: BOB_KEY,
    })
    const carolState1 = await processWelcome({
      welcome: carolWelcome,
      selfUserId: 'carol',
      myInitPrivKeyB64: CAROL_KEY,
    })

    const { commit: removeCommit, nextState: aliceState2 } = await buildRemoveCommit({
      state: aliceState1,
      targetUserId: 'bob',
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    })

    const carolState2 = await applyCommit({
      state: carolState1,
      commit: removeCommit,
      myInitPrivKeyB64: CAROL_KEY,
    })
    const bobState2 = await applyCommit({
      state: bobState1,
      commit: removeCommit,
      myInitPrivKeyB64: BOB_KEY,
    })

    return { aliceState2, carolState2, bobState2, removeCommit }
  }

  it('removed member has null applicationSecretB64', async () => {
    const { bobState2 } = await removeScenario('rem-null-app')
    expect(bobState2.applicationSecretB64).toBeNull()
  })

  it('removed member has null selfLeafIndex', async () => {
    const { bobState2 } = await removeScenario('rem-null-leaf')
    expect(bobState2.selfLeafIndex).toBeNull()
  })

  it('removed member has null initSecretB64 (cannot advance to next epoch)', async () => {
    const { bobState2 } = await removeScenario('rem-null-init')
    expect(bobState2.initSecretB64).toBeNull()
  })

  it('remaining members agree on applicationSecretB64 after removal', async () => {
    const { aliceState2, carolState2 } = await removeScenario('rem-agree')
    expect(aliceState2.applicationSecretB64).not.toBeNull()
    expect(aliceState2.applicationSecretB64).toBe(carolState2.applicationSecretB64)
  })

  it('removed member applicationSecretB64 differs from remaining members', async () => {
    const { aliceState2, bobState2 } = await removeScenario('rem-diff')
    // bobState2.applicationSecretB64 is null; aliceState2 is not null → always differ
    expect(aliceState2.applicationSecretB64).not.toBe(bobState2.applicationSecretB64)
  })

  it('remove-commit epoch is currentEpoch + 1 (exactly one step)', async () => {
    const { removeCommit } = await removeScenario('rem-epoch')
    // epoch after add = 1, so remove must be at epoch 2
    expect(removeCommit.epoch).toBe(2)
  })

  it('Bob cannot re-apply the same remove commit a second time', async () => {
    const { bobState2, removeCommit } = await removeScenario('rem-no-replay')
    await expect(
      applyCommit({ state: bobState2, commit: removeCommit, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow('Invalid commit epoch')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 10. Parent-hash binding — applyCommit must reject tampered node keys
//
// A sender who knows their own path secrets can encrypt them correctly for
// copath recipients, but CANNOT substitute the parent node public keys with
// attacker-controlled values.  applyUpdatePath re-derives the expected key
// from the decrypted path secret and compares it to the claimed publicKeyB64.
//
// Similarly, a tampered parentHashB64 must be detected even when the node
// key itself is unchanged, because parentHashB64 binds the key to the copath
// sibling subtree state.
// ══════════════════════════════════════════════════════════════════════════════

describe('applyCommit — parent-hash binding', () => {
  it('real commit carries parentHashB64 on every non-root update-path node', async () => {
    const { aliceState } = await epoch0('phash-present')
    const { commit } = await addCarolCommit(aliceState)

    // The root has no copath sibling so no parentHashB64; all other nodes must have it.
    const nonRootEntries = commit.updatePath.slice(0, -1)
    for (const entry of nonRootEntries) {
      expect(typeof entry.parentHashB64).toBe('string')
      expect(entry.parentHashB64.length).toBeGreaterThan(0)
    }
  })

  it('rejects a commit whose leaf node publicKeyB64 is replaced with an attacker key', async () => {
    const { aliceState, bobState } = await epoch0('phash-tamper-key-leaf')
    const { commit } = await addCarolCommit(aliceState)

    // Replace the leaf (index 0) node's public key with a bogus key.
    const tampered = {
      ...commit,
      updatePath: commit.updatePath.map((e, i) =>
        i === 0 ? { ...e, publicKeyB64: MALLORY_KEY } : e
      ),
    }
    tampered.signature = await signCommit(tampered, aliceState.leafSigningPrivKeyB64)

    // Bob decrypts the copath path secret fine, but the re-derived expected key
    // for the leaf differs from MALLORY_KEY → recoverAndVerify throws.
    await expect(
      applyCommit({ state: bobState, commit: tampered, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow('Node key mismatch')
  })

  it('rejects a commit whose parent node publicKeyB64 is replaced with an attacker key', async () => {
    const { aliceState, bobState } = await epoch0('phash-tamper-key-parent')
    const { commit } = await addCarolCommit(aliceState)

    // Find the first non-leaf update-path entry (index 1 if the path has depth ≥ 2).
    const parentIdx = commit.updatePath.findIndex((e, i) => i > 0)
    if (parentIdx === -1) return // skip for trivially shallow trees

    const tampered = {
      ...commit,
      updatePath: commit.updatePath.map((e, i) =>
        i === parentIdx ? { ...e, publicKeyB64: MALLORY_KEY } : e
      ),
    }
    tampered.signature = await signCommit(tampered, aliceState.leafSigningPrivKeyB64)

    await expect(
      applyCommit({ state: bobState, commit: tampered, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow('Node key mismatch')
  })

  it('rejects a commit whose parentHashB64 is replaced with garbage (copath-binding check)', async () => {
    const { aliceState, bobState } = await epoch0('phash-tamper-phash')
    const { commit } = await addCarolCommit(aliceState)

    // Replace the leaf node's parentHashB64 with a zeroed-out value.
    const bogusParentHash = bytesToBase64(new Uint8Array(32).fill(0x00))
    const tampered = {
      ...commit,
      updatePath: commit.updatePath.map((e, i) =>
        i === 0 && e.parentHashB64 ? { ...e, parentHashB64: bogusParentHash } : e
      ),
    }

    // The node key itself is correct, but the parentHashB64 no longer matches
    // SHA-256(nodePub || subtreeHash(copathSibling)) → recoverAndVerify throws.
    await expect(
      applyCommit({ state: bobState, commit: tampered, myInitPrivKeyB64: BOB_KEY })
    ).rejects.toThrow('Parent hash mismatch')
  })

  it('a legitimately-built commit always passes parent-hash verification end-to-end', async () => {
    const { aliceState, bobState } = await epoch0('phash-roundtrip')
    const { commit } = await addCarolCommit(aliceState)

    // No tampering — should succeed without throwing.
    await expect(
      applyCommit({ state: bobState, commit, myInitPrivKeyB64: BOB_KEY })
    ).resolves.not.toThrow()
  })

  it('parentHashB64 changes when the copath sibling key changes (binding is tight)', async () => {
    // Build two add-carol commits from two states whose trees differ in the
    // copath sibling position, and check that their parentHashB64 values differ.
    const { aliceState: a1 } = await epoch0('phash-tight-1')
    const { aliceState: a2 } = await epoch0('phash-tight-2')
    const { commit: c1 } = await addCarolCommit(a1)
    const { commit: c2 } = await addCarolCommit(a2)

    // Both commits follow the same structure.  The randomised leaf signing keys
    // mean the copath sibling's public key differs between the two group states,
    // so the parentHashB64 on the leaf path node must differ.
    const ph1 = c1.updatePath[0]?.parentHashB64
    const ph2 = c2.updatePath[0]?.parentHashB64

    // One or both must be non-null (at minimum the first non-root node has one).
    expect(ph1 ?? ph2).toBeTruthy()
    // Because the two states have distinct leaf signing keys, their copath hashes
    // differ, which must produce different parentHashB64 values.
    if (ph1 && ph2) {
      expect(ph1).not.toBe(ph2)
    }
  })
})
