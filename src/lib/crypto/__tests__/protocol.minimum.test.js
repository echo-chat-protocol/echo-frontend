import { describe, it, expect, beforeEach, vi } from 'vitest'
import { webcrypto } from 'node:crypto'

import { arrayBufferToBase64, base64ToArrayBuffer } from '@features/chat/utils/helpers'

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto
}

let activeUserId = null

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
    rootKey: new Map(), // targetUserId -> Uint8Array(32)
    sendingChainKey: new Map(), // targetUserId -> Uint8Array(32)
    receivingChainKey: new Map(), // targetUserId -> Uint8Array(32)
    eph: new Map(), // targetUserId -> object
    ns: new Map(), // targetUserId -> number
    nr: new Map(), // targetUserId -> number
    pn: new Map(), // targetUserId -> number
    skipped: new Map(), // targetUserId -> object
  }
}

let devices = new Map()
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
    const expectedByte = parsed?.b
    const actualByte = new Uint8Array(key)[0]
    if (expectedByte !== actualByte) {
      throw new Error(`wrong key: got ${actualByte}, expected ${expectedByte}`)
    }
    return parsed.p
  })
)

// deterministic “chain KDF”: mk = byte b, nextCk = b+1
const chainKdfMock = vi.hoisted(() =>
  vi.fn((ck) => {
    const b = new Uint8Array(ck)[0]
    const mk = new Uint8Array(32).fill(b)
    const next = new Uint8Array(32).fill((b + 1) & 0xff)
    return new Uint8Array([...mk, ...next])
  })
)

let privCounter = 10

const dhWasm = vi.hoisted(() => ({
  init: vi.fn(async () => {}),
  generate_private_ephemeral_key: vi.fn(async () => new Uint8Array(32).fill(privCounter++ & 0xff)),
  generate_public_ephemeral_key: vi.fn(async (priv) =>
    new Uint8Array(32).fill((new Uint8Array(priv)[0] + 1) & 0xff)
  ),
  diffie_hellman: vi.fn(async (priv, pub) => {
    const a = new Uint8Array(priv)[0]
    const bPriv = (new Uint8Array(pub)[0] - 1) & 0xff // invert our "pub = priv+1" test mapping
    return new Uint8Array(32).fill((a * bPriv) & 0xff)
  }),
  hkdf_derive: vi.fn((ikm, salt, info, len) => {
    const i0 = new Uint8Array(ikm)[0]
    const s0 = salt && salt.length ? new Uint8Array(salt)[0] : 0
    const info0 = info && info.length ? new Uint8Array(info)[0] : 0
    const base = (i0 ^ s0 ^ info0) & 0xff
    const out = new Uint8Array(len)
    out.fill((base + 1) & 0xff, 0, Math.min(32, len))
    if (len > 32) out.fill((base + 2) & 0xff, 32)
    return out
  }),
}))

const INFO_RK = new TextEncoder().encode('EchoProtocol/v1/KDF_RK')

const dr = vi.hoisted(() => ({
  initializeDoubleRatchet: vi.fn(async () => new Uint8Array(32).fill(1)),
  initializeDoubleRatchetResponse: vi.fn(async () => new Uint8Array(32).fill(1)),
  continueDoubleRatchetChain: vi.fn(async (_socket, _targetUserId, pubBase64, priv, rootKey) => {
    const pub = base64ToArrayBuffer(pubBase64)
    const dhOut = await dhWasm.diffie_hellman(priv, pub)
    const okm = dhWasm.hkdf_derive(dhOut, rootKey, INFO_RK, 64)
    return { newRootKey: okm.slice(0, 32), receivingChainKey: okm.slice(32) }
  }),
}))

