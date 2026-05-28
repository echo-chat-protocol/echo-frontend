import { describe, it, expect, vi, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const wasm = vi.hoisted(() => ({
  init: vi.fn(async () => {}),
  encrypt: vi.fn(async (_text, _key, _nonce) => "cipher-hex"),
  decrypt: vi.fn(async (_text, _key, _nonce) => "plain"),
  encrypt_aad: vi.fn(async () => "cipher-aad-hex"),
  decrypt_aad: vi.fn(async () => "plain-aad"),
  // aes.js wrapper uses encrypt_aad_bytes to return ciphertext *bytes* (Uint8Array),
  // then encodes them to base64 at the JS boundary.
  encrypt_aad_bytes: vi.fn(async (ptBytes) => new Uint8Array([...ptBytes].reverse())),
  decrypt_aad_bytes: vi.fn(async (ctBytes) => new Uint8Array([...ctBytes].reverse())),
}));

vi.mock('@mascaro101/echo-protocol', () => ({
  default: (...args) => wasm.init(...args),
  encrypt: (...args) => wasm.encrypt(...args),
  decrypt: (...args) => wasm.decrypt(...args),
  encrypt_aad: (...args) => wasm.encrypt_aad(...args),
  decrypt_aad: (...args) => wasm.decrypt_aad(...args),
  encrypt_aad_bytes: (...args) => wasm.encrypt_aad_bytes(...args),
  decrypt_aad_bytes: (...args) => wasm.decrypt_aad_bytes(...args),
}));

import { encrypt, decrypt, encryptWithAad, decryptWithAad, buildAadBytes } from "../aes.js";

describe("aes.js util wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("encrypt() initializes WASM and passes through to wasm encrypt", async () => {
    const key = new Uint8Array(32).fill(1);
    const nonce = new Uint8Array(12).fill(2);
    const out = await encrypt("hello", key, nonce);
    expect(out).toBe("cipher-hex");
    expect(wasm.init).toHaveBeenCalledTimes(1);
    expect(wasm.encrypt).toHaveBeenCalledTimes(1);
    const [_text, passedKey, passedNonce] = wasm.encrypt.mock.calls[0];
    expect(passedKey).toBeInstanceOf(Uint8Array);
    expect(passedKey).toHaveLength(32);
    expect(passedNonce).toEqual(nonce);
  });

  it("encrypt() accepts ArrayBuffer keys (normalizes to Uint8Array)", async () => {
    const keyBuf = new Uint8Array(32).fill(3).buffer;
    const nonce = new Uint8Array(12).fill(4);
    await encrypt("hi", keyBuf, nonce);
    const [_text, passedKey] = wasm.encrypt.mock.calls[0];
    expect(passedKey).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(passedKey)).toEqual(Buffer.from(new Uint8Array(32).fill(3)));
  });

  it("encrypt() throws on invalid key length", async () => {
    await expect(encrypt("x", new Uint8Array(31), new Uint8Array(12))).rejects.toThrow(
      "Invalid key length"
    );
  });

  it("decrypt() initializes WASM and passes through to wasm decrypt", async () => {
    const key = new Uint8Array(32).fill(9);
    const nonce = new Uint8Array(12).fill(8);
    const out = await decrypt("cipher", key, nonce);
    expect(out).toBe("plain");
    expect(wasm.init).toHaveBeenCalledTimes(1);
    expect(wasm.decrypt).toHaveBeenCalledTimes(1);
  });

  it("encryptWithAad() encodes plaintext to bytes and returns base64 ciphertext", async () => {
    const key = new Uint8Array(32).fill(7);
    const nonce = new Uint8Array(12).fill(6);
    const aad = new TextEncoder().encode("aad");
    const ct = await encryptWithAad("abc", key, nonce, aad);

    expect(wasm.encrypt_aad_bytes).toHaveBeenCalledTimes(1);
    const [ptBytes] = wasm.encrypt_aad_bytes.mock.calls[0];
    expect(ptBytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(ptBytes)).toEqual(Buffer.from(new TextEncoder().encode("abc")));

    const expectedCipherBytes = new Uint8Array([99, 98, 97]);
    const expectedB64 = Buffer.from(expectedCipherBytes).toString("base64");
    expect(ct).toBe(expectedB64);
  });

  it("decryptWithAad() decodes base64 ciphertext to plaintext string", async () => {
    const key = new Uint8Array(32).fill(7);
    const nonce = new Uint8Array(12).fill(6);
    const aad = new TextEncoder().encode("aad");

    const cipherBytes = new Uint8Array([99, 98, 97]);
    const cipherB64 = Buffer.from(cipherBytes).toString("base64");

    const out = await decryptWithAad(cipherB64, key, nonce, aad);
    expect(out).toBe("abc");
    expect(wasm.decrypt_aad_bytes).toHaveBeenCalledTimes(1);
    const [passedCipherBytes] = wasm.decrypt_aad_bytes.mock.calls[0];
    expect(passedCipherBytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(passedCipherBytes)).toEqual(Buffer.from(cipherBytes));
  });

  it("buildAadBytes() uses v1 when spkId/opkId are missing and v2 when present", () => {
    const base = {
      userId: "ALICE",
      targetUserId: "BOB",
      publicEphemeralKey: "dh",
      sendingNumber: 1,
      previousSendingNumber: 0,
    };

    const v1 = buildAadBytes(base);
    const v2 = buildAadBytes({ ...base, spkId: 1, opkId: "opk1" });

    expect(new TextDecoder().decode(v1).startsWith("Echo/v1|")).toBe(true);
    expect(new TextDecoder().decode(v2).startsWith("Echo/v2|")).toBe(true);
    expect(Buffer.from(v1)).not.toEqual(Buffer.from(v2));
  });
});
