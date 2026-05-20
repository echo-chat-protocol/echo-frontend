/**
 * Per-device MLS leaves (item 5).
 *
 * When a user is added to a group, every one of their devices joins as its
 * own leaf with its own signing key — never sharing a leaf signing private
 * across devices. The UI groups leaves by parentUserId so the user still
 * sees a single "Bob" in the roster.
 *
 * This module exposes the lookup primitives needed by commitFlow:
 *   - getPerDeviceAddTargets(userId) — fans a logical "add user" into a list
 *     of per-device add targets, one entry per trusted device.
 *   - getOwnDeviceBundleForGroupJoin() — returns this device's own bundle in
 *     the same shape, for use when joining a group as a secondary device.
 *
 * Wire-up (deferred for a focused follow-up):
 *   - commitFlow.js Add proposal generation calls getPerDeviceAddTargets and
 *     emits one Add per returned target. Roster ends with N leaves per user.
 *   - When the primary becomes aware of a freshly synced secondary, it
 *     iterates every group it's in and issues a Commit with N Add proposals
 *     (one per device of every member that hasn't yet been mapped per-device,
 *     or just one Add for the new secondary if every other member is already
 *     per-device).
 *   - GroupHeader/GroupChat UI groups roster entries by parentUserId for
 *     display so the user count UX is unchanged.
 */

import { deviceService } from '@/features/devices/deviceService'
import {
  filterTrustedDeviceBundles,
  ensureDeviceIKPubs,
  loadDeviceSPKPrivate,
  loadDeviceAuthorizationSignature,
} from '@/features/devices/deviceKeyBundle'

/**
 * Resolve all trusted per-device bundles for `userId` and shape them as Add
 * targets for the commit flow. Untrusted secondaries (bad auth_sig) are
 * dropped — the server cannot splice in fake siblings as group members.
 *
 * @param {string} userId
 * @returns {Promise<Array>} per-device add targets, primary first
 */
export async function getPerDeviceAddTargets(userId) {
  if (!userId) return []
  const raw = await deviceService.getDeviceBundles(userId).catch(() => null)
  const bundles = Array.isArray(raw) ? raw : (raw?.bundles ?? [])
  if (!Array.isArray(bundles) || bundles.length === 0) return []
  const trusted = await filterTrustedDeviceBundles(bundles)
  return trusted.map((b) => ({
    parentUserId: userId,
    deviceId: b.deviceId,
    deviceUserId: b.deviceUserId,
    isPrimary: Boolean(b.isPrimary),
    publicIdentityKeyX25519: b.publicIdentityKeyX25519,
    publicIdentityKeyEd25519: b.publicIdentityKeyEd25519,
    signedPreKey: b.signedPreKey,
    signedPreKeySignature: b.signedPreKeySignature,
    signedPreKeyId: b.signedPreKeyId,
    deviceAuthorizationSignature: b.deviceAuthorizationSignature,
    opk: b.opk,
  }))
}

/**
 * Resolve this device's own per-device bundle for use when joining a group.
 * Used by the secondary device immediately after sync to construct its own
 * leaf in groups the primary is committing it into.
 *
 * Returns only the public material the group commit flow needs to place a
 * leaf — the matching private SPK stays in localStorage and is accessed
 * separately when this device performs MLS operations.
 *
 * @returns {Promise<object | null>}
 */
export async function getOwnDeviceBundleForGroupJoin() {
  const ikPubs = await ensureDeviceIKPubs()
  const spk = loadDeviceSPKPrivate()
  if (!spk?.pub) return null
  return {
    publicIdentityKeyX25519: ikPubs.pubX25519,
    publicIdentityKeyEd25519: ikPubs.pubEd25519,
    signedPreKey: spk.pub,
    deviceAuthorizationSignature: loadDeviceAuthorizationSignature(),
  }
}

/**
 * Group an MLS roster (array of leaves) by parentUserId for UI display.
 * Each entry in the result is { parentUserId, leaves: [...] }. Display code
 * shows one entry per user and aggregates per-device leaves under it.
 *
 * @param {Array<{ parentUserId: string }>} leaves
 * @returns {Array<{ parentUserId: string, leaves: Array }>}
 */
export function groupRosterByUser(leaves) {
  const byUser = new Map()
  for (const leaf of leaves || []) {
    const k = leaf?.parentUserId
    if (!k) continue
    if (!byUser.has(k)) byUser.set(k, [])
    byUser.get(k).push(leaf)
  }
  return Array.from(byUser.entries()).map(([parentUserId, entries]) => ({
    parentUserId,
    leaves: entries,
  }))
}
