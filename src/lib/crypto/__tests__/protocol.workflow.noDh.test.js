import { describe, it, expect, beforeEach, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { arrayBufferToBase64, base64ToArrayBuffer } from "../../helpers.js";

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

let activeUserId = null;

function k(ownerId, peerId) {
  return `${ownerId}|${peerId}`;
}

function createState() {
  return {
    rootKey: new Map(),
    sendingChainKey: new Map(),
    receivingChainKey: new Map(),
    eph: new Map(),
    ns: new Map(),
    nr: new Map(),
    pn: new Map(),
    skipped: new Map(),
  };
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

const encryptMock = vi.hoisted(() =>
  vi.fn(async (plaintext, key) => JSON.stringify({ b: new Uint8Array(key)[0], p: plaintext }))
);

const decryptMock = vi.hoisted(() =>
  vi.fn(async (ciphertext, key) => {
    const parsed = JSON.parse(ciphertext);
    const b = parsed?.b;
    const expected = new Uint8Array(key)[0];
    if (b !== expected) {
      throw new Error(`wrong key: got ${expected}, expected ${b}`);
    }
    return parsed.p;
  })
);

// deterministic “chain KDF”: mk = byte b, nextCk = b+1
const chainKdfMock = vi.hoisted(() =>
  vi.fn((ck) => {
    const b = ck[0];
    const mk = new Uint8Array(32).fill(b);
    const next = new Uint8Array(32).fill((b + 1) & 0xff);
    return new Uint8Array([...mk, ...next]);
  })
);

const dr = vi.hoisted(() => ({
  initializeDoubleRatchetResponse: vi.fn(),
  continueDoubleRatchetChain: vi.fn(),
}));

const dhWasm = vi.hoisted(() => ({
  init: vi.fn(async () => {}),
  generate_private_ephemeral_key: vi.fn(),
  generate_public_ephemeral_key: vi.fn(),
  diffie_hellman: vi.fn(),
  hkdf_derive: vi.fn(),
}));

let state = createState();

const km = vi.hoisted(() => ({
  getSessionKey: vi.fn(),
  setSessionKey: vi.fn(),

  getRootKey: vi.fn(async (userId, targetUserId) => state.rootKey.get(k(userId, targetUserId)) ?? null),
  setRootKey: vi.fn(async (userId, targetUserId, rootKey) => {
    state.rootKey.set(k(userId, targetUserId), rootKey instanceof Uint8Array ? rootKey : new Uint8Array(rootKey));
  }),

  getEphemeralData: vi.fn(async (userId, targetUserId) => state.eph.get(k(userId, targetUserId)) ?? null),
  setEphemeralData: vi.fn(async (userId, targetUserId, data) => {
    state.eph.set(k(userId, targetUserId), data);
  }),
  setOwnEphemeralKeys: vi.fn(async (userId, targetUserId, publicKey, privateKey) => {
    const existing = state.eph.get(k(userId, targetUserId)) ?? {};
    state.eph.set(k(userId, targetUserId), { ...existing, ephPub: publicKey, ephPriv: privateKey });
  }),
  getOwnEphemeralKeys: vi.fn(async (userId, targetUserId) => {
    const data = state.eph.get(k(userId, targetUserId));
    if (!data?.ephPub || !data?.ephPriv) return null;
    return { public: data.ephPub, private: data.ephPriv };
  }),

  getSendingChainKey: vi.fn(async (userId, targetUserId) => state.sendingChainKey.get(k(userId, targetUserId)) ?? null),
  setSendingChainKey: vi.fn(async (userId, targetUserId, ck) => {
    state.sendingChainKey.set(k(userId, targetUserId), ck instanceof Uint8Array ? ck : new Uint8Array(ck));
  }),

  getReceivingChainKey: vi.fn(async (userId, targetUserId) => state.receivingChainKey.get(k(userId, targetUserId)) ?? null),
  setReceivingChainKey: vi.fn(async (userId, targetUserId, ck) => {
    state.receivingChainKey.set(k(userId, targetUserId), ck instanceof Uint8Array ? ck : new Uint8Array(ck));
  }),

  getCurrentSendingNumber: vi.fn(async (targetUserId) => state.ns.get(k(activeUserId, targetUserId)) ?? 0),
  setCurrentSendingNumber: vi.fn(async (targetUserId, n) => {
    state.ns.set(k(activeUserId, targetUserId), n);
  }),

  getCurrentReceivingNumber: vi.fn(async (targetUserId) => state.nr.get(k(activeUserId, targetUserId)) ?? 0),
  setCurrentReceivingNumber: vi.fn(async (targetUserId, n) => {
    state.nr.set(k(activeUserId, targetUserId), n);
  }),

  getPreviousSendingNumber: vi.fn(async (targetUserId) => state.pn.get(k(activeUserId, targetUserId)) ?? 0),
  setPreviousSendingNumber: vi.fn(async (targetUserId, n) => {
    state.pn.set(k(activeUserId, targetUserId), n);
  }),

  getSkippedMessages: vi.fn(async (targetUserId) => state.skipped.get(k(activeUserId, targetUserId)) ?? {}),
  setSkippedMessages: vi.fn(async (targetUserId, skipped) => {
    state.skipped.set(k(activeUserId, targetUserId), skipped);
  }),

  updateSavedMessages: vi.fn(),
}));

vi.mock("../../crypto/aes", () => ({
  encrypt: (...args) => encryptMock(...args),
  decrypt: (...args) => decryptMock(...args),
  buildAadBytes: () => new Uint8Array([1]),
  decryptWithAad: (...args) => decryptMock(...args),
}));
vi.mock("../../crypto/dr", () => dr);
vi.mock('@mascaro101/echo-protocol', () => ({
  default: (...args) => dhWasm.init(...args),
  generate_private_ephemeral_key: (...args) => dhWasm.generate_private_ephemeral_key(...args),
  generate_public_ephemeral_key: (...args) => dhWasm.generate_public_ephemeral_key(...args),
  diffie_hellman: (...args) => dhWasm.diffie_hellman(...args),
  hkdf_derive: (...args) => dhWasm.hkdf_derive(...args),
}));
vi.mock("../../crypto/hkdf", () => ({
  chain_key_KDF: (ck) => chainKdfMock(ck),
  deriveChainKeys: () => ({ sendingChainKey: new Uint8Array(32).fill(1), receivingChainKey: new Uint8Array(32).fill(1) }),
}));
vi.mock("../../chat/keyManagement", () => km);

import { decryptIncomingMessage } from "../../chat/messageDecryption.js";

async function sendOnExistingChain({ from, to, text }) {
  return asUser(from, async () => {
    const sendingChainKey = await km.getSendingChainKey(from, to);
    if (!sendingChainKey) {
      throw new Error(`missing sending chain key for ${from}->${to}`);
    }

    const material = chainKdfMock(sendingChainKey);
    const messageKey = material.slice(0, 32);
    const nextChainKey = material.slice(32);
    await km.setSendingChainKey(from, to, nextChainKey);

    const ownEph = await km.getOwnEphemeralKeys(from, to);
    if (!ownEph?.public) throw new Error(`missing own eph keys for ${from}->${to}`);

    const nonce = new Uint8Array(12).fill(7);
    const payload = JSON.stringify({ text, image: null });
    const encryptedPayload = await encryptMock(payload, messageKey, nonce);

    const sendingNumber = await km.getCurrentSendingNumber(to);
    const previousSendingNumber = await km.getPreviousSendingNumber(to);

    await km.setCurrentSendingNumber(to, sendingNumber + 1);

    return {
      payload: encryptedPayload,
      nonce: arrayBufferToBase64(nonce),
      userId: from,
      targetUserId: to,
      username: from,
      publicEphemeralKey: ownEph.public,
      sendingNumber,
      previousSendingNumber,
    };
  });
}

async function recv(receiverId, msg) {
  return asUser(receiverId, async () => {
    const nonce = base64ToArrayBuffer(msg.nonce);
    return decryptIncomingMessage(msg, nonce, receiverId, msg.userId, new Uint8Array(32), {}, null);
  });
}

describe("protocol workflow (no DH change)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state = createState();
    activeUserId = null;

    const A = "alice";
    const B = "bob";

    // shared-ish root key (stored per owner in real life)
    const root = new Uint8Array(32).fill(1);
    state.rootKey.set(k(A, B), root);
    state.rootKey.set(k(B, A), root);

    // initial chain keys (directional)
    const ckAB = new Uint8Array(32).fill(5);
    const ckBA = new Uint8Array(32).fill(9);
    state.sendingChainKey.set(k(A, B), ckAB);
    state.receivingChainKey.set(k(B, A), ckAB);
    state.sendingChainKey.set(k(B, A), ckBA);
    state.receivingChainKey.set(k(A, B), ckBA);

    const A_dh = arrayBufferToBase64(new Uint8Array(32).fill(0xa1));
    const B_dh = arrayBufferToBase64(new Uint8Array(32).fill(0xb2));

    state.eph.set(k(A, B), {
      ephPub: A_dh,
      ephPriv: arrayBufferToBase64(new Uint8Array(32).fill(0xa0)),
      currentTargetPublicEphemeralKey: B_dh,
      knownTargetPublicEphemeralKeys: { [B_dh]: true },
    });
    state.eph.set(k(B, A), {
      ephPub: B_dh,
      ephPriv: arrayBufferToBase64(new Uint8Array(32).fill(0xb0)),
      currentTargetPublicEphemeralKey: A_dh,
      knownTargetPublicEphemeralKeys: { [A_dh]: true },
    });
  });

  it("alice sends 3, bob sends 2; both decrypt and advance chains/counters", async () => {
    const A = "alice";
    const B = "bob";

    const m1 = await sendOnExistingChain({ from: A, to: B, text: "a1" });
    const m2 = await sendOnExistingChain({ from: A, to: B, text: "a2" });
    const m3 = await sendOnExistingChain({ from: A, to: B, text: "a3" });

    expect((await recv(B, m1))?.text).toBe("a1");
    expect((await recv(B, m2))?.text).toBe("a2");
    expect((await recv(B, m3))?.text).toBe("a3");

    const bNr = state.nr.get(k(B, A));
    expect(bNr).toBe(3);

    const b1 = await sendOnExistingChain({ from: B, to: A, text: "b1" });
    const b2 = await sendOnExistingChain({ from: B, to: A, text: "b2" });

    expect((await recv(A, b1))?.text).toBe("b1");
    expect((await recv(A, b2))?.text).toBe("b2");

    const aNr = state.nr.get(k(A, B));
    expect(aNr).toBe(2);

    // sanity: no DH-ratchet functions invoked in this flow
    expect(dr.continueDoubleRatchetChain).not.toHaveBeenCalled();
  });
});
