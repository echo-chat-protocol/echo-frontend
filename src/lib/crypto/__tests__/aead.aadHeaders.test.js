import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";

import { buildAadBytes } from "../aes.js";

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

async function aesGcmEncrypt({ keyBytes, iv, aad, plaintext }) {
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    key,
    new TextEncoder().encode(plaintext)
  );
  return new Uint8Array(ct);
}

async function aesGcmDecrypt({ keyBytes, iv, aad, ciphertext }) {
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    key,
    ciphertext
  );
  return new TextDecoder().decode(pt);
}

describe("AEAD AAD header binding", () => {
  it("round-trips with same headers; fails if headers (AAD) change", async () => {
    const header = {
      userId: "ALICE",
      targetUserId: "BOB",
      publicEphemeralKey: "base64-ephemeral-pub",
      sendingNumber: 7,
      previousSendingNumber: 3,
    };

    const aad = buildAadBytes(header);
    const aad2 = buildAadBytes({ ...header });
    expect(Buffer.from(aad)).toEqual(Buffer.from(aad2));

    const keyBytes = new Uint8Array(32).fill(9);
    const iv = new Uint8Array(12).fill(4);
    const plaintext = JSON.stringify({ text: "hi", image: null });

    const ciphertext = await aesGcmEncrypt({ keyBytes, iv, aad, plaintext });
    await expect(aesGcmDecrypt({ keyBytes, iv, aad, ciphertext })).resolves.toBe(plaintext);

    // Tamper: change message number (this is exactly what AAD is meant to protect).
    const aadTamperedN = buildAadBytes({ ...header, sendingNumber: 8 });
    await expect(aesGcmDecrypt({ keyBytes, iv, aad: aadTamperedN, ciphertext })).rejects.toThrow();

    // Tamper: change DH header.
    const aadTamperedDh = buildAadBytes({ ...header, publicEphemeralKey: "different-dh" });
    await expect(aesGcmDecrypt({ keyBytes, iv, aad: aadTamperedDh, ciphertext })).rejects.toThrow();
  });
});

