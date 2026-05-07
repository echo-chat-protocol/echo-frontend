import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.atob) globalThis.atob = (b) => Buffer.from(b, 'base64').toString('binary');
if (!globalThis.btoa) globalThis.btoa = (b) => Buffer.from(b, 'binary').toString('base64');

// Key-tagged WASM mock: encrypt appends "::<key[0]>" so decrypt can detect key mismatch
vi.mock('@mascaro101/echo-protocol', () => ({
  default: vi.fn(async () => {}),
  encrypt: vi.fn(async (pt, key) => `${pt}::${key[0]}`),
  decrypt: vi.fn(async (ct, key) => {
    const sep = ct.lastIndexOf('::');
    const tag = ct.slice(sep + 2);
    if (tag !== String(key[0])) throw new Error('decrypt failed: wrong key');
    return ct.slice(0, sep);
  }),
}));

// Fast deterministic KDF: derives from first byte of password so different passwords → different keys
vi.mock('@noble/hashes/argon2.js', () => ({
  argon2id: vi.fn((pw) => new Uint8Array(32).fill(pw[0] ?? 1)),
}));

const { EncryptedLocalDatabase } = await import('../EncryptedLocalDatabase.js');

// Helper: fresh instance with unique DB name per test (via unique class instance)
// fake-indexeddb shares the same in-memory DB across all EncryptedLocalDatabase
// instances in one file, so we isolate tests by using unique userIds.
let counter = 0;
function uid() {
  return `user-${++counter}`;
}

// ─── 1. Lifecycle ────────────────────────────────────────────────────────────

describe('Lifecycle: createUser / unlock / lock', () => {
  let db;
  beforeEach(() => {
    db = new EncryptedLocalDatabase();
  });

  it('createUser sets isUnlocked() true', async () => {
    const userId = uid();
    expect(db.isUnlocked()).toBe(false);
    await db.createUser(userId, 'pass');
    expect(db.isUnlocked()).toBe(true);
  });

  it('createUser throws on empty userId', async () => {
    await expect(db.createUser('', 'pass')).rejects.toThrow('Missing userId');
  });

  it('createUser throws on empty password', async () => {
    await expect(db.createUser(uid(), '')).rejects.toThrow('Missing password');
  });

  it('createUser throws if user already exists', async () => {
    const userId = uid();
    await db.createUser(userId, 'pass');
    const db2 = new EncryptedLocalDatabase();
    await expect(db2.createUser(userId, 'pass')).rejects.toThrow('User already exists');
  });

  it('unlock succeeds with correct password', async () => {
    const userId = uid();
    await db.createUser(userId, 'correct');
    db.lock();
    expect(db.isUnlocked()).toBe(false);
    await db.unlock(userId, 'correct');
    expect(db.isUnlocked()).toBe(true);
  });

  it('unlock throws and locks on wrong password', async () => {
    const userId = uid();
    await db.createUser(userId, 'correct');
    db.lock();
    await expect(db.unlock(userId, 'wrong')).rejects.toThrow('Invalid password');
    expect(db.isUnlocked()).toBe(false);
  });

  it('unlock throws on empty userId', async () => {
    await expect(db.unlock('', 'pass')).rejects.toThrow('Missing userId');
  });

  it('unlock throws on non-existent user', async () => {
    await expect(db.unlock('ghost', 'pass')).rejects.toThrow('User does not exist');
  });

  it('lock zeroes dek and clears currentUserId', async () => {
    const userId = uid();
    await db.createUser(userId, 'pass');
    const dekRef = db.dek;
    db.lock();
    // dek buffer was zeroed in-place
    expect(dekRef.every((b) => b === 0)).toBe(true);
    expect(db.dek).toBeNull();
    expect(db.currentUserId).toBeNull();
    expect(db.isUnlocked()).toBe(false);
  });

  it('_ensureUnlocked throws when locked', async () => {
    expect(() => db._ensureUnlocked()).toThrow('Database is locked');
  });

  it('getCurrentUserId returns currentUserId', async () => {
    const userId = uid();
    await db.createUser(userId, 'pass');
    expect(db.getCurrentUserId()).toBe(userId);
  });
});

