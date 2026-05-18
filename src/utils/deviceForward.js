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

// ── DR state snapshot helpers ─────────────────────────────────────────────────

const b64FromBytes = (bytes) => (bytes ? btoa(String.fromCharCode(...new Uint8Array(bytes))) : null)

/**
 * Snapshot the full Double Ratchet state for (userId, targetUserId).
 *
 * Sibling devices share one DR session per peer. Whenever this device mutates
 * state — by sending, by receiving a message that advances the receive chain,
 * or by performing a DH ratchet step on receive — we forward this snapshot so
 * the other devices can keep up. Missing fields fall through silently; the
 * receiver's merge step is tolerant of partial snapshots.
 */
async function snapshotDoubleRatchetState(userId, targetUserId) {
  try {
    const {
      getSendingChainKey,
      getCurrentSendingNumber,
      getOwnEphemeralKeys,
      getReceivingChainKey,
      getCurrentReceivingNumber,
      getPreviousSendingNumber,
      getRootKey,
      getEphemeralData,
    } = await import('@/components/Dashboard/Chat/utils/chat/keyManagement')

    const [
      sendingChainKey,
      currentSendingNumber,
      ownKeys,
      receivingChainKey,
      currentReceivingNumber,
      previousSendingNumber,
      rootKey,
      ephData,
    ] = await Promise.all([
      getSendingChainKey(userId, targetUserId).catch(() => null),
      getCurrentSendingNumber(targetUserId).catch(() => null),
      getOwnEphemeralKeys(userId, targetUserId).catch(() => null),
      getReceivingChainKey(userId, targetUserId).catch(() => null),
      getCurrentReceivingNumber(targetUserId).catch(() => null),
      getPreviousSendingNumber(targetUserId).catch(() => null),
      getRootKey(userId, targetUserId).catch(() => null),
      getEphemeralData(userId, targetUserId).catch(() => null),
    ])

    if (!sendingChainKey || currentSendingNumber == null || !ownKeys?.public || !ownKeys?.private) {
      // Bare minimum to make a snapshot useful is the sending chain.
      return null
    }

    return {
      // sending side
      sendingChainKey: b64FromBytes(sendingChainKey),
      currentSendingNumber,
      publicEphemeralKey: ownKeys.public,
      privateEphemeralKey: ownKeys.private,
      // receiving side
      receivingChainKey: b64FromBytes(receivingChainKey),
      currentReceivingNumber,
      previousSendingNumber,
      rootKey: b64FromBytes(rootKey),
      currentTargetPublicEphemeralKey: ephData?.currentTargetPublicEphemeralKey || null,
    }
  } catch {
    return null
  }
}

/**
 * Merge a sibling device's DR snapshot into this device's state.
 *
 * Two independent "DH ratchet step" signals:
 *   - Own ephemeral changed → sender just performed a DH step on receive
 *     (post-receive ratchet). Apply the entire sending side + root key.
 *   - Peer ephemeral changed → sender just decrypted a message that contained
 *     a new peer ephemeral. Apply the entire receiving side + root key.
 *
 * For the same-ephemeral case we only advance if the counter moves forward,
 * to discard stale envelopes arriving out of order.
 */
