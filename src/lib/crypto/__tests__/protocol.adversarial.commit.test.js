import { describe, it, expect, beforeEach, vi } from "vitest";
import { webcrypto } from "node:crypto";

import { arrayBufferToBase64, base64ToArrayBuffer } from "../../helpers.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.atob) globalThis.atob = (b64) => Buffer.from(b64, "base64").toString("binary");
if (!globalThis.btoa) globalThis.btoa = (bin) => Buffer.from(bin, "binary").toString("base64");

async function aesGcmEncryptBytes({ plaintextBytes, keyBytes, ivBytes, aadBytes }) {
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBytes, additionalData: aadBytes },
    key,
    plaintextBytes
  );
  return new Uint8Array(ct);
}

async function aesGcmDecryptBytes({ ciphertextBytes, keyBytes, ivBytes, aadBytes }) {
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes, additionalData: aadBytes },
    key,
    ciphertextBytes
  );
  return new Uint8Array(pt);
}

// ---- Mocks: use real AAD builder + wrappers, but implement AEAD via WebCrypto ----
vi.mock('@mascaro101/echo-protocol', () => ({
  default: vi.fn(async () => {}),
  encrypt: vi.fn(async (text) => text),
  decrypt: vi.fn(async (text) => text),
  encrypt_aad: vi.fn(async (text) => text),
  decrypt_aad: vi.fn(async (text) => text),
  encrypt_aad_bytes: vi.fn(async (plaintextBytes, key, nonce, aad) =>
    aesGcmEncryptBytes({ plaintextBytes, keyBytes: key, ivBytes: nonce, aadBytes: aad })
  ),
  decrypt_aad_bytes: vi.fn(async (ciphertextBytes, key, nonce, aad) =>
    aesGcmDecryptBytes({ ciphertextBytes, keyBytes: key, ivBytes: nonce, aadBytes: aad })
  ),
  generate_private_ephemeral_key: vi.fn(async () => new Uint8Array(32).fill(7)),
  generate_public_ephemeral_key: vi.fn(async () => new Uint8Array(32).fill(8)),
  diffie_hellman: vi.fn(async () => new Uint8Array(32).fill(9)),
  hkdf_derive: vi.fn(() => new Uint8Array(64).fill(6)),
}));

const chainKdfMock = vi.hoisted(() =>
  vi.fn((ck) => {
    const b = new Uint8Array(ck)[0];
    const mk = new Uint8Array(32).fill(b);
    const next = new Uint8Array(32).fill((b + 1) & 0xff);
    return new Uint8Array([...mk, ...next]);
  })
);

vi.mock("../hkdf.js", () => ({
  chain_key_KDF: (ck) => chainKdfMock(ck),
  deriveChainKeys: () => ({
    sendingChainKey: new Uint8Array(32).fill(1),
    receivingChainKey: new Uint8Array(32).fill(1),
  }),
}));


// dr not used here; stub to avoid network/API calls if code path changes.
vi.mock("../dr.js", () => ({
  initializeDoubleRatchet: vi.fn(async () => ({ root_key: new Uint8Array(32).fill(1) })),
  continueDoubleRatchetChain: vi.fn(async () => ({ receivingChainKey: new Uint8Array(32).fill(1), newRootKey: new Uint8Array(32).fill(1) })),
  initializeDoubleRatchetResponse: vi.fn(async () => new Uint8Array(32).fill(1)),
}));

let activeUserId = null;

function newDeviceState() {
  return {
    rootKey: new Map(), // targetUserId -> Uint8Array(32)
    sendingChainKey: new Map(), // targetUserId -> Uint8Array(32)
    receivingChainKey: new Map(), // targetUserId -> Uint8Array(32)
    eph: new Map(), // targetUserId -> object
    ns: new Map(), // targetUserId -> number
    nr: new Map(), // targetUserId -> number
    pn: new Map(), // targetUserId -> number
    skipped: new Map(), // targetUserId -> object
  };
}

let devices = new Map();
function device(userId) {
  if (!devices.has(userId)) devices.set(userId, newDeviceState());
  return devices.get(userId);
}

async function asUser(userId, fn) {
  const prev = activeUserId;
  activeUserId = userId;
  try {
    return await fn();
  } finally {
    activeUserId = prev;
  }
}

