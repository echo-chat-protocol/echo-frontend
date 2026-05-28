import { getIdentityKeys } from '../../chat/keyManagement'
import { applyCommit, loadGroupState, processWelcome, saveGroupState } from '../groupCryptoProvider'
import { requestSiblingGroupMlsBootstrap } from './deviceGroupLeaves'
import { isGroupWelcomeForThisDevice, shouldApplyGroupWelcome } from './welcomeTargeting'
import { resolveProcessWelcomeOptions } from '@/features/devices/mlsDeviceKeyPackage'
import { leafNode } from './treemath.js'

export function parseMlsArtifactPayload(message) {
  if (typeof message?.payload !== 'string' || message.payload.length === 0) return null
  try {
    return JSON.parse(message.payload)
  } catch {
    return null
  }
}

const GROUP_MESSAGE_PAGE_SIZE = 200
// Rank candidate MLS states so a rebuild cannot accidentally regress us.
// A state without usable secrets is unusable for send/decrypt, so any state
// WITH secrets always beats a state without. Among states in the same usability
// class, the higher epoch wins.
function scoreMlsState(state) {
  if (!state) return -1
  const epoch = Number.isInteger(state.epoch) ? state.epoch : -1
  const hasSecrets = state.initSecretB64 && state.applicationSecretB64 ? 1 : 0
  return hasSecrets * 1_000_000 + epoch
}

export function pickBetterState(current, candidate) {
  return scoreMlsState(candidate) > scoreMlsState(current) ? candidate : current
}

// Dedup the "Strict replay after transcript rebuild failed" warning so a
// single unrecoverable historic commit doesn't flood the console every time
// catch-up runs.
const loggedRebuildErrors = new Set()

const isTranscriptMismatchError = (err) =>
  /transcript hash mismatch/i.test(String(err?.message ?? err ?? ''))
const isConfirmationTagMismatchError = (err) =>
  /confirmation tag mismatch/i.test(String(err?.message ?? err ?? ''))
const isSelfAuthoredReplayError = (err) =>
  /commit authored by this account on another device/i.test(String(err?.message ?? err ?? ''))
const isEpochSecretsDriftError = (err) =>
  isTranscriptMismatchError(err) || isConfirmationTagMismatchError(err)
const isInvalidSignatureError = (err) =>
  /(welcome signature invalid|signature invalid)/i.test(String(err?.message ?? err ?? ''))
const invalidArtifactKeys = new Set()
const MAX_INVALID_ARTIFACT_KEYS = 500

function rememberInvalidArtifactKey(key) {
  if (!key) return
  if (invalidArtifactKeys.size >= MAX_INVALID_ARTIFACT_KEYS) {
    const first = invalidArtifactKeys.values().next().value
    if (first) invalidArtifactKeys.delete(first)
  }
  invalidArtifactKeys.add(key)
}

function buildArtifactKey(groupId, message, contentType) {
  const gid = String(groupId ?? '')
  const seq = Number.isInteger(message?.seq) ? message.seq : 'x'
  const id = String(message?._id ?? '')
  return `${gid}:${contentType}:${seq}:${id}`
}

/** Paginate group history — required so early commits/welcomes are not dropped. */
export async function fetchAllGroupMessages(socket, groupId, pageSize = GROUP_MESSAGE_PAGE_SIZE) {
  const gid = String(groupId ?? '')
  if (!socket || !gid) return []

  const all = []
  let beforeSeq = null
  let pages = 0
  const maxPages = 100

  while (pages < maxPages) {
    pages += 1
    const payload = { groupId: gid, limit: pageSize }
    if (Number.isInteger(beforeSeq)) payload.beforeSeq = beforeSeq

    const res = await new Promise((resolve) => {
      socket.emit('fetchGroupMessages', payload, resolve)
    })
    if (!res?.success || !Array.isArray(res.messages) || res.messages.length === 0) break

    const batch = res.messages
    all.unshift(...batch)
    const oldestSeq = batch[0]?.seq
    if (!Number.isInteger(oldestSeq) || batch.length < pageSize) break
    beforeSeq = oldestSeq
  }

  return all
}

