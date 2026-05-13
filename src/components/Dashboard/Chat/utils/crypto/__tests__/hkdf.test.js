import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Buffer } from 'node:buffer'

const dh = vi.hoisted(() => ({
  hkdf_derive: vi.fn((ikm, _salt, _info, len) => {
    const material = ikm instanceof Uint8Array ? ikm : new Uint8Array(ikm)
    const out = new Uint8Array(len)
    for (let i = 0; i < len; i++) out[i] = (material[i % material.length] + i) & 0xff
    return out
  }),
}))

// mock dh-wasm hkdf_derive so the tests don’t depend on WASM init
vi.mock('@mascaro101/echo-protocol', () => ({
  hkdf_derive: (...args) => dh.hkdf_derive(...args),
}))

import { chain_key_KDF, deriveChainKeys } from '../hkdf.js'

beforeEach(() => {
  dh.hkdf_derive.mockClear()
})

describe('chain_key_KDF', () => {
  it('returns 76 bytes and produces different keys after advancing', () => {
    const ck0 = new Uint8Array(32).fill(5)

    const okm0 = chain_key_KDF(ck0)
    expect(okm0).toHaveLength(76)

    const mk0 = okm0.slice(0, 32)
    const ck1 = okm0.slice(32, 64)

    const okm1 = chain_key_KDF(ck1)
    const mk1 = okm1.slice(0, 32)

    expect(mk0).not.toEqual(mk1)
  })
})

describe('deriveChainKeys', () => {
  it('splits OKM into ck0/ck1 and assigns sending/receiving by id ordering', () => {
    dh.hkdf_derive.mockImplementationOnce((_ikm, _salt, _info, len) => {
      const okm = new Uint8Array(len)
      for (let i = 0; i < len; i++) okm[i] = i & 0xff
      return okm
    })

    const rootKey = new Uint8Array(32).fill(7)
    const { sendingChainKey, receivingChainKey } = deriveChainKeys(rootKey, 'ALICE', 'BOB')
    expect(sendingChainKey).toHaveLength(32)
    expect(receivingChainKey).toHaveLength(32)
    expect(Buffer.from(sendingChainKey)).toEqual(Buffer.from(new Uint8Array([...Array(32).keys()])))
    expect(Buffer.from(receivingChainKey)).toEqual(
      Buffer.from(new Uint8Array([...Array(32).keys()].map((n) => n + 32)))
    )

    dh.hkdf_derive.mockImplementationOnce((_ikm, _salt, _info, len) => {
      const okm = new Uint8Array(len)
      for (let i = 0; i < len; i++) okm[i] = i & 0xff
      return okm
    })

    const swapped = deriveChainKeys(rootKey, 'ZOE', 'AMY')
    expect(Buffer.from(swapped.sendingChainKey)).toEqual(
      Buffer.from(new Uint8Array([...Array(32).keys()].map((n) => n + 32)))
    )
    expect(Buffer.from(swapped.receivingChainKey)).toEqual(
      Buffer.from(new Uint8Array([...Array(32).keys()]))
    )
  })

  it('gives complementary chain directions to the two peers for the same root key', () => {
    dh.hkdf_derive.mockImplementationOnce((_ikm, _salt, _info, len) => {
      const okm = new Uint8Array(len)
      for (let i = 0; i < len; i++) okm[i] = i & 0xff
      return okm
    })
    const alice = deriveChainKeys(new Uint8Array(32).fill(7), 'ALICE', 'BOB')

    dh.hkdf_derive.mockImplementationOnce((_ikm, _salt, _info, len) => {
      const okm = new Uint8Array(len)
      for (let i = 0; i < len; i++) okm[i] = i & 0xff
      return okm
    })
    const bob = deriveChainKeys(new Uint8Array(32).fill(7), 'BOB', 'ALICE')

    expect(Buffer.from(alice.sendingChainKey)).toEqual(Buffer.from(bob.receivingChainKey))
    expect(Buffer.from(alice.receivingChainKey)).toEqual(Buffer.from(bob.sendingChainKey))
  })
})
