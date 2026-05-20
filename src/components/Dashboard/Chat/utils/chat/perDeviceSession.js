/**
 * Per-device session primitives (items 3 + 4).
 *
 * Each (ownDevice, peerDevice) pair has its own Double Ratchet session. The
 * underlying keyManagement.js storage functions take an opaque
 * "targetUserId" string; we encode the peer device-pair as
 * `${peerUserId}@${peerDeviceUserId}` and pass that as the targetUserId. The
 * functions don't need to know it's a compound key.
 *
 * Wire-up:
 *   1. Where the existing code calls
 *      `getRootKey(ownUserId, peerUserId)` etc., callers that want per-device
 *      isolation should call `peerSessionId(peerUserId, peerDeviceUserId)` and
 *      pass the result as the second argument.
 *   2. The DM send path fetches all of the recipient's bundles, filters via
 *      `filterTrustedDeviceBundles`, and runs `encryptOutgoingMessage` once
 *      per trusted bundle with the compound id.
 *   3. The DM receive path looks up state by
 *      `peerSessionId(senderUserId, senderDeviceUserId)`.
 */

import { deviceService } from '@/features/devices/deviceService'
import { filterTrustedDeviceBundles } from '@/features/devices/deviceKeyBundle'

/**
 * Build the compound peer-session id used as the opaque "targetUserId"
 * argument to keyManagement.js functions when running per-device sessions.
 *
 * @param {string} peerUserId
 * @param {string} peerDeviceId
 * @returns {string} e.g. "alice@dev-abc"
 */
export function peerSessionId(peerUserId, peerDeviceUserId) {
  if (!peerUserId) throw new Error('peerSessionId requires peerUserId')
  if (!peerDeviceUserId) return String(peerUserId)
  if (String(peerDeviceUserId) === String(peerUserId)) return String(peerUserId)
  return `${peerUserId}@${peerDeviceUserId}`
}

/**
 * Parse a compound session id back into its components.
 *
 * @param {string} sessionId
 * @returns {{ peerUserId: string, peerDeviceId: string | null }}
 */
export function parsePeerSessionId(sessionId) {
  const s = String(sessionId || '')
  const idx = s.indexOf('@')
  if (idx < 0) return { peerUserId: s, peerDeviceId: null }
  return { peerUserId: s.slice(0, idx), peerDeviceId: s.slice(idx + 1) }
}

/**
 * Fetch the trusted device bundles for a peer user. Drops any secondary
 * device whose deviceAuthorizationSignature does not verify against the
 * peer's primary IK_Ed25519 (item 6 — prevents the server from splicing in
 * fake siblings).
 *
 * @param {string} peerUserId
 * @returns {Promise<Array>} trusted bundles, primary first
 */
export async function getTrustedPeerDeviceBundles(peerUserId) {
  if (!peerUserId) return []
  const raw = await deviceService.getDeviceBundles(peerUserId).catch(() => null)
  const bundles = Array.isArray(raw) ? raw : (raw?.bundles ?? [])
  if (!Array.isArray(bundles) || bundles.length === 0) return []
  return filterTrustedDeviceBundles(bundles)
}

async function getLinkedDeviceUsers(peerUserId) {
  if (!peerUserId) return []
  const raw = await deviceService.getDeviceIdentities(peerUserId).catch(() => null)
  const devices = Array.isArray(raw) ? raw : (raw?.identities ?? [])
  if (!Array.isArray(devices)) return []

  const out = [{ deliveryUserId: String(peerUserId), peerDeviceId: null, peerDeviceUserId: null }]
  for (const device of devices) {
    if (!device?.deviceUserId) continue
    if (device.isPrimary || String(device.deviceUserId) === String(peerUserId)) continue
    out.push({
      deliveryUserId: String(device.deviceUserId),
      peerDeviceId: device.deviceId || null,
      peerDeviceUserId: String(device.deviceUserId),
    })
  }
  return out
}

