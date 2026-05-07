import { webcrypto, createCipheriv, createDecipheriv } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.atob) globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
if (!globalThis.btoa) globalThis.btoa = (bin) => Buffer.from(bin, 'binary').toString('base64');

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
    default: vi.fn(async () => {}),
    encrypt_aad_bytes: vi.fn((pt, key, nonce, aad) => aesgcmEncryptSync(pt, key, nonce, aad)),
    decrypt_aad_bytes: vi.fn((ct, key, nonce, aad) => aesgcmDecryptSync(ct, key, nonce, aad)),
    diffie_hellman: vi.fn((a, b) => new Uint8Array(32).map((_, index) => a[index] ^ b[index])),
    generate_private_ephemeral_key: vi.fn((rand) => new Uint8Array(rand).slice(0, 32)),
    generate_public_ephemeral_key: vi.fn((priv) => new Uint8Array(priv).slice(0, 32)),
    hkdf_derive: vi.fn((ikm, _salt, info, len) => deriveBytes(len, new Uint8Array(ikm), new Uint8Array(info))),
    derive_ed25519_keypair_from_x25519: vi.fn((priv) => new Uint8Array(priv).slice(0, 32)),
    convert_x25519_to_xeddsa: vi.fn((priv) => { const b = new Uint8Array(64); b.set(new Uint8Array(priv).slice(0, 32), 0); b.set(new Uint8Array(priv).slice(0, 32), 32); return b; }),
    compute_determenistic_nonce: vi.fn((prefix, msg) => deriveBytes(32, new Uint8Array(prefix), new Uint8Array(msg))),
    compute_nonce_point: vi.fn((nonce) => new Uint8Array(nonce).slice(0, 32)),
    compute_challenge_hash: vi.fn((R, A, M) => deriveBytes(32, new Uint8Array(R), new Uint8Array(A), new Uint8Array(M))),
    compute_signature_scaler: vi.fn((nonce, challenge, scalar) => deriveBytes(32, new Uint8Array(nonce), new Uint8Array(challenge), new Uint8Array(scalar))),
    compute_signature: vi.fn((R, s) => { const sig = new Uint8Array(64); sig.set(new Uint8Array(R).slice(0, 32), 0); sig.set(new Uint8Array(s).slice(0, 32), 32); return sig; }),
    verify_signature: vi.fn(() => true),
  };
});

vi.mock('../keySchedule.js', () => ({
  advanceEpoch: vi.fn(async ({ initSecret, commitSecret, groupId, epoch }) => {
    const epochSecret = deriveBytes(32, initSecret, commitSecret, encodeText(`${groupId}|${epoch}|epoch`));
    return {
      epochSecret,
      applicationSecret: deriveBytes(32, epochSecret, encodeText('encryption')),
      senderDataSecret: deriveBytes(32, epochSecret, encodeText('sender_data')),
      nextInitSecret: deriveBytes(32, epochSecret, encodeText('init')),
    };
  }),
  deriveSecret: vi.fn(async (secret, label) => deriveBytes(32, secret, encodeText(label))),
  expandWithLabel: vi.fn(async (secret, label, context, length) => deriveBytes(length, secret, encodeText(label), context)),
  deriveAppKeyAndNonce: vi.fn(async (applicationSecret, senderLeafIndex, generation) => ({
    key: deriveBytes(32, applicationSecret, encodeText(`key|${senderLeafIndex}|${generation}`)),
    nonce: deriveBytes(12, applicationSecret, encodeText(`nonce|${senderLeafIndex}|${generation}`)),
  })),
  ratchetAppSecret: vi.fn(async (applicationSecret, senderLeafIndex, generation) => (
    deriveBytes(32, applicationSecret, encodeText(`secret|${senderLeafIndex}|${generation}`))
  )),
}));

vi.mock('../../../../../../utils/storage/EncryptedLocalDatabase', () => ({
  default: {
    isUnlocked: vi.fn(() => true),
    storeMlsGroupState: vi.fn(async () => {}),
    getMlsGroupState: vi.fn(async () => null),
  },
}));

const { bytesToBase64 } = await import('../../helpers');
const {
  applyCommit,
  buildAddCommit,
  buildInitialWelcomes,
  buildRemoveCommit,
  createNewGroupState,
  decryptApplicationMessage,
  encryptApplicationMessage,
  processWelcome,
} = await import('../groupCryptoProvider.js');

const ALICE_KEY = bytesToBase64(new Uint8Array(32).fill(0x01));
const BOB_KEY = bytesToBase64(new Uint8Array(32).fill(0x02));
const CAROL_KEY = bytesToBase64(new Uint8Array(32).fill(0x03));