const km = vi.hoisted(() => ({
  getSessionKey: vi.fn(),
  setSessionKey: vi.fn(),

  getRootKey: vi.fn(async (_userId, targetUserId) => device(activeUserId).rootKey.get(targetUserId) ?? null),
  setRootKey: vi.fn(async (_userId, targetUserId, rootKey) => {
    device(activeUserId).rootKey.set(targetUserId, rootKey instanceof Uint8Array ? rootKey : new Uint8Array(rootKey));
  }),

  getEphemeralData: vi.fn(async (_userId, targetUserId) => device(activeUserId).eph.get(targetUserId) ?? null),
  setEphemeralData: vi.fn(async (_userId, targetUserId, data) => {
    device(activeUserId).eph.set(targetUserId, data);
  }),
  setOwnEphemeralKeys: vi.fn(async (_userId, targetUserId, publicKey, privateKey) => {
    const existing = device(activeUserId).eph.get(targetUserId) ?? {};
    device(activeUserId).eph.set(targetUserId, { ...existing, ephPub: publicKey, ephPriv: privateKey });
  }),
  getOwnEphemeralKeys: vi.fn(async (_userId, targetUserId) => {
    const data = device(activeUserId).eph.get(targetUserId);
    if (!data?.ephPriv || !data?.ephPub) return null;
    return { private: data.ephPriv, public: data.ephPub };
  }),

  getSendingChainKey: vi.fn(async (_userId, targetUserId) => device(activeUserId).sendingChainKey.get(targetUserId) ?? null),
  setSendingChainKey: vi.fn(async (_userId, targetUserId, ck) => {
    device(activeUserId).sendingChainKey.set(targetUserId, ck instanceof Uint8Array ? ck : new Uint8Array(ck));
  }),

  getReceivingChainKey: vi.fn(async (_userId, targetUserId) => device(activeUserId).receivingChainKey.get(targetUserId) ?? null),
  setReceivingChainKey: vi.fn(async (_userId, targetUserId, ck) => {
    device(activeUserId).receivingChainKey.set(targetUserId, ck instanceof Uint8Array ? ck : new Uint8Array(ck));
  }),

  getCurrentSendingNumber: vi.fn(async (targetUserId) => device(activeUserId).ns.get(targetUserId) ?? 0),
  setCurrentSendingNumber: vi.fn(async (targetUserId, n) => {
    device(activeUserId).ns.set(targetUserId, n);
  }),

  getCurrentReceivingNumber: vi.fn(async (targetUserId) => device(activeUserId).nr.get(targetUserId) ?? 0),
  setCurrentReceivingNumber: vi.fn(async (targetUserId, n) => {
    device(activeUserId).nr.set(targetUserId, n);
  }),

  getPreviousSendingNumber: vi.fn(async (targetUserId) => device(activeUserId).pn.get(targetUserId) ?? 0),
  setPreviousSendingNumber: vi.fn(async (targetUserId, n) => {
    device(activeUserId).pn.set(targetUserId, n);
  }),

  getSkippedMessages: vi.fn(async (targetUserId) => device(activeUserId).skipped.get(targetUserId) ?? {}),
  setSkippedMessages: vi.fn(async (targetUserId, skipped) => {
    device(activeUserId).skipped.set(targetUserId, skipped);
  }),

  updateSavedMessages: vi.fn(),
  deleteOPKPrivateKey: vi.fn(),
}));

vi.mock("../../chat/keyManagement.js", () => km);

import { encryptOutgoingMessage } from "../../chat/messageEncryption.js";
import { decryptIncomingMessage } from "../../chat/messageDecryption.js";