/**
 * Map a peer's trusted device bundles into fanout targets — one entry per
 * device, ready for encryptOutgoingMessage to consume.
 *
 * Each target is:
 *   - sessionTargetId: compound id to pass as the keyManagement "targetUserId"
 *   - peerDeviceId:    the recipient device id (used for server routing)
 *   - peerDeviceUserId: the recipient device-user id (used for DR sessions)
 *   - peerUserId:      the recipient user id (this account or the peer)
 *   - bundle:          the full per-device bundle (for X3DH initialization)
 *
 * @param {string} peerUserId
 * @returns {Promise<Array<{ sessionTargetId: string, peerDeviceId: string, peerDeviceUserId: string, peerUserId: string, bundle: object }>>}
 */
export async function buildDmFanoutTargets(peerUserId) {
  const targets = await getLinkedDeviceUsers(peerUserId)
  return targets.map((target) => ({
    sessionTargetId: target.deliveryUserId,
    peerDeviceId: target.peerDeviceId,
    peerDeviceUserId: target.peerDeviceUserId,
    peerUserId: target.deliveryUserId,
    deliveryUserId: target.deliveryUserId,
    bundle: null,
  }))
}

/**
 * Full DM fanout target list including the sender's own sibling devices.
 *
 * For a send by Alice's desktop to Bob, this returns:
 *   - One entry per (trusted) device of Bob's account (peer fanout)
 *   - One entry per (trusted) device of Alice's account *except* this one
 *     (own-sibling fanout, so Alice's phone sees its own copy and decrypts
 *      it independently — no sibling-channel plaintext forward needed)
 *
 * Each (own_device, recipient_device) pair runs its own X3DH+DR session.
 * Compromise of one device's keys does not expose any other device's
 * sessions, and there is no per-account shared symmetric secret.
 *
 * @param {string} ownUserId  this account's user id (sender's account)
 * @param {string} peerUserId the conversation partner's user id
 * @param {string} ownDeviceId  this device's id (excluded from sibling list)
 * @returns {Promise<Array>}  fanout targets
 */
export async function buildDmFanoutTargetsIncludingSiblings(ownUserId, peerUserId, ownDeviceId) {
  const out = []
  const peerTargets = await buildDmFanoutTargets(peerUserId)
  for (const t of peerTargets) out.push(t)

  if (!ownUserId || ownUserId === peerUserId) return out

  const raw = await deviceService.listDevices(ownUserId).catch(() => null)
  const siblingDevices = Array.isArray(raw) ? raw : (raw?.devices ?? [])
  for (const device of siblingDevices) {
    if (!device?.deviceId) continue
    if (ownDeviceId && String(device.deviceId) === String(ownDeviceId)) continue
    const isPrimaryUserDevice =
      device.isPrimary || String(device.deviceUserId) === String(ownUserId)
    const deliveryUserId = isPrimaryUserDevice
      ? String(ownUserId)
      : String(device.deviceUserId || '')
    if (!deliveryUserId) continue
    out.push({
      sessionTargetId: deliveryUserId,
      peerDeviceId: device.deviceId,
      peerDeviceUserId: isPrimaryUserDevice ? null : deliveryUserId,
      peerUserId: deliveryUserId,
      deliveryUserId,
      bundle: null,
    })
  }
  return out
}

/**
 * Receive-side: look up the sender's per-device public identity material by
 * (senderUserId, senderDeviceId/deviceUserId). Uses the non-OPK-consuming identities
 * endpoint. Returns null if no matching device is found or if the bundle's
 * deviceAuthorizationSignature fails verification against the user's primary
 * IK_Ed25519.
 *
 * @param {string} senderUserId
 * @param {string} senderDeviceId
 * @returns {Promise<object|null>}
 */
export async function lookupSenderDevicePub(
  senderUserId,
  senderDeviceId,
  senderDeviceUserId = null
) {
  if (!senderUserId || (!senderDeviceId && !senderDeviceUserId)) return null
  const raw = await deviceService.getDeviceIdentities(senderUserId).catch(() => null)
  const identities = Array.isArray(raw) ? raw : (raw?.identities ?? [])
  if (!Array.isArray(identities) || identities.length === 0) return null
  const trusted = filterTrustedDeviceBundles(identities)
  return (
    trusted.find(
      (b) =>
        (senderDeviceUserId && String(b.deviceUserId) === String(senderDeviceUserId)) ||
        (senderDeviceId && String(b.deviceId) === String(senderDeviceId))
    ) ?? null
  )
}