/** Prefer the tree-stored init private key for the local leaf when replaying commits. */
export function resolveMyInitPrivKeyB64(state, fallbackPriv) {
  if (!state || !Number.isInteger(state.selfLeafIndex)) return fallbackPriv
  const nodeIdx = leafNode(state.selfLeafIndex)
  const treePriv = state?.tree?.nodes?.[nodeIdx]?.privateKeyB64
  if (typeof treePriv === 'string' && treePriv.length > 0) return treePriv
  return fallbackPriv
}

/**
 * Apply stored commits/welcomes until no more progress. Remove→re-add and
 * multi-device adds emit several commits; a single linear pass misses later
 * epochs when an earlier commit was skipped.
 */
export async function applyMlsArtifactsMultiPass({
  groupId,
  userId,
  messages,
  initialState,
  myInitPrivKeyB64,
  strict = false,
  onCommitError = null,
}) {
  if (!initialState || !groupId) return initialState

  const sorted = [...(Array.isArray(messages) ? messages : [])].sort((a, b) => {
    const seqA = Number.isInteger(a?.seq) ? a.seq : Number.MAX_SAFE_INTEGER
    const seqB = Number.isInteger(b?.seq) ? b.seq : Number.MAX_SAFE_INTEGER
    return seqA - seqB
  })

  let state = initialState
  let progress = true
  let rounds = 0
  const maxRounds = Math.max(sorted.length + 2, 8)
  const loggedCommitErrors = new Set()

  while (progress && rounds < maxRounds) {
    progress = false
    rounds += 1

    for (const message of sorted) {
      if (message?.contentType === 'commit') {
        const artifactKey = buildArtifactKey(groupId, message, 'commit')
        if (invalidArtifactKeys.has(artifactKey)) continue
        const commit = parseMlsArtifactPayload(message)
        if (!commit) continue
        if (Number.isInteger(state.epoch) && commit.epoch <= state.epoch) continue
        if (Number.isInteger(state.epoch) && commit.epoch !== state.epoch + 1) continue

        try {
          state = await applyCommit({
            state,
            commit,
            myInitPrivKeyB64: resolveMyInitPrivKeyB64(state, myInitPrivKeyB64),
          })
          progress = true
        } catch (err) {
          onCommitError?.({ err, commit, state, groupId })
          if (isSelfAuthoredReplayError(err)) {
            // Expected on sibling-device replay; mark as invalid so we don't
            // retry it every pass and don't log it.
            rememberInvalidArtifactKey(artifactKey)
            continue
          }
          if (strict) throw err
          if (isInvalidSignatureError(err)) {
            rememberInvalidArtifactKey(artifactKey)
          }
          const logKey = `${commit?.epoch ?? 'x'}:${String(err?.message ?? err ?? '')}`
          if (!loggedCommitErrors.has(logKey)) {
            loggedCommitErrors.add(logKey)
            console.warn('[MLS] Catch-up commit application failed:', err)
          }
        }
        continue
      }

      if (message?.contentType === 'welcome') {
        const artifactKey = buildArtifactKey(groupId, message, 'welcome')
        if (invalidArtifactKeys.has(artifactKey)) continue
        const welcome = parseMlsArtifactPayload(message)
        if (!welcome || String(welcome.recipientUserId ?? '') !== String(userId)) continue
        if (!isGroupWelcomeForThisDevice(welcome)) continue
        if (!shouldApplyGroupWelcome(state, welcome)) continue

        try {
          state = await processWelcome({
            welcome,
            selfUserId: userId,
            ...resolveProcessWelcomeOptions({ userId, myInitPrivKeyB64 }),
          })
          progress = true
        } catch (err) {
          if (strict) throw err
          if (isInvalidSignatureError(err)) {
            rememberInvalidArtifactKey(artifactKey)
          }
          const logKey = `welcome:${welcome?.epoch ?? 'x'}:${String(err?.message ?? err ?? '')}`
          if (!loggedCommitErrors.has(logKey)) {
            loggedCommitErrors.add(logKey)
            console.warn('[MLS] Catch-up welcome application failed:', err)
          }
        }
      }
    }
  }

  if (state !== initialState) {
    await saveGroupState(groupId, state)
  }

  return state
}

