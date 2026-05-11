import { Buffer } from 'node:buffer'
import { webcrypto, createCipheriv, createDecipheriv } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

if (!globalThis.crypto) globalThis.crypto = webcrypto
if (!globalThis.atob) globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary')
if (!globalThis.btoa) globalThis.btoa = (bin) => Buffer.from(bin, 'binary').toString('base64')

function encodeText(value) {
  return new TextEncoder().encode(value)
}

function deriveBytes(length, ...parts) {
  const out = new Uint8Array(length)
  const sources = parts.map((part) => (part instanceof Uint8Array ? part : new Uint8Array(part)))
  for (let i = 0; i < out.length; i++) {
    let value = i
    for (const source of sources) value = (value + (source[i % source.length] || 0)) & 0xff
    out[i] = value
  }
  return out
}

const _eldStore = new Map()

vi.mock('@mascaro101/echo-protocol', () => {
  const aesgcmEncryptSync = (plaintext, key, nonce, aad) => {
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce))
    cipher.setAAD(Buffer.from(aad))
    const enc = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()])
    const tag = cipher.getAuthTag()
    return new Uint8Array(Buffer.concat([enc, tag]))
  }

  const aesgcmDecryptSync = (ciphertext, key, nonce, aad) => {
    const buf = Buffer.from(ciphertext)
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce))
    decipher.setAAD(Buffer.from(aad))
    decipher.setAuthTag(buf.subarray(buf.length - 16))
    return new Uint8Array(
      Buffer.concat([decipher.update(buf.subarray(0, buf.length - 16)), decipher.final()])
    )
  }

  return {
    default: vi.fn(async () => {}),
    encrypt_aad_bytes: vi.fn((pt, key, nonce, aad) => aesgcmEncryptSync(pt, key, nonce, aad)),
    decrypt_aad_bytes: vi.fn((ct, key, nonce, aad) => aesgcmDecryptSync(ct, key, nonce, aad)),
    diffie_hellman: vi.fn((a, b) => new Uint8Array(32).map((_, i) => a[i] ^ b[i])),
    generate_private_ephemeral_key: vi.fn((rand) => new Uint8Array(rand).slice(0, 32)),
    generate_public_ephemeral_key: vi.fn((priv) => new Uint8Array(priv).slice(0, 32)),
    hkdf_derive: vi.fn((ikm, _salt, info, len) =>
      deriveBytes(len, new Uint8Array(ikm), new Uint8Array(info))
    ),
    hkdf_extract: vi.fn((salt, ikm) => deriveBytes(32, new Uint8Array(salt), new Uint8Array(ikm))),
    hkdf_expand: vi.fn((prk, info, len) =>
      deriveBytes(len, new Uint8Array(prk), new Uint8Array(info))
    ),
  }
})

vi.mock('../keySchedule.js', () => ({
  advanceEpoch: vi.fn(async ({ initSecret, commitSecret, groupId, epoch }) => {
    const joinerSecret = deriveBytes(32, initSecret, commitSecret, encodeText('joiner'))
    const epochSecret = deriveBytes(32, joinerSecret, encodeText(`${groupId}|${epoch}|epoch`))
    return {
      joinerSecret,
      epochSecret,
      applicationSecret: deriveBytes(32, epochSecret, encodeText('encryption')),
      senderDataSecret: deriveBytes(32, epochSecret, encodeText('sender_data')),
      externalSecret: deriveBytes(32, epochSecret, encodeText('external')),
      nextInitSecret: deriveBytes(32, epochSecret, encodeText('init')),
    }
  }),
  deriveEpochSecrets: vi.fn(async (joinerSecret, { groupId, epoch }) => {
    const epochSecret = deriveBytes(32, joinerSecret, encodeText(`${groupId}|${epoch}|epoch`))
    return {
      epochSecret,
      applicationSecret: deriveBytes(32, epochSecret, encodeText('encryption')),
      senderDataSecret: deriveBytes(32, epochSecret, encodeText('sender_data')),
      externalSecret: deriveBytes(32, epochSecret, encodeText('external')),
      nextInitSecret: deriveBytes(32, epochSecret, encodeText('init')),
    }
  }),
  deriveJoinerSecret: vi.fn(async (initSecret, commitSecret) =>
    deriveBytes(32, initSecret, commitSecret, encodeText('joiner'))
  ),
  deriveWelcomeSecret: vi.fn(async (joinerSecret) =>
    deriveBytes(32, joinerSecret, encodeText('welcome'))
  ),
  deriveWelcomeKeyAndNonce: vi.fn(async (welcomeSecret) => ({
    key: deriveBytes(32, welcomeSecret, encodeText('key')),
    nonce: deriveBytes(12, welcomeSecret, encodeText('nonce')),
  })),
  deriveSecret: vi.fn(async (secret, label) => deriveBytes(32, secret, encodeText(label))),
  expandWithLabel: vi.fn(async (secret, label, context, length) =>
    deriveBytes(length, secret, encodeText(label), context)
  ),
  deriveAppKeyAndNonce: vi.fn(async (applicationSecret, senderLeafIndex, generation) => ({
    key: deriveBytes(32, applicationSecret, encodeText(`key|${senderLeafIndex}|${generation}`)),
    nonce: deriveBytes(12, applicationSecret, encodeText(`nonce|${senderLeafIndex}|${generation}`)),
  })),
  computeConfirmationTag: vi.fn(async (epochSecret, transcriptHash) =>
    deriveBytes(32, epochSecret, transcriptHash, encodeText('confirm'))
  ),
  verifyConfirmationTag: vi.fn(async () => {}),
  deriveSenderDataKeyAndNonce: vi.fn(async (senderDataSecret, prefix) => ({
    key: deriveBytes(32, senderDataSecret, prefix, encodeText('sd-key')),
    nonce: deriveBytes(12, senderDataSecret, prefix, encodeText('sd-nonce')),
  })),
}))

