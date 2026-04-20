import { base64ToArrayBuffer } from '../helpers'

import {
  fetchPublicIdentityKeyX25519,
  fetchPublicIdentityKeyEd25519,
  fetchPreKeyBundle,
} from '../api'

import init, { verify_signature, diffie_hellman, hkdf_derive } from '@mascaro101/echo-protocol'

import { getIdentityKeys, getOPKPrivateKey, getPeerIdentityKeys } from '../chat/keyManagement'

const HKDF_SALT = new Uint8Array()
const INFO_RK = new TextEncoder().encode('EchoProtocol/v1/KDF_RK')

const peerIdentityChangedError = (peerId, savedPeer, fetchedPeer) => {
  const err = new Error('Peer identity changed')
  err.code = 'PEER_IDENTITY_CHANGED'
  err.peerId = String(peerId ?? '')
  err.savedPeer = savedPeer ?? null
  err.fetchedPeer = fetchedPeer ?? null
  return err
}

const initializeDoubleRatchet = async (
  socket,
  targetUserId,
  ephemeralKey_private,
  publicEphemeralKey,
  privateKeyArray
) => {
  await init()

  const bundle = await fetchPreKeyBundle(socket, targetUserId)

  const savedPeer = await getPeerIdentityKeys(targetUserId)

  if (savedPeer) {
    const x = savedPeer.publicIdentityKeyX25519
    const ed = savedPeer.publicIdentityKeyEd25519 ?? null
    const fetchedEd = bundle.publicIdentityKeyEd25519 ?? null

    if (x !== bundle.publicIdentityKeyX25519 || (ed && fetchedEd && ed !== fetchedEd)) {
      throw peerIdentityChangedError(targetUserId, savedPeer, {
        publicIdentityKeyX25519: bundle.publicIdentityKeyX25519,
        ...(bundle.publicIdentityKeyEd25519
          ? { publicIdentityKeyEd25519: bundle.publicIdentityKeyEd25519 }
          : {}),
      })
    }
  }

  const peerIdentityToPin = savedPeer
    ? null
    : {
        publicIdentityKeyX25519: bundle.publicIdentityKeyX25519,
        ...(bundle.publicIdentityKeyEd25519
          ? { publicIdentityKeyEd25519: bundle.publicIdentityKeyEd25519 }
          : {}),
      }

  const targetPublicIdentityKeyX25519 = base64ToArrayBuffer(bundle.publicIdentityKeyX25519)
  const targetPublicIdentityKeyEd25519 = base64ToArrayBuffer(bundle.publicIdentityKeyEd25519)
  const targetSignedPreKey = base64ToArrayBuffer(bundle.signedPreKey)
  const targetSignature = base64ToArrayBuffer(bundle.signature)
  const spkId = bundle.spkId ?? null

  await init()
  const isValidSignature = await verify_signature(
    targetSignature,
    targetSignedPreKey,
    targetPublicIdentityKeyEd25519
  )

  if (!isValidSignature) {
    throw new Error('Invalid SPK signature detected')
  }

  const dh1 = await diffie_hellman(privateKeyArray, targetSignedPreKey)
  const dh2 = await diffie_hellman(ephemeralKey_private, targetPublicIdentityKeyX25519)
  const dh3 = await diffie_hellman(ephemeralKey_private, targetSignedPreKey)

  let opkId = null
  let dh4 = null
  if (bundle.opk && bundle.opk.opkId && bundle.opk.opkPub) {
    opkId = String(bundle.opk.opkId)
    const opkPub = base64ToArrayBuffer(bundle.opk.opkPub)
    dh4 = await diffie_hellman(ephemeralKey_private, opkPub)
  }

  const parts = dh4 ? [dh1, dh2, dh3, dh4] : [dh1, dh2, dh3]
  const totalLen = parts.reduce((sum, p) => sum + p.length, 0)
  const IKM = new Uint8Array(totalLen)
  let offset = 0
  for (const p of parts) {
    IKM.set(p, offset)
    offset += p.length
  }
  const root_key = hkdf_derive(IKM, HKDF_SALT, INFO_RK, 32)

  return { root_key, spkId, opkId, peerIdentityToPin }
}