async function replayFromDeviceWelcome({
  groupId,
  userId,
  messages,
  myInitPrivKeyB64,
  forceBaseline = false,
}) {
  // Always prefer the LATEST welcome targeted at this device. On accounts that
  // have piled up multiple device leaves (sibling syncs over time), older
  // welcomes drop us back to a long-dead leaf and trigger an unwinnable cascade
  // of "self-authored commit cannot be replayed" failures. The newest welcome
  // reflects the most recent leaf this device legitimately holds keys for.
  const welcomes = [...(Array.isArray(messages) ? messages : [])]
    .filter((message) => message?.contentType === 'welcome')
    .sort((a, b) => {
      const welcomeA = parseMlsArtifactPayload(a)
      const welcomeB = parseMlsArtifactPayload(b)
      const epochA = Number.isInteger(welcomeA?.epoch) ? welcomeA.epoch : 0
      const epochB = Number.isInteger(welcomeB?.epoch) ? welcomeB.epoch : 0
      if (epochA !== epochB) return epochB - epochA
      const seqA = Number.isInteger(a?.seq) ? a.seq : -1
      const seqB = Number.isInteger(b?.seq) ? b.seq : -1
      return seqB - seqA
    })

  for (const message of welcomes) {
    const artifactKey = buildArtifactKey(groupId, message, 'welcome')
    if (invalidArtifactKeys.has(artifactKey)) continue
    const welcome = parseMlsArtifactPayload(message)
    if (!welcome || String(welcome.recipientUserId ?? '') !== String(userId)) continue
    if (!isGroupWelcomeForThisDevice(welcome)) continue

    const existing = await loadGroupState(groupId).catch(() => null)
    if (!shouldApplyGroupWelcome(existing, welcome, { forceBaseline })) continue

    try {
      let state = await processWelcome({
        welcome,
        selfUserId: userId,
        ...resolveProcessWelcomeOptions({ userId, myInitPrivKeyB64 }),
      })
      state = await applyMlsArtifactsMultiPass({
        groupId,
        userId,
        messages,
        initialState: state,
        myInitPrivKeyB64,
      })
      await saveGroupState(groupId, state)
      return state
    } catch (err) {
      if (isInvalidSignatureError(err)) {
        rememberInvalidArtifactKey(artifactKey)
      }
      console.warn('[MLS] Welcome baseline replay failed:', err)
    }
  }

  return null
}

/**
 * Apply server-stored welcomes addressed to this device (required before a
 * synced sibling can decrypt or send in groups it joined on another device).
 */
export async function fetchAndApplyPendingWelcomes({ socket, userId, groupId = null }) {
  if (!socket || !userId) return null

  const res = await new Promise((resolve) => {
    socket.emit('fetchPendingWelcomes', {}, resolve)
  })
  if (!res?.success || !Array.isArray(res.welcomes)) return null

  const identityKeys = await getIdentityKeys()
  const myInitPrivKeyB64 =
    localStorage.getItem('echo-device-mls-priv') || identityKeys?.privateKeyX25519 || null
  if (!myInitPrivKeyB64) return null

  const focusGid = groupId ? String(groupId) : null
  let focused = null

  for (const item of res.welcomes) {
    const gid = String(item.groupId ?? '')
    const welcome = item.welcome
    if (!gid || !welcome) continue
    const pendingWelcomeKey = `${gid}:pending-welcome:${
      Number.isInteger(welcome?.epoch) ? welcome.epoch : 'x'
    }:${String(welcome?.recipientClientId ?? '')}`
    if (invalidArtifactKeys.has(pendingWelcomeKey)) continue
    if (focusGid && gid !== focusGid) continue
    if (!isGroupWelcomeForThisDevice(welcome)) continue

    const existing = await loadGroupState(gid).catch(() => null)
    const needsFirstWelcome = !existing?.initSecretB64
    if (!needsFirstWelcome && !shouldApplyGroupWelcome(existing, welcome)) continue

    try {
      let state = await processWelcome({
        welcome,
        selfUserId: userId,
        ...resolveProcessWelcomeOptions({ userId, myInitPrivKeyB64 }),
      })
      state = await saveGroupState(gid, state)
      state = await finalizeLocalMlsState(gid, state, userId)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('groupStateSynced', { detail: { groupId: gid } }))
      }
      if (!focusGid || gid === focusGid) focused = state
    } catch (err) {
      if (isInvalidSignatureError(err)) {
        rememberInvalidArtifactKey(pendingWelcomeKey)
        // Stale or malformed pending welcomes can be retained server-side after
        // remove/leave churn. If local MLS material is already ready, ignore the
        // bad welcome so this group doesn't get stuck behind a noisy retry loop.
        const hasReadyMaterial = Boolean(
          existing?.initSecretB64 && (existing?.applicationSecretB64 || existing?.groupKeyB64)
        )
        if (hasReadyMaterial) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('groupStateSynced', { detail: { groupId: gid } }))
          }
          continue
        }
      }
      console.warn('[MLS] Pending welcome application failed:', err)
    }
  }

  if (focused) return focused
  return focusGid ? await loadGroupState(focusGid).catch(() => null) : null
}

