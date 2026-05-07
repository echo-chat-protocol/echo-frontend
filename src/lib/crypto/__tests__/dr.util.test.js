import { describe, it, expect, vi, beforeEach } from 'vitest'
import { webcrypto } from 'node:crypto'
import { Buffer } from 'node:buffer'

if (!globalThis.crypto) globalThis.crypto = webcrypto
if (!globalThis.atob) globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary')
if (!globalThis.btoa) globalThis.btoa = (bin) => Buffer.from(bin, 'binary').toString('base64')

const toB64 = (u8) => Buffer.from(u8).toString('base64')

const api = vi.hoisted(() => ({
  fetchPreKeyBundle: vi.fn(),
  fetchPublicIdentityKeyX25519: vi.fn(),
  fetchPublicIdentityKeyEd25519: vi.fn(),
}))

const km = vi.hoisted(() => ({
  getIdentityKeys: vi.fn(),
  getOPKPrivateKey: vi.fn(),
  getPeerIdentityKeys: vi.fn(),
}))

const dh = vi.hoisted(() => ({
  init: vi.fn(async () => {}),
  diffie_hellman: vi.fn(),
  hkdf_derive: vi.fn(),
}))

const xeddsa = vi.hoisted(() => ({
  init: vi.fn(async () => {}),
  verify_signature: vi.fn(async () => true),
}))

vi.mock('@features/chat/utils/api', () => api)
vi.mock('../../chat/keyManagement.js', () => km)

vi.mock('@mascaro101/echo-protocol', () => ({
  default: (...args) => dh.init(...args),
  diffie_hellman: (...args) => dh.diffie_hellman(...args),
  hkdf_derive: (...args) => dh.hkdf_derive(...args),
  verify_signature: (...args) => xeddsa.verify_signature(...args),
}))

import { continueDoubleRatchetChain, initializeDoubleRatchetResponse } from '../dr.js'

