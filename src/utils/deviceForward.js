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

    const pairedDeviceIds = await getPairedDeviceIds(userId)
    if (pairedDeviceIds.length === 0) return

    const envelopeKey = await deriveEnvelopeKey(identityKeys.privateKeyX25519)

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

    const { ciphertext, nonce } = await encryptEnvelope(envelopeKey, payload)

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

// ── fetch and process pending envelopes on this device ────────────────────────

export async function processIncomingEnvelopes(userId) {
  const deviceId = localStorage.getItem('echo-device-id')
  if (!deviceId) return

  try {
    const identityKeys = await getIdentityKeys()
    if (!identityKeys?.privateKeyX25519) return

    const envelopeKey = await deriveEnvelopeKey(identityKeys.privateKeyX25519)

    const data = await deviceService.fetchEnvelopes(deviceId)
    const envelopes = Array.isArray(data) ? data : (data.envelopes ?? [])
    if (envelopes.length === 0) return

    // Lazy-import to avoid circular dependencies
    const { updateSavedMessages } =
      await import('@/components/Dashboard/Chat/utils/chat/keyManagement')

    for (const envelope of envelopes) {
      try {
        const payload = await decryptEnvelope(envelopeKey, envelope.ciphertext, envelope.nonce)

        // Derive the conversation partner's ID (the contact, not ourselves).
        const contactId = payload.direction === 'outgoing' ? payload.targetUserId : payload.userId

        const message = {
          _id: payload._id || crypto.randomUUID(),
          userId: payload.userId,
          targetUserId: payload.targetUserId,
          text: payload.text ?? '',
          image: payload.image ?? null,
          createdAt: payload.createdAt || new Date().toISOString(),
          seenStatus: payload.seenStatus ?? false,
          _fromDeviceForward: true,
        }

        await updateSavedMessages(userId, contactId, message, null)

        // Ack so the server won't re-deliver this envelope next time.
        await deviceService.ackEnvelope(envelope.envelopeId, {
          deviceId,
          status: 'delivered',
        })
      } catch (err) {
        console.warn('[DeviceForward] Failed to process envelope', envelope.envelopeId, err)
      }
    }
  } catch (err) {
    console.warn('[DeviceForward] Failed to fetch envelopes:', err)
  }
}
