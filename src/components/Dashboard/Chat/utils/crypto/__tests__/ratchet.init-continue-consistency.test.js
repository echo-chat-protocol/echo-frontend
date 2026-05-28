import { describe, it, expect, beforeEach, vi } from 'vitest'
import { webcrypto } from 'node:crypto'

import { base64ToArrayBuffer } from '../../helpers.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

let activeUserId = null
let devices = new Map()
let privCounter = 10

function asUser(userId, fn) {
  const prev = activeUserId
  activeUserId = userId
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      activeUserId = prev
    })
}

function newDeviceState() {
  return {
    rootKey: new Map(),
    sendingChainKey: new Map(),
    receivingChainKey: new Map(),
    eph: new Map(),
    ns: new Map(),
    nr: new Map(),
    pn: new Map(),
    skipped: new Map(),
  }
}

function device(userId) {
  if (!devices.has(userId)) devices.set(userId, newDeviceState())
  return devices.get(userId)
}

const encryptMock = vi.hoisted(() =>
  vi.fn(async (plaintext, key) => JSON.stringify({ b: new Uint8Array(key)[0], p: plaintext }))
)

const decryptMock = vi.hoisted(() =>
  vi.fn(async (ciphertext, key) => {
    const parsed = JSON.parse(ciphertext)
    const actualByte = new Uint8Array(key)[0]
    if (parsed.b !== actualByte) {
      throw new Error(`wrong key: got ${actualByte}, expected ${parsed.b}`)
    }
    return parsed.p
  })
)

const dhWasm = vi.hoisted(() => ({
  init: vi.fn(async () => {}),
  generate_private_ephemeral_key: vi.fn(async () => new Uint8Array(32).fill(privCounter++ & 0xff)),
  generate_public_ephemeral_key: vi.fn(async (priv) =>
    new Uint8Array(32).fill((new Uint8Array(priv)[0] + 1) & 0xff)
  ),
  diffie_hellman: vi.fn(async (priv, pub) => {
    const a = new Uint8Array(priv)[0]
    const bPriv = (new Uint8Array(pub)[0] - 1) & 0xff
    return new Uint8Array(32).fill((a * bPriv) & 0xff)
  }),
  hkdf_derive: vi.fn((ikm, _salt, info, len) => {
    const infoText = new TextDecoder().decode(info)
    const out = new Uint8Array(len)

    if (infoText === 'EchoProtocol/v1/CHAIN_INIT') {
      out.fill(0x11, 0, 32)
      out.fill(0x22, 32)
      return out
    }

    if (infoText === 'EchoProtocol/v1/KDF_CK') {
      const b = new Uint8Array(ikm)[0]
      out.fill(b, 0, 32)
      out.fill((b + 1) & 0xff, 32)
      return out
    }

    if (infoText === 'EchoProtocol/v1/KDF_RK') {
      const ikmByte = new Uint8Array(ikm)[0]
      const saltByte = _salt && _salt.length ? new Uint8Array(_salt)[0] : 0
      const base = (ikmByte ^ saltByte ^ 0x45) & 0xff
      out.fill((base + 1) & 0xff, 0, 32)
      out.fill((base + 2) & 0xff, 32)
      return out
    }

    out.fill(0x33)
    return out
  }),
}))