function snapshot(userId) {
  const d = device(userId);
  const toHex = (bytes) => Buffer.from(bytes).toString("hex");
  const snapMap = (m) => Object.fromEntries([...m.entries()].map(([k, v]) => [k, v instanceof Uint8Array ? toHex(v) : v]));
  const snapObjMap = (m) => Object.fromEntries([...m.entries()].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
  return {
    rootKey: snapMap(d.rootKey),
    sendingChainKey: snapMap(d.sendingChainKey),
    receivingChainKey: snapMap(d.receivingChainKey),
    ns: Object.fromEntries(d.ns.entries()),
    nr: Object.fromEntries(d.nr.entries()),
    pn: Object.fromEntries(d.pn.entries()),
    eph: snapObjMap(d.eph),
    skipped: snapObjMap(d.skipped),
  };
}

function seedConversation({ alice = "alice", bob = "bob", ckABByte = 5, ckBAByte = 9 }) {
  const root = new Uint8Array(32).fill(1);
  device(alice).rootKey.set(bob, root);
  device(bob).rootKey.set(alice, root);

  device(alice).sendingChainKey.set(bob, new Uint8Array(32).fill(ckABByte));
  device(bob).receivingChainKey.set(alice, new Uint8Array(32).fill(ckABByte));

  device(bob).sendingChainKey.set(alice, new Uint8Array(32).fill(ckBAByte));
  device(alice).receivingChainKey.set(bob, new Uint8Array(32).fill(ckBAByte));

  const A_dh_priv = arrayBufferToBase64(new Uint8Array(32).fill(0xa0));
  const B_dh_priv = arrayBufferToBase64(new Uint8Array(32).fill(0xb0));
  const A_dh_pub = arrayBufferToBase64(new Uint8Array(32).fill(0xa1));
  const B_dh_pub = arrayBufferToBase64(new Uint8Array(32).fill(0xb1));

  device(alice).eph.set(bob, {
    ephPriv: A_dh_priv,
    ephPub: A_dh_pub,
    currentTargetPublicEphemeralKey: B_dh_pub,
    knownTargetPublicEphemeralKeys: { [B_dh_pub]: true },
  });

  device(bob).eph.set(alice, {
    ephPriv: B_dh_priv,
    ephPub: B_dh_pub,
    currentTargetPublicEphemeralKey: A_dh_pub,
    knownTargetPublicEphemeralKeys: { [A_dh_pub]: true },
  });
}

describe("protocol adversarial: fail-closed without state desync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    devices = new Map();
    activeUserId = null;
    seedConversation({});
  });

  it("rejects if message header fields (AAD) are tampered; does not advance Nr/CKr", async () => {
    const alice = "alice";
    const bob = "bob";

    const msg = await asUser(alice, () =>
      encryptOutgoingMessage({
        text: "hi",
        imageData: null,
        userId: alice,
        targetUserId: bob,
        username: "alice",
        socket: {},
        privateKeyArray: new Uint8Array(32).fill(1),
      })
    );

    // Sanity: Bob can decrypt the original message.
    await asUser(bob, async () => {
      const nonce = base64ToArrayBuffer(msg.nonce);
      await expect(decryptIncomingMessage(msg, nonce, bob, alice, new Uint8Array(32), {}, null)).resolves.toMatchObject({
        text: "hi",
      });
    });

    // Now craft a second message and tamper a header field that is authenticated via AAD
    // but should not change the derived message key (so failure is due to AAD mismatch).
    const msg2 = await asUser(alice, () =>
      encryptOutgoingMessage({
        text: "hi-2",
        imageData: null,
        userId: alice,
        targetUserId: bob,
        username: "alice",
        socket: {},
        privateKeyArray: new Uint8Array(32).fill(1),
      })
    );

    const tampered = { ...msg2, targetUserId: "mallory" };

    const before = snapshot(bob);
    await asUser(bob, async () => {
      const nonce = base64ToArrayBuffer(tampered.nonce);
      await expect(decryptIncomingMessage(tampered, nonce, bob, alice, new Uint8Array(32), {}, null)).rejects.toThrow();
    });
    const after = snapshot(bob);
    
    console.log("Before:", before);
    console.log("After:", after);
    expect(after).toEqual(before);
  });

  it("rejects if ciphertext is tampered; does not advance Nr/CKr", async () => {
    const alice = "alice";
    const bob = "bob";

    const msg = await asUser(alice, () =>
      encryptOutgoingMessage({
        text: "hi",
        imageData: null,
        userId: alice,
        targetUserId: bob,
        username: "alice",
        socket: {},
        privateKeyArray: new Uint8Array(32).fill(1),
      })
    );

    const tamperedPayload =
      msg.payload.length > 2 ? `${msg.payload.slice(0, -2)}00` : `${msg.payload}00`;
    const tampered = { ...msg, payload: tamperedPayload };

    const before = snapshot(bob);
    await asUser(bob, async () => {
      const nonce = base64ToArrayBuffer(tampered.nonce);
      await expect(decryptIncomingMessage(tampered, nonce, bob, alice, new Uint8Array(32), {}, null)).rejects.toThrow();
    });
    const after = snapshot(bob);

    expect(after).toEqual(before);
  });

  it("ignores replay (same n after Nr advanced) without changing state", async () => {
    const alice = "alice";
    const bob = "bob";

    const msg = await asUser(alice, () =>
      encryptOutgoingMessage({
        text: "hi",
        imageData: null,
        userId: alice,
        targetUserId: bob,
        username: "alice",
        socket: {},
        privateKeyArray: new Uint8Array(32).fill(1),
      })
    );

    await asUser(bob, async () => {
      const nonce = base64ToArrayBuffer(msg.nonce);
      const out1 = await decryptIncomingMessage(msg, nonce, bob, alice, new Uint8Array(32), {}, null);
      expect(out1?.text).toBe("hi");
    });

    const beforeReplay = snapshot(bob);
    await asUser(bob, async () => {
      const nonce = base64ToArrayBuffer(msg.nonce);
      const out2 = await decryptIncomingMessage(msg, nonce, bob, alice, new Uint8Array(32), {}, null);
      expect(out2).toBeNull();
    });
    const afterReplay = snapshot(bob);

    expect(afterReplay).toEqual(beforeReplay);
  });
});
