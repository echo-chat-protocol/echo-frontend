import { forwardGroupStateToPairedDevices } from '@/utils/deviceForward'
import { buildAddCommit, loadGroupState, saveGroupState } from '../groupCryptoProvider'

function socketEmitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (ack) => {
      if (ack?.success) resolve(ack)
      else reject(new Error(ack?.error || `Failed to ${event}`))
    })
  })
}

function isBenignMlsEpochError(err) {
  const msg = String(err?.message || err || '')
  return /invalid commit epoch/i.test(msg) || /conflict/i.test(msg) || err?.status === 409
}

async function fetchOwnMlsKeyPackages(socket, userId) {
  return new Promise((resolve) => {
    socket.emit('fetchAllKeyPackages', { userId }, (res) => {
      if (!res?.success || !Array.isArray(res.packages)) {
        resolve([])
        return
      }
      // Require a full KeyPackage with a signing pub key. A bare initKey would
      // make buildAddCommit write the new leaf with leafSigningPubKeyB64=null,
      // which desyncs the treeHash between sender, receivers and the new device
      // (see groupContext.js: identity is folded into the leaf hash whenever
      // both userId and leafSigningPubKey are present). The mobile re-publishes
      // its full KP on Dashboard mount, so siblings should just wait.
      resolve(
        res.packages
          .filter((pkg) => pkg?.keyPackage?.initKeyB64 && pkg?.keyPackage?.leafSigningPubKeyB64)
          .map((pkg) => ({
            userId,
            clientId: pkg.clientId ?? null,
            initKeyB64: pkg.keyPackage.initKeyB64,
            keyPackage: pkg.keyPackage,
          }))
      )
    })
  })
}

/**
 * Ask another online device on this account (with MLS state) to add this
 * device's leaf and publish a targeted Welcome.
 */
export function requestSiblingGroupMlsBootstrap(socket, groupId) {
  const gid = String(groupId ?? '')
  if (!socket || !gid) return Promise.resolve()
  return new Promise((resolve) => {
    socket.emit('requestSiblingGroupMlsBootstrap', { groupId: gid }, () => resolve())
  })
}

/**
 * Add this account's other device leaves to one group when we already hold
 * initSecretB64 (primary / sibling with existing membership).
 */
export async function ensureDeviceLeavesForGroup({ socket, userId, username, groupId }) {
  const gid = String(groupId ?? '')
  if (!socket || !gid || !userId) return false

  let state = await loadGroupState(gid).catch(() => null)
  if (!state?.initSecretB64 || !Array.isArray(state?.roster)) return false

  const packages = await fetchOwnMlsKeyPackages(socket, userId)
  if (packages.length === 0) return false

  // Match by leaf signing pub key (stable per-device identity) instead of the
  // tree node publicKey. Update paths rotate the node publicKey on every
  // commit, so an initKeyB64-based check would re-add already-present devices.
  const leafSigningPubKeys = new Set(
    Object.values(state.tree?.leafData ?? {})
      .map((leaf) => leaf?.leafSigningPubKeyB64)
      .filter((value) => typeof value === 'string' && value.length > 0)
  )
  const thisDeviceId = localStorage.getItem('echo-device-id')
  const seenSigningPubKeys = new Set()
  const missingPackages = packages.filter((pkg) => {
    const signingPubKeyB64 = pkg.keyPackage?.leafSigningPubKeyB64 ?? null
    if (!signingPubKeyB64) return false
    if (leafSigningPubKeys.has(signingPubKeyB64)) return false
    if (pkg.clientId && thisDeviceId && pkg.clientId === thisDeviceId) return false
    if (seenSigningPubKeys.has(signingPubKeyB64)) return false
    seenSigningPubKeys.add(signingPubKeyB64)
    return true
  })
  if (missingPackages.length === 0) return false

  let nextLeafIndex =
    state.roster.reduce(
      (max, member) =>
        Number.isInteger(member?.leafIndex) && member.leafIndex > max ? member.leafIndex : max,
      -1
    ) + 1

  let progressed = false
  for (const pkg of missingPackages) {
    const leafIndex = nextLeafIndex
    nextLeafIndex += 1
    const memberInitKeys = [{ ...pkg, leafIndex }]
    const { commit, welcome, welcomes, nextState } = await buildAddCommit({
      state,
      newMember: { userId, username: username || 'Member', leafIndex },
      memberInitKeys,
    })

    try {
      await socketEmitWithAck(socket, 'sendGroupCommit', { groupId: gid, commit })
    } catch (err) {
      if (isBenignMlsEpochError(err)) {
        state = (await loadGroupState(gid).catch(() => null)) ?? state
        continue
      }
      console.warn('[MLS] sendGroupCommit failed while ensuring device leaves:', err)
      break
    }

    for (const welcomeMessage of (Array.isArray(welcomes) ? welcomes : [welcome]).filter(Boolean)) {
      try {
        await socketEmitWithAck(socket, 'sendGroupWelcome', {
          groupId: gid,
          recipientUserId: welcomeMessage.recipientUserId,
          welcome: welcomeMessage,
        })
      } catch (err) {
        if (!isBenignMlsEpochError(err)) {
          console.warn('[MLS] sendGroupWelcome failed while ensuring device leaves:', err)
        }
      }
    }

    state = await saveGroupState(gid, nextState)
    forwardGroupStateToPairedDevices(userId, gid, state).catch(() => {})
    progressed = true
  }

  return progressed
}
