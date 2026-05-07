/**
 * groupCryptoProvider.epochs.test.js
 *
 * Multi-epoch integration tests for the full commit/welcome/apply pipeline.
 * The scenario exercised is:
 *   Epoch 0 — Alice creates the group with Bob
 *   Epoch 1 — Alice adds Carol (add-commit + welcome + applyCommit for Bob)
 *   Epoch 2 — Alice removes Bob (remove-commit + applyCommit for Carol + applyCommit for Bob)
 *
 * Asserts that:
 *   • every active member independently derives the same applicationSecretB64
 *   • epoch numbers advance monotonically
 *   • the removed member ends up with null applicationSecretB64 and null selfLeafIndex
 *   • commits carry a non-empty signature field
 *   • applyCommit rejects commits from senders whose signing pub key is absent in the roster
 *   • applyCommit rejects commits when the underlying verify_signature call returns false
 *
 * Mock strategy: same as groupCryptoProvider.test.js / groupCryptoProvider.ecdh.test.js.
 *   – @mascaro101/echo-protocol: real AES-256-GCM (Node.js createCipheriv) + simplified
 *     stub X25519 (public key = private key, DH = XOR) + stub XEdDSA stubs.
 *   – keySchedule: deterministic deriveBytes so secret equality is verifiable.
 *   – EncryptedLocalDatabase: in-memory store so saveGroupState / loadGroupState work.
 */
import { webcrypto, createCipheriv, createDecipheriv } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.atob) globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
if (!globalThis.btoa) globalThis.btoa = (bin) => Buffer.from(bin, 'binary').toString('base64');

// ── Helpers used inside mock factories ────────────────────────────────────────

function encodeText(value) {
  return new TextEncoder().encode(value);
}

function deriveBytes(length, ...parts) {
  const out = new Uint8Array(length);
  const sources = parts.map((part) => (part instanceof Uint8Array ? part : new Uint8Array(part)));
  for (let i = 0; i < out.length; i++) {
    let value = i;
    for (const source of sources) {
      value = (value + (source[i % source.length] || 0)) & 0xff;
    }
    out[i] = value;
  }
  return out;
}

// ── @mascaro101/echo-protocol mock ────────────────────────────────────────────
// Real AES-256-GCM from Node.js for correct encrypt/decrypt round-trips.
// X25519 DH is stubbed as XOR so that pub = priv (the init keys passed to
// wrapGroupKey and wrapPathSecret as "public" keys are the same bytes used
// as "private" keys during unwrap).

vi.mock('@mascaro101/echo-protocol', () => {
  const aesgcmEncryptSync = (plaintext, key, nonce, aad) => {
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce));
    cipher.setAAD(Buffer.from(aad));
    const enc = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
    const tag = cipher.getAuthTag();
    return new Uint8Array(Buffer.concat([enc, tag]));
  };

  const aesgcmDecryptSync = (ciphertext, key, nonce, aad) => {
    const buf = Buffer.from(ciphertext);
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(buf.subarray(buf.length - 16));
    return new Uint8Array(
      Buffer.concat([decipher.update(buf.subarray(0, buf.length - 16)), decipher.final()]),
    );
  };

  return {
    default:                vi.fn(async () => {}),
    encrypt_aad_bytes:      vi.fn((pt, key, nonce, aad) => aesgcmEncryptSync(pt, key, nonce, aad)),
    decrypt_aad_bytes:      vi.fn((ct, key, nonce, aad) => aesgcmDecryptSync(ct, key, nonce, aad)),
    // XOR DH — round-trips because we use the same bytes as pub and priv.
    diffie_hellman:         vi.fn((a, b) => new Uint8Array(32).map((_, i) => a[i] ^ b[i])),
    // pub = first 32 bytes of priv (identity map in stub world)
    generate_private_ephemeral_key: vi.fn((rand) => new Uint8Array(rand).slice(0, 32)),
    generate_public_ephemeral_key:  vi.fn((priv) => new Uint8Array(priv).slice(0, 32)),
    hkdf_derive:            vi.fn((ikm, _salt, info, len) =>
      deriveBytes(len, new Uint8Array(ikm), new Uint8Array(info)),
    ),
    // XEdDSA stubs — verify always passes so the epoch chain runs end-to-end.
    derive_ed25519_keypair_from_x25519: vi.fn((priv) => new Uint8Array(priv).slice(0, 32)),
    convert_x25519_to_xeddsa:  vi.fn((priv) => {
      const b = new Uint8Array(64);
      b.set(new Uint8Array(priv).slice(0, 32), 0);
      b.set(new Uint8Array(priv).slice(0, 32), 32);
      return b;
    }),
    compute_determenistic_nonce: vi.fn((prefix, msg) =>
      deriveBytes(32, new Uint8Array(prefix), new Uint8Array(msg)),
    ),
    compute_nonce_point:        vi.fn((nonce) => new Uint8Array(nonce).slice(0, 32)),
    compute_challenge_hash:     vi.fn((R, A, M) =>
      deriveBytes(32, new Uint8Array(R), new Uint8Array(A), new Uint8Array(M)),
    ),
    compute_signature_scaler:   vi.fn((nonce, challenge, scalar) =>
      deriveBytes(32, new Uint8Array(nonce), new Uint8Array(challenge), new Uint8Array(scalar)),
    ),
    compute_signature:          vi.fn((R, s) => {
      const sig = new Uint8Array(64);
      sig.set(new Uint8Array(R).slice(0, 32), 0);
      sig.set(new Uint8Array(s).slice(0, 32), 32);
      return sig;
    }),
    verify_signature: vi.fn(() => true),
  };
});

