/**
 * Device-to-device message forwarding.
 *
 * After the per-device identity migration, each device has its OWN IK and
 * peers fan out to every device directly — so a paired device receives Bob's
 * inbound messages from Bob, not via the master.
 *
 * The only remaining use case for this channel is sibling display-sync of
 * OUTBOUND messages: when Alice sends from her desktop, her mobile should
 * show the message in the conversation too. The envelope carries display-
 * only fields (plaintext, sender/recipient ids, timestamps); it MUST NOT
 * carry DR ratchet state, root keys, or ephemeral private keys.
 *
 * NOTE: the symmetric envelope key here is currently derived from the
 * device's own IK private. After per-device IK separation, sibling devices
 * no longer share an IK and therefore cannot derive a matching envelope
 * key. Display-sync is expected to be reimplemented over a per-device
 * sibling channel (a separate DR session between Alice's own devices). The
 * current code remains as a no-op fallback until that channel exists.
 */

import { deviceService } from '@/features/devices/deviceService'
import { getIdentityKeys } from '@/components/Dashboard/Chat/utils/chat/keyManagement'
import { getSocket } from '../socket'
import { diffie_hellman } from '@mascaro101/echo-protocol'

const ENVELOPE_SALT = new TextEncoder().encode('echo-device-envelope-v1')
const ENVELOPE_INFO = new TextEncoder().encode('device-to-device-envelope-key')
const DH_ENVELOPE_SALT = new TextEncoder().encode('echo-device-envelope-dh-v1')
const DH_ENVELOPE_INFO = new TextEncoder().encode('x25519-hkdf-aesgcm')

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

