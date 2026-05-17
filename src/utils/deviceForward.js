/**
 * Device-to-device message forwarding via the envelope REST API.
 *
 * Both master and paired devices share the same X25519 identity private key
 * (copied via snapshot). We derive a symmetric AES-GCM key from that shared
 * private key so every device of the same account can encrypt/decrypt
 * forwarded message envelopes without any additional key exchange.
 *
 * Master → mobile:  outgoing messages the master sent, and incoming messages
 *                   the master decrypted (mobile cannot decrypt them directly
 *                   because its DR ratchet state was cleared on import).
 * Mobile → master:  outgoing messages the mobile sent (so the master's
 *                   conversation history stays complete).
 */

import { deviceService } from '@/features/devices/deviceService'
import { getIdentityKeys } from '@/components/Dashboard/Chat/utils/chat/keyManagement'
import { getSocket } from '../socket'

const ENVELOPE_SALT = new TextEncoder().encode('echo-device-envelope-v1')
const ENVELOPE_INFO = new TextEncoder().encode('device-to-device-envelope-key')

// ── key derivation ────────────────────────────────────────────────────────────

async function deriveEnvelopeKey(privateKeyX25519B64) {
  const keyBytes = Uint8Array.from(atob(privateKeyX25519B64), (c) => c.charCodeAt(0))
  const ikm = await crypto.subtle.importKey('raw', keyBytes, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: ENVELOPE_SALT, info: ENVELOPE_INFO },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ── encrypt / decrypt ─────────────────────────────────────────────────────────

async function encryptEnvelope(envelopeKey, payload) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    envelopeKey,
    new TextEncoder().encode(JSON.stringify(payload))
  )
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  return { ciphertext: b64(encrypted), nonce: b64(iv) }
}

async function decryptEnvelope(envelopeKey, ciphertext, nonce) {
  const b64dec = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64dec(nonce) },
    envelopeKey,
    b64dec(ciphertext)
  )
  return JSON.parse(new TextDecoder().decode(decrypted))
}

// ── device discovery ──────────────────────────────────────────────────────────

let _pairedDevicesCache = null
let _pairedDevicesCachedAt = 0

export function invalidatePairedDevicesCache() {
  _pairedDevicesCache = null
}

export async function getPairedDeviceIds(userId) {
  const now = Date.now()
  if (_pairedDevicesCache && now - _pairedDevicesCachedAt < 60_000) {
    return _pairedDevicesCache
  }

  const currentDeviceId = localStorage.getItem('echo-device-id')
  try {
    const data = await deviceService.listDevices(userId)
    const list = Array.isArray(data) ? data : (data.devices ?? [])
    const paired = list.map((d) => d.deviceId).filter((id) => id && id !== currentDeviceId)
    _pairedDevicesCache = paired
    _pairedDevicesCachedAt = now
    return paired
  } catch {
    return []
  }
}

// ── forward a single message to all other devices ─────────────────────────────

export async function forwardMessageToDevices({
  userId,
  targetUserId,
  text,
  image,
  direction, // 'outgoing' | 'incoming'
  messageId,
  createdAt,
  seenStatus,
}) {
  try {
    const identityKeys = await getIdentityKeys()
    if (!identityKeys?.privateKeyX25519) return

    const envelopeKey = await deriveEnvelopeKey(identityKeys.privateKeyX25519)

    // For outgoing messages, snapshot the current DR session state so paired devices
    // can advance their ratchet position before their next send.
    let sessionUpdate = null
    if (direction === 'outgoing') {
      try {
        const { getSendingChainKey, getCurrentSendingNumber, getOwnEphemeralKeys } =
          await import('@/components/Dashboard/Chat/utils/chat/keyManagement')
        const chainKey = await getSendingChainKey(userId, targetUserId)
        const sendingNumber = await getCurrentSendingNumber(targetUserId)
        const ownKeys = await getOwnEphemeralKeys(userId, targetUserId)
        if (chainKey && sendingNumber != null && ownKeys?.public && ownKeys?.private) {
          sessionUpdate = {
            sendingChainKey: btoa(String.fromCharCode(...new Uint8Array(chainKey))),
            currentSendingNumber: sendingNumber,
            publicEphemeralKey: ownKeys.public,
            privateEphemeralKey: ownKeys.private,
          }
        }
      } catch {
        // non-fatal; forward without session snapshot
      }
    }

    const payload = {
      text: text ?? '',
      image: image ?? null,
      userId,
      targetUserId,
      direction,
      _id: messageId,
      createdAt,
      seenStatus: seenStatus ?? false,
    }
    if (sessionUpdate) payload.sessionUpdate = sessionUpdate

    const { ciphertext, nonce } = await encryptEnvelope(envelopeKey, payload)

    // Always push via socket — the server relays to every other socket in the
    // user's room without needing an explicit device ID list. This covers the
    // case where the device list cache is stale (e.g. primary registered after
    // the paired device's last listDevices call).
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('deviceEnvelope', { ciphertext, nonce })
    }

    // REST store is the targeted offline fallback — only needed when a device
    // isn't currently connected. Skip if no paired device IDs are known yet.
    const pairedDeviceIds = await getPairedDeviceIds(userId)
    if (pairedDeviceIds.length === 0) return

    const currentDeviceId = localStorage.getItem('echo-device-id') || null
    const conversationId = [userId, targetUserId].sort().join('-')

    await deviceService.storeEnvelopes({
      senderDeviceId: currentDeviceId,
      envelopes: pairedDeviceIds.map((recipientDeviceId) => ({
        logicalRecipientId: userId,
        recipientDeviceId,
        ciphertext,
        nonce,
        header: null,
        messageType: 'message',
        conversationId,
      })),
    })
  } catch (err) {
    console.warn('[DeviceForward] Failed to forward message:', err)
  }
}