// ── keySchedule mock ──────────────────────────────────────────────────────────
// Deterministic derivation so that any two callers with the same inputs get
// byte-identical secrets (verifies cross-member agreement without real HKDF).

vi.mock('../keySchedule.js', () => ({
  advanceEpoch: vi.fn(async ({ initSecret, commitSecret, groupId, epoch }) => {
    const epochSecret = deriveBytes(
      32,
      initSecret,
      commitSecret,
      encodeText(`${groupId}|${epoch}|epoch`),
    );
    return {
      epochSecret,
      applicationSecret:  deriveBytes(32, epochSecret, encodeText('encryption')),
      senderDataSecret:   deriveBytes(32, epochSecret, encodeText('sender_data')),
      nextInitSecret:     deriveBytes(32, epochSecret, encodeText('init')),
    };
  }),
  deriveSecret: vi.fn(async (secret, label) =>
    deriveBytes(32, secret, encodeText(label)),
  ),
  expandWithLabel: vi.fn(async (secret, label, context, length) =>
    deriveBytes(length, secret, encodeText(label), context),
  ),
  deriveAppKeyAndNonce: vi.fn(async (applicationSecret, senderLeafIndex, generation) => ({
    key:   deriveBytes(32, applicationSecret, encodeText(`key|${senderLeafIndex}|${generation}`)),
    nonce: deriveBytes(12, applicationSecret, encodeText(`nonce|${senderLeafIndex}|${generation}`)),
  })),
  ratchetAppSecret: vi.fn(async (applicationSecret, senderLeafIndex, generation) =>
    deriveBytes(32, applicationSecret, encodeText(`secret|${senderLeafIndex}|${generation}`)),
  ),
}));

// ── EncryptedLocalDatabase mock ───────────────────────────────────────────────
// In-memory store: storeMlsGroupState / getMlsGroupState round-trip correctly
// so saveGroupState persists and createNewGroupState can read back if needed.

const _eldStore = new Map();

vi.mock('../../../../../../utils/storage/EncryptedLocalDatabase', () => ({
  default: {
    isUnlocked:       vi.fn(() => true),
    storeMlsGroupState: vi.fn(async (groupId, record) => { _eldStore.set(groupId, record); }),
    getMlsGroupState:   vi.fn(async (groupId) => _eldStore.get(groupId) ?? null),
  },
}));

// ── Module imports (after mocks are installed) ────────────────────────────────

const { bytesToBase64, base64ToBytes } = await import('../../helpers.js');
const {
  applyCommit,
  buildAddCommit,
  buildInitialWelcomes,
  buildRemoveCommit,
  createNewGroupState,
  processWelcome,
} = await import('../groupCryptoProvider.js');

