import { arrayBufferToBase64 } from '../helpers'
import init_dh, {
  generate_private_ephemeral_key,
  generate_public_ephemeral_key,
} from '@mascaro101/echo-protocol'

import { buildAadBytes, encryptWithAad } from '../crypto/aes'
import { initializeDoubleRatchet } from '../crypto/dr'
import { chain_key_KDF, deriveChainKeys } from '../crypto/hkdf'
import {
  getRootKey,
  setRootKey,
  getSendingChainKey,
  setSendingChainKey,
  getOwnEphemeralKeys,
  setOwnEphemeralKeys,
  getCurrentSendingNumber,
  setCurrentSendingNumber,
  getPreviousSendingNumber,
} from './keyManagement'

const ensureSocketConnected = async (socket, timeoutMs = 15_000) => {
  // Unit tests pass a dummy `{}` socket; skip connection waiting in that case.
  if (!socket) return
  if (socket.connected) return
  if (typeof socket.on !== 'function' || typeof socket.connect !== 'function') return

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      cleanup()
      reject(new Error(`Socket did not connect within ${timeoutMs}ms`))
    }, timeoutMs)

    const cleanup = () => {
      clearTimeout(t)
      socket.off?.('connect', onConnect)
    }

    const onConnect = () => {
      cleanup()
      resolve()
    }

    socket.on('connect', onConnect)
    if (typeof socket.connect === 'function') socket.connect()
  })
}

export const encryptOutgoingMessage = async ({
  text,
  imageData = null,
  userId,
  targetUserId,
  username,
  socket,
  privateKeyArray,
  // Per-device fan-out: `sessionTargetId` is the keyManagement storage key for
  // this DR session (compound `peerUserId@peerDeviceId` for per-device, plain
  // `peerUserId` for the legacy single-target path). `peerUserId` is the real
  // user id used for X3DH identity pinning. `precomputedBundle` lets callers
  // pass a device-scoped bundle and skip the user-level fetch.
  sessionTargetId = null,
  peerUserId = null,
  precomputedBundle = null,
  // Optional compact reply context, embedded in the encrypted payload so the
  // quoted message stays end-to-end encrypted.
  replyTo = null,
}) => {
  if (!userId || !targetUserId) {
    throw new Error('encryptOutgoingMessage requires userId and targetUserId')
  }
  await ensureSocketConnected(socket)

  const sessionId = sessionTargetId ?? targetUserId
  const realPeerUserId = peerUserId ?? targetUserId

  let root_key = await getRootKey(userId, sessionId)

  // If no existing root key, initialize a new session
  if (!root_key) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32))

    await init_dh()
    const privateEphemeralKey = await generate_private_ephemeral_key(randomBytes)
    const publicEphemeralKey = await generate_public_ephemeral_key(privateEphemeralKey)

    const initResult = await initializeDoubleRatchet(
      socket,
      realPeerUserId,
      privateEphemeralKey,
      publicEphemeralKey,
      privateKeyArray,
      { precomputedBundle, peerIdentityScope: sessionId }
    )

    root_key = initResult.root_key
    const spkId = initResult.spkId ?? null
    const opkId = initResult.opkId ?? null
    const peerIdentityToPin = initResult.peerIdentityToPin ?? null
    await setRootKey(userId, sessionId, root_key)

    const { sendingChainKey } = deriveChainKeys(root_key, userId, sessionId)

    const chain_key_material = chain_key_KDF(sendingChainKey)
    const messageKey = chain_key_material.slice(0, 32)
    const newChainKey = chain_key_material.slice(32, 64)
    const nonceArray = chain_key_material.slice(64, 76)

    await setSendingChainKey(userId, sessionId, newChainKey)

    const publicEphemeralKeyBase64 = arrayBufferToBase64(publicEphemeralKey)
    await setOwnEphemeralKeys(
      userId,
      sessionId,
      publicEphemeralKeyBase64,
      arrayBufferToBase64(privateEphemeralKey)
    )

    let currentSendingNumber = await getCurrentSendingNumber(sessionId)
    if (currentSendingNumber == null) currentSendingNumber = 0

    let previousSendingNumber = await getPreviousSendingNumber(sessionId)
    if (previousSendingNumber == null) previousSendingNumber = 0

    const payload = JSON.stringify({
      text: text || '',
      image: imageData || null,
      replyTo: replyTo || null,
    })

    const aadBytes = buildAadBytes({
      userId,
      targetUserId,
      publicEphemeralKey: publicEphemeralKeyBase64,
      sendingNumber: currentSendingNumber,
      previousSendingNumber,
      spkId,
      opkId,
    })

    const encryptedPayload = await encryptWithAad(payload, messageKey, nonceArray, aadBytes)

    await setCurrentSendingNumber(sessionId, currentSendingNumber + 1)

    return {
      payload: encryptedPayload,
      nonce: arrayBufferToBase64(nonceArray),
      userId,
      targetUserId,
      username,
      publicEphemeralKey: publicEphemeralKeyBase64,
      sendingNumber: currentSendingNumber,
      previousSendingNumber,
      spkId,
      opkId,
      ...(peerIdentityToPin ? { peerIdentityToPin } : {}),
    }
  }

  let sendingChainKey = await getSendingChainKey(userId, sessionId)
  if (!sendingChainKey) {
    const { sendingChainKey: derivedSendingChainKey } = deriveChainKeys(root_key, userId, sessionId)
    sendingChainKey = derivedSendingChainKey
    await setSendingChainKey(userId, sessionId, sendingChainKey)
  }

  const chain_key_material = chain_key_KDF(sendingChainKey)
  const messageKey = chain_key_material.slice(0, 32)
  const newChainKey = chain_key_material.slice(32, 64)
  const nonceArray = chain_key_material.slice(64, 76)

  await setSendingChainKey(userId, sessionId, newChainKey)

  const ownKeys = await getOwnEphemeralKeys(userId, sessionId)
  const publicEphemeralKeyBase64 = ownKeys?.public
  if (!publicEphemeralKeyBase64) {
    throw new Error('Missing own ephemeral public key for outgoing message')
  }

  let currentSendingNumber = await getCurrentSendingNumber(sessionId)
  if (currentSendingNumber == null) currentSendingNumber = 0

  let previousSendingNumber = await getPreviousSendingNumber(sessionId)
  if (previousSendingNumber == null) previousSendingNumber = 0

  const payload = JSON.stringify({
    text: text || '',
    image: imageData || null,
    replyTo: replyTo || null,
  })

  const aadBytes = buildAadBytes({
    userId,
    targetUserId,
    publicEphemeralKey: publicEphemeralKeyBase64,
    sendingNumber: currentSendingNumber,
    previousSendingNumber,
  })

  const encryptedPayload = await encryptWithAad(payload, messageKey, nonceArray, aadBytes)

  await setCurrentSendingNumber(sessionId, currentSendingNumber + 1)

  return {
    payload: encryptedPayload,
    nonce: arrayBufferToBase64(nonceArray),
    userId,
    targetUserId,
    username,
    publicEphemeralKey: publicEphemeralKeyBase64,
    sendingNumber: currentSendingNumber,
    previousSendingNumber,
  }
}
