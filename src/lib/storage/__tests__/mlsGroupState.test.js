import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

vi.mock('@mascaro101/echo-protocol', () => ({
  default: vi.fn(async () => {}),
  encrypt: vi.fn(async (plaintext) => plaintext),
  decrypt: vi.fn(async (ciphertext) => ciphertext),
  hkdf_derive: vi.fn((_ikm, _salt, _info, len) => new Uint8Array(len).fill(7)),
}));

const { default: eld } = await import('../EncryptedLocalDatabase');

describe('MLS group state persistence', () => {
  beforeEach(async () => {
    await eld.initializeDB();
    await eld.createUser('alice', 'test-password');
    await eld.unlock('alice', 'test-password');
    await eld.deleteMlsGroupState('group-1');
  });

  it('stores and loads the richer MLS group state', async () => {
    const state = {
      stateVersion: 1,
      groupId: 'group-1',
      epoch: 2,
      cipherSuite: 'MLS-MVP/X25519_AES256GCM_SHA256',
      selfUserId: 'alice',
      selfLeafIndex: 0,
      applicationMessageCounter: 4,
      groupKeyB64: 'group-key-b64',
      roster: [{ userId: 'alice', username: 'Alice', leafIndex: 0 }],
      tree: { nodes: [], root: null },
      secrets: { epochSecretsB64: null, initSecretB64: null },
      pendingCommits: [],
    };

    await eld.storeMlsGroupState('group-1', state);

    const loaded = await eld.getMlsGroupState('group-1');

    expect(loaded).toEqual(state);
  });
});
