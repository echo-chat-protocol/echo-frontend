// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── WASM mock (hoisted so vi.mock factories can close over it) ────────────────

const wasm = vi.hoisted(() => {
  const fixedPriv = new Uint8Array(32).fill(0x01)
  const fixedPub = new Uint8Array(32).fill(0x02)

  return {
    init: vi.fn().mockResolvedValue(undefined),
    generate_private_ephemeral_key: vi.fn().mockResolvedValue(fixedPriv),
    generate_public_ephemeral_key: vi.fn().mockResolvedValue(fixedPub),
    diffie_hellman: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x42)),
    hkdf_derive: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x99)),
    // Symmetric fake: hex-encode the text so decrypt can invert it exactly
    encrypt: vi.fn().mockImplementation((text) => {
      const bytes = new TextEncoder().encode(text)
      const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      return Promise.resolve(hex)
    }),
    decrypt: vi.fn().mockImplementation((hex) => {
      const bytes = new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)))
      return Promise.resolve(new TextDecoder().decode(bytes))
    }),
    fixedPriv,
    fixedPub,
  }
})

vi.mock('@mascaro101/echo-protocol', () => ({
  default: (...a) => wasm.init(...a),
  generate_private_ephemeral_key: (...a) => wasm.generate_private_ephemeral_key(...a),
  generate_public_ephemeral_key: (...a) => wasm.generate_public_ephemeral_key(...a),
  diffie_hellman: (...a) => wasm.diffie_hellman(...a),
  hkdf_derive: (...a) => wasm.hkdf_derive(...a),
  encrypt: (...a) => wasm.encrypt(...a),
  decrypt: (...a) => wasm.decrypt(...a),
}))

