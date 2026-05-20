import { base64ToArrayBuffer } from '../helpers'

import {
  fetchPublicIdentityKeyX25519,
  fetchPublicIdentityKeyEd25519,
  fetchPreKeyBundle,
} from '../api'

import init, { verify_signature, diffie_hellman, hkdf_derive } from '@mascaro101/echo-protocol'

import { getIdentityKeys, getOPKPrivateKey, getPeerIdentityKeys } from '../chat/keyManagement'

const HKDF_SALT = new Uint8Array()
const INFO_SK = new TextEncoder().encode('EchoProtocol/v1/X3DH_SK')
const INFO_RK = new TextEncoder().encode('EchoProtocol/v1/KDF_RK')

const peerIdentityChangedError = (peerId, savedPeer, fetchedPeer) => {
  const err = new Error('Peer identity changed')
  err.code = 'PEER_IDENTITY_CHANGED'
  err.peerId = String(peerId ?? '')
  err.savedPeer = savedPeer ?? null
  err.fetchedPeer = fetchedPeer ?? null
  return err
}

// Per-device bundles from deviceService.getDeviceBundles use slightly different
// field names than the legacy user-level fetchPreKeyBundle. Normalize so the
// rest of the X3DH path doesn't have to care.
function normalizeBundleShape(b) {
  if (!b) return b
  return {
    publicIdentityKeyX25519: b.publicIdentityKeyX25519,
    publicIdentityKeyEd25519: b.publicIdentityKeyEd25519,
    signedPreKey: b.signedPreKey,
    signature: b.signature ?? b.signedPreKeySignature ?? null,
    spkId: b.spkId ?? b.signedPreKeyId ?? null,
    opk: b.opk ?? null,
  }
}

const initializeDoubleRatchet = async (
  socket,
  targetUserId,
  ephemeralKey_private,
  publicEphemeralKey,
  privateKeyArray,
  options = {}
) => {
  await init()

  // `peerIdentityScope` overrides the storage key for getPeerIdentityKeys so a
  // per-device session pins identity per (peerUserId, peerDeviceId) rather than
  // per peerUserId. `precomputedBundle` lets the caller pass a device-scoped
  // bundle (from deviceService.getDeviceBundles) and skip the user-level fetch.
  const { precomputedBundle = null, peerIdentityScope = null } = options
  const identityScope = peerIdentityScope ?? targetUserId

  const bundle = precomputedBundle
    ? normalizeBundleShape(precomputedBundle)
    : await fetchPreKeyBundle(socket, targetUserId)

  const savedPeer = await getPeerIdentityKeys(identityScope)

  if (savedPeer) {
    const x = savedPeer.publicIdentityKeyX25519
    const ed = savedPeer.publicIdentityKeyEd25519 ?? null
    const fetchedEd = bundle.publicIdentityKeyEd25519 ?? null

    if (x !== bundle.publicIdentityKeyX25519 || (ed && fetchedEd && ed !== fetchedEd)) {
      throw peerIdentityChangedError(identityScope, savedPeer, {
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
  const root_key = hkdf_derive(IKM, HKDF_SALT, INFO_SK, 32)

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
  const newRootKey = hkdf_expand.slice(0, 32)
  const receivingChainKey = hkdf_expand.slice(32)

  return { receivingChainKey, newRootKey }
}

const initializeDoubleRatchetResponse = async (
  socket,
  message,
  targetUserId,
  privateKeyArray,
  options = {}
) => {
  await init()
  // `senderDevicePub` lets the caller (per-device receive path) skip the
  // user-level identity fetch and use the sender's device-specific IK pub
  // directly. `peerIdentityScope` controls the storage key for pinning.
  const { senderDevicePub = null, peerIdentityScope = null } = options
  const identityScope = peerIdentityScope ?? targetUserId

  const identityKeysResponse = await getIdentityKeys()
  const storedPrivatePreKey = identityKeysResponse?.privatePreKey
  if (!storedPrivatePreKey) {
    throw new Error('Private PreKey not found in encrypted storage')
  }
  const privatePreKey = base64ToArrayBuffer(storedPrivatePreKey)

  if (peerIdentityScope && peerIdentityScope !== targetUserId && !senderDevicePub) {
    throw new Error(`Sender device identity not found for per-device session ${peerIdentityScope}`)
  }

  const encTargetPublicIdentityKeyX25519 =
    senderDevicePub?.publicIdentityKeyX25519 ??
    (await fetchPublicIdentityKeyX25519(socket, targetUserId))
  const encTargetPublicIdentityKeyEd25519 =
    senderDevicePub?.publicIdentityKeyEd25519 ??
    (await fetchPublicIdentityKeyEd25519(socket, targetUserId).catch(() => null))

  const savedPeer = await getPeerIdentityKeys(identityScope)
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
      throw peerIdentityChangedError(identityScope, savedPeer, {
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
  const root_key = hkdf_derive(IKM, HKDF_SALT, INFO_SK, 32)
  return { root_key, peerIdentityToPin }
}

export { initializeDoubleRatchet, continueDoubleRatchetChain, initializeDoubleRatchetResponse }
