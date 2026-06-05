import { describe, it, expect, vi } from 'vitest'
import { webcrypto } from 'node:crypto'

if (!globalThis.crypto) globalThis.crypto = webcrypto

// Back the wasm AEAD with real WebCrypto AES-256-GCM so round-trip, tamper,
// wrong-key, and truncation assertions actually exercise authenticated
// encryption (the production build uses the wasm; the contract is identical:
// (bytes, key, 12-byte nonce, aad) → bytes, throwing on auth failure).
vi.mock('@mascaro101/echo-protocol', () => ({
  default: async () => {},
  encrypt_aad_bytes: async (ptBytes, key, nonce, aad) => {
    const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt'])
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: aad },
      k,
      ptBytes
    )
    return new Uint8Array(ct)
  },
  decrypt_aad_bytes: async (ctBytes, key, nonce, aad) => {
    const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt'])
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: aad },
      k,
      ctBytes
    )
    return new Uint8Array(pt)
  },
}))

import { encryptMediaBlob, decryptMediaBlob, MEDIA_SCHEME } from '../mediaCrypto'

function patternBytes(n) {
  const b = new Uint8Array(n)
  for (let i = 0; i < n; i += 1) b[i] = (i * 73 + 13) & 0xff
  return b
}

describe('mediaCrypto', () => {
  it('round-trips a multi-chunk blob', async () => {
    const data = patternBytes(2_500_000) // > 2 chunks at 1 MiB
    const { ciphertext, keyB64, scheme, size } = await encryptMediaBlob(data, {
      chunkSize: 1024 * 1024,
    })
    expect(scheme).toBe(MEDIA_SCHEME)
    expect(size).toBe(data.length)
    expect(ciphertext.length).toBeGreaterThan(data.length)
    const out = await decryptMediaBlob(ciphertext, keyB64)
    expect(Buffer.from(out).equals(Buffer.from(data))).toBe(true)
  })

  it('round-trips a small single-chunk blob', async () => {
    const data = patternBytes(42)
    const { ciphertext, keyB64 } = await encryptMediaBlob(data)
    const out = await decryptMediaBlob(ciphertext, keyB64)
    expect(Buffer.from(out).equals(Buffer.from(data))).toBe(true)
  })

  it('fails to decrypt with the wrong key', async () => {
    const { ciphertext } = await encryptMediaBlob(patternBytes(5000))
    const wrong = await encryptMediaBlob(patternBytes(10))
    await expect(decryptMediaBlob(ciphertext, wrong.keyB64)).rejects.toBeTruthy()
  })

  it('fails when a chunk is tampered', async () => {
    const { ciphertext, keyB64 } = await encryptMediaBlob(patternBytes(5000))
    const tampered = ciphertext.slice()
    tampered[tampered.length - 1] ^= 0xff
    await expect(decryptMediaBlob(tampered, keyB64)).rejects.toBeTruthy()
  })

  it('rejects a truncated blob', async () => {
    const { ciphertext, keyB64 } = await encryptMediaBlob(patternBytes(2_500_000), {
      chunkSize: 1024 * 1024,
    })
    const truncated = ciphertext.slice(0, Math.floor(ciphertext.length / 2))
    await expect(decryptMediaBlob(truncated, keyB64)).rejects.toBeTruthy()
  })
})