describe('dr.js util exports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('continueDoubleRatchetChain derives receivingChainKey/newRootKey from hkdf_derive output', async () => {
    dh.diffie_hellman.mockReturnValue(new Uint8Array(32).fill(9))
    dh.hkdf_derive.mockImplementation((_ikm, _salt, _info, len) => {
      const okm = new Uint8Array(len)
      okm.fill(1, 0, 32)
      okm.fill(2, 32)
      return okm
    })

    const prevTargetEk = new Uint8Array(32).fill(6)
    const ourEkPriv = new Uint8Array(32).fill(5)
    const rootKey = new Uint8Array(32).fill(7)

    const out = await continueDoubleRatchetChain({}, 'bob', prevTargetEk, ourEkPriv, rootKey)
    expect(out.receivingChainKey).toHaveLength(32)
    expect(out.newRootKey).toHaveLength(32)
    expect(Buffer.from(out.newRootKey)).toEqual(Buffer.from(new Uint8Array(32).fill(1)))
    expect(Buffer.from(out.receivingChainKey)).toEqual(Buffer.from(new Uint8Array(32).fill(2)))

    expect(dh.init).toHaveBeenCalledTimes(1)
    expect(dh.diffie_hellman).toHaveBeenCalledTimes(1)
    expect(dh.hkdf_derive).toHaveBeenCalledTimes(1)

    const [, salt, info, len] = dh.hkdf_derive.mock.calls[0]
    expect(Buffer.from(salt)).toEqual(Buffer.from(rootKey))
    expect(Buffer.from(info)).toEqual(
      Buffer.from(new TextEncoder().encode('EchoProtocol/v1/KDF_RK'))
    )
    expect(len).toBe(64)
  })

  it('initializeDoubleRatchetResponse returns a root_key and pins identity when no saved peer exists', async () => {
    const privatePreKey = new Uint8Array(32).fill(1)
    const targetIk = new Uint8Array(32).fill(2)
    const targetEk = new Uint8Array(32).fill(3)

    km.getIdentityKeys.mockResolvedValue({ privatePreKey: toB64(privatePreKey) })
    km.getPeerIdentityKeys.mockResolvedValue(null)
    km.getOPKPrivateKey.mockResolvedValue(null)

    api.fetchPublicIdentityKeyX25519.mockResolvedValue(toB64(targetIk))
    api.fetchPublicIdentityKeyEd25519.mockRejectedValue(new Error('no-ed'))

    let dhCall = 0
    dh.diffie_hellman.mockImplementation(() => {
      dhCall += 1
      return new Uint8Array(32).fill(dhCall * 10)
    })

    dh.hkdf_derive.mockImplementation((ikm, _salt, _info, len) => {
      expect(ikm).toHaveLength(96)
      expect(Buffer.from(ikm.slice(0, 32))).toEqual(Buffer.from(new Uint8Array(32).fill(10)))
      expect(Buffer.from(ikm.slice(32, 64))).toEqual(Buffer.from(new Uint8Array(32).fill(20)))
      expect(Buffer.from(ikm.slice(64, 96))).toEqual(Buffer.from(new Uint8Array(32).fill(30)))
      return new Uint8Array(len).fill(99)
    })

    const message = { publicEphemeralKey: toB64(targetEk) }
    const out = await initializeDoubleRatchetResponse(
      {},
      message,
      'bob',
      new Uint8Array(32).fill(4)
    )

    expect(out.root_key).toEqual(new Uint8Array(32).fill(99))
    expect(out.peerIdentityToPin).toEqual({ publicIdentityKeyX25519: toB64(targetIk) })
    expect(dh.diffie_hellman).toHaveBeenCalledTimes(3)
    expect(dh.hkdf_derive).toHaveBeenCalledTimes(1)
  })

  it('initializeDoubleRatchetResponse includes OPK DH when opkId is present', async () => {
    km.getIdentityKeys.mockResolvedValue({ privatePreKey: toB64(new Uint8Array(32).fill(1)) })
    km.getPeerIdentityKeys.mockResolvedValue(null)
    km.getOPKPrivateKey.mockResolvedValue(new Uint8Array(32).fill(8))
    api.fetchPublicIdentityKeyX25519.mockResolvedValue(toB64(new Uint8Array(32).fill(2)))
    api.fetchPublicIdentityKeyEd25519.mockRejectedValue(new Error('no-ed'))

    let dhCall = 0
    dh.diffie_hellman.mockImplementation(() => {
      dhCall += 1
      return new Uint8Array(32).fill(dhCall * 10)
    })

    dh.hkdf_derive.mockImplementation((ikm, _salt, _info, len) => {
      expect(ikm).toHaveLength(128)
      expect(Buffer.from(ikm.slice(96, 128))).toEqual(Buffer.from(new Uint8Array(32).fill(40)))
      return new Uint8Array(len).fill(7)
    })

    const message = { publicEphemeralKey: toB64(new Uint8Array(32).fill(3)), opkId: 'OPK1' }
    const out = await initializeDoubleRatchetResponse(
      {},
      message,
      'bob',
      new Uint8Array(32).fill(4)
    )

    expect(out.root_key).toEqual(new Uint8Array(32).fill(7))
    expect(dh.diffie_hellman).toHaveBeenCalledTimes(4)
  })

  it('initializeDoubleRatchetResponse throws PEER_IDENTITY_CHANGED if stored identity differs', async () => {
    const saved = toB64(new Uint8Array(32).fill(9))
    const fetched = toB64(new Uint8Array(32).fill(1))

    km.getIdentityKeys.mockResolvedValue({ privatePreKey: toB64(new Uint8Array(32).fill(1)) })
    km.getPeerIdentityKeys.mockResolvedValue({
      publicIdentityKeyX25519: saved,
      publicIdentityKeyEd25519: null,
    })
    api.fetchPublicIdentityKeyX25519.mockResolvedValue(fetched)
    api.fetchPublicIdentityKeyEd25519.mockResolvedValue(null)

    await expect(
      initializeDoubleRatchetResponse(
        {},
        { publicEphemeralKey: toB64(new Uint8Array(32).fill(3)) },
        'bob',
        new Uint8Array(32).fill(4)
      )
    ).rejects.toMatchObject({ code: 'PEER_IDENTITY_CHANGED' })

    expect(dh.diffie_hellman).not.toHaveBeenCalled()
    expect(dh.hkdf_derive).not.toHaveBeenCalled()
  })
})