// ─── 2. Key encoding helpers ─────────────────────────────────────────────────

describe('Key encoding helpers: _uint8ToBase64 / _base64ToUint8', () => {
  let db;
  beforeEach(() => {
    db = new EncryptedLocalDatabase();
  });

  it('roundtrips a known Uint8Array', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    const b64 = db._uint8ToBase64(original);
    const restored = db._base64ToUint8(b64);
    expect(restored).toEqual(original);
  });

  it('roundtrips a 32-byte key', () => {
    const key = new Uint8Array(32).map((_, i) => i * 8);
    expect(db._base64ToUint8(db._uint8ToBase64(key))).toEqual(key);
  });
});

// ─── 3. Identity keys ────────────────────────────────────────────────────────

describe('Identity keys', () => {
  let db;
  let userId;
  beforeEach(async () => {
    db = new EncryptedLocalDatabase();
    userId = uid();
    await db.createUser(userId, 'pass');
  });

  it('returns null when no identity key stored', async () => {
    expect(await db.getIdentityKeys()).toBeNull();
  });

  it('stores and retrieves identity keys', async () => {
    const keys = { ik_pub: 'pub', ik_priv: 'priv' };
    await db.storeIdentityKeys(keys);
    expect(await db.getIdentityKeys()).toEqual(keys);
  });

  it('overwrites existing identity keys on second store', async () => {
    await db.storeIdentityKeys({ v: 1 });
    await db.storeIdentityKeys({ v: 2 });
    expect(await db.getIdentityKeys()).toEqual({ v: 2 });
  });

  it('throws when locked', async () => {
    db.lock();
    await expect(db.getIdentityKeys()).rejects.toThrow('Database is locked');
  });
});

// ─── 4. Peer identity keys ───────────────────────────────────────────────────

describe('Peer identity keys', () => {
  let db;
  let userId;
  beforeEach(async () => {
    db = new EncryptedLocalDatabase();
    userId = uid();
    await db.createUser(userId, 'pass');
  });

  it('returns null for unknown peer', async () => {
    expect(await db.getPeerIdentityKey('bob')).toBeNull();
  });

  it('returns null for empty peerId', async () => {
    expect(await db.getPeerIdentityKey('')).toBeNull();
  });

  it('stores and retrieves peer identity key', async () => {
    const keys = { ik_pub_x: 'x', ik_pub_ed: 'ed' };
    await db.storePeerIdentityKey('bob', keys);
    expect(await db.getPeerIdentityKey('bob')).toEqual(keys);
  });

  it('peer keys are directional: A→B stored under current user', async () => {
    const keys = { direction: 'alice-to-bob' };
    await db.storePeerIdentityKey('bob', keys);

    // Switch user — should not see alice's peer key
    const db2 = new EncryptedLocalDatabase();
    const userId2 = uid();
    await db2.createUser(userId2, 'pass');
    expect(await db2.getPeerIdentityKey('bob')).toBeNull();
  });

  it('throws on missing peerId', async () => {
    await expect(db.storePeerIdentityKey('', {})).rejects.toThrow('Missing peerId');
  });
});

// ─── 5. DR root keys ─────────────────────────────────────────────────────────

describe('DR root keys', () => {
  let db;
  beforeEach(async () => {
    db = new EncryptedLocalDatabase();
    await db.createUser(uid(), 'pass');
  });

  it('returns null when no root key stored', async () => {
    expect(await db.getRootKey('bob')).toBeNull();
  });

  it('stores and retrieves a root key', async () => {
    const rootKey = new Uint8Array(32).fill(42);
    await db.storeRootKey('bob', rootKey);
    const result = await db.getRootKey('bob');
    expect(result.rootKey).toEqual(rootKey);
  });

  it('deletes a root key', async () => {
    const rootKey = new Uint8Array(32).fill(9);
    await db.storeRootKey('bob', rootKey);
    await db.deleteRootKey('bob');
    expect(await db.getRootKey('bob')).toBeNull();
  });

  it('throws on invalid root key length', async () => {
    await expect(db.storeRootKey('bob', new Uint8Array(16))).rejects.toThrow('Invalid root key length');
  });

  it('throws on non-Uint8Array root key', async () => {
    await expect(db.storeRootKey('bob', 'not-a-key')).rejects.toThrow('Invalid root key length');
  });
});