vi.mock('../../../../../../utils/storage/EncryptedLocalDatabase', () => ({
  default: {
    isUnlocked: vi.fn(() => true),
    storeMlsGroupState: vi.fn(async (groupId, record) => {
      _eldStore.set(groupId, record)
    }),
    getMlsGroupState: vi.fn(async (groupId) => _eldStore.get(groupId) ?? null),
  },
}))

const { bytesToBase64 } = await import('../../helpers.js')
const { buildAddCommit, buildInitialWelcomes, createNewGroupState, processWelcome, applyCommit } =
  await import('../groupCryptoProvider.js')
const { generateKeyPackage } = await import('../groupCrypto/keyPackage.js')
const { buildUpdateCommit } = await import('../groupCrypto/groupCryptoProvider.js')

const CIPHER_SUITE = 'ECHO-MLS/X25519_AES256GCM_SHA256'
const makeInitKey = (fill) => bytesToBase64(new Uint8Array(32).fill(fill))

async function generateMemberMaterial(userId, fill) {
  const initKeyB64 = makeInitKey(fill)
  const { keyPackage, leafSigningPrivKeyB64 } = await generateKeyPackage({
    userId,
    initKeyB64,
    cipherSuite: CIPHER_SUITE,
  })
  return { initKeyB64, keyPackage, leafSigningPrivKeyB64 }
}

async function initialPair(groupId) {
  const aliceInitKeyB64 = makeInitKey(0x01)
  const bob = await generateMemberMaterial('bob', 0x02)

  const creatorState = await createNewGroupState({
    groupId,
    creatorUserId: 'alice',
    roster: [
      { userId: 'alice', username: 'Alice', leafIndex: 0 },
      { userId: 'bob', username: 'Bob', leafIndex: 1 },
    ],
    memberInitKeys: [
      { userId: 'alice', leafIndex: 0, initKeyB64: aliceInitKeyB64 },
      { userId: 'bob', leafIndex: 1, initKeyB64: bob.initKeyB64, keyPackage: bob.keyPackage },
    ],
    selfInitPrivKeyB64: aliceInitKeyB64,
  })

  const welcomes = await buildInitialWelcomes({
    creatorState,
    roster: [
      { userId: 'alice', username: 'Alice', leafIndex: 0 },
      { userId: 'bob', username: 'Bob', leafIndex: 1 },
    ],
    memberInitKeys: [
      { userId: 'bob', leafIndex: 1, initKeyB64: bob.initKeyB64, keyPackage: bob.keyPackage },
    ],
  })

  const bobWelcome = welcomes.find((welcome) => welcome.recipientUserId === 'bob')
  const bobState = await processWelcome({
    welcome: bobWelcome,
    selfUserId: 'bob',
    myInitPrivKeyB64: bob.initKeyB64,
    myKeyPackage: bob.keyPackage,
    myLeafSigningPrivKeyB64: bob.leafSigningPrivKeyB64,
  })

  return { creatorState, bob, bobState }
}

beforeEach(() => {
  vi.clearAllMocks()
  _eldStore.clear()
})

