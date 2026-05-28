import { describe, it, expect, vi, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

// Mock dh-wasm: private key = random seed XOR 0xAA, public key = private XOR 0x55
vi.mock('@mascaro101/echo-protocol', () => ({
  default: vi.fn(async () => {}),
  generate_private_ephemeral_key: vi.fn((seed) => {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = seed[i] ^ 0xaa;
    return out;
  }),
  generate_public_ephemeral_key: vi.fn((priv) => {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = priv[i] ^ 0x55;
    return out;
  }),
}));

// Mock helpers so no transitive imports break
vi.mock("../../helpers.js", () => ({
  arrayBufferToBase64: (buf) => Buffer.from(buf).toString("base64"),
  base64ToArrayBuffer: (b64) => new Uint8Array(Buffer.from(b64, "base64")),
}));

import { generateOneTimePreKeys } from "../opk.js";

describe("generateOneTimePreKeys", () => {
  it("returns the requested number of key pairs (default 100)", async () => {
    const { privateKeys, publicBundle } = await generateOneTimePreKeys();
    expect(privateKeys).toHaveLength(100);
    expect(publicBundle).toHaveLength(100);
  });

  it("respects a custom count", async () => {
    const { privateKeys, publicBundle } = await generateOneTimePreKeys(5);
    expect(privateKeys).toHaveLength(5);
    expect(publicBundle).toHaveLength(5);
  });

  it("each entry has a UUID opkId shared between private and public halves", async () => {
    const { privateKeys, publicBundle } = await generateOneTimePreKeys(10);
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (let i = 0; i < 10; i++) {
      expect(privateKeys[i].opkId).toMatch(uuidRe);
      expect(publicBundle[i].opkId).toBe(privateKeys[i].opkId);
    }
  });

  it("all opkIds are unique", async () => {
    const { privateKeys } = await generateOneTimePreKeys(50);
    const ids = new Set(privateKeys.map((k) => k.opkId));
    expect(ids.size).toBe(50);
  });

  it("private keys are 32-byte Uint8Arrays", async () => {
    const { privateKeys } = await generateOneTimePreKeys(5);
    for (const { privateKey } of privateKeys) {
      expect(privateKey).toBeInstanceOf(Uint8Array);
      expect(privateKey).toHaveLength(32);
    }
  });

  it("public keys in the bundle are non-empty base64 strings", async () => {
    const { publicBundle } = await generateOneTimePreKeys(5);
    const b64Re = /^[A-Za-z0-9+/]+=*$/;
    for (const { publicKey } of publicBundle) {
      expect(typeof publicKey).toBe("string");
      expect(publicKey.length).toBeGreaterThan(0);
      expect(publicKey).toMatch(b64Re);
    }
  });

  it("public key is derived from private key (mock relationship holds)", async () => {
    const { privateKeys, publicBundle } = await generateOneTimePreKeys(3);
    for (let i = 0; i < 3; i++) {
      const priv = privateKeys[i].privateKey;
      const pubBytes = new Uint8Array(
        Buffer.from(publicBundle[i].publicKey, "base64")
      );
      // mock: pub = priv XOR 0x55
      const expected = new Uint8Array(32);
      for (let j = 0; j < 32; j++) expected[j] = priv[j] ^ 0x55;
      expect(pubBytes).toEqual(expected);
    }
  });

  it("no two key pairs share the same private key bytes", async () => {
    const { privateKeys } = await generateOneTimePreKeys(20);
    const seen = new Set(privateKeys.map((k) => k.privateKey.toString()));
    expect(seen.size).toBe(20);
  });
});