// ── process a single already-fetched envelope (shared by socket and REST paths) ─

export async function processRawDeviceEnvelope(userId, rawEnvelope) {
  const identityKeys = await getIdentityKeys()
  if (!identityKeys?.privateKeyX25519) return

  const envelopeKey = await deriveEnvelopeKey(identityKeys.privateKeyX25519)
  const payload = await decryptEnvelope(envelopeKey, rawEnvelope.ciphertext, rawEnvelope.nonce)

  if (payload.direction === 'outgoing' && payload.sessionUpdate) {
    try {
      const {
        setSendingChainKey,
        setCurrentSendingNumber,
        setOwnEphemeralKeys,
        getCurrentSendingNumber,
      } = await import('@/components/Dashboard/Chat/utils/chat/keyManagement')
      const b64dec = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
      const su = payload.sessionUpdate
      const contactId = payload.targetUserId
      // Only advance session state — never overwrite with a stale snapshot.
      const localSn = await getCurrentSendingNumber(contactId).catch(() => null)
      if (
        su.currentSendingNumber != null &&
        (localSn == null || su.currentSendingNumber > localSn)
      ) {
        if (su.sendingChainKey) {
          await setSendingChainKey(userId, contactId, b64dec(su.sendingChainKey))
        }
        await setCurrentSendingNumber(contactId, su.currentSendingNumber)
        if (su.publicEphemeralKey && su.privateEphemeralKey) {
          await setOwnEphemeralKeys(
            userId,
            contactId,
            su.publicEphemeralKey,
            su.privateEphemeralKey
          )
        }
      }
    } catch {
      // non-fatal
    }
  }

  // sessionSync envelopes carry only session state — no message to display.
  if (payload.type === 'sessionSync') return

  // groupStateSync envelopes carry MLS epoch secrets — keep device's own leaf identity.
  if (payload.type === 'groupStateSync') {
    try {
      const { saveGroupState, loadGroupState } =
        await import('@/components/Dashboard/Chat/utils/crypto/groupCryptoProvider')
      const { groupId, groupState } = payload
      if (groupId && groupState) {
        const local = await loadGroupState(groupId).catch(() => null)
        if (!local) {
          // No local state — first time seeing this group. Save as-is for bootstrap.
          await saveGroupState(groupId, groupState)
        } else if (groupState.epoch != null && groupState.epoch > local.epoch) {
          // Epoch advanced: update epoch secrets but keep our own leaf identity and tree.
          // Our selfLeafIndex, leafSigningPrivKeyB64, and tree private keys are ours.
          await saveGroupState(groupId, {
            ...local,
            applicationSecretB64: groupState.applicationSecretB64,
            groupKeyB64: groupState.applicationSecretB64,
            senderDataSecretB64: groupState.senderDataSecretB64,
            initSecretB64: groupState.initSecretB64,
            externalSecretB64: groupState.externalSecretB64,
            membershipSecretB64: groupState.membershipSecretB64,
            resumptionPskB64: groupState.resumptionPskB64,
            confirmationTagB64: groupState.confirmationTagB64,
            confirmedTranscriptHashB64: groupState.confirmedTranscriptHashB64,
            treeHashB64: groupState.treeHashB64,
            epoch: groupState.epoch,
            roster: groupState.roster,
            senderGenerations: groupState.senderGenerations,
          })
        }
        window.dispatchEvent(new CustomEvent('groupStateSynced', { detail: { groupId } }))
      }
    } catch (err) {
      console.warn('[DeviceForward] Failed to apply group state sync:', err)
    }
    return
  }

  const isIncoming = payload.direction === 'incoming'
  const contactId = payload.targetUserId

  const message = {
    _id: payload._id || crypto.randomUUID(),
    userId: isIncoming ? payload.targetUserId : payload.userId,
    targetUserId: isIncoming ? payload.userId : payload.targetUserId,
    text: payload.text ?? '',
    image: payload.image ?? null,
    createdAt: payload.createdAt || new Date().toISOString(),
    seenStatus: payload.seenStatus ?? false,
    _fromDeviceForward: true,
  }

  const { updateSavedMessages } =
    await import('@/components/Dashboard/Chat/utils/chat/keyManagement')
  await updateSavedMessages(userId, contactId, message, null)
}