const ALICE_BOB_ROSTER = [
  { userId: 'alice', username: 'Alice', leafIndex: 0 },
  { userId: 'bob', username: 'Bob', leafIndex: 1 },
];

const THREE_PERSON_ROSTER = [
  { userId: 'alice', username: 'Alice', leafIndex: 0 },
  { userId: 'bob', username: 'Bob', leafIndex: 1 },
  { userId: 'carol', username: 'Carol', leafIndex: 2 },
];

const ALICE_BOB_INIT_KEYS = [
  { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
  { userId: 'bob', leafIndex: 1, initKeyB64: BOB_KEY },
];

const ALL_INIT_KEYS = [
  { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
  { userId: 'bob', leafIndex: 1, initKeyB64: BOB_KEY },
  { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
];

async function buildCreatorAndWelcomes(groupId, roster, memberInitKeys) {
  const creatorState = await createNewGroupState({
    groupId,
    creatorUserId: 'alice',
    roster,
    memberInitKeys,
  });
  const welcomes = await buildInitialWelcomes({ creatorState, roster, memberInitKeys });
  return { creatorState, welcomes };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('groupCryptoProvider state creation', () => {
  it('creates epoch-0 state with applicationSecretB64, initSecretB64, tree nodes, and compatibility aliases', async () => {
    const state = await createNewGroupState({
      groupId: 'group-state-1',
      creatorUserId: 'alice',
      roster: ALICE_BOB_ROSTER,
      memberInitKeys: ALICE_BOB_INIT_KEYS,
    });

    expect(state.epoch).toBe(0);
    expect(state.selfLeafIndex).toBe(0);
    expect(typeof state.applicationSecretB64).toBe('string');
    expect(typeof state.initSecretB64).toBe('string');
    expect(state.senderGenerations).toEqual({});
    expect(state.groupKeyB64).toBe(state.applicationSecretB64);
    expect(state.applicationMessageCounter).toBe(0);
    expect(state.tree.nodes).toHaveLength(3);
    expect(state.secrets.epochInitSecretB64).toEqual(expect.any(String));
    expect(state.secrets.epochCommitSecretB64).toEqual(expect.any(String));
  });
});

describe('groupCryptoProvider welcomes', () => {
  it('buildInitialWelcomes and processWelcome put members on the same application secret', async () => {
    const { creatorState, welcomes } = await buildCreatorAndWelcomes(
      'group-welcome-1',
      THREE_PERSON_ROSTER,
      ALL_INIT_KEYS,
    );

    const bobWelcome = welcomes.find((welcome) => welcome.recipientUserId === 'bob');
    const carolWelcome = welcomes.find((welcome) => welcome.recipientUserId === 'carol');

    const bobState = await processWelcome({
      welcome: bobWelcome,
      selfUserId: 'bob',
      myInitPrivKeyB64: BOB_KEY,
    });
    const carolState = await processWelcome({
      welcome: carolWelcome,
      selfUserId: 'carol',
      myInitPrivKeyB64: CAROL_KEY,
    });

    expect(bobState.applicationSecretB64).toBe(creatorState.applicationSecretB64);
    expect(carolState.applicationSecretB64).toBe(creatorState.applicationSecretB64);
    expect(bobState.initSecretB64).toBe(creatorState.initSecretB64);
    expect(carolState.initSecretB64).toBe(creatorState.initSecretB64);
    expect(bobState.tree.nodes).toHaveLength(5);
    expect(carolState.selfLeafIndex).toBe(2);
  });
});

describe('groupCryptoProvider application messages', () => {
  it('derives header generation and decrypts with a matching receiver state', async () => {
    const { creatorState, welcomes } = await buildCreatorAndWelcomes(
      'group-msg-1',
      ALICE_BOB_ROSTER,
      ALICE_BOB_INIT_KEYS,
    );
    const bobState = await processWelcome({
      welcome: welcomes.find((welcome) => welcome.recipientUserId === 'bob'),
      selfUserId: 'bob',
      myInitPrivKeyB64: BOB_KEY,
    });

    const encrypted = await encryptApplicationMessage({
      state: creatorState,
      plaintextBytes: encodeText('hello group'),
    });
    const plaintextBytes = await decryptApplicationMessage({
      state: bobState,
      header: encrypted.headerB64,
      ciphertext: encrypted.ciphertextB64,
    });

    expect(encrypted.header.generation).toBe(0);
    expect(encrypted.header).not.toHaveProperty('nonceB64');
    expect(encrypted.newState.senderGenerations['0']).toBe(1);
    expect(encrypted.newState.applicationSecretB64).toBe(creatorState.applicationSecretB64);
    expect(new TextDecoder().decode(plaintextBytes)).toBe('hello group');
  });

  it('advances the receiver state after each decrypted application message', async () => {
    const { creatorState, welcomes } = await buildCreatorAndWelcomes(
      'group-msg-2',
      ALICE_BOB_ROSTER,
      ALICE_BOB_INIT_KEYS,
    );
    const bobState = await processWelcome({
      welcome: welcomes.find((welcome) => welcome.recipientUserId === 'bob'),
      selfUserId: 'bob',
      myInitPrivKeyB64: BOB_KEY,
    });

    const firstEncrypted = await encryptApplicationMessage({
      state: creatorState,
      plaintextBytes: encodeText('first'),
    });
    const firstDecrypted = await decryptApplicationMessage({
      state: bobState,
      header: firstEncrypted.headerB64,
      ciphertext: firstEncrypted.ciphertextB64,
      includeNewState: true,
    });

    const secondEncrypted = await encryptApplicationMessage({
      state: firstEncrypted.newState,
      plaintextBytes: encodeText('second'),
    });
    const secondDecrypted = await decryptApplicationMessage({
      state: firstDecrypted.newState,
      header: secondEncrypted.headerB64,
      ciphertext: secondEncrypted.ciphertextB64,
      includeNewState: true,
    });

    expect(new TextDecoder().decode(firstDecrypted.plaintextBytes)).toBe('first');
    expect(new TextDecoder().decode(secondDecrypted.plaintextBytes)).toBe('second');
    expect(firstDecrypted.newState.senderGenerations['0']).toBe(1);
    expect(secondDecrypted.newState.senderGenerations['0']).toBe(2);
    expect(secondDecrypted.newState.applicationSecretB64).toBe(secondEncrypted.newState.applicationSecretB64);
  });

  it('allows different senders to send within the same epoch without mutating the shared application secret', async () => {
    const { creatorState, welcomes } = await buildCreatorAndWelcomes(
      'group-msg-3',
      THREE_PERSON_ROSTER,
      ALL_INIT_KEYS,
    );
    const bobState = await processWelcome({
      welcome: welcomes.find((welcome) => welcome.recipientUserId === 'bob'),
      selfUserId: 'bob',
      myInitPrivKeyB64: BOB_KEY,
    });
    const carolState = await processWelcome({
      welcome: welcomes.find((welcome) => welcome.recipientUserId === 'carol'),
      selfUserId: 'carol',
      myInitPrivKeyB64: CAROL_KEY,
    });

    const aliceEncrypted = await encryptApplicationMessage({
      state: creatorState,
      plaintextBytes: encodeText('from alice'),
    });
    const bobAfterAlice = await decryptApplicationMessage({
      state: bobState,
      header: aliceEncrypted.headerB64,
      ciphertext: aliceEncrypted.ciphertextB64,
      includeNewState: true,
    });

    const carolEncrypted = await encryptApplicationMessage({
      state: carolState,
      plaintextBytes: encodeText('from carol'),
    });
    const bobAfterCarol = await decryptApplicationMessage({
      state: bobAfterAlice.newState,
      header: carolEncrypted.headerB64,
      ciphertext: carolEncrypted.ciphertextB64,
      includeNewState: true,
    });

    expect(new TextDecoder().decode(bobAfterAlice.plaintextBytes)).toBe('from alice');
    expect(new TextDecoder().decode(bobAfterCarol.plaintextBytes)).toBe('from carol');
    expect(bobAfterCarol.newState.applicationSecretB64).toBe(creatorState.applicationSecretB64);
    expect(bobAfterCarol.newState.senderGenerations['0']).toBe(1);
    expect(bobAfterCarol.newState.senderGenerations['2']).toBe(1);
  });
});

describe('groupCryptoProvider commits', () => {
  it('buildAddCommit lets the receiver and the added member derive the same next epoch secret', async () => {
    const { creatorState, welcomes } = await buildCreatorAndWelcomes(
      'group-add-1',
      ALICE_BOB_ROSTER,
      ALICE_BOB_INIT_KEYS,
    );
    const bobState = await processWelcome({
      welcome: welcomes.find((welcome) => welcome.recipientUserId === 'bob'),
      selfUserId: 'bob',
      myInitPrivKeyB64: BOB_KEY,
    });

    const { commit, welcome, nextState: aliceNext } = await buildAddCommit({
      state: creatorState,
      newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
      memberInitKeys: ALL_INIT_KEYS,
    });
    const bobNext = await applyCommit({
      state: bobState,
      commit,
      myInitPrivKeyB64: BOB_KEY,
    });
    const carolState = await processWelcome({
      welcome,
      selfUserId: 'carol',
      myInitPrivKeyB64: CAROL_KEY,
    });

    expect(commit).toHaveProperty('updatePath');
    expect(commit).not.toHaveProperty('encryptedKeys');
    expect(commit.treePublicNodes).toHaveLength(5);
    expect(aliceNext.epoch).toBe(1);
    expect(bobNext.applicationSecretB64).toBe(aliceNext.applicationSecretB64);
    expect(carolState.applicationSecretB64).toBe(aliceNext.applicationSecretB64);
  });

  it('buildAddCommit hydrates missing member leaf keys from memberInitKeys before encrypting the update path', async () => {
    const creatorState = await createNewGroupState({
      groupId: 'group-add-repair-1',
      creatorUserId: 'alice',
      roster: ALICE_BOB_ROSTER,
    });
    const welcomes = await buildInitialWelcomes({
      creatorState,
      roster: ALICE_BOB_ROSTER,
      memberInitKeys: [{ userId: 'bob', leafIndex: 1, initKeyB64: BOB_KEY }],
    });
    const bobState = await processWelcome({
      welcome: welcomes.find((entry) => entry.recipientUserId === 'bob'),
      selfUserId: 'bob',
      myInitPrivKeyB64: BOB_KEY,
    });

    const { commit, nextState: aliceNext } = await buildAddCommit({
      state: creatorState,
      newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
      memberInitKeys: ALL_INIT_KEYS,
    });
    const bobNext = await applyCommit({
      state: bobState,
      commit,
      myInitPrivKeyB64: BOB_KEY,
    });

    expect(bobNext.applicationSecretB64).toBe(aliceNext.applicationSecretB64);
    expect(bobNext.applicationSecretB64).not.toBeNull();
  });

  it('buildRemoveCommit blanks the removed member while remaining members keep the new epoch secret', async () => {
    const { creatorState, welcomes } = await buildCreatorAndWelcomes(
      'group-remove-1',
      THREE_PERSON_ROSTER,
      ALL_INIT_KEYS,
    );
    const carolState = await processWelcome({
      welcome: welcomes.find((welcome) => welcome.recipientUserId === 'carol'),
      selfUserId: 'carol',
      myInitPrivKeyB64: CAROL_KEY,
    });
    const bobState = await processWelcome({
      welcome: welcomes.find((welcome) => welcome.recipientUserId === 'bob'),
      selfUserId: 'bob',
      myInitPrivKeyB64: BOB_KEY,
    });

    const { commit, nextState: aliceNext } = await buildRemoveCommit({
      state: creatorState,
      targetUserId: 'bob',
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    });
    const carolNext = await applyCommit({
      state: carolState,
      commit,
      myInitPrivKeyB64: CAROL_KEY,
    });
    const bobNext = await applyCommit({
      state: bobState,
      commit,
      myInitPrivKeyB64: BOB_KEY,
    });

    expect(commit.type).toBe('remove');
    expect(commit.targetUserId).toBe('bob');
    expect(carolNext.applicationSecretB64).toBe(aliceNext.applicationSecretB64);
    expect(bobNext.applicationSecretB64).toBeNull();
    expect(bobNext.selfLeafIndex).toBeNull();
  });

  it('resets sender generation to 0 after a remove commit even when the sender had already sent messages', async () => {
    const { creatorState, welcomes } = await buildCreatorAndWelcomes(
      'group-remove-2',
      THREE_PERSON_ROSTER,
      ALL_INIT_KEYS,
    );
    const creatorAfterMessage = (await encryptApplicationMessage({
      state: creatorState,
      plaintextBytes: encodeText('before remove'),
    })).newState;
    const carolState = await processWelcome({
      welcome: welcomes.find((welcome) => welcome.recipientUserId === 'carol'),
      selfUserId: 'carol',
      myInitPrivKeyB64: CAROL_KEY,
    });

    const { commit, nextState: aliceNext } = await buildRemoveCommit({
      state: creatorAfterMessage,
      targetUserId: 'bob',
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    });
    const carolNext = await applyCommit({
      state: carolState,
      commit,
      myInitPrivKeyB64: CAROL_KEY,
    });
    const encrypted = await encryptApplicationMessage({
      state: aliceNext,
      plaintextBytes: encodeText('after remove'),
    });

    expect(aliceNext.senderGenerations['0'] ?? 0).toBe(0);
    expect(aliceNext.applicationMessageCounter).toBe(0);
    expect(carolNext.senderGenerations['2'] ?? 0).toBe(0);
    expect(carolNext.applicationMessageCounter).toBe(0);
    expect(encrypted.header.generation).toBe(0);
  });
});
