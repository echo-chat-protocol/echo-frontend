import { describe, it, expect, beforeEach, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { arrayBufferToBase64 } from '../../helpers.js'

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto
}

const decryptMock = vi.hoisted(() => vi.fn(async () => JSON.stringify({ text: 'hi', image: null })))

// deterministic “chain KDF”: mk = byte b, nextCk = b+1
const chainKdfMock = vi.hoisted(() =>
  vi.fn((ck) => {
    const b = ck[0]
    const mk = new Uint8Array(32).fill(b)
    const next = new Uint8Array(32).fill((b + 1) & 0xff)
    return new Uint8Array([...mk, ...next])
  })
)

const dhWasm = vi.hoisted(() => ({
  init: vi.fn(async () => {}),
  generate_private_ephemeral_key: vi.fn(async () => new Uint8Array(32).fill(55)),
  generate_public_ephemeral_key: vi.fn(async () => new Uint8Array(32).fill(56)),
  diffie_hellman: vi.fn(async () => new Uint8Array(32).fill(77)),
  hkdf_derive: vi.fn(() => {
    const out = new Uint8Array(64)
    out.fill(0xaa, 0, 32) // sending chain
    out.fill(0xbb, 32) // new root
    return out
  }),
}))

const dr = vi.hoisted(() => ({
  initializeDoubleRatchetResponse: vi.fn(),
  continueDoubleRatchetChain: vi.fn(async () => ({
    receivingChainKey: new Uint8Array(32).fill(20),
    newRootKey: new Uint8Array(32).fill(2),
  })),
}))

const km = vi.hoisted(() => ({
  getSessionKey: vi.fn(),
  setSessionKey: vi.fn(),

  getRootKey: vi.fn(),
  setRootKey: vi.fn(),

  getEphemeralData: vi.fn(),
  setEphemeralData: vi.fn(),
  setOwnEphemeralKeys: vi.fn(),

  getReceivingChainKey: vi.fn(),
  setReceivingChainKey: vi.fn(),
  setSendingChainKey: vi.fn(),

  setCurrentSendingNumber: vi.fn(),
  getCurrentSendingNumber: vi.fn(),
  setPreviousSendingNumber: vi.fn(),

  getCurrentReceivingNumber: vi.fn(),
  setCurrentReceivingNumber: vi.fn(),

  getSkippedMessages: vi.fn(),
  setSkippedMessages: vi.fn(),

  updateSavedMessages: vi.fn(),
}))

vi.mock('@mascaro101/echo-protocol', () => ({
  default: (...args) => dhWasm.init(...args),
  generate_private_ephemeral_key: (...args) => dhWasm.generate_private_ephemeral_key(...args),
  generate_public_ephemeral_key: (...args) => dhWasm.generate_public_ephemeral_key(...args),
  diffie_hellman: (...args) => dhWasm.diffie_hellman(...args),
  hkdf_derive: (...args) => dhWasm.hkdf_derive(...args),
}))

vi.mock('../../crypto/aes', () => ({
  buildAadBytes: () => new Uint8Array([1]),
  decryptWithAad: (...args) => decryptMock(...args),
}))
vi.mock('../../crypto/dr', () => dr)
vi.mock('../../crypto/hkdf', () => ({
  chain_key_KDF: (ck) => chainKdfMock(ck),
  deriveChainKeys: () => ({ receivingChainKey: new Uint8Array(32).fill(99) }),
}))
vi.mock('../../chat/keyManagement', () => km)

import { decryptIncomingMessage } from '../../chat/messageDecryption.js'

function b64Dh(byte) {
  return arrayBufferToBase64(new Uint8Array(32).fill(byte))
}