// ── group state sync ──────────────────────────────────────────────────────────

export async function forwardGroupStateToPairedDevices(userId, groupId, groupState) {
  try {
    const identityKeys = await getIdentityKeys()
    if (!identityKeys?.privateKeyX25519) return

    const envelopeKey = await deriveEnvelopeKey(identityKeys.privateKeyX25519)
    const { ciphertext, nonce } = await encryptEnvelope(envelopeKey, {
      type: 'groupStateSync',
      userId,
      groupId,
      groupState,
    })

    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('deviceEnvelope', { ciphertext, nonce })
    }

    const pairedDeviceIds = await getPairedDeviceIds(userId)
    if (pairedDeviceIds.length === 0) return

    const currentDeviceId = localStorage.getItem('echo-device-id') || null
    await deviceService.storeEnvelopes({
      senderDeviceId: currentDeviceId,
      envelopes: pairedDeviceIds.map((recipientDeviceId) => ({
        logicalRecipientId: userId,
        recipientDeviceId,
        ciphertext,
        nonce,
        header: null,
        messageType: 'groupStateSync',
        conversationId: `group:${groupId}`,
      })),
    })
  } catch (err) {
    console.warn('[DeviceForward] Failed to forward group state:', err)
  }
}

// ── session sync: let other devices pull current ratchet state ────────────────

export function requestSessionSync(targetUserId) {
  const socket = getSocket()
  if (socket?.connected && targetUserId) {
    socket.emit('deviceSessionRequest', { targetUserId })
  }
}

export async function broadcastSessionSync(userId, targetUserId) {
  try {
    const identityKeys = await getIdentityKeys()
    if (!identityKeys?.privateKeyX25519) return

    const { getSendingChainKey, getCurrentSendingNumber, getOwnEphemeralKeys } =
      await import('@/components/Dashboard/Chat/utils/chat/keyManagement')
    const chainKey = await getSendingChainKey(userId, targetUserId)
    const sendingNumber = await getCurrentSendingNumber(targetUserId)
    const ownKeys = await getOwnEphemeralKeys(userId, targetUserId)
    if (!chainKey || sendingNumber == null || !ownKeys?.public || !ownKeys?.private) return

    const envelopeKey = await deriveEnvelopeKey(identityKeys.privateKeyX25519)
    const { ciphertext, nonce } = await encryptEnvelope(envelopeKey, {
      type: 'sessionSync',
      userId,
      targetUserId,
      direction: 'outgoing',
      sessionUpdate: {
        sendingChainKey: btoa(String.fromCharCode(...new Uint8Array(chainKey))),
        currentSendingNumber: sendingNumber,
        publicEphemeralKey: ownKeys.public,
        privateEphemeralKey: ownKeys.private,
      },
    })
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('deviceEnvelope', { ciphertext, nonce })
    }
  } catch {
    // non-fatal
  }
}

// ── fetch and process pending envelopes on this device ────────────────────────

export async function processIncomingEnvelopes(userId) {
  const deviceId = localStorage.getItem('echo-device-id')
  if (!deviceId) return

  try {
    const identityKeys = await getIdentityKeys()
    if (!identityKeys?.privateKeyX25519) return

    const data = await deviceService.fetchEnvelopes(deviceId)
    const envelopes = Array.isArray(data) ? data : (data.envelopes ?? [])
    if (envelopes.length === 0) return

    for (const envelope of envelopes) {
      try {
        await processRawDeviceEnvelope(userId, envelope)
        await deviceService.ackEnvelope(envelope.envelopeId, { deviceId, status: 'delivered' })
      } catch (err) {
        console.warn('[DeviceForward] Failed to process envelope', envelope.envelopeId, err)
      }
    }
  } catch (err) {
    console.warn('[DeviceForward] Failed to fetch envelopes:', err)
  }
}