/**
 * Bring one group's MLS state to readiness on this device: sibling envelopes,
 * pending welcomes, request a device-leaf add on the account primary, then replay commits.
 */
export async function bootstrapGroupMlsOnDevice({
  socket,
  groupId,
  userId,
  targetEpoch = null,
  limit = 250,
}) {
  const gid = String(groupId ?? '')
  if (!socket || !gid || !userId) return null

  try {
    const { processIncomingEnvelopes } = await import('@/utils/deviceForward')
    await processIncomingEnvelopes(userId).catch(() => {})
  } catch {
    /* ignore */
  }

  await fetchAndApplyPendingWelcomes({ socket, userId, groupId: gid })

  let state = await loadGroupState(gid).catch(() => null)
  if (!state?.initSecretB64) {
    await requestSiblingGroupMlsBootstrap(socket, gid)
  }

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('echo-request-device-leaf-sweep'))
    }
  } catch {
    /* ignore */
  }

  // Primary may still be publishing the add+Welcome for this device leaf.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    state = await loadGroupState(gid).catch(() => null)
    if (state?.initSecretB64) break
    if (attempt > 0 && attempt % 4 === 0) {
      await requestSiblingGroupMlsBootstrap(socket, gid)
    }
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    await fetchAndApplyPendingWelcomes({ socket, userId, groupId: gid })
  }

  state = await catchUpGroupMlsFromServer({ socket, groupId: gid, userId, targetEpoch, limit })
  if (state?.initSecretB64 && state?.applicationSecretB64) return state

  return loadGroupState(gid).catch(() => state)
}

export async function catchUpGroupMlsFromServer({
  socket,
  groupId,
  userId,
  targetEpoch = null,
  limit = 250,
}) {
  const gid = String(groupId ?? '')
  if (!socket || !gid || !userId) return null

  let state = await loadGroupState(gid).catch(() => null)

  if (!state?.initSecretB64) {
    await fetchAndApplyPendingWelcomes({ socket, userId, groupId: gid })
    state = await loadGroupState(gid).catch(() => null)
  }

  if (!state?.initSecretB64) {
    await requestSiblingGroupMlsBootstrap(socket, gid)
    await fetchAndApplyPendingWelcomes({ socket, userId, groupId: gid })
    state = await loadGroupState(gid).catch(() => null)
  }

  if (!state?.initSecretB64) return state

  const messages = await fetchAllGroupMessages(
    socket,
    gid,
    Math.min(limit, GROUP_MESSAGE_PAGE_SIZE)
  )

  const identityKeys = await getIdentityKeys()
  const myInitPrivKeyB64 =
    localStorage.getItem('echo-device-mls-priv') || identityKeys?.privateKeyX25519 || null
  if (!myInitPrivKeyB64) return state

  let sawEpochSecretsDrift = false
  state = await applyMlsArtifactsMultiPass({
    groupId: gid,
    userId,
    messages,
    initialState: state,
    myInitPrivKeyB64,
    onCommitError: ({ err }) => {
      if (isEpochSecretsDriftError(err)) sawEpochSecretsDrift = true
    },
  })

  if (sawEpochSecretsDrift) {
    // Capture the pre-rebuild state. If our welcome history can only land us at
    // an older epoch (e.g., on a single-welcome account that authored later
    // commits whose secrets it cannot reproduce), the rebuild must NOT clobber
    // a more advanced live state.
    const preRebuildState = state
    const driftLogKey = `drift:${gid}:${state?.epoch ?? '?'}`
    if (!loggedRebuildErrors.has(driftLogKey)) {
      loggedRebuildErrors.add(driftLogKey)
      console.warn(
        `[MLS] Epoch secret drift detected for ${gid}; rebuilding from device Welcome baseline`
      )
    }
    const rebuilt = await replayFromDeviceWelcome({
      groupId: gid,
      userId,
      messages,
      myInitPrivKeyB64,
      forceBaseline: true,
    })
    if (rebuilt) {
      let candidate = rebuilt
      try {
        candidate = await applyMlsArtifactsMultiPass({
          groupId: gid,
          userId,
          messages,
          initialState: rebuilt,
          myInitPrivKeyB64,
          strict: true,
        })
      } catch (err) {
        const logKey = `strict-rebuild:${gid}:${String(err?.message ?? err ?? '')}`
        if (!loggedRebuildErrors.has(logKey)) {
          loggedRebuildErrors.add(logKey)
          console.warn('[MLS] Strict replay after transcript rebuild failed:', err)
        }
        candidate = rebuilt
      }
      const picked = pickBetterState(preRebuildState, candidate)
      if (picked !== preRebuildState) {
        console.warn(
          `[MLS] Rebuilt MLS state for ${gid} from welcome baseline (epoch ${picked?.epoch ?? '?'})`
        )
      }
      state = picked
    }
  }

  if (
    Number.isInteger(targetEpoch) &&
    Number.isInteger(state?.epoch) &&
    state.epoch < targetEpoch
  ) {
    const preCatchUpState = state
    const rebuilt = await replayFromDeviceWelcome({
      groupId: gid,
      userId,
      messages,
      myInitPrivKeyB64,
      forceBaseline: true,
    })
    if (rebuilt) {
      state = pickBetterState(preCatchUpState, rebuilt)
    } else if (state?.epoch < targetEpoch) {
      state = await applyMlsArtifactsMultiPass({
        groupId: gid,
        userId,
        messages,
        initialState: state,
        myInitPrivKeyB64,
      })
    }
  }

  if (
    Number.isInteger(targetEpoch) &&
    Number.isInteger(state?.epoch) &&
    state.epoch < targetEpoch
  ) {
    const behindKey = `behind:${gid}:${state.epoch}->${targetEpoch}`
    if (!loggedRebuildErrors.has(behindKey)) {
      loggedRebuildErrors.add(behindKey)
      console.warn(
        `[MLS] Group ${gid} still at epoch ${state.epoch} after catch-up (target ${targetEpoch})`
      )
    }
  }

  return finalizeLocalMlsState(gid, state, userId)
}