// ─── 6. DR chain keys (sending + receiving) ──────────────────────────────────

describe('DR sending chain keys', () => {
  let db;
  beforeEach(async () => {
    db = new EncryptedLocalDatabase();
    await db.createUser(uid(), 'pass');
  });

  it('returns null when no sending chain key stored', async () => {
    expect(await db.getSendingChainKey('bob')).toBeNull();
  });

  it('stores and retrieves a sending chain key', async () => {
    const key = new Uint8Array(32).fill(11);
    await db.storeSendingChainKey('bob', key);
    const result = await db.getSendingChainKey('bob');
    expect(result.sendingChainKey).toEqual(key);
  });

  it('deletes a sending chain key', async () => {
    await db.storeSendingChainKey('bob', new Uint8Array(32).fill(3));
    await db.deleteSendingChainKey('bob');
    expect(await db.getSendingChainKey('bob')).toBeNull();
  });

  it('throws on invalid length', async () => {
    await expect(db.storeSendingChainKey('bob', new Uint8Array(31))).rejects.toThrow('Invalid sending chain key length');
  });
});

describe('DR receiving chain keys', () => {
  let db;
  beforeEach(async () => {
    db = new EncryptedLocalDatabase();
    await db.createUser(uid(), 'pass');
  });

  it('returns null when no receiving chain key stored', async () => {
    expect(await db.getReceivingChainKey('bob')).toBeNull();
  });

  it('stores and retrieves a receiving chain key', async () => {
    const key = new Uint8Array(32).fill(22);
    await db.storeReceivingChainKey('bob', key);
    const result = await db.getReceivingChainKey('bob');
    expect(result.receivingChainKey).toEqual(key);
  });

  it('deletes a receiving chain key', async () => {
    await db.storeReceivingChainKey('bob', new Uint8Array(32).fill(5));
    await db.deleteReceivingChainKey('bob');
    expect(await db.getReceivingChainKey('bob')).toBeNull();
  });

  it('throws on invalid length', async () => {
    await expect(db.storeReceivingChainKey('bob', new Uint8Array(33))).rejects.toThrow('Invalid receiving chain key length');
  });
});

// ─── 7. Message store ────────────────────────────────────────────────────────

describe('Message store', () => {
  let db;
  beforeEach(async () => {
    db = new EncryptedLocalDatabase();
    await db.createUser(uid(), 'pass');
  });

  it('returns empty array when no messages stored', async () => {
    expect(await db.getMessages('bob')).toEqual([]);
  });

  it('stores and retrieves a single message', async () => {
    const msg = { _id: 'msg1', text: 'hello', createdAt: '2025-01-01T00:00:00Z' };
    await db.storeMessage('bob', msg);
    const messages = await db.getMessages('bob');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(msg);
  });

  it('retrieves multiple messages sorted by createdAt', async () => {
    const msg1 = { _id: 'a', text: 'first', createdAt: '2025-01-01T00:00:00Z' };
    const msg2 = { _id: 'b', text: 'second', createdAt: '2025-01-02T00:00:00Z' };
    const msg3 = { _id: 'c', text: 'third', createdAt: '2025-01-03T00:00:00Z' };
    // Store out of order
    await db.storeMessage('bob', msg3);
    await db.storeMessage('bob', msg1);
    await db.storeMessage('bob', msg2);
    const messages = await db.getMessages('bob');
    expect(messages.map((m) => m._id)).toEqual(['a', 'b', 'c']);
  });

  it('isolates messages by conversation (different peer)', async () => {
    await db.storeMessage('bob', { _id: 'm1', text: 'to bob', createdAt: '2025-01-01T00:00:00Z' });
    await db.storeMessage('carol', { _id: 'm2', text: 'to carol', createdAt: '2025-01-01T00:00:00Z' });
    expect(await db.getMessages('bob')).toHaveLength(1);
    expect(await db.getMessages('carol')).toHaveLength(1);
  });
});