// Derive a per-recipient envelope key using static X25519 DH between
// sender's IK private and recipient's IK public. Both sides can derive
// the same secret; HKDF turns it into an AES-GCM key.
async function deriveDhEnvelopeKey(senderPrivB64, recipientPubB64) {
  const b64dec = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
  const shared = await diffie_hellman(b64dec(senderPrivB64), b64dec(recipientPubB64))
  const ikm = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: DH_ENVELOPE_SALT, info: DH_ENVELOPE_INFO },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptDhEnvelope({ senderPrivB64, recipientPubB64, payload }) {
  const key = await deriveDhEnvelopeKey(senderPrivB64, recipientPubB64)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  )
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  return { ciphertext: b64(enc), nonce: b64(iv) }
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
//
// REMOVED: snapshotDoubleRatchetState / applyDoubleRatchetSnapshot.
//
// These previously serialised the local Double Ratchet state — including the
// sender's private ephemeral key, root key, and chain keys — and shipped it
// to sibling devices so they could decrypt the same conversation. That model
// required every sibling to hold the master's IK private (key cloning) and
// gave any compromised sibling decryption authority over every conversation.
//
// Under per-device identity, peers fan out to each device independently and
// each device runs its own DR session per peer. There is no sibling DR state
// to share; an own-outbound display-sync channel (if needed) must carry only
// plaintext display data, never DR private state.

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

    // Display-only payload — never carries DR ratchet state or private keys.
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

  let payload
  try {
    const envelopeKey = await deriveEnvelopeKey(identityKeys.privateKeyX25519)
    payload = await decryptEnvelope(envelopeKey, rawEnvelope.ciphertext, rawEnvelope.nonce)
  } catch (e) {
    // Try per-recipient DH envelope fallback when header indicates so
    const header = rawEnvelope?.header
    const headerObj = typeof header === 'string' ? JSON.parse(header) : header
    if (
      headerObj &&
      (headerObj.alg === 'x25519-hkdf-aesgcm' || headerObj.alg === 'x25519-hkdf-aes-gcm') &&
      typeof headerObj.senderPubB64 === 'string' &&
      headerObj.senderPubB64.length > 0
    ) {
      const key = await deriveDhEnvelopeKey(identityKeys.privateKeyX25519, headerObj.senderPubB64)
      payload = await decryptEnvelope(key, rawEnvelope.ciphertext, rawEnvelope.nonce)
    } else {
      throw e
    }
  }

  // sessionSync envelopes used to carry DR ratchet state; the new model never
  // shares that across siblings, so we drop any legacy envelopes of this type.
  if (payload.type === 'sessionSync') return

  // groupStateSync envelopes carry MLS epoch secrets — keep device's own leaf identity.
  if (payload.type === 'groupStateSync') {
    try {
      const { saveGroupState, loadGroupState } =
        await import('@/components/Dashboard/Chat/utils/crypto/groupCryptoProvider')
      const { groupId, groupState } = payload
      if (groupId && groupState) {
        const local = await loadGroupState(groupId).catch(() => null)
        const localMlsPub = localStorage.getItem('echo-device-mls-pub') || null
        const localMlsPriv = localStorage.getItem('echo-device-mls-priv') || null
        const incomingNodes = Array.isArray(groupState.tree?.nodes) ? groupState.tree.nodes : []
        const ownLeafNodeIndex =
          localMlsPub && incomingNodes.length > 0
            ? incomingNodes.findIndex((node) => node?.publicKeyB64 === localMlsPub)
            : -1
        const ownLeafIndex =
          ownLeafNodeIndex >= 0 && ownLeafNodeIndex % 2 === 0 ? ownLeafNodeIndex / 2 : null
        const mergeIncomingTree = (baseTree = {}, selfLeafIndex = null) => {
          const baseNodes = Array.isArray(baseTree?.nodes) ? baseTree.nodes : []
          const sourceNodes = incomingNodes.length > 0 ? incomingNodes : baseNodes
          const selfNodeIndex = Number.isInteger(selfLeafIndex) ? selfLeafIndex * 2 : -1
          const nodes = sourceNodes.map((node, index) => ({
            publicKeyB64:
              index === selfNodeIndex && localMlsPub ? localMlsPub : (node?.publicKeyB64 ?? null),
            privateKeyB64:
              index === selfNodeIndex && localMlsPriv
                ? localMlsPriv
                : baseNodes[index]?.publicKeyB64 === node?.publicKeyB64
                  ? (baseNodes[index]?.privateKeyB64 ?? null)
                  : null,
          }))
          const incomingLeafData =
            groupState.tree?.leafData && typeof groupState.tree.leafData === 'object'
              ? groupState.tree.leafData
              : {}
          const selfLeafKey = Number.isInteger(selfLeafIndex) ? String(selfLeafIndex) : null
          const baseLeafData =
            baseTree?.leafData && typeof baseTree.leafData === 'object' ? baseTree.leafData : {}
          // Use the forwarded leafData as the source of truth (it's the
          // post-commit view at the new epoch — entries removed by Remove
          // commits must NOT be resurrected from local). The one exception is
          // when the forward arrives with an *empty* leafData: that's almost
          // certainly a sender-side bug (placeholder-state forward, partial
          // serialization, etc.) rather than "every leaf was removed", and
          // wiping the receiver's view to match strands it on the next
          // inbound commit with "No signing pub key at leafIndex 0". Fall
          // back to the local leafData in that degenerate case.
          const incomingLeafCount = Object.keys(incomingLeafData).length
          const useIncoming = incomingLeafCount > 0
          const leafData = useIncoming
            ? selfLeafKey && baseLeafData[selfLeafKey] && !incomingLeafData[selfLeafKey]
              ? { ...incomingLeafData, [selfLeafKey]: baseLeafData[selfLeafKey] }
              : incomingLeafData
            : baseLeafData
          if (!useIncoming && Object.keys(baseLeafData).length > 0) {
            console.warn(
              '[DeviceForward] Incoming groupStateSync had empty leafData; keeping local leafData to avoid stranding'
            )
          }
          return {
            ...baseTree,
            nodes,
            leafData,
          }
        }

        const syncedEpochState = {
          ...groupState,
          // Application sender generations are local receive/send ratchets, not
          // epoch key material. Syncing them makes siblings believe they already
          // consumed messages that only the forwarding device encrypted/decrypted.
          senderGenerations: {},
          applicationMessageCounter: 0,
        }

        if (!local) {
          // No local state: only bootstrap if this device already has its own
          // MLS leaf in the forwarded tree. Otherwise saving as-is would clone
          // the sender's selfLeafIndex and make two devices transmit from the
          // same leaf/counter.
          if (!Number.isInteger(ownLeafIndex)) return
          await saveGroupState(groupId, {
            ...syncedEpochState,
            selfUserId: userId,
            selfLeafIndex: ownLeafIndex,
            tree: mergeIncomingTree(groupState.tree, ownLeafIndex),
          })
        } else if (groupState.epoch != null && groupState.epoch > local.epoch) {
          // Epoch advanced: update epoch secrets but keep our own leaf identity and tree.
          // Our selfLeafIndex, leafSigningPrivKeyB64, and tree private keys are ours.
          //
          // tree.leafData (public-only: userId, username, leafSigningPubKey,
          // credential) must come from the forwarded state — otherwise
          // normalizeGroupState reconstructs the roster from our STALE local
          // leafData, silently reverting an admin's add/remove on this device
          // and leaving siblings showing the removed member.
          const selfLeafIndex = Number.isInteger(ownLeafIndex) ? ownLeafIndex : local.selfLeafIndex
          const mergedTree = mergeIncomingTree(local.tree, selfLeafIndex)
          const ownSenderGeneration =
            Number.isInteger(selfLeafIndex) && local.senderGenerations
              ? local.senderGenerations[String(selfLeafIndex)]
              : null
          const senderGenerations = Number.isInteger(ownSenderGeneration)
            ? { [String(selfLeafIndex)]: ownSenderGeneration }
            : {}
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
            selfLeafIndex,
            roster: groupState.roster,
            senderGenerations,
            applicationMessageCounter: Number.isInteger(ownSenderGeneration)
              ? ownSenderGeneration
              : 0,
            tree: mergedTree,
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

    // Build per-recipient envelopes using X25519 DH so sibling devices can decrypt
    const pairedDeviceIds = await getPairedDeviceIds(userId)
    if (pairedDeviceIds.length === 0) return

    // Fetch recipient device identity pubs
    let identities = []
    try {
      const res = await deviceService.getDeviceIdentities(userId)
      identities = Array.isArray(res?.devices) ? res.devices : Array.isArray(res) ? res : []
    } catch {
      identities = []
    }
    const byId = new Map(
      identities
        .filter((d) => d?.deviceId && d?.publicIdentityKeyX25519)
        .map((d) => [String(d.deviceId), d])
    )

    const senderPrivB64 = identityKeys.privateKeyX25519
    const senderPubB64 = identityKeys.publicKeyX25519 || null

    const currentDeviceId = localStorage.getItem('echo-device-id') || null
    const envelopes = []
    for (const recipientDeviceId of pairedDeviceIds) {
      const rec = byId.get(String(recipientDeviceId))
      if (!rec?.publicIdentityKeyX25519) continue
      const { ciphertext, nonce } = await encryptDhEnvelope({
        senderPrivB64,
        recipientPubB64: rec.publicIdentityKeyX25519,
        payload: {
          type: 'groupStateSync',
          userId,
          groupId,
          groupState,
        },
      })
      envelopes.push({
        logicalRecipientId: userId,
        recipientDeviceId,
        ciphertext,
        nonce,
        header: { alg: 'x25519-hkdf-aesgcm', senderPubB64: senderPubB64 },
        messageType: 'groupStateSync',
        conversationId: `group:${groupId}`,
      })
    }

    if (envelopes.length > 0) {
      await deviceService.storeEnvelopes({ senderDeviceId: currentDeviceId, envelopes })
    }
  } catch (err) {
    console.warn('[DeviceForward] Failed to forward group state:', err)
  }
}

// ── session sync ──────────────────────────────────────────────────────────────
//
// Pulling/pushing DR ratchet state across siblings has been removed: under
// per-device identity, each device runs its own DR session and no device may
// reconstruct a sibling's state. The exported names below are kept as no-ops
// so any straggling call sites do not crash.

export function requestSessionSync() {
  // no-op
}

export async function broadcastSessionSync() {
  // no-op
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
        // Legacy symmetric envelopes (no DH header): ack to prevent re-fetch loops.
        // DH per-recipient envelopes carry header.alg === 'x25519-hkdf-aesgcm' —
        // do NOT ack on failure so we can retry after identity/state settles.
        const headerObj =
          typeof envelope?.header === 'string' ? JSON.parse(envelope.header) : envelope?.header
        const alg = headerObj?.alg || null
        const isDhEnvelope = alg === 'x25519-hkdf-aesgcm' || alg === 'x25519-hkdf-aes-gcm'
        if (!isDhEnvelope) {
          try {
            await deviceService.ackEnvelope(envelope.envelopeId, { deviceId, status: 'delivered' })
          } catch {
            /* ignore ack failure — will retry later */
          }
        }
        const isOpError = err?.name === 'OperationError' || /OperationError/i.test(String(err))
        if (!isOpError) {
          console.warn('[DeviceForward] Failed to process envelope', envelope.envelopeId, err)
        }
      }
    }
  } catch (err) {
    if (err?.status === 401 || err?.code === 'unauthorized') return
    console.warn('[DeviceForward] Failed to fetch envelopes:', err)
  }
}