async function applyDoubleRatchetSnapshot(userId, contactId, su) {
  if (!su || !contactId) return
  try {
    const {
      setSendingChainKey,
      setCurrentSendingNumber,
      setOwnEphemeralKeys,
      getOwnEphemeralKeys,
      getCurrentSendingNumber,
      setReceivingChainKey,
      setCurrentReceivingNumber,
      getCurrentReceivingNumber,
      setPreviousSendingNumber,
      setRootKey,
      getEphemeralData,
      setEphemeralData,
    } = await import('@/components/Dashboard/Chat/utils/chat/keyManagement')

    const b64dec = (s) =>
      typeof s === 'string' ? Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) : null

    const [localEph, localSn, localNr, localEphData] = await Promise.all([
      getOwnEphemeralKeys(userId, contactId).catch(() => null),
      getCurrentSendingNumber(contactId).catch(() => null),
      getCurrentReceivingNumber(contactId).catch(() => null),
      getEphemeralData(userId, contactId).catch(() => null),
    ])

    // ── Sending side ────────────────────────────────────────────────────────
    const sendingDhStepped =
      !!su.publicEphemeralKey && (!localEph?.public || localEph.public !== su.publicEphemeralKey)
    const sendingSameChainAdvance =
      !sendingDhStepped &&
      su.currentSendingNumber != null &&
      (localSn == null || su.currentSendingNumber > localSn)

    if (sendingDhStepped || sendingSameChainAdvance) {
      if (su.sendingChainKey) {
        await setSendingChainKey(userId, contactId, b64dec(su.sendingChainKey))
      }
      if (su.currentSendingNumber != null) {
        await setCurrentSendingNumber(contactId, su.currentSendingNumber)
      }
      if (su.publicEphemeralKey && su.privateEphemeralKey) {
        await setOwnEphemeralKeys(userId, contactId, su.publicEphemeralKey, su.privateEphemeralKey)
      }
    }

    // ── Receiving side ──────────────────────────────────────────────────────
    const localPeerEph = localEphData?.currentTargetPublicEphemeralKey || null
    const receivingDhStepped =
      !!su.currentTargetPublicEphemeralKey && localPeerEph !== su.currentTargetPublicEphemeralKey
    const receivingSameChainAdvance =
      !receivingDhStepped &&
      su.currentReceivingNumber != null &&
      (localNr == null || su.currentReceivingNumber > localNr)

    if (receivingDhStepped || receivingSameChainAdvance) {
      if (su.receivingChainKey) {
        await setReceivingChainKey(userId, contactId, b64dec(su.receivingChainKey))
      }
      if (su.currentReceivingNumber != null) {
        await setCurrentReceivingNumber(contactId, su.currentReceivingNumber)
      }
      if (su.currentTargetPublicEphemeralKey) {
        const existingKnown =
          localEphData?.knownTargetPublicEphemeralKeys &&
          typeof localEphData.knownTargetPublicEphemeralKeys === 'object' &&
          !Array.isArray(localEphData.knownTargetPublicEphemeralKeys)
            ? localEphData.knownTargetPublicEphemeralKeys
            : {}
        await setEphemeralData(userId, contactId, {
          ...(localEphData || {}),
          currentTargetPublicEphemeralKey: su.currentTargetPublicEphemeralKey,
          previousTargetPublicEphemeralKey: su.currentTargetPublicEphemeralKey,
          knownTargetPublicEphemeralKeys: {
            ...existingKnown,
            [su.currentTargetPublicEphemeralKey]: true,
          },
        })
      }
    }

    // PN moves forward on every DH step; safe to apply if greater.
    if (su.previousSendingNumber != null) {
      try {
        const { getPreviousSendingNumber } =
          await import('@/components/Dashboard/Chat/utils/chat/keyManagement')
        const localPn = await getPreviousSendingNumber(contactId).catch(() => null)
        if (localPn == null || su.previousSendingNumber > localPn) {
          await setPreviousSendingNumber(contactId, su.previousSendingNumber)
        }
      } catch {
        // non-fatal
      }
    }

    // Root key advances on every DH step. Apply whenever either side detected
    // a DH step from the snapshot.
    if (su.rootKey && (sendingDhStepped || receivingDhStepped)) {
      await setRootKey(userId, contactId, b64dec(su.rootKey))
    }
  } catch {
    // non-fatal — at worst the sibling falls back to forwarded plaintext.
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
  username,
}) {
  try {
    const identityKeys = await getIdentityKeys()
    if (!identityKeys?.privateKeyX25519) return

    const envelopeKey = await deriveEnvelopeKey(identityKeys.privateKeyX25519)

    // Snapshot the full DR state regardless of direction.
    //   - 'outgoing': captures the chain key advance + sn increment from the send.
    //   - 'incoming': captures the post-DH-ratchet state (new own ephemeral,
    //                 new sending chain, sn reset to 0, advanced receiving chain,
    //                 new peer ephemeral, advanced root key) so sibling devices
    //                 can both send AND decrypt subsequent traffic.
    const sessionUpdate = await snapshotDoubleRatchetState(userId, targetUserId)

    const payload = {
      text: text ?? '',
      image: image ?? null,
      userId,
      targetUserId,
      direction,
      _id: messageId,
      createdAt,
      seenStatus: seenStatus ?? false,
      username: username ?? '',
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

  if (payload.sessionUpdate) {
    await applyDoubleRatchetSnapshot(userId, payload.targetUserId, payload.sessionUpdate)
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
    username: payload.username ?? '',
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

    const sessionUpdate = await snapshotDoubleRatchetState(userId, targetUserId)
    if (!sessionUpdate) return

    const envelopeKey = await deriveEnvelopeKey(identityKeys.privateKeyX25519)
    const { ciphertext, nonce } = await encryptEnvelope(envelopeKey, {
      type: 'sessionSync',
      userId,
      targetUserId,
      direction: 'outgoing',
      sessionUpdate,
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