// ── Fixture constants ─────────────────────────────────────────────────────────
// Each member's "init key" acts as both their public key (given to others for
// encryption) and their private key (used for decryption), because the stub
// `generate_public_ephemeral_key` is an identity map.

const ALICE_KEY = bytesToBase64(new Uint8Array(32).fill(0x01));
const BOB_KEY   = bytesToBase64(new Uint8Array(32).fill(0x02));
const CAROL_KEY = bytesToBase64(new Uint8Array(32).fill(0x03));

const ALICE_BOB_ROSTER = [
  { userId: 'alice', username: 'Alice', leafIndex: 0 },
  { userId: 'bob',   username: 'Bob',   leafIndex: 1 },
];

const ALICE_BOB_INIT_KEYS = [
  { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
  { userId: 'bob',   leafIndex: 1, initKeyB64: BOB_KEY },
];

// ── Helper: build epoch-0 states for Alice and Bob ────────────────────────────

async function epoch0States(groupId) {
  _eldStore.clear();

  const aliceState = await createNewGroupState({
    groupId,
    creatorUserId: 'alice',
    roster:         ALICE_BOB_ROSTER,
    memberInitKeys: ALICE_BOB_INIT_KEYS,
  });

  const [bobWelcome] = await buildInitialWelcomes({
    creatorState:   aliceState,
    roster:         ALICE_BOB_ROSTER,
    memberInitKeys: [{ userId: 'bob', leafIndex: 1, initKeyB64: BOB_KEY }],
  });

  const bobState = await processWelcome({
    welcome:           bobWelcome,
    selfUserId:        'bob',
    myInitPrivKeyB64:  BOB_KEY,
  });

  return { aliceState, bobState };
}

beforeEach(() => {
  vi.clearAllMocks();
  _eldStore.clear();
});

// ── Epoch-0: initial group formation ─────────────────────────────────────────

describe('epoch 0 — group formation', () => {
  it('Alice and Bob derive the same applicationSecretB64 after processWelcome', async () => {
    const { aliceState, bobState } = await epoch0States('ep0-agree');
    expect(aliceState.applicationSecretB64).not.toBeNull();
    expect(aliceState.applicationSecretB64).toBe(bobState.applicationSecretB64);
  });

  it('both states are at epoch 0', async () => {
    const { aliceState, bobState } = await epoch0States('ep0-epochs');
    expect(aliceState.epoch).toBe(0);
    expect(bobState.epoch).toBe(0);
  });

  it('Alice roster carries her own leafSigningPubKeyB64', async () => {
    const { aliceState } = await epoch0States('ep0-sigkey');
    const aliceEntry = aliceState.roster.find((m) => m.userId === 'alice');
    expect(typeof aliceEntry?.leafSigningPubKeyB64).toBe('string');
    expect(aliceEntry.leafSigningPubKeyB64.length).toBeGreaterThan(0);
  });
});

// ── Epoch-1: Alice adds Carol ─────────────────────────────────────────────────

describe('epoch 1 — add Carol', () => {
  async function epoch1States(groupId) {
    const { aliceState, bobState } = await epoch0States(groupId);

    const { commit, welcome, nextState: aliceState1 } = await buildAddCommit({
      state:     aliceState,
      newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
        { userId: 'bob',   leafIndex: 1, initKeyB64: BOB_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    });

    const bobState1 = await applyCommit({
      state:            bobState,
      commit,
      myInitPrivKeyB64: BOB_KEY,
    });

    const carolState1 = await processWelcome({
      welcome,
      selfUserId:        'carol',
      myInitPrivKeyB64:  CAROL_KEY,
    });

    return { aliceState1, bobState1, carolState1, commit };
  }

  it('all three members agree on applicationSecretB64 after the add-commit', async () => {
    const { aliceState1, bobState1, carolState1 } = await epoch1States('ep1-agree');

    expect(aliceState1.applicationSecretB64).not.toBeNull();
    expect(aliceState1.applicationSecretB64).toBe(bobState1.applicationSecretB64);
    expect(aliceState1.applicationSecretB64).toBe(carolState1.applicationSecretB64);
  });

  it('all three members advance to epoch 1', async () => {
    const { aliceState1, bobState1, carolState1 } = await epoch1States('ep1-epoch');

    expect(aliceState1.epoch).toBe(1);
    expect(bobState1.epoch).toBe(1);
    expect(carolState1.epoch).toBe(1);
  });

  it('applicationSecretB64 at epoch 1 differs from epoch 0', async () => {
    const { aliceState, aliceState: { applicationSecretB64: secret0 } } =
      await (async () => {
        const s = await epoch0States('ep1-diff-0');
        return { aliceState: s.aliceState };
      })();
    const { aliceState1: { applicationSecretB64: secret1 } } =
      await epoch1States('ep1-diff-1');
    expect(secret1).not.toBe(secret0);
  });

  it('the add-commit carries a non-empty signature string', async () => {
    const { commit } = await epoch1States('ep1-sig');
    expect(typeof commit.signature).toBe('string');
    expect(commit.signature.length).toBeGreaterThan(0);
  });

  it('Carol is present in the epoch-1 roster for all members', async () => {
    const { aliceState1, bobState1, carolState1 } = await epoch1States('ep1-roster');
    for (const state of [aliceState1, bobState1, carolState1]) {
      expect(state.roster.some((m) => m.userId === 'carol')).toBe(true);
    }
  });
});

// ── Epoch-2: Alice removes Bob ────────────────────────────────────────────────

describe('epoch 2 — remove Bob', () => {
  async function fullChain(groupId) {
    const { aliceState, bobState } = await epoch0States(groupId);

    const { commit: addCommit, welcome: carolWelcome, nextState: aliceState1 } =
      await buildAddCommit({
        state:     aliceState,
        newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
        memberInitKeys: [
          { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
          { userId: 'bob',   leafIndex: 1, initKeyB64: BOB_KEY },
          { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
        ],
      });

    const bobState1   = await applyCommit({ state: bobState,   commit: addCommit, myInitPrivKeyB64: BOB_KEY });
    const carolState1 = await processWelcome({ welcome: carolWelcome, selfUserId: 'carol', myInitPrivKeyB64: CAROL_KEY });

    const { commit: removeCommit, nextState: aliceState2 } = await buildRemoveCommit({
      state:     aliceState1,
      targetUserId: 'bob',
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    });

    const carolState2 = await applyCommit({ state: carolState1, commit: removeCommit, myInitPrivKeyB64: CAROL_KEY });
    const bobState2   = await applyCommit({ state: bobState1,   commit: removeCommit, myInitPrivKeyB64: BOB_KEY });

    return { aliceState2, carolState2, bobState2, removeCommit };
  }

  it('Alice and Carol agree on applicationSecretB64 at epoch 2', async () => {
    const { aliceState2, carolState2 } = await fullChain('ep2-agree');
    expect(aliceState2.applicationSecretB64).not.toBeNull();
    expect(aliceState2.applicationSecretB64).toBe(carolState2.applicationSecretB64);
  });

  it('Bob has null applicationSecretB64 after being removed', async () => {
    const { bobState2 } = await fullChain('ep2-bob-null');
    expect(bobState2.applicationSecretB64).toBeNull();
  });

  it('Bob has null selfLeafIndex after being removed', async () => {
    const { bobState2 } = await fullChain('ep2-bob-leaf');
    expect(bobState2.selfLeafIndex).toBeNull();
  });

  it('all active members advance to epoch 2', async () => {
    const { aliceState2, carolState2, bobState2 } = await fullChain('ep2-epoch');
    expect(aliceState2.epoch).toBe(2);
    expect(carolState2.epoch).toBe(2);
    expect(bobState2.epoch).toBe(2);
  });

  it('the remove-commit carries a non-empty signature string', async () => {
    const { removeCommit } = await fullChain('ep2-sig');
    expect(typeof removeCommit.signature).toBe('string');
    expect(removeCommit.signature.length).toBeGreaterThan(0);
  });

  it('Bob is absent from the epoch-2 roster in Alice and Carol states', async () => {
    const { aliceState2, carolState2 } = await fullChain('ep2-roster');
    for (const state of [aliceState2, carolState2]) {
      expect(state.roster.some((m) => m.userId === 'bob')).toBe(false);
    }
  });

  it('epoch-2 applicationSecretB64 differs from epoch-1', async () => {
    const { aliceState, bobState } = await epoch0States('ep2-diff-base');
    const { nextState: aliceState1 } = await buildAddCommit({
      state:     aliceState,
      newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
        { userId: 'bob',   leafIndex: 1, initKeyB64: BOB_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    });
    const { nextState: aliceState2 } = await buildRemoveCommit({
      state: aliceState1,
      targetUserId: 'bob',
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    });
    expect(aliceState2.applicationSecretB64).not.toBe(aliceState1.applicationSecretB64);
  });
});

// ── Commit signing / verification ─────────────────────────────────────────────

describe('commit signature enforcement in applyCommit', () => {
  it('throws when the sender entry has no leafSigningPubKeyB64 in the local roster', async () => {
    const { aliceState, bobState } = await epoch0States('sig-missing-key');

    // Strip Alice's signing pub key from Bob's local view of the roster before the commit.
    const bobStateNoAliceSig = {
      ...bobState,
      roster: bobState.roster.map((m) =>
        m.userId === 'alice' ? { ...m, leafSigningPubKeyB64: null } : m,
      ),
    };

    const { commit } = await buildAddCommit({
      state:     aliceState,
      newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
        { userId: 'bob',   leafIndex: 1, initKeyB64: BOB_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    });

    await expect(
      applyCommit({ state: bobStateNoAliceSig, commit, myInitPrivKeyB64: BOB_KEY }),
    ).rejects.toThrow('No signing pub key for commit sender');
  });

  it('throws when verify_signature returns false (forged or corrupted commit)', async () => {
    const { aliceState, bobState } = await epoch0States('sig-bad-verify');

    const { commit } = await buildAddCommit({
      state:     aliceState,
      newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
        { userId: 'bob',   leafIndex: 1, initKeyB64: BOB_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    });

    // Override the mock to reject the next verification call.
    const protocol = await import('@mascaro101/echo-protocol');
    vi.mocked(protocol.verify_signature).mockReturnValueOnce(false);

    await expect(
      applyCommit({ state: bobState, commit, myInitPrivKeyB64: BOB_KEY }),
    ).rejects.toThrow();
  });

  it('commit epoch is incremented by exactly 1 relative to the prior state', async () => {
    const { aliceState } = await epoch0States('sig-epoch-inc');

    const { commit } = await buildAddCommit({
      state:     aliceState,
      newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
        { userId: 'bob',   leafIndex: 1, initKeyB64: BOB_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    });

    expect(commit.epoch).toBe(aliceState.epoch + 1);
  });

  it('applyCommit rejects a commit whose epoch does not exceed the current epoch', async () => {
    const { aliceState, bobState } = await epoch0States('sig-stale-epoch');

    const { commit } = await buildAddCommit({
      state:     aliceState,
      newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
        { userId: 'bob',   leafIndex: 1, initKeyB64: BOB_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    });

    // Downgrade the epoch on the commit to match the current state — must be rejected.
    const staleCommit = { ...commit, epoch: bobState.epoch };
    await expect(
      applyCommit({ state: bobState, commit: staleCommit, myInitPrivKeyB64: BOB_KEY }),
    ).rejects.toThrow('Invalid commit epoch');
  });

  it('applyCommit rejects a commit whose groupId does not match the local state', async () => {
    const { aliceState, bobState } = await epoch0States('sig-group-mismatch');

    const { commit } = await buildAddCommit({
      state:     aliceState,
      newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
        { userId: 'bob',   leafIndex: 1, initKeyB64: BOB_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    });

    const wrongGroupCommit = { ...commit, groupId: 'evil-group' };
    await expect(
      applyCommit({ state: bobState, commit: wrongGroupCommit, myInitPrivKeyB64: BOB_KEY }),
    ).rejects.toThrow('Commit groupId mismatch');
  });
});