const km = vi.hoisted(() => ({
  getSessionKey: vi.fn(),
  setSessionKey: vi.fn(),

  getRootKey: vi.fn(
    async (_userId, targetUserId) => device(activeUserId).rootKey.get(targetUserId) ?? null
  ),
  setRootKey: vi.fn(async (_userId, targetUserId, rootKey) => {
    device(activeUserId).rootKey.set(
      targetUserId,
      rootKey instanceof Uint8Array ? rootKey : new Uint8Array(rootKey)
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

  getCurrentSendingNumber: vi.fn(
    async (targetUserId) => device(activeUserId).ns.get(targetUserId) ?? 0
  ),
  setCurrentSendingNumber: vi.fn(async (targetUserId, n) => {
    device(activeUserId).ns.set(targetUserId, n)
  }),

  getCurrentReceivingNumber: vi.fn(
    async (targetUserId) => device(activeUserId).nr.get(targetUserId) ?? 0
  ),
  setCurrentReceivingNumber: vi.fn(async (targetUserId, n) => {
    device(activeUserId).nr.set(targetUserId, n)
  }),

  getPreviousSendingNumber: vi.fn(
    async (targetUserId) => device(activeUserId).pn.get(targetUserId) ?? 0
  ),
  setPreviousSendingNumber: vi.fn(async (targetUserId, n) => {
    device(activeUserId).pn.set(targetUserId, n)
  }),

  getSkippedMessages: vi.fn(
    async (targetUserId) => device(activeUserId).skipped.get(targetUserId) ?? {}
  ),
  setSkippedMessages: vi.fn(async (targetUserId, skipped) => {
    device(activeUserId).skipped.set(targetUserId, skipped)
  }),

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
  encrypt: (...args) => encryptMock(...args),
  decrypt: (...args) => decryptMock(...args),
  buildAadBytes: () => new Uint8Array([1]),
  encryptWithAad: (...args) => encryptMock(...args),
  decryptWithAad: (...args) => decryptMock(...args),
}))

vi.mock('../../crypto/hkdf', () => ({
  chain_key_KDF: (ck) => chainKdfMock(ck),
  deriveChainKeys: () => ({
    sendingChainKey: new Uint8Array(32).fill(1),
    receivingChainKey: new Uint8Array(32).fill(1),
  }),
}))

vi.mock('../../crypto/dr', () => dr)
vi.mock('../../chat/keyManagement', () => km)

import { encryptOutgoingMessage } from '@features/chat/utils/chat/messageEncryption'
import { decryptIncomingMessage } from '@features/chat/utils/chat/messageDecryption'

function seedConversation({ a, b, ckABByte = 5, ckBAByte = 9 }) {
  const A_dh_priv = new Uint8Array(32).fill(0xa0)
  const B_dh_priv = new Uint8Array(32).fill(0xb0)
  const A_dh_pub = new Uint8Array(32).fill(0xa1) // priv+1
  const B_dh_pub = new Uint8Array(32).fill(0xb1) // priv+1

  const A_dh_pub_b64 = arrayBufferToBase64(A_dh_pub)
  const B_dh_pub_b64 = arrayBufferToBase64(B_dh_pub)

  // Root keys (per-device)
  device(a).rootKey.set(b, new Uint8Array(32).fill(1))
  device(b).rootKey.set(a, new Uint8Array(32).fill(1))

  // Chain keys: A->B
  device(a).sendingChainKey.set(b, new Uint8Array(32).fill(ckABByte))
  device(b).receivingChainKey.set(a, new Uint8Array(32).fill(ckABByte))

  // Chain keys: B->A
  device(b).sendingChainKey.set(a, new Uint8Array(32).fill(ckBAByte))
  device(a).receivingChainKey.set(b, new Uint8Array(32).fill(ckBAByte))

  // Ephemeral + peer DH tracking
  device(a).eph.set(b, {
    ephPriv: arrayBufferToBase64(A_dh_priv),
    ephPub: A_dh_pub_b64,
    currentTargetPublicEphemeralKey: B_dh_pub_b64,
    knownTargetPublicEphemeralKeys: { [B_dh_pub_b64]: true },
    lastSendingKdfDh: B_dh_pub_b64, // prevent send-side DH ratchet in "no DH change" tests
  })

  device(b).eph.set(a, {
    ephPriv: arrayBufferToBase64(B_dh_priv),
    ephPub: B_dh_pub_b64,
    currentTargetPublicEphemeralKey: A_dh_pub_b64,
    knownTargetPublicEphemeralKeys: { [A_dh_pub_b64]: true },
    lastSendingKdfDh: A_dh_pub_b64,
  })

  return { A_dh_pub_b64, B_dh_pub_b64 }
}

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

describe('protocol minimum (transcript) tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    privCounter = 10
    devices = new Map()
    activeUserId = null
  })

  it('1) in-order A->B x3 advances chains and Nr', async () => {
    seedConversation({ a: 'alice', b: 'bob' })

    const m0 = await send('alice', 'bob', 'a0')
    const m1 = await send('alice', 'bob', 'a1')
    const m2 = await send('alice', 'bob', 'a2')

    expect((await recv('bob', m0))?.text).toBe('a0')
    expect((await recv('bob', m1))?.text).toBe('a1')
    expect((await recv('bob', m2))?.text).toBe('a2')

    expect(device('bob').nr.get('alice')).toBe(3)
    expect(new Uint8Array(device('bob').receivingChainKey.get('alice'))[0]).toBe(8)
    expect(new Uint8Array(device('alice').sendingChainKey.get('bob'))[0]).toBe(8)
  })

  it('2) interleaved A->B x2 then B->A x2 works', async () => {
    seedConversation({ a: 'alice', b: 'bob' })

    const a0 = await send('alice', 'bob', 'a0')
    const a1 = await send('alice', 'bob', 'a1')
    expect((await recv('bob', a0))?.text).toBe('a0')
    expect((await recv('bob', a1))?.text).toBe('a1')
    expect(device('bob').nr.get('alice')).toBe(2)

    const b0 = await send('bob', 'alice', 'b0')
    const b1 = await send('bob', 'alice', 'b1')
    expect((await recv('alice', b0))?.text).toBe('b0')
    expect((await recv('alice', b1))?.text).toBe('b1')
    expect(device('alice').nr.get('bob')).toBe(2)
  })

  it('3) out-of-order receive caches skipped keys and consumes them', async () => {
    seedConversation({ a: 'alice', b: 'bob' })

    const m0 = await send('alice', 'bob', 'a0')
    const m1 = await send('alice', 'bob', 'a1')
    const m2 = await send('alice', 'bob', 'a2')

    // deliver n=2 first
    expect((await recv('bob', m2))?.text).toBe('a2')
    expect(device('bob').nr.get('alice')).toBe(3)

    // should have skipped keys for 0 and 1 under dh
    const dh = m2.publicEphemeralKey
    const skippedNow = device('bob').skipped.get('alice')
    expect(skippedNow?.[dh]?.['0']).toBeTruthy()
    expect(skippedNow?.[dh]?.['1']).toBeTruthy()

    // late arrivals use cached keys and empty the bucket
    expect((await recv('bob', m0))?.text).toBe('a0')
    expect((await recv('bob', m1))?.text).toBe('a1')
    const skippedAfter = device('bob').skipped.get('alice') || {}
    expect(skippedAfter[dh]).toBeUndefined()
    expect(device('bob').nr.get('alice')).toBe(3)
  })

  it('4) DH ratchet transcript: receiving new DH triggers ratchet; next send uses new DH', async () => {
    const { A_dh_pub_b64 } = seedConversation({ a: 'alice', b: 'bob' })

    // Simulate Bob sending with a NEW DH pub (different from Alice's current DHr) and a matching sending chain key.
    const bobNewPriv = new Uint8Array(32).fill(0xb2)
    const bobNewPub = new Uint8Array(32).fill(0xb3) // priv+1
    const bobNewPubB64 = arrayBufferToBase64(bobNewPub)

    // Update Bob's DHs used in outgoing headers
    device('bob').eph.set('alice', {
      ...device('bob').eph.get('alice'),
      ephPriv: arrayBufferToBase64(bobNewPriv),
      ephPub: bobNewPubB64,
      // keep DHr pointing at Alice's current DHs from seedConversation
      currentTargetPublicEphemeralKey: A_dh_pub_b64,
      knownTargetPublicEphemeralKeys: { [A_dh_pub_b64]: true },
    })

    // Compute the expected chain key seed that Alice will derive on DH-ratchet receive:
    // okm = HKDF( DH(A_priv, B_new_priv), salt=rootKey(=1), info=INFO_RK )
    const alicePriv = base64ToArrayBuffer(device('alice').eph.get('bob').ephPriv)
    const aliceRootKey = device('alice').rootKey.get('bob')
    const dhOut = await dhWasm.diffie_hellman(alicePriv, bobNewPub)
    const okm = dhWasm.hkdf_derive(dhOut, aliceRootKey, INFO_RK, 64)
    const bobSendingSeed = okm.slice(32)

    // Force Bob's sending chain to match that derived seed so payload decrypts correctly on Alice.
    device('bob').sendingChainKey.set('alice', bobSendingSeed)

    // Bob -> Alice (DH change) should ratchet on Alice receive
    const b0 = await send('bob', 'alice', 'b0')
    expect(b0.publicEphemeralKey).toBe(bobNewPubB64)
    expect((await recv('alice', b0))?.text).toBe('b0')

    const aliceAfter = device('alice').eph.get('bob')
    expect(aliceAfter.currentTargetPublicEphemeralKey).toBe(b0.publicEphemeralKey)
    expect(aliceAfter.ephPub).not.toBe(A_dh_pub_b64)

    // Alice -> Bob should now use Alice's freshly generated DHs in the header
    const a0 = await send('alice', 'bob', 'a0')
    expect(a0.publicEphemeralKey).toBe(aliceAfter.ephPub)
  })

  it('5) tampered ciphertext does not advance Nr/chain', async () => {
    seedConversation({ a: 'alice', b: 'bob' })

    const msg = await send('alice', 'bob', 'a0')

    // Keep payload JSON-parseable but ensure decryption fails (wrong key / tamper).
    const parsed = JSON.parse(msg.payload)
    parsed.b = (parsed.b + 1) & 0xff
    const tampered = { ...msg, payload: JSON.stringify(parsed) }

    await expect(recv('bob', tampered)).rejects.toThrow()

    // should not commit state updates on failed decrypt
    expect(device('bob').nr.get('alice') ?? 0).toBe(0)
    expect(new Uint8Array(device('bob').receivingChainKey.get('alice'))[0]).toBe(5)
  })
})