describe('decryptIncomingMessage DH-ratchet + late-across-DH', () => {
  const userId = 'me'
  const targetUserId = 'peer'

  beforeEach(() => {
    vi.clearAllMocks()
    km.getRootKey.mockResolvedValue(new Uint8Array(32).fill(1))
    km.getSkippedMessages.mockResolvedValue({})
    km.getReceivingChainKey.mockResolvedValue(new Uint8Array(32).fill(5)) // old CKr
    km.getCurrentSendingNumber.mockResolvedValue(7)
  })

  it('ratchets on new DH and caches old/new skipped keys', async () => {
    const oldDh = b64Dh(9)
    const newDh = b64Dh(10)
    const ephPriv = b64Dh(33)

    km.getEphemeralData.mockResolvedValue({
      currentTargetPublicEphemeralKey: oldDh,
      ephPriv,
      knownTargetPublicEphemeralKeys: {},
    })
    km.getCurrentReceivingNumber.mockResolvedValue(1)

    await decryptIncomingMessage(
      {
        payload: 'ciphertext',
        publicEphemeralKey: newDh,
        sendingNumber: 2,
        previousSendingNumber: 3,
      },
      'nonce',
      userId,
      targetUserId,
      new Uint8Array(32),
      {},
      null
    )

    // Nr becomes n+1 on the new chain
    expect(km.setCurrentReceivingNumber).toHaveBeenCalledWith(targetUserId, 3)

    // old chain: cache i=1..2 under oldDh (Nr..pn-1)
    // new chain: cache i=0..1 under newDh (0..n-1)
    const skippedArg = km.setSkippedMessages.mock.calls.at(-1)[1]
    expect(skippedArg).toHaveProperty(oldDh)
    expect(skippedArg[oldDh]).toHaveProperty('1')
    expect(skippedArg[oldDh]).toHaveProperty('2')
    expect(skippedArg).toHaveProperty(newDh)
    expect(skippedArg[newDh]).toHaveProperty('0')
    expect(skippedArg[newDh]).toHaveProperty('1')

    // root key updates: once from DR, then once from HKDF(DH4)
    const newRootFromDr = new Uint8Array(32).fill(2)
    const newRootFromHkdf = new Uint8Array(32).fill(0xaa)
    expect(km.setRootKey).toHaveBeenNthCalledWith(1, userId, targetUserId, newRootFromDr)
    expect(km.setRootKey).toHaveBeenNthCalledWith(2, userId, targetUserId, newRootFromHkdf)

    // sending chain set from HKDF output second half (0xbb...)
    expect(km.setSendingChainKey).toHaveBeenCalledWith(
      userId,
      targetUserId,
      new Uint8Array(32).fill(0xbb)
    )

    // local eph regenerated + stored
    expect(km.setOwnEphemeralKeys).toHaveBeenCalledWith(
      userId,
      targetUserId,
      arrayBufferToBase64(new Uint8Array(32).fill(56)),
      arrayBufferToBase64(new Uint8Array(32).fill(55))
    )

    // Ns reset and PN updated
    expect(km.setPreviousSendingNumber).toHaveBeenCalledWith(targetUserId, 7)
    expect(km.setCurrentSendingNumber).toHaveBeenCalledWith(targetUserId, 0)

    // DH ratchet path actually invoked
    expect(dr.continueDoubleRatchetChain).toHaveBeenCalled()
    expect(dhWasm.diffie_hellman).toHaveBeenCalled()
    expect(dhWasm.hkdf_derive).toHaveBeenCalled()

    // DHr moves to newDh when we processed a message on that chain
    const ephUpdate = km.setEphemeralData.mock.calls.at(-1)[2]
    expect(ephUpdate.currentTargetPublicEphemeralKey).toBe(newDh)
  })

  it('late message from old DH uses skipped key and does not ratchet or move DHr backwards', async () => {
    const oldDh = b64Dh(9)
    const newDh = b64Dh(10)

    km.getEphemeralData.mockResolvedValue({
      currentTargetPublicEphemeralKey: newDh,
      knownTargetPublicEphemeralKeys: { [oldDh]: true, [newDh]: true },
      ephPriv: b64Dh(33),
    })
    km.getCurrentReceivingNumber.mockResolvedValue(3)

    const mkFor1 = arrayBufferToBase64(new Uint8Array(32).fill(42))
    km.getSkippedMessages.mockResolvedValue({ [oldDh]: { 1: mkFor1 } })

    const out = await decryptIncomingMessage(
      {
        payload: 'ciphertext',
        publicEphemeralKey: oldDh,
        sendingNumber: 1,
        previousSendingNumber: 0,
      },
      'nonce',
      userId,
      targetUserId,
      new Uint8Array(32),
      {},
      null
    )

    expect(out?.text).toBe('hi')

    // no state advancement on chain/Nr
    expect(km.setReceivingChainKey).not.toHaveBeenCalled()
    expect(km.setCurrentReceivingNumber).not.toHaveBeenCalled()

    // no DH ratchet performed
    expect(dr.continueDoubleRatchetChain).not.toHaveBeenCalled()
    expect(dhWasm.diffie_hellman).not.toHaveBeenCalled()
    expect(dhWasm.hkdf_derive).not.toHaveBeenCalled()

    // skipped key consumed
    const skippedAfter = km.setSkippedMessages.mock.calls.at(-1)[1]
    expect(skippedAfter[oldDh]?.['1']).toBeUndefined()

    // DHr should remain newDh (not overwritten to oldDh)
    const ephUpdate = km.setEphemeralData.mock.calls.at(-1)[2]
    expect(ephUpdate.currentTargetPublicEphemeralKey).toBe(newDh)
  })
})