const km = vi.hoisted(() => ({
  getRootKey: vi.fn(
    async (_userId, targetUserId) => device(activeUserId).rootKey.get(targetUserId) ?? null
  ),
  setRootKey: vi.fn(async (_userId, targetUserId, rootKey) => {
    device(activeUserId).rootKey.set(
      targetUserId,
      rootKey instanceof Uint8Array ? rootKey : new Uint8Array(rootKey)
    )
  }),
  getSendingChainKey: vi.fn(
    async (_userId, targetUserId) => device(activeUserId).sendingChainKey.get(targetUserId) ?? null
  ),
  setSendingChainKey: vi.fn(async (_userId, targetUserId, ck) => {
    device(activeUserId).sendingChainKey.set(
      targetUserId,
      ck instanceof Uint8Array ? ck : new Uint8Array(ck)
    )
  }),
  getReceivingChainKey: vi.fn(
    async (_userId, targetUserId) =>
      device(activeUserId).receivingChainKey.get(targetUserId) ?? null
  ),
  setReceivingChainKey: vi.fn(async (_userId, targetUserId, ck) => {
    device(activeUserId).receivingChainKey.set(
      targetUserId,
      ck instanceof Uint8Array ? ck : new Uint8Array(ck)
    )
  }),
  getEphemeralData: vi.fn(
    async (_userId, targetUserId) => device(activeUserId).eph.get(targetUserId) ?? null
  ),
  setEphemeralData: vi.fn(async (_userId, targetUserId, data) => {
    device(activeUserId).eph.set(targetUserId, data)
  }),
  setOwnEphemeralKeys: vi.fn(async (_userId, targetUserId, publicKey, privateKey) => {
    const existing = device(activeUserId).eph.get(targetUserId) ?? {}
    device(activeUserId).eph.set(targetUserId, {
      ...existing,
      ephPub: publicKey,
      ephPriv: privateKey,
    })
  }),
  getOwnEphemeralKeys: vi.fn(async (_userId, targetUserId) => {
    const data = device(activeUserId).eph.get(targetUserId)
    if (!data?.ephPub || !data?.ephPriv) return null
    return { public: data.ephPub, private: data.ephPriv }
  }),
  getCurrentSendingNumber: vi.fn(
    async (targetUserId) => device(activeUserId).ns.get(targetUserId) ?? 0
  ),
  setCurrentSendingNumber: vi.fn(async (targetUserId, n) => {
    device(activeUserId).ns.set(targetUserId, n)
  }),
  getPreviousSendingNumber: vi.fn(
    async (targetUserId) => device(activeUserId).pn.get(targetUserId) ?? 0
  ),
  setPreviousSendingNumber: vi.fn(async (targetUserId, n) => {
    device(activeUserId).pn.set(targetUserId, n)
  }),
  getCurrentReceivingNumber: vi.fn(
    async (targetUserId) => device(activeUserId).nr.get(targetUserId) ?? 0
  ),
  setCurrentReceivingNumber: vi.fn(async (targetUserId, n) => {
    device(activeUserId).nr.set(targetUserId, n)
  }),
  getSkippedMessages: vi.fn(
    async (targetUserId) => device(activeUserId).skipped.get(targetUserId) ?? {}
  ),
  setSkippedMessages: vi.fn(async (targetUserId, skipped) => {
    device(activeUserId).skipped.set(targetUserId, skipped)
  }),
  setSessionKey: vi.fn(),
  updateSavedMessages: vi.fn(),
  deleteOPKPrivateKey: vi.fn(),
  storePeerIdentityKeys: vi.fn(),
}))

const drMocks = vi.hoisted(() => ({
  initializeDoubleRatchet: vi.fn(async () => ({
    root_key: new Uint8Array(32).fill(0x33),
    spkId: null,
    opkId: null,
    peerIdentityToPin: null,
  })),
  initializeDoubleRatchetResponse: vi.fn(async () => ({
    root_key: new Uint8Array(32).fill(0x33),
    peerIdentityToPin: null,
  })),
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
  encryptWithAad: (...args) => encryptMock(...args),
  decryptWithAad: (...args) => decryptMock(...args),
}))

vi.mock('../../chat/keyManagement', () => km)

vi.mock('../../crypto/dr', async () => {
  const actual = await vi.importActual('../../crypto/dr.js')
  return {
    ...actual,
    initializeDoubleRatchet: (...args) => drMocks.initializeDoubleRatchet(...args),
    initializeDoubleRatchetResponse: (...args) => drMocks.initializeDoubleRatchetResponse(...args),
  }
})

import { encryptOutgoingMessage } from '../../chat/messageEncryption.js'
import { decryptIncomingMessage } from '../../chat/messageDecryption.js'

async function send(from, to, text) {
  return asUser(from, () =>
    encryptOutgoingMessage({
      text,
      imageData: null,
      userId: from,
      targetUserId: to,
      username: from,
      socket: {},
      privateKeyArray: new Uint8Array(32),
    })
  )
}

async function recv(receiver, msg) {
  return asUser(receiver, () =>
    decryptIncomingMessage(
      msg,
      base64ToArrayBuffer(msg.nonce),
      receiver,
      msg.userId,
      new Uint8Array(32),
      {},
      null
    )
  )
}

describe('ratchet initiate/continue consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeUserId = null
    devices = new Map()
    privCounter = 10
  })

  it('initial send, continue-ratchet receive, and the next reply all break if root/chain halves are inverted', async () => {
    const first = await send('alice', 'bob', 'a0')
    expect(first.sendingNumber).toBe(0)

    expect((await recv('bob', first))?.text).toBe('a0')
    expect(new Uint8Array(device('bob').rootKey.get('alice'))[0]).toBe(0x19)
    expect(new Uint8Array(device('bob').sendingChainKey.get('alice'))[0]).toBe(0x1a)

    const reply = await send('bob', 'alice', 'b0')
    expect(reply.publicEphemeralKey).toBe(device('bob').eph.get('alice').ephPub)
    expect((await recv('alice', reply))?.text).toBe('b0')
    expect(new Uint8Array(device('alice').rootKey.get('bob'))[0]).toBe(0xd9)
    expect(new Uint8Array(device('alice').sendingChainKey.get('bob'))[0]).toBe(0xda)

    const next = await send('alice', 'bob', 'a1')
    expect(next.publicEphemeralKey).toBe(device('alice').eph.get('bob').ephPub)
    expect((await recv('bob', next))?.text).toBe('a1')

    expect(drMocks.initializeDoubleRatchet).toHaveBeenCalledTimes(1)
    expect(drMocks.initializeDoubleRatchetResponse).toHaveBeenCalledTimes(1)
  })
})
