/**
 * hpke.test.js
 *
 * Tests RFC 9180 HPKE (DHKEM(X25519, HKDF-SHA256) + HKDF-SHA256 + AES-256-GCM)
 * using real WASM primitives loaded via initSync.
 *
 * Security properties tested:
 *   - Round-trip: seal then open recovers original plaintext
 *   - Wrong private key: open fails (different KEM shared secret → different AEAD key → tag mismatch)
 *   - Tampered ciphertext: open fails (AES-256-GCM authentication tag check)
 *   - Wrong AAD: open fails (AAD is bound into the GCM authentication tag)
 *   - Non-determinism: two seals of the same plaintext produce distinct ephemeral keys
 */
import { webcrypto } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

if (!globalThis.crypto) globalThis.crypto = webcrypto
if (!globalThis.atob) globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary')
if (!globalThis.btoa) globalThis.btoa = (bin) => Buffer.from(bin, 'binary').toString('base64')

// ── Real WASM mock ──────────────────────────────────────────────────────────
vi.mock('@mascaro101/echo-protocol', async () => {
  const { readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')

  const aes = await import('@mascaro101/echo-protocol/aes.js')
  const x25519 = await import('@mascaro101/echo-protocol/x25519.js')

  aes.initSync({
    module: readFileSync(resolve('node_modules/@mascaro101/echo-protocol/aes_bg.wasm')),
  })
  x25519.initSync({
    module: readFileSync(resolve('node_modules/@mascaro101/echo-protocol/x25519_bg.wasm')),
  })

  return {
    default: vi.fn(async () => {}),
    encrypt_aad_bytes: aes.encrypt_aad_bytes,
    decrypt_aad_bytes: aes.decrypt_aad_bytes,
    diffie_hellman: x25519.diffie_hellman,
    generate_private_ephemeral_key: x25519.generate_private_ephemeral_key,
    generate_public_ephemeral_key: x25519.generate_public_ephemeral_key,
    hkdf_derive: x25519.hkdf_derive,
    hkdf_extract: x25519.hkdf_extract,
    hkdf_expand: x25519.hkdf_expand,
  }
})

const { hpkeSeal, hpkeOpen } = await import('../groupCrypto/hpke.js')

// Access the real X25519 module (already initialised in the mock factory) to generate
// test keypairs from deterministic seeds.
const x25519 = await import('@mascaro101/echo-protocol/x25519.js')

function makeKeypair(seedByte) {
  const seed = new Uint8Array(32).fill(seedByte)
  const priv = x25519.generate_private_ephemeral_key(seed)
  const pub = x25519.generate_public_ephemeral_key(priv)
  return { priv, pub }
}

const INFO = new TextEncoder().encode('EchoMLS/v1/HPKE/TestInfo')
const AAD = new TextEncoder().encode('EchoMLS/v1/HPKE/TestAAD')

// ── hpkeSeal / hpkeOpen ──────────────────────────────────────────────────────

describe('hpkeSeal / hpkeOpen', () => {
  it('round-trip: seal then open with the correct private key recovers the original plaintext', async () => {
    const { priv, pub } = makeKeypair(0x01)
    const plaintext = new TextEncoder().encode('hello HPKE world')

    const { enc, ct } = await hpkeSeal(pub, INFO, AAD, plaintext)
    const recovered = await hpkeOpen(enc, priv, INFO, AAD, ct)

    expect(Buffer.from(recovered)).toEqual(Buffer.from(plaintext))
  })

  it('open with a different private key throws (wrong KEM secret → wrong AEAD key → GCM auth fails)', async () => {
    const { pub } = makeKeypair(0x02)
    const { priv: wrongPriv } = makeKeypair(0x03)
    const plaintext = new Uint8Array(32).fill(0xbb)

    const { enc, ct } = await hpkeSeal(pub, INFO, AAD, plaintext)
    await expect(hpkeOpen(enc, wrongPriv, INFO, AAD, ct)).rejects.toThrow()
  })

  it('tampered ciphertext (first byte flipped) throws (AES-GCM authentication tag failure)', async () => {
    const { priv, pub } = makeKeypair(0x04)
    const plaintext = new Uint8Array(16).fill(0xcc)

    const { enc, ct: original } = await hpkeSeal(pub, INFO, AAD, plaintext)
    const tampered = new Uint8Array(original)
    tampered[0] ^= 0xff

    await expect(hpkeOpen(enc, priv, INFO, AAD, tampered)).rejects.toThrow()
  })

  it('tampered authentication tag (last byte flipped) throws', async () => {
    const { priv, pub } = makeKeypair(0x05)
    const plaintext = new Uint8Array(16).fill(0xdd)

    const { enc, ct: original } = await hpkeSeal(pub, INFO, AAD, plaintext)
    const tampered = new Uint8Array(original)
    tampered[tampered.length - 1] ^= 0x01

    await expect(hpkeOpen(enc, priv, INFO, AAD, tampered)).rejects.toThrow()
  })

  it('wrong AAD causes GCM to reject (AAD is bound into the authentication tag)', async () => {
    const { priv, pub } = makeKeypair(0x06)
    const plaintext = new TextEncoder().encode('aad-sensitive message')
    const correctAad = new TextEncoder().encode('correct-aad')
    const wrongAad = new TextEncoder().encode('wrong-aad')

    const { enc, ct } = await hpkeSeal(pub, INFO, correctAad, plaintext)
    await expect(hpkeOpen(enc, priv, INFO, wrongAad, ct)).rejects.toThrow()
  })

  it('wrong info parameter causes decryption to fail (info is bound into the KEM key schedule)', async () => {
    const { priv, pub } = makeKeypair(0x07)
    const plaintext = new TextEncoder().encode('info-sensitive message')
    const correctInfo = new TextEncoder().encode('EchoMLS/v1/HPKE/CorrectInfo')
    const wrongInfo = new TextEncoder().encode('EchoMLS/v1/HPKE/WrongInfo')

    const { enc, ct } = await hpkeSeal(pub, correctInfo, AAD, plaintext)
    await expect(hpkeOpen(enc, priv, wrongInfo, AAD, ct)).rejects.toThrow()
  })

  it('two seals of the same plaintext produce different ephemeral keys (non-deterministic encap)', async () => {
    const { pub } = makeKeypair(0x08)
    const plaintext = new TextEncoder().encode('same message')

    const r1 = await hpkeSeal(pub, INFO, AAD, plaintext)
    const r2 = await hpkeSeal(pub, INFO, AAD, plaintext)

    // Different random ephemeral keys → different enc and ct
    expect(Buffer.from(r1.enc)).not.toEqual(Buffer.from(r2.enc))
    expect(Buffer.from(r1.ct)).not.toEqual(Buffer.from(r2.ct))
  })

  it('seal returns enc (32 bytes) and ct (plaintext.length + 16 bytes GCM tag)', async () => {
    const { pub } = makeKeypair(0x09)
    const plaintext = new Uint8Array(32).fill(0x42)

    const { enc, ct } = await hpkeSeal(pub, INFO, AAD, plaintext)

    expect(enc).toBeInstanceOf(Uint8Array)
    expect(enc).toHaveLength(32) // X25519 public key = 32 bytes
    expect(ct).toBeInstanceOf(Uint8Array)
    expect(ct).toHaveLength(32 + 16) // plaintext + 16-byte GCM auth tag
  })

  it('round-trip with empty plaintext', async () => {
    const { priv, pub } = makeKeypair(0x0a)
    const plaintext = new Uint8Array(0)

    const { enc, ct } = await hpkeSeal(pub, INFO, AAD, plaintext)
    const recovered = await hpkeOpen(enc, priv, INFO, AAD, ct)

    expect(recovered).toHaveLength(0)
  })

  it('round-trip with empty info and empty aad', async () => {
    const { priv, pub } = makeKeypair(0x0b)
    const plaintext = new TextEncoder().encode('no context')
    const emptyInfo = new Uint8Array(0)
    const emptyAad = new Uint8Array(0)

    const { enc, ct } = await hpkeSeal(pub, emptyInfo, emptyAad, plaintext)
    const recovered = await hpkeOpen(enc, priv, emptyInfo, emptyAad, ct)

    expect(Buffer.from(recovered)).toEqual(Buffer.from(plaintext))
  })
})
