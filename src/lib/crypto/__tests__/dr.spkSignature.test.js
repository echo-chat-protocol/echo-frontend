import { describe, it, expect, vi, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";

import { arrayBufferToBase64 } from "../../helpers.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.atob) globalThis.atob = (b64) => Buffer.from(b64, "base64").toString("binary");
if (!globalThis.btoa) globalThis.btoa = (bin) => Buffer.from(bin, "binary").toString("base64");

const api = vi.hoisted(() => ({
  fetchPreKeyBundle: vi.fn(),
  fetchPublicIdentityKeyX25519: vi.fn(),
  fetchPublicIdentityKeyEd25519: vi.fn(),
}));

const xeddsa = vi.hoisted(() => ({
  init: vi.fn(async () => {}),
  verify_signature: vi.fn(async () => false),
}));

const dh = vi.hoisted(() => ({
  init: vi.fn(async () => {}),
  diffie_hellman: vi.fn(async () => new Uint8Array(32).fill(9)),
  hkdf_derive: vi.fn(() => new Uint8Array(32).fill(1)),
}));

const km = vi.hoisted(() => ({
  getPeerIdentityKeys: vi.fn(async () => null),
  getIdentityKeys: vi.fn(async () => ({ publicKeyX25519: arrayBufferToBase64(new Uint8Array(32).fill(7)) })),
  getOPKPrivateKey: vi.fn(async () => null),
}));

vi.mock("../../api.js", () => api);
vi.mock("../../chat/keyManagement.js", () => km);

vi.mock('@mascaro101/echo-protocol', () => ({
  default: vi.fn(async () => {}),
  verify_signature: (...args) => xeddsa.verify_signature(...args),
  diffie_hellman: (...args) => dh.diffie_hellman(...args),
  hkdf_derive: (...args) => dh.hkdf_derive(...args),
}));

import { initializeDoubleRatchet } from "../dr.js";

describe("DR init: SPK signature verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws if peer SPK signature is invalid; does not derive secrets", async () => {
    const bundle = {
      publicIdentityKeyX25519: arrayBufferToBase64(new Uint8Array(32).fill(1)),
      publicIdentityKeyEd25519: arrayBufferToBase64(new Uint8Array(32).fill(2)),
      signedPreKey: arrayBufferToBase64(new Uint8Array(32).fill(3)),
      signature: arrayBufferToBase64(new Uint8Array(64).fill(4)),
      spkId: 1,
      opk: null,
    };

    api.fetchPreKeyBundle.mockResolvedValue(bundle);
    xeddsa.verify_signature.mockResolvedValue(false);

    await expect(
      initializeDoubleRatchet(
        {}, // socket
        "bob",
        new Uint8Array(32).fill(10), // eph priv
        new Uint8Array(32).fill(11), // eph pub
        new Uint8Array(32).fill(12) // our IK priv (x25519)
      )
    ).rejects.toThrow("Invalid SPK signature detected");

    expect(xeddsa.verify_signature).toHaveBeenCalledTimes(1);
    expect(dh.diffie_hellman).not.toHaveBeenCalled();
    expect(dh.hkdf_derive).not.toHaveBeenCalled();
  });
});