// ─── 8. Ephemeral data ───────────────────────────────────────────────────────

describe('Ephemeral data', () => {
  let db;
  beforeEach(async () => {
    db = new EncryptedLocalDatabase();
    await db.createUser(uid(), 'pass');
  });

  it('returns null when no ephemeral data stored', async () => {
    expect(await db.getEphemeralData('bob')).toBeNull();
  });

  it('stores and retrieves ephemeral data', async () => {
    const data = { ek_pub: 'ephem-pub', ek_priv: 'ephem-priv' };
    await db.storeEphemeralData('bob', data);
    expect(await db.getEphemeralData('bob')).toEqual(data);
  });

  it('deletes ephemeral data', async () => {
    await db.storeEphemeralData('bob', { x: 1 });
    await db.deleteEphemeralData('bob');
    expect(await db.getEphemeralData('bob')).toBeNull();
  });

  it('overwrites on second store', async () => {
    await db.storeEphemeralData('bob', { v: 1 });
    await db.storeEphemeralData('bob', { v: 2 });
    expect(await db.getEphemeralData('bob')).toEqual({ v: 2 });
  });
});

// ─── 9. Message counters ─────────────────────────────────────────────────────

describe('Message counters: Ns, Nr, Pn, skipped keys', () => {
  let db;
  beforeEach(async () => {
    db = new EncryptedLocalDatabase();
    await db.createUser(uid(), 'pass');
  });

  it('getCurrentNs returns null when not stored', async () => {
    expect(await db.getCurrentNs('bob')).toBeNull();
  });

  it('stores and retrieves Ns', async () => {
    await db.storeCurrentSendingNumber('bob', 5);
    expect(await db.getCurrentNs('bob')).toBe(5);
  });

  it('deleteCurrentSendingNumber removes entry', async () => {
    await db.storeCurrentSendingNumber('bob', 3);
    await db.deleteCurrentSendingNumber('bob');
    expect(await db.getCurrentNs('bob')).toBeNull();
  });

  it('stores and retrieves Nr', async () => {
    await db.storeCurrentReceivingNumber('bob', 7);
    expect(await db.getCurrentNr('bob')).toBe(7);
  });

  it('deleteCurrentReceivingNumber removes entry', async () => {
    await db.storeCurrentReceivingNumber('bob', 7);
    await db.deleteCurrentReceivingNumber('bob');
    expect(await db.getCurrentNr('bob')).toBeNull();
  });

  it('stores and retrieves Pn', async () => {
    await db.storePreviousSendingNumber('bob', 2);
    expect(await db.getPn('bob')).toBe(2);
  });

  it('deletePreviousSendingNumber removes entry', async () => {
    await db.storePreviousSendingNumber('bob', 2);
    await db.deletePreviousSendingNumber('bob');
    expect(await db.getPn('bob')).toBeNull();
  });

  it('stores and retrieves skipped message keys', async () => {
    const skipped = { '1:5': 'key-a', '1:6': 'key-b' };
    await db.storeSkippedMessageKeys('bob', skipped);
    expect(await db.getSkippedMessageKeys('bob')).toEqual(skipped);
  });

  it('getSkippedMessageKeys returns null when not stored', async () => {
    expect(await db.getSkippedMessageKeys('bob')).toBeNull();
  });

  it('deleteSkippedMessageKeys removes entry', async () => {
    await db.storeSkippedMessageKeys('bob', { k: 'v' });
    await db.deleteSkippedMessageKeys('bob');
    expect(await db.getSkippedMessageKeys('bob')).toBeNull();
  });
});

// ─── 10. OPK store ───────────────────────────────────────────────────────────

