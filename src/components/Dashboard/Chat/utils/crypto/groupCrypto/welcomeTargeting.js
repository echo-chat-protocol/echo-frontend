/**
 * Guards for MLS Welcome delivery on multi-device accounts.
 */

export function isGroupWelcomeForThisDevice(welcome) {
  if (!welcome || typeof welcome !== 'object') return false
  const thisDeviceId = localStorage.getItem('echo-device-id')
  const targetClientId = welcome.recipientClientId ?? null
  if (targetClientId !== null) {
    // Mobile can briefly process welcomes before device-id hydration finishes.
    // In that window, allow processing attempts; processWelcome will still
    // cryptographically reject welcomes encrypted to a different device key.
    if (!thisDeviceId) return true
    return targetClientId === thisDeviceId
  }
  // Legacy welcomes without recipientClientId: only this device should attempt
  // unwrap (processWelcome fails on the wrong init key).
  return true
}

export function shouldApplyGroupWelcome(existing, welcome, options = {}) {
  if (!welcome || typeof welcome !== 'object') return false
  if (!isGroupWelcomeForThisDevice(welcome)) return false

  const incomingEpoch = Number.isInteger(welcome?.epoch) ? welcome.epoch : 0
  const existingEpoch = Number.isInteger(existing?.epoch) ? existing.epoch : -1
  const hasMaterial = Boolean(existing?.applicationSecretB64 || existing?.groupKeyB64)

  if (options.forceBaseline === true) {
    // Catch-up recovery: re-apply a device welcome to rebuild transcript + epoch
    // secrets, then replay commits. Allow newer welcomes (re-add) as well.
    return true
  }

  if (hasMaterial && existingEpoch > incomingEpoch) return false
  if (hasMaterial && existingEpoch === incomingEpoch) return false

  return true
}

export function shouldEmitGroupJoinedSystemMessage(existing, welcome) {
  if (!welcome || typeof welcome !== 'object') return false

  const incomingEpoch = Number.isInteger(welcome?.epoch) ? welcome.epoch : 0
  const hadMaterial = Boolean(existing?.applicationSecretB64 || existing?.groupKeyB64)
  const existingEpoch = Number.isInteger(existing?.epoch) ? existing.epoch : -1
  const leftAtEpoch = Number.isInteger(existing?.leftAtEpoch) ? existing.leftAtEpoch : null

  if (Number.isInteger(leftAtEpoch) && incomingEpoch >= leftAtEpoch) return true
  if (!hadMaterial && existingEpoch < incomingEpoch) return true
  return false
}

export function buildGroupJoinedMessageId(groupId, welcome) {
  const epoch = Number.isInteger(welcome?.epoch) ? welcome.epoch : 0
  const leaf = Number.isInteger(welcome?.recipientLeafIndex) ? welcome.recipientLeafIndex : 'x'
  return `group-joined:${String(groupId)}:${epoch}:${leaf}`
}