const continueDoubleRatchetChain = async (
  socket,
  targetUserId,
  previousTargetPublicEphemeralKeyBase64,
  privateEphemeralKey,
  root_key
) => {
  let previousTargetPublicEphemeralKey
  if (previousTargetPublicEphemeralKeyBase64 instanceof Uint8Array) {
    previousTargetPublicEphemeralKey = previousTargetPublicEphemeralKeyBase64
  } else {
    previousTargetPublicEphemeralKey = base64ToArrayBuffer(previousTargetPublicEphemeralKeyBase64)
  }

  await init()
  const DH4 = await diffie_hellman(privateEphemeralKey, previousTargetPublicEphemeralKey)

  const hkdf_expand = hkdf_derive(DH4, root_key, INFO_RK, 64)
  const receivingChainKey = hkdf_expand.slice(0, 32)
  const newRootKey = hkdf_expand.slice(32)

  return { receivingChainKey, newRootKey }
}

const initializeDoubleRatchetResponse = async (socket, message, targetUserId, privateKeyArray) => {
  await init()
  const identityKeysResponse = await getIdentityKeys()
  const storedPrivatePreKey = identityKeysResponse?.privatePreKey
  if (!storedPrivatePreKey) {
    throw new Error('Private PreKey not found in encrypted storage')
  }
  const privatePreKey = base64ToArrayBuffer(storedPrivatePreKey)

  const encTargetPublicIdentityKeyX25519 = await fetchPublicIdentityKeyX25519(socket, targetUserId)
  const encTargetPublicIdentityKeyEd25519 = await fetchPublicIdentityKeyEd25519(
    socket,
    targetUserId
  ).catch(() => null)

  const savedPeer = await getPeerIdentityKeys(targetUserId)
  const peerIdentityToPin = savedPeer
    ? null
    : {
        publicIdentityKeyX25519: encTargetPublicIdentityKeyX25519,
        ...(encTargetPublicIdentityKeyEd25519
          ? { publicIdentityKeyEd25519: encTargetPublicIdentityKeyEd25519 }
          : {}),
      }

  if (savedPeer) {
    const x = savedPeer.publicIdentityKeyX25519
    const ed = savedPeer.publicIdentityKeyEd25519 ?? null

    if (
      x !== encTargetPublicIdentityKeyX25519 ||
      (ed && encTargetPublicIdentityKeyEd25519 && ed !== encTargetPublicIdentityKeyEd25519)
    ) {
      throw peerIdentityChangedError(targetUserId, savedPeer, {
        publicIdentityKeyX25519: encTargetPublicIdentityKeyX25519,
        ...(encTargetPublicIdentityKeyEd25519
          ? { publicIdentityKeyEd25519: encTargetPublicIdentityKeyEd25519 }
          : {}),
      })
    }
  }

  const targetPublicIdentityKey = base64ToArrayBuffer(encTargetPublicIdentityKeyX25519)

  const targetPublicEphemeralKey = base64ToArrayBuffer(message.publicEphemeralKey)

  const dh1 = await diffie_hellman(privatePreKey, targetPublicIdentityKey)
  const dh2 = await diffie_hellman(privateKeyArray, targetPublicEphemeralKey)
  const dh3 = await diffie_hellman(privatePreKey, targetPublicEphemeralKey)

  let dh4 = null
  const opkId = message?.opkId ?? null
  if (opkId) {
    const opkPriv = await getOPKPrivateKey(opkId)
    if (!opkPriv) {
      throw new Error(`OPK private key not found for opkId=${opkId}`)
    }
    dh4 = await diffie_hellman(opkPriv, targetPublicEphemeralKey)
  }

  const parts = dh4 ? [dh1, dh2, dh3, dh4] : [dh1, dh2, dh3]
  const totalLen = parts.reduce((sum, p) => sum + p.length, 0)
  const IKM = new Uint8Array(totalLen)
  let offset = 0
  for (const p of parts) {
    IKM.set(p, offset)
    offset += p.length
  }
  const root_key = hkdf_derive(IKM, HKDF_SALT, INFO_RK, 32)
  return { root_key, peerIdentityToPin }
}

export { initializeDoubleRatchet, continueDoubleRatchetChain, initializeDoubleRatchetResponse }