/** Re-derive epoch secrets from server commits when decrypt fails at the right epoch. */
export async function rebuildMlsStateForDecryptFailure({
  socket,
  groupId,
  userId,
  targetEpoch = null,
}) {
  const gid = String(groupId ?? '')
  if (!socket || !gid || !userId) return null

  await fetchAndApplyPendingWelcomes({ socket, userId, groupId: gid })

  const identityKeys = await getIdentityKeys()
  const myInitPrivKeyB64 =
    localStorage.getItem('echo-device-mls-priv') || identityKeys?.privateKeyX25519 || null
  if (!myInitPrivKeyB64) return null

  const messages = await fetchAllGroupMessages(socket, gid)

  let state = null
  try {
    state = await replayFromDeviceWelcome({
      groupId: gid,
      userId,
      messages,
      myInitPrivKeyB64,
      forceBaseline: true,
    })
    if (state) {
      state = await applyMlsArtifactsMultiPass({
        groupId: gid,
        userId,
        messages,
        initialState: state,
        myInitPrivKeyB64,
        strict: true,
      })
    }
  } catch (err) {
    console.warn('[MLS] Strict welcome+commit rebuild failed:', err)
    state = null
  }

  if (!state?.applicationSecretB64) {
    state = await catchUpGroupMlsFromServer({
      socket,
      groupId: gid,
      userId,
      targetEpoch,
    })
  }

  if (
    state?.applicationSecretB64 &&
    Number.isInteger(targetEpoch) &&
    Number.isInteger(state?.epoch) &&
    state.epoch < targetEpoch
  ) {
    console.warn(
      `[MLS] Rebuild for ${gid} at epoch ${state.epoch} still below message epoch ${targetEpoch}`
    )
  }

  return finalizeLocalMlsState(gid, state, userId)
}

export async function fetchGroupServerEpoch(socket, groupId, options = {}) {
  const gid = String(groupId ?? '')
  if (!socket || !gid) return null

  const attempts = Number.isInteger(options.attempts) ? options.attempts : 3
  const timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : 8000

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const res = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), timeoutMs)
      socket.emit('openGroup', { groupId: gid }, (payload) => {
        clearTimeout(timeout)
        resolve(payload)
      })
    })
    if (res?.success) {
      return Number.isInteger(res.group?.epoch) ? res.group.epoch : 0
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }

  return null
}