describe('group crypto KeyPackage bindings', () => {
  it('processWelcome installs the recipient identity from the provided KeyPackage', async () => {
    const { creatorState, bob, bobState } = await initialPair('kp-welcome-1')

    const creatorBob = creatorState.roster.find((member) => member.userId === 'bob')
    const localBob = bobState.roster.find((member) => member.userId === 'bob')

    expect(creatorBob?.leafSigningPubKeyB64).toBe(bob.keyPackage.leafSigningPubKeyB64)
    expect(creatorBob?.credential?.signature).toBe(bob.keyPackage.credential.signature)
    expect(localBob?.leafSigningPubKeyB64).toBe(bob.keyPackage.leafSigningPubKeyB64)
    expect(localBob?.credential?.signature).toBe(bob.keyPackage.credential.signature)
    expect(bobState.leafSigningPrivKeyB64).toBe(bob.leafSigningPrivKeyB64)
  })

  it('buildAddCommit and processWelcome preserve the added member KeyPackage identity', async () => {
    const { creatorState, bob, bobState } = await initialPair('kp-add-1')
    const carol = await generateMemberMaterial('carol', 0x03)

    const { commit, welcome } = await buildAddCommit({
      state: creatorState,
      newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: makeInitKey(0x01) },
        { userId: 'bob', leafIndex: 1, initKeyB64: bob.initKeyB64, keyPackage: bob.keyPackage },
        {
          userId: 'carol',
          leafIndex: 2,
          initKeyB64: carol.initKeyB64,
          keyPackage: carol.keyPackage,
        },
      ],
    })

    expect(commit.leafDataPatch['2'].leafSigningPubKeyB64).toBe(
      carol.keyPackage.leafSigningPubKeyB64
    )
    expect(commit.leafDataPatch['2'].credential.signature).toBe(
      carol.keyPackage.credential.signature
    )

    const bobNext = await applyCommit({
      state: bobState,
      commit,
      myInitPrivKeyB64: bob.initKeyB64,
    })
    const carolState = await processWelcome({
      welcome,
      selfUserId: 'carol',
      myInitPrivKeyB64: carol.initKeyB64,
      myKeyPackage: carol.keyPackage,
      myLeafSigningPrivKeyB64: carol.leafSigningPrivKeyB64,
    })

    const bobCarol = bobNext.roster.find((member) => member.userId === 'carol')
    const carolCarol = carolState.roster.find((member) => member.userId === 'carol')

    expect(bobCarol?.leafSigningPubKeyB64).toBe(carol.keyPackage.leafSigningPubKeyB64)
    expect(bobCarol?.credential?.signature).toBe(carol.keyPackage.credential.signature)
    expect(carolCarol?.leafSigningPubKeyB64).toBe(carol.keyPackage.leafSigningPubKeyB64)
    expect(carolCarol?.credential?.signature).toBe(carol.keyPackage.credential.signature)
    expect(carolState.leafSigningPrivKeyB64).toBe(carol.leafSigningPrivKeyB64)
  })

  it('processWelcome rejects a KeyPackage that does not belong to the welcome recipient', async () => {
    const { creatorState, bob } = await initialPair('kp-welcome-mismatch')
    const carol = await generateMemberMaterial('carol', 0x03)

    const { welcome } = await buildAddCommit({
      state: creatorState,
      newMember: { userId: 'carol', username: 'Carol', leafIndex: 2 },
      memberInitKeys: [
        { userId: 'alice', leafIndex: 0, initKeyB64: makeInitKey(0x01) },
        { userId: 'bob', leafIndex: 1, initKeyB64: bob.initKeyB64, keyPackage: bob.keyPackage },
        {
          userId: 'carol',
          leafIndex: 2,
          initKeyB64: carol.initKeyB64,
          keyPackage: carol.keyPackage,
        },
      ],
    })

    await expect(
      processWelcome({
        welcome,
        selfUserId: 'carol',
        myInitPrivKeyB64: carol.initKeyB64,
        myKeyPackage: bob.keyPackage,
        myLeafSigningPrivKeyB64: bob.leafSigningPrivKeyB64,
      })
    ).rejects.toThrow('KeyPackage userId mismatch')
  })

  it('buildUpdateCommit propagates the new KeyPackage identity to receivers', async () => {
    const { creatorState, bob, bobState } = await initialPair('kp-update-1')
    const aliceNextMaterial = await generateMemberMaterial('alice', 0x11)

    const { commit, nextState } = await buildUpdateCommit({
      state: creatorState,
      newInitKeyB64: aliceNextMaterial.initKeyB64,
      newInitPrivKeyB64: aliceNextMaterial.initKeyB64,
      newLeafSigningPrivKeyB64: aliceNextMaterial.leafSigningPrivKeyB64,
      newLeafSigningPubKeyB64: aliceNextMaterial.keyPackage.leafSigningPubKeyB64,
      memberInitKeys: [
        {
          userId: 'alice',
          leafIndex: 0,
          initKeyB64: aliceNextMaterial.initKeyB64,
          keyPackage: aliceNextMaterial.keyPackage,
        },
      ],
    })

    const bobNext = await applyCommit({
      state: bobState,
      commit,
      myInitPrivKeyB64: bob.initKeyB64,
    })

    expect(commit.leafDataPatch['0'].leafSigningPubKeyB64).toBe(
      aliceNextMaterial.keyPackage.leafSigningPubKeyB64
    )
    expect(commit.leafDataPatch['0'].credential.signature).toBe(
      aliceNextMaterial.keyPackage.credential.signature
    )
    expect(
      nextState.roster.find((member) => member.userId === 'alice')?.credential?.signature
    ).toBe(aliceNextMaterial.keyPackage.credential.signature)
    expect(bobNext.roster.find((member) => member.userId === 'alice')?.credential?.signature).toBe(
      aliceNextMaterial.keyPackage.credential.signature
    )
  })
})