vi.mock('@/utils/storage/EncryptedLocalDatabase', () => ({
  default: {
    isUnlocked: vi.fn(() => false),
    getIdentityKeys: vi.fn(),
  },
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import eld from '@/utils/storage/EncryptedLocalDatabase'
import {
  getOrCreateDeviceIK,
  encryptQRPayload,
  decryptQRPayload,
  parseQRPayload,
  generateSyncPayload,
  decryptSyncPayload,
  parseSyncPayload,
} from '../qrCrypto.js'

const LS_IK_KEY = 'echo_device_ik'

// Helper: encode a Uint8Array the same way the module does (btoa of raw bytes)
function toB64(u8) {
  let bin = ''
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
  return btoa(bin)
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.clearAllMocks())

// ── getOrCreateDeviceIK ───────────────────────────────────────────────────────

describe('getOrCreateDeviceIK', () => {
  it('returns ELD keys with source="eld" when ELD is unlocked and has X25519 keys', async () => {
    const privKey = new Uint8Array(32).fill(0xaa)
    const pubKey = new Uint8Array(32).fill(0xbb)
    eld.isUnlocked.mockReturnValue(true)
    eld.getIdentityKeys.mockResolvedValue({
      privateKeyX25519: toB64(privKey),
      publicKeyX25519: toB64(pubKey),
    })

    const ik = await getOrCreateDeviceIK()

    expect(ik.source).toBe('eld')
    expect(ik.priv).toBeInstanceOf(Uint8Array)
    expect(Array.from(ik.priv)).toEqual(Array.from(privKey))
    expect(Array.from(ik.pub)).toEqual(Array.from(pubKey))
  })

  it('falls back to localStorage when ELD is locked', async () => {
    eld.isUnlocked.mockReturnValue(false)
    const privKey = new Uint8Array(32).fill(0x11)
    const pubKey = new Uint8Array(32).fill(0x22)
    localStorage.setItem(LS_IK_KEY, JSON.stringify({ priv: toB64(privKey), pub: toB64(pubKey) }))

    const ik = await getOrCreateDeviceIK()

    expect(ik.source).toBe('local')
    expect(Array.from(ik.priv)).toEqual(Array.from(privKey))
    expect(Array.from(ik.pub)).toEqual(Array.from(pubKey))
  })

  it('falls back to localStorage when ELD is unlocked but has no X25519 keys', async () => {
    eld.isUnlocked.mockReturnValue(true)
    eld.getIdentityKeys.mockResolvedValue({})
    const privKey = new Uint8Array(32).fill(0x33)
    const pubKey = new Uint8Array(32).fill(0x44)
    localStorage.setItem(LS_IK_KEY, JSON.stringify({ priv: toB64(privKey), pub: toB64(pubKey) }))

    const ik = await getOrCreateDeviceIK()

    expect(ik.source).toBe('local')
  })

  it('generates and persists a fresh key pair on first run', async () => {
    eld.isUnlocked.mockReturnValue(false)

    const ik = await getOrCreateDeviceIK()

    expect(ik.source).toBe('local')
    expect(ik.priv).toBeInstanceOf(Uint8Array)
    expect(wasm.generate_private_ephemeral_key).toHaveBeenCalledOnce()
    expect(wasm.generate_public_ephemeral_key).toHaveBeenCalledOnce()
    const stored = localStorage.getItem(LS_IK_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored)
    expect(parsed).toHaveProperty('priv')
    expect(parsed).toHaveProperty('pub')
  })

  it('reuses persisted local key on second call without regenerating', async () => {
    eld.isUnlocked.mockReturnValue(false)

    await getOrCreateDeviceIK()
    wasm.generate_private_ephemeral_key.mockClear()

    await getOrCreateDeviceIK()

    expect(wasm.generate_private_ephemeral_key).not.toHaveBeenCalled()
  })
})

// ── encryptQRPayload + decryptQRPayload ───────────────────────────────────────

describe('encryptQRPayload', () => {
  const fakeIK = { priv: new Uint8Array(32).fill(0xaa), pub: new Uint8Array(32).fill(0xbb) }

  it('returns a payload with v="echo-qr-v1" and required fields', async () => {
    const payload = await encryptQRPayload('hello', fakeIK)

    expect(payload.v).toBe('echo-qr-v1')
    expect(typeof payload.epk).toBe('string')
    expect(typeof payload.ct).toBe('string')
    expect(typeof payload.s).toBe('string')
    expect(typeof payload.n).toBe('string')
  })

  it('calls DH with the ephemeral private key and recipient public key', async () => {
    await encryptQRPayload('hello', fakeIK)

    expect(wasm.diffie_hellman).toHaveBeenCalledWith(wasm.fixedPriv, fakeIK.pub)
  })

  it('calls HKDF after DH', async () => {
    await encryptQRPayload('hello', fakeIK)

    expect(wasm.hkdf_derive).toHaveBeenCalled()
  })
})

describe('decryptQRPayload', () => {
  const fakeIK = { priv: new Uint8Array(32).fill(0xaa), pub: new Uint8Array(32).fill(0xbb) }

  it('roundtrip: recovers the original plaintext', async () => {
    const message = 'secret roundtrip message'
    const payload = await encryptQRPayload(message, fakeIK)
    const recovered = await decryptQRPayload(payload, fakeIK)

    expect(recovered).toBe(message)
  })

  it('throws when version does not match', async () => {
    await expect(
      decryptQRPayload({ v: 'not-echo-qr-v1', epk: 'a', ct: 'b', s: 'c', n: 'd' }, fakeIK)
    ).rejects.toThrow('Not an ECHO QR payload')
  })
})

// ── parseQRPayload ────────────────────────────────────────────────────────────

describe('parseQRPayload', () => {
  it('returns the object for a valid echo-qr-v1 JSON string', () => {
    const obj = { v: 'echo-qr-v1', epk: 'a', ct: 'b', s: 'c', n: 'd' }
    expect(parseQRPayload(JSON.stringify(obj))).toEqual(obj)
  })

  it('returns null for invalid JSON', () => {
    expect(parseQRPayload('not json at all')).toBeNull()
  })

  it('returns null when version field is missing or wrong', () => {
    expect(
      parseQRPayload(JSON.stringify({ v: 'other-version', epk: 'a', ct: 'b', s: 'c', n: 'd' }))
    ).toBeNull()
    expect(parseQRPayload(JSON.stringify({ epk: 'a', ct: 'b', s: 'c', n: 'd' }))).toBeNull()
  })

  it('returns null when required fields are absent', () => {
    // Missing n
    expect(
      parseQRPayload(JSON.stringify({ v: 'echo-qr-v1', epk: 'a', ct: 'b', s: 'c' }))
    ).toBeNull()
    // Missing ct
    expect(parseQRPayload(JSON.stringify({ v: 'echo-qr-v1', epk: 'a', s: 'c', n: 'd' }))).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseQRPayload('')).toBeNull()
  })
})

// ── generateSyncPayload + decryptSyncPayload ──────────────────────────────────

describe('generateSyncPayload', () => {
  it('returns a payload with v="echo-sync-v1" and required fields', async () => {
    const payload = await generateSyncPayload({ token: 'tok', userId: 'u1', username: 'alice' })

    expect(payload.v).toBe('echo-sync-v1')
    expect(typeof payload.k).toBe('string')
    expect(typeof payload.ct).toBe('string')
    expect(typeof payload.n).toBe('string')
  })
})

describe('decryptSyncPayload', () => {
  it('roundtrip: recovers original credentials', async () => {
    const creds = { token: 'tok123', userId: 'uid-456', username: 'bob' }
    const payload = await generateSyncPayload(creds)
    const recovered = await decryptSyncPayload(payload)

    expect(recovered).toEqual(creds)
  })

  it('throws when version does not match', async () => {
    await expect(decryptSyncPayload({ v: 'echo-qr-v1', k: 'a', ct: 'b', n: 'c' })).rejects.toThrow(
      'Not an ECHO sync payload'
    )
  })
})

// ── parseSyncPayload ──────────────────────────────────────────────────────────

describe('parseSyncPayload', () => {
  it('returns the object for a valid echo-sync-v1 JSON string', () => {
    const obj = { v: 'echo-sync-v1', k: 'key', ct: 'ciphertext', n: 'nonce' }
    expect(parseSyncPayload(JSON.stringify(obj))).toEqual(obj)
  })

  it('returns null for invalid JSON', () => {
    expect(parseSyncPayload('{')).toBeNull()
  })

  it('returns null when version is wrong', () => {
    expect(
      parseSyncPayload(JSON.stringify({ v: 'echo-qr-v1', k: 'a', ct: 'b', n: 'c' }))
    ).toBeNull()
  })

  it('returns null when required fields are absent', () => {
    // Missing ct
    expect(parseSyncPayload(JSON.stringify({ v: 'echo-sync-v1', k: 'a', n: 'c' }))).toBeNull()
  })
})
