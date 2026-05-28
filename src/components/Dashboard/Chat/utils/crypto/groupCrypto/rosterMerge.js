import { leafNode } from './treemath.js'
import { normalizeRoster } from './treeState.js'

/**
 * Merge account-level membership (one row per user from the server) into the
 * local MLS roster (one leaf per device). Drops leaves for users no longer on
 * the server; keeps all device leaves for users still present.
 */
export function mergeAccountRosterIntoMlsRoster({ localRoster, accountRoster }) {
  const normalizedLocal = normalizeRoster(localRoster)
  const normalizedAccount = normalizeRoster(accountRoster)
  if (normalizedLocal.length === 0) return normalizedAccount
  if (normalizedAccount.length === 0) return []

  const activeUserIds = new Set(
    normalizedAccount.map((member) => String(member?.userId ?? '')).filter(Boolean)
  )
  const accountMemberByUserId = new Map(
    normalizedAccount
      .filter((member) => member?.userId)
      .map((member) => [String(member.userId), member])
  )

  const merged = normalizedLocal
    .filter((member) => activeUserIds.has(String(member?.userId ?? '')))
    .map((member) => {
      const accountMember = accountMemberByUserId.get(String(member.userId))
      return {
        ...member,
        username: accountMember?.username ?? member?.username ?? 'Member',
      }
    })

  for (const accountMember of normalizedAccount) {
    const accountUserId = String(accountMember?.userId ?? '')
    if (!accountUserId) continue
    const alreadyRepresented = merged.some(
      (member) => String(member?.userId ?? '') === accountUserId
    )
    if (alreadyRepresented) continue
    merged.push(accountMember)
  }

  return merged
    .filter((member) => Number.isInteger(member?.leafIndex))
    .sort((a, b) => a.leafIndex - b.leafIndex)
}

/**
 * Resolve this device's own leaf index when multiple leaves share the same
 * parent userId (per-device MLS membership).
 */
export function resolveDeviceAwareSelfLeafIndex({
  selfUserId,
  currentSelfLeafIndex = null,
  roster = [],
  treeNodes = [],
} = {}) {
  const normalizedRoster = normalizeRoster(roster)
  const userIdStr = String(selfUserId ?? '')
  let fallbackCurrentLeafIndex = null
  let deviceMlsPub = null
  try {
    if (typeof localStorage !== 'undefined') {
      deviceMlsPub = localStorage.getItem('echo-device-mls-pub')
    }
  } catch {
    /* ignore */
  }

  if (Number.isInteger(currentSelfLeafIndex)) {
    const currentLeafStillPresent = normalizedRoster.some(
      (member) => member.leafIndex === currentSelfLeafIndex && String(member.userId) === userIdStr
    )
    if (currentLeafStillPresent) {
      fallbackCurrentLeafIndex = currentSelfLeafIndex
      // On multi-device accounts, only trust the carried selfLeafIndex when the
      // leaf node still matches this device's MLS public key.
      if (deviceMlsPub && Array.isArray(treeNodes) && treeNodes.length > 0) {
        const currentNode = treeNodes[leafNode(currentSelfLeafIndex)]
        if (currentNode?.publicKeyB64 === deviceMlsPub) return currentSelfLeafIndex
      } else {
        return currentSelfLeafIndex
      }
    }
  }

  if (deviceMlsPub && Array.isArray(treeNodes) && treeNodes.length > 0) {
    for (const member of normalizedRoster) {
      if (!Number.isInteger(member?.leafIndex) || String(member.userId) !== userIdStr) continue
      const nodeIndex = leafNode(member.leafIndex)
      const node = treeNodes[nodeIndex]
      if (node?.publicKeyB64 === deviceMlsPub) return member.leafIndex
    }
  }

  const ownLeaves = normalizedRoster.filter(
    (member) => Number.isInteger(member?.leafIndex) && String(member.userId) === userIdStr
  )
  if (ownLeaves.length === 1) {
    // Re-add flows can temporarily carry incomplete tree/public-key snapshots.
    // If this account has exactly one active leaf in roster, that leaf is safe
    // to use even before the tree-node key match resolves.
    return ownLeaves[0].leafIndex
  }

  // Removal/re-add churn can temporarily leave tree public keys out of sync with
  // the roster snapshot. If our previously persisted leaf still exists in roster,
  // keep it to avoid dropping this device into a send-blocked null selfLeafIndex.
  if (Number.isInteger(fallbackCurrentLeafIndex)) {
    return fallbackCurrentLeafIndex
  }

  // Do not fall back to the first leaf for this userId: on multi-device accounts
  // that would bind this device to a sibling's MLS leaf and break commits/sends.
  return null
}
