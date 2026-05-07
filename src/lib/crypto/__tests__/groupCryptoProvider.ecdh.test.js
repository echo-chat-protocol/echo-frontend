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

const { bytesToBase64, base64ToBytes } = await import('../../helpers');
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
const EVE_KEY = bytesToBase64(new Uint8Array(32).fill(0x04));

const ALICE_BOB_ROSTER = [
  { userId: 'alice', username: 'Alice', leafIndex: 0 },
  { userId: 'bob', username: 'Bob', leafIndex: 1 },
];

const ALL_INIT_KEYS = [
  { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
  { userId: 'bob', leafIndex: 1, initKeyB64: BOB_KEY },
  { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
];

async function initialPair(groupId) {
  const creatorState = await createNewGroupState({
    groupId,
    creatorUserId: 'alice',
    roster: ALICE_BOB_ROSTER,
    memberInitKeys: [
      { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
      { userId: 'bob', leafIndex: 1, initKeyB64: BOB_KEY },
    ],
  });
  const welcomes = await buildInitialWelcomes({
    creatorState,
    roster: ALICE_BOB_ROSTER,
    memberInitKeys: [{ userId: 'bob', leafIndex: 1, initKeyB64: BOB_KEY }],
  });
  const bobState = await processWelcome({
    welcome: welcomes[0],
    selfUserId: 'bob',
    myInitPrivKeyB64: BOB_KEY,
  });
  return { creatorState, bobState };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('groupCryptoProvider adversarial welcomes', () => {
  it('rejects processing a welcome with the wrong private key', async () => {
    const { creatorState } = await initialPair('adv-welcome-1');
    const { welcome } = await buildAddCommit({
      state: creatorState,
      newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
      memberInitKeys: ALL_INIT_KEYS,
    });

    await expect(
      processWelcome({
        welcome,
        selfUserId: 'carol',
        myInitPrivKeyB64: EVE_KEY,
      }),
    ).rejects.toThrow();
  });
});

describe('groupCryptoProvider adversarial commits', () => {
  it('returns null applicationSecretB64 when a path-secret ciphertext is tampered', async () => {
    const { creatorState, bobState } = await initialPair('adv-commit-1');
    const { commit } = await buildAddCommit({
      state: creatorState,
      newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
      memberInitKeys: ALL_INIT_KEYS,
    });

    const tamperedCommit = {
      ...commit,
      updatePath: commit.updatePath.map((entry) => ({
        ...entry,
        encryptedPathSecrets: entry.encryptedPathSecrets.map((secretEntry) => {
          if (secretEntry.recipientNodeIdx !== 2) return secretEntry;
          const bytes = base64ToBytes(secretEntry.encryptedB64);
          bytes[0] ^= 0xff;
          return { ...secretEntry, encryptedB64: bytesToBase64(bytes) };
        }),
      })),
    };

    const nextState = await applyCommit({
      state: bobState,
      commit: tamperedCommit,
      myInitPrivKeyB64: BOB_KEY,
    });

    expect(nextState.applicationSecretB64).toBeNull();
  });
});

describe('groupCryptoProvider adversarial application messages', () => {
  it('fails closed when header generation is tampered', async () => {
    const { creatorState, bobState } = await initialPair('adv-msg-1');
    const encrypted = await encryptApplicationMessage({
      state: creatorState,
      plaintextBytes: encodeText('confidential'),
    });

    const tamperedHeader = {
      ...encrypted.header,
      generation: encrypted.header.generation + 1,
    };

    await expect(
      decryptApplicationMessage({
        state: bobState,
        header: Buffer.from(JSON.stringify(tamperedHeader), 'utf8').toString('base64'),
        ciphertext: encrypted.ciphertextB64,
      }),
    ).rejects.toThrow();
  });
});

describe('groupCryptoProvider removal security', () => {
  it('removed members cannot derive the next epoch secret', async () => {
    const creatorState = await createNewGroupState({
      groupId: 'adv-remove-1',
      creatorUserId: 'alice',
      roster: [
        { userId: 'alice', username: 'Alice', leafIndex: 0 },
        { userId: 'bob', username: 'Bob', leafIndex: 1 },
        { userId: 'carol', username: 'Carol', leafIndex: 2 },
      ],
      memberInitKeys: ALL_INIT_KEYS,
    });
    const welcomes = await buildInitialWelcomes({
      creatorState,
      roster: creatorState.roster,
      memberInitKeys: [
        { userId: 'bob', leafIndex: 1, initKeyB64: BOB_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    });
    const bobState = await processWelcome({
      welcome: welcomes.find((welcome) => welcome.recipientUserId === 'bob'),
      selfUserId: 'bob',
      myInitPrivKeyB64: BOB_KEY,
    });

    const { commit } = await buildRemoveCommit({
      state: creatorState,
      targetUserId: 'bob',
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: ALICE_KEY },
        { userId: 'carol', leafIndex: 2, initKeyB64: CAROL_KEY },
      ],
    });
    const bobNext = await applyCommit({
      state: bobState,
      commit,
      myInitPrivKeyB64: BOB_KEY,
    });

    expect(bobNext.applicationSecretB64).toBeNull();
    expect(bobNext.selfLeafIndex).toBeNull();
  });
});