/**
 * Align local MLS state with the server's current group epoch before sending.
 * groupMeta alone can lag when commits arrived on another device/tab.
 */
export async function prepareGroupMlsForSend({ socket, groupId, userId, currentState = null }) {
  const gid = String(groupId ?? '')
  if (!socket || !gid || !userId) {
    return { state: currentState, serverEpoch: null }
  }

  let state = currentState ?? (await loadGroupState(gid).catch(() => null))
  const serverEpoch = await fetchGroupServerEpoch(socket, gid)

  const needsBootstrap =
    !state?.initSecretB64 ||
    !state?.applicationSecretB64 ||
    !Number.isInteger(state?.selfLeafIndex) ||
    !Number.isInteger(state?.epoch) ||
    (Number.isInteger(serverEpoch) && state.epoch < serverEpoch)

  if (Number.isInteger(serverEpoch)) {
    // Always replay server commits before sending when we know the live epoch.
    const caught = needsBootstrap
      ? await bootstrapGroupMlsOnDevice({
          socket,
          groupId: gid,
          userId,
          targetEpoch: serverEpoch,
        })
      : await catchUpGroupMlsFromServer({
          socket,
          groupId: gid,
          userId,
          targetEpoch: serverEpoch,
        })
    if (caught?.applicationSecretB64) {
      state = await finalizeLocalMlsState(gid, caught, userId)
      await saveGroupState(gid, state)
    }
  } else {
    // Server epoch unknown (slow mobile openGroup) — still attempt catch-up from history.
    const caught = needsBootstrap
      ? await bootstrapGroupMlsOnDevice({ socket, groupId: gid, userId })
      : await catchUpGroupMlsFromServer({ socket, groupId: gid, userId })
    if (caught?.applicationSecretB64) {
      state = await finalizeLocalMlsState(gid, caught, userId)
      await saveGroupState(gid, state)
    }
  }

  state = await finalizeLocalMlsState(gid, state, userId)

  // When state is AHEAD of the server, we likely picked up a commit through
  // device-forward / live broadcast a tick before the server's openGroup read
  // reflected the new epoch. Re-poll briefly so a real race resolves itself
  // instead of throwing — failing here strands a sibling that already applied
  // the commit correctly. Only the genuine "still ahead after retries" case
  // is reported, and the message no longer mislabels every mismatch as
  // "behind".
  let effectiveServerEpoch = serverEpoch
  if (
    Number.isInteger(effectiveServerEpoch) &&
    Number.isInteger(state?.epoch) &&
    state.epoch > effectiveServerEpoch
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
      const refetched = await fetchGroupServerEpoch(socket, gid)
      if (Number.isInteger(refetched) && refetched >= state.epoch) {
        effectiveServerEpoch = refetched
        break
      }
      if (Number.isInteger(refetched)) effectiveServerEpoch = refetched
    }
  }

  if (
    Number.isInteger(effectiveServerEpoch) &&
    Number.isInteger(state?.epoch) &&
    state.epoch !== effectiveServerEpoch
  ) {
    const direction = state.epoch < effectiveServerEpoch ? 'behind' : 'ahead of'
    throw new Error(
      `MLS state epoch ${state.epoch} is ${direction} server epoch ${effectiveServerEpoch} for group ${gid}`
    )
  }

  return {
    state,
    serverEpoch: Number.isInteger(effectiveServerEpoch)
      ? effectiveServerEpoch
      : Number.isInteger(state?.epoch)
        ? state.epoch
        : null,
  }
}

export async function finalizeLocalMlsState(groupId, state, userId) {
  if (!state || !userId || !groupId) return state

  const { resolveDeviceAwareSelfLeafIndex } = await import('./rosterMerge')
  const selfLeafIndex = resolveDeviceAwareSelfLeafIndex({
    selfUserId: userId,
    currentSelfLeafIndex: state.selfLeafIndex,
    roster: state.roster,
    treeNodes: state.tree?.nodes,
  })
  if (!Number.isInteger(selfLeafIndex) || selfLeafIndex === state.selfLeafIndex) {
    return state
  }
  return saveGroupState(groupId, { ...state, selfLeafIndex })
}