describe('OPK store', () => {
  let db;
  beforeEach(async () => {
    db = new EncryptedLocalDatabase();
    await db.createUser(uid(), 'pass');
  });

  it('getOPKCount returns 0 when no OPKs stored', async () => {
    expect(await db.getOPKCount()).toBe(0);
  });

  it('stores a batch of OPKs and counts them', async () => {
    const opks = [
      { opkId: 'opk-1', privateKey: new Uint8Array(32).fill(1) },
      { opkId: 'opk-2', privateKey: new Uint8Array(32).fill(2) },
      { opkId: 'opk-3', privateKey: new Uint8Array(32).fill(3) },
    ];
    await db.storeOPKs(opks);
    expect(await db.getOPKCount()).toBe(3);
  });

  it('getOPK returns Uint8Array private key', async () => {
    const privKey = new Uint8Array(32).fill(55);
    await db.storeOPKs([{ opkId: 'opk-x', privateKey: privKey }]);
    const result = await db.getOPK('opk-x');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(privKey);
  });

  it('getOPK returns null for unknown opkId', async () => {
    expect(await db.getOPK('nonexistent')).toBeNull();
  });

  it('deleteOPK removes the key and decrements count', async () => {
    await db.storeOPKs([
      { opkId: 'opk-a', privateKey: new Uint8Array(32).fill(10) },
      { opkId: 'opk-b', privateKey: new Uint8Array(32).fill(20) },
    ]);
    await db.deleteOPK('opk-a');
    expect(await db.getOPKCount()).toBe(1);
    expect(await db.getOPK('opk-a')).toBeNull();
    expect(await db.getOPK('opk-b')).toBeInstanceOf(Uint8Array);
  });
});

// ─── 11. MLS group state ─────────────────────────────────────────────────────

describe('MLS group state', () => {
  let db;
  beforeEach(async () => {
    db = new EncryptedLocalDatabase();
    await db.createUser(uid(), 'pass');
  });

  it('returns null for unknown groupId', async () => {
    expect(await db.getMlsGroupState('group-x')).toBeNull();
  });

  it('stores and retrieves MLS group state', async () => {
    const state = {
      groupId: 'group-1',
      epoch: 3,
      roster: [{ userId: 'alice', leafIndex: 0 }],
    };
    await db.storeMlsGroupState('group-1', state);
    expect(await db.getMlsGroupState('group-1')).toEqual(state);
  });

  it('overwrites state on second store', async () => {
    await db.storeMlsGroupState('group-1', { epoch: 1 });
    await db.storeMlsGroupState('group-1', { epoch: 2 });
    expect(await db.getMlsGroupState('group-1')).toEqual({ epoch: 2 });
  });

  it('deleteMlsGroupState removes the state', async () => {
    await db.storeMlsGroupState('group-1', { epoch: 1 });
    await db.deleteMlsGroupState('group-1');
    expect(await db.getMlsGroupState('group-1')).toBeNull();
  });

  it('different group IDs are stored independently', async () => {
    await db.storeMlsGroupState('g1', { epoch: 10 });
    await db.storeMlsGroupState('g2', { epoch: 20 });
    expect((await db.getMlsGroupState('g1')).epoch).toBe(10);
    expect((await db.getMlsGroupState('g2')).epoch).toBe(20);
  });
});

// ─── 12. Cross-user isolation ────────────────────────────────────────────────

describe('Cross-user isolation', () => {
  it('user A cannot read user B identity keys via currentUserId scoping', async () => {
    const dbA = new EncryptedLocalDatabase();
    const dbB = new EncryptedLocalDatabase();
    const userA = uid();
    const userB = uid();

    await dbA.createUser(userA, 'passA');
    await dbB.createUser(userB, 'passB');

    await dbA.storeIdentityKeys({ owner: 'alice' });
    await dbB.storeIdentityKeys({ owner: 'bob' });

    expect(await dbA.getIdentityKeys()).toEqual({ owner: 'alice' });
    expect(await dbB.getIdentityKeys()).toEqual({ owner: 'bob' });
  });

  it('user A messages are not visible to user B', async () => {
    const dbA = new EncryptedLocalDatabase();
    const dbB = new EncryptedLocalDatabase();

    await dbA.createUser(uid(), 'passA');
    await dbB.createUser(uid(), 'passB');

    await dbA.storeMessage('carol', { _id: 'secret', text: 'private', createdAt: '2025-01-01T00:00:00Z' });

    // B sees no messages to carol
    expect(await dbB.getMessages('carol')).toEqual([]);
  });
});
