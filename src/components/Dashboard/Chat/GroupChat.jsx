import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { getSocket } from '../../../socket'
import DisplayText from './MessageDisplay/displayText'
import SendText from './MessageInput/sendText'
import TypingIndicator from './MessageDisplay/TypingIndicator'
import { formatProfileImage } from '../DashboardComponents/utils/helpers'
import {
  upsertTypist,
  removeTypist,
  activeTypists,
  formatTypingText,
  TYPING_TTL_MS,
} from './utils/chat/typing'

import {
  applyCommit,
  createNewGroupState,
  decryptApplicationMessage,
  encryptApplicationMessage,
  loadGroupState,
  saveGroupState,
  processWelcome,
} from './utils/crypto/groupCryptoProvider'

import {
  deletePendingOutgoingGroupMessage,
  getIdentityKeys,
  getSavedMessages,
  setPendingOutgoingGroupMessage,
  storeSavedMessagesBatch,
  updateSavedMessages,
} from './utils/chat/keyManagement'
import {
  decryptIncomingGroupMessage,
  decodeGroupMessagePayload,
  encodeGroupMessagePayload,
} from './utils/chat/groupMessageDecryption'
import {
  forwardGroupStateToPairedDevices,
  processIncomingEnvelopes,
} from '../../../utils/deviceForward'
import {
  isGroupWelcomeForThisDevice,
  shouldApplyGroupWelcome,
} from './utils/crypto/groupCrypto/welcomeTargeting'
import { resolveProcessWelcomeOptions } from '@/features/devices/mlsDeviceKeyPackage'
import {
  prepareGroupMlsForSend,
  fetchGroupServerEpoch,
  bootstrapGroupMlsOnDevice,
  rebuildMlsStateForDecryptFailure,
  resolveMyInitPrivKeyB64,
  pickBetterState,
  fetchAllGroupMessages,
} from './utils/crypto/groupCrypto/groupMlsReplay'
import { mergeAccountRosterIntoMlsRoster } from './utils/crypto/groupCrypto/rosterMerge'

const TEXT_DECODER = new TextDecoder()
const MLS_UNAVAILABLE_TEXT = '[Unable to decrypt message]'
const MLS_KEY_MISSING_REASON = 'MLS state is not ready on this device yet'
const DEFAULT_MLS_CIPHER_SUITE = 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256'
const GROUP_CACHE_PREFIX = 'group:'
const hasGroupKeyMaterial = (state) => Boolean(state?.applicationSecretB64 || state?.groupKeyB64)
const isUsableMlsStateAtEpoch = (state, epoch) =>
  Boolean(
    state &&
    hasGroupKeyMaterial(state) &&
    Number.isInteger(state.selfLeafIndex) &&
    (!Number.isInteger(epoch) || state.epoch === epoch)
  )

const parseMlsHeader = (message) => {
  try {
    if (!message?.headerB64) return null
    const json = TEXT_DECODER.decode(
      Uint8Array.from(atob(message.headerB64), (char) => char.charCodeAt(0))
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

const advanceCachedMessageGeneration = (state, message) => {
  const header = parseMlsHeader(message)
  if (
    !state ||
    !Number.isInteger(header?.senderLeafIndex) ||
    !Number.isInteger(header?.generation)
  ) {
    return state
  }

  const key = String(header.senderLeafIndex)
  const nextGeneration = header.generation + 1
  const currentGeneration = state.senderGenerations?.[key] ?? 0
  if (currentGeneration >= nextGeneration) return state

  return {
    ...state,
    senderGenerations: {
      ...(state.senderGenerations ?? {}),
      [key]: nextGeneration,
    },
    applicationMessageCounter:
      state.selfLeafIndex === header.senderLeafIndex
        ? nextGeneration
        : state.applicationMessageCounter,
  }
}

const buildRemovedMessage = (activeGroupId, removedInfo = {}) => ({
  _id: `group-removed:${activeGroupId}:${removedInfo.at || 'now'}`,
  userId: '',
  username: '',
  text: removedInfo.text || 'You were removed from the group',
  createdAt: removedInfo.at || new Date().toISOString(),
  seenStatus: true,
  messageType: 'system',
})

const GroupChat = ({ activeGroupId, userId, username, currentWallpaper, removedInfo = null }) => {
  const socket = useMemo(() => getSocket(), [])
  const [messages, setMessages] = useState([])
  const [typists, setTypists] = useState({})
  const typingPruneRef = useRef(null)
  // Drop typing state when switching between groups.
  useEffect(() => {
    setTypists({})
    if (typingPruneRef.current) clearTimeout(typingPruneRef.current)
  }, [activeGroupId])
  const [, setMembers] = useState([])
  const [, setRole] = useState(null)
  const [groupCryptoState, setGroupCryptoState] = useState(null)
  const [groupMeta, setGroupMeta] = useState({
    mlsEnabled: false,
    epoch: 0,
    cipherSuite: null,
    createdBy: null,
  })

  const isInitialLoadRef = useRef(true)
  const messagesEndRef = useRef(null)
  const groupCryptoStateRef = useRef(null)
  const groupMetaRef = useRef(groupMeta)
  const liveMessageQueueRef = useRef(Promise.resolve())
  const sendQueueRef = useRef(Promise.resolve())
  const pendingEncryptedGroupMessagesRef = useRef(new Map()) // groupId -> array of messages
  const removedInfoRef = useRef(removedInfo)

  useEffect(() => {
    groupCryptoStateRef.current = groupCryptoState
  }, [groupCryptoState])

  useEffect(() => {
    groupMetaRef.current = groupMeta
  }, [groupMeta])

  useEffect(() => {
    const wasRemoved = removedInfoRef.current
    removedInfoRef.current = removedInfo

    if (removedInfo) {
      // Don't wipe the message history on removal — that's handled by the main
      // load effect below, which preserves cached plaintext and appends the
      // "you were removed" placeholder. Here we only need to drop crypto state
      // and any in-flight encrypted messages whose keys we'll never see.
      setGroupCryptoState(null)
      groupCryptoStateRef.current = null
      pendingEncryptedGroupMessagesRef.current.set(String(activeGroupId), [])
      return
    }

    if (!wasRemoved) return
    // Re-add path: this effect cleared groupCryptoState when removedInfo was
    // set; nothing else proactively restores it once the user is re-added.
    // The Welcome / groupStateSynced handlers do repopulate eventually, but
    // they're re-bound by the dep change on this effect, so a Welcome that
    // arrives in the unbinding window is missed — the input then stays
    // disabled ("MLS state is not ready") with no console error, and the
    // re-added user can't send. Force a disk reload so groupCryptoState is
    // restored from whatever the Welcome already persisted.
    void (async () => {
      try {
        const fresh = await loadGroupState(activeGroupId)
        if (fresh) {
          setGroupCryptoState(fresh)
          groupCryptoStateRef.current = fresh
          // Nudge any listeners (Dashboard, buffered decrypts) to refresh
          try {
            window.dispatchEvent(
              new CustomEvent('groupStateSynced', { detail: { groupId: activeGroupId } })
            )
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* loadGroupState is best-effort here; the live handlers still get another shot */
      }
    })()
  }, [activeGroupId, removedInfo])

  // Update in-view avatars when any user updates their profile picture
  useEffect(() => {
    const socket = getSocket()
    const onUserProfileUpdated = ({ userId: updatedUserId, username, profilePicture }) => {
      if (!updatedUserId) return
      const base = formatProfileImage(profilePicture, username || 'User')
      const busted = base ? `${base}${base.includes('?') ? '&' : '?'}v=${Date.now()}` : null
      setMessages((prev) =>
        Array.isArray(prev)
          ? prev.map((m) =>
              String(m?.userId ?? '') === String(updatedUserId)
                ? { ...m, profileImage: busted || base }
                : m
            )
          : prev
      )
    }
    socket.on('userProfileUpdated', onUserProfileUpdated)
    return () => socket.off('userProfileUpdated', onUserProfileUpdated)
  }, [])

  const buildRoster = useCallback(
    (serverMembers) =>
      Array.isArray(serverMembers)
        ? serverMembers.map((member, index) => ({
            userId: String(member?.userId ?? member?.id ?? ''),
            username: member?.username ?? 'Member',
            leafIndex: Number.isInteger(member?.leafIndex) ? member.leafIndex : index,
          }))
        : [],
    []
  )

  // Ask Dashboard to re-run the device-leaf sweep, which can publish a fresh
  // Welcome for this device to the current epoch when drift is detected.
  const requestDeviceLeafSweep = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent('echo-request-device-leaf-sweep'))
    } catch {
      /* ignore */
    }
  }, [])

  const getGroupCacheId = useCallback((groupId) => `${GROUP_CACHE_PREFIX}${groupId}`, [])

  const parseArtifactPayload = useCallback((message) => {
    if (typeof message?.payload !== 'string' || message.payload.length === 0) return null

    try {
      return JSON.parse(message.payload)
    } catch (err) {
      console.error('[GroupChat] Failed to parse stored MLS artifact payload:', err)
      return null
    }
  }, [])

  const findMemberByUserId = useCallback(
    (roster, memberUserId) =>
      Array.isArray(roster)
        ? roster.find((member) => String(member?.userId ?? '') === String(memberUserId ?? ''))
        : null,
    []
  )

  const findMemberByLeafIndex = useCallback(
    (roster, leafIndex) =>
      Array.isArray(roster)
        ? roster.find(
            (member) => Number.isInteger(member?.leafIndex) && member.leafIndex === leafIndex
          )
        : null,
    []
  )

  const resolveLocalSelfLeafIndex = useCallback(
    (currentState, serverLeafIndex) => {
      const localLeafIndex = currentState?.selfLeafIndex
      const localLeafData = Number.isInteger(localLeafIndex)
        ? currentState?.tree?.leafData?.[String(localLeafIndex)]
        : null

      if (localLeafData && String(localLeafData.userId) === String(userId)) {
        return localLeafIndex
      }

      return Number.isInteger(serverLeafIndex) ? serverLeafIndex : null
    },
    [userId]
  )

  const buildCommitSystemMessage = useCallback(
    ({ commit, priorState, message, actorUsername }) => {
      if (!commit || typeof commit !== 'object') return null

      const createdAt = message?.createdAt || message?.timestamp || new Date().toISOString()
      const commitGroupId = String(commit?.groupId ?? activeGroupId ?? '')
      const commitEpoch = Number.isInteger(commit?.epoch) ? commit.epoch : null
      const commitSystemId =
        commitGroupId && commitEpoch !== null
          ? `commit:${commitGroupId}:${commitEpoch}`
          : message?._id || `commit:${commitGroupId || 'unknown'}:${createdAt}`
      const actorName =
        actorUsername ||
        findMemberByLeafIndex(priorState?.roster, commit?.senderLeafIndex)?.username ||
        findMemberByLeafIndex(commit?.roster, commit?.senderLeafIndex)?.username ||
        'A member'
      const targetName =
        findMemberByUserId(priorState?.roster, commit?.targetUserId)?.username ||
        findMemberByUserId(commit?.roster, commit?.targetUserId)?.username ||
        'a member'

      const targetUserIdStr = String(commit?.targetUserId ?? '')
      const targetIsSelf = targetUserIdStr !== '' && targetUserIdStr === String(userId)
      // A sibling-device add re-adds a userId that already holds a leaf — it is
      // device management, not a membership change, so it gets no system row.
      // Detect it two ways so a stale priorState can't let it slip through:
      //   1. the target userId is already present in priorState.roster, or
      //   2. the target userId owns more than one leaf in the post-add roster
      //      (i.e. it had at least one leaf before this Add).
      const targetAlreadyMember =
        targetUserIdStr !== '' &&
        Array.isArray(priorState?.roster) &&
        priorState.roster.some((member) => String(member?.userId ?? '') === targetUserIdStr)
      const targetLeafCountAfter = Array.isArray(commit?.roster)
        ? commit.roster.filter((member) => String(member?.userId ?? '') === targetUserIdStr).length
        : 0
      const isDeviceAdd =
        targetUserIdStr !== '' && (targetAlreadyMember || targetLeafCountAfter > 1)

      let text = `${actorName} updated the group`
      if (commit?.type === 'add') {
        if (isDeviceAdd) return null
        text = targetIsSelf ? `${actorName} added you` : `${actorName} added ${targetName}`
      } else if (commit?.type === 'remove') {
        const actorWasTarget =
          String(commit?.targetUserId ?? '') ===
          String(findMemberByLeafIndex(priorState?.roster, commit?.senderLeafIndex)?.userId ?? '')
        text = actorWasTarget
          ? `${actorName} left the group`
          : `${actorName} removed ${targetName} from the group`
      }

      return {
        _id: commitSystemId,
        sourceMessageId: message?._id ?? null,
        commitGroupId,
        commitEpoch,
        commitType: typeof commit?.type === 'string' ? commit.type : null,
        userId: '',
        username: '',
        text,
        createdAt,
        seenStatus: true,
        messageType: 'system',
      }
    },
    [activeGroupId, findMemberByLeafIndex, findMemberByUserId, userId]
  )

  // Synthetic "X created <group>" row shown as the first message of every group.
  // Derived locally from the openGroup response (createdBy + members + name), so
  // every member renders it without it having to be sent over the wire. Stable
  // _id keeps it de-duplicated across reopens.
  const buildGroupCreatedSystemMessage = useCallback(
    ({ createdBy, members, groupName, createdAt }) => {
      const creatorName =
        (Array.isArray(members) ? members : []).find(
          (member) => String(member?.userId ?? member?.id ?? '') === String(createdBy ?? '')
        )?.username || 'Someone'
      return {
        _id: `created:${String(activeGroupId)}`,
        userId: '',
        username: '',
        text: `${creatorName} created ${groupName || 'the group'}`,
        createdAt: createdAt || new Date(0).toISOString(),
        seenStatus: true,
        messageType: 'system',
      }
    },
    [activeGroupId]
  )

  const mergeCachedMessages = (cachedMessages, incomingMessages) => {
    const byId = new Map()

    for (const message of Array.isArray(cachedMessages) ? cachedMessages : []) {
      if (!message?._id) continue
      byId.set(message._id, message)
    }

    for (const message of Array.isArray(incomingMessages) ? incomingMessages : []) {
      if (!message?._id) continue
      const cached = byId.get(message._id)
      if (
        cached &&
        message.text === MLS_UNAVAILABLE_TEXT &&
        cached.text &&
        cached.text !== MLS_UNAVAILABLE_TEXT
      ) {
        byId.set(message._id, { ...message, text: cached.text })
        continue
      }
      byId.set(message._id, message)
    }

    return [...byId.values()].sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    )
  }

  const syncLocalStateFromServer = useCallback(
    async ({ roster, responseGroup, responseMembership }) => {
      const currentState = await loadGroupState(activeGroupId)
      const serverLeafIndex = Number.isInteger(responseMembership?.leafIndex)
        ? responseMembership.leafIndex
        : (roster.find((member) => String(member.userId) === String(userId))?.leafIndex ?? null)

      if (!currentState) {
        // For MLS groups, NEVER take the createNewGroupState path here.
        // Group creation happens in CreateGroupModal; by the time the creator
        // opens GroupChat, currentState exists.  If we reach this branch with
        // a missing local state, this device is either:
        //   1. a freshly-synced sibling whose Welcome hasn't arrived yet, or
        //   2. a device whose local storage was reset.
        // In both cases the right answer is a placeholder, then catch-up via
        // pending Welcomes / sibling-bootstrap.  Becoming "creator" again would
        // mint a parallel epoch-0 state with the wrong roster (account-level,
        // missing the primary's per-device leaf), and the local state would
        // never advance epoch because subsequent Add commits target the real
        // group's epoch, not this synthetic one.
        if (responseGroup?.mlsEnabled) {
          return saveGroupState(activeGroupId, {
            groupId: activeGroupId,
            epoch: 0,
            cipherSuite: responseGroup?.cipherSuite ?? DEFAULT_MLS_CIPHER_SUITE,
            selfUserId: userId,
            selfLeafIndex: serverLeafIndex,
            groupKeyB64: null,
            applicationMessageCounter: 0,
            roster,
            tree: { nodes: [], root: null },
            secrets: { epochSecretsB64: null, initSecretB64: null },
            pendingCommits: [],
          })
        }

        // Legacy non-MLS groups (no MLS enabled): keep the original behaviour.
        return createNewGroupState({
          groupId: activeGroupId,
          creatorUserId: userId,
          roster,
          cipherSuite: responseGroup?.cipherSuite ?? DEFAULT_MLS_CIPHER_SUITE,
        })
      }

      const nextSelfLeafIndex = resolveLocalSelfLeafIndex(currentState, serverLeafIndex)
      // Account roster is one row per user; local MLS roster is one leaf per device.
      const mergedRoster = mergeAccountRosterIntoMlsRoster({
        localRoster: currentState.roster ?? [],
        accountRoster: roster ?? [],
      })
      const nextState = {
        ...currentState,
        selfLeafIndex: nextSelfLeafIndex,
        roster: mergedRoster,
      }

      const rosterChanged =
        JSON.stringify(currentState.roster ?? []) !== JSON.stringify(mergedRoster)
      const needsSave = rosterChanged || currentState.selfLeafIndex !== nextState.selfLeafIndex

      return needsSave ? saveGroupState(activeGroupId, nextState) : nextState
    },
    [activeGroupId, resolveLocalSelfLeafIndex, userId]
  )

  const formatMessage = useCallback(
    async (message, cryptoState, meta) => {
      const createdAt = message?.createdAt || message?.timestamp || new Date().toISOString()
      const id =
        message?._id ||
        `${String(message?.groupId ?? activeGroupId)}:${String(message?.seq ?? createdAt)}`
      const fromUsername =
        message?.username || (String(message?.userId) === String(userId) ? username : 'Member')

      let text = ''
      let image = null
      let nextState = cryptoState

      const hasAppMessage =
        meta?.mlsEnabled &&
        message?.contentType === 'application' &&
        (message?.encryptedSenderDataB64 || message?.headerB64) &&
        message?.ciphertextB64
      if (hasAppMessage) {
        // Skip silently when this device has no key material for the relevant
        // epoch (e.g. message sent while we were removed, before the Welcome
        // that re-adds us has been processed). The replay caller drops the
        // resulting UNAVAILABLE row, and cached plaintext from before removal
        // is preserved via mergeCachedMessages.
        if (!hasGroupKeyMaterial(cryptoState)) {
          text = MLS_UNAVAILABLE_TEXT
        } else {
          try {
            const decrypted = await decryptApplicationMessage({
              state: cryptoState,
              encryptedSenderDataB64: message.encryptedSenderDataB64 ?? null,
              header: message.headerB64 ?? null,
              ciphertext: message.ciphertextB64,
              includeNewState: true,
            })
            const plaintextBytes = decrypted?.plaintextBytes ?? decrypted
            nextState = decrypted?.newState ?? cryptoState
            const payload = decodeGroupMessagePayload(plaintextBytes)
            text = payload.text
            image = payload.image
          } catch (err) {
            console.error('[GroupChat] Failed to decrypt MLS message:', err)
            text = MLS_UNAVAILABLE_TEXT
          }
        }
      } else if (typeof message?.payload === 'string') {
        text = message.payload
      } else if (typeof message?.text === 'string') {
        text = message.text
      }

      return {
        formattedMessage: {
          _id: id,
          userId: String(message?.userId ?? ''),
          username: fromUsername,
          text,
          image,
          createdAt,
          seenStatus: true,
        },
        nextState,
      }
    },
    [activeGroupId, userId, username]
  )

  const replayFetchedMessages = useCallback(
    async ({ fetchedMessages, initialState, initialMeta, cachedMessages = [] }) => {
      let replayState = initialState
      let replayMeta = initialMeta
      const formattedMessages = []
      const sortedMessages = [...(Array.isArray(fetchedMessages) ? fetchedMessages : [])].sort(
        (a, b) => {
          const seqA = Number.isInteger(a?.seq) ? a.seq : Number.MAX_SAFE_INTEGER
          const seqB = Number.isInteger(b?.seq) ? b.seq : Number.MAX_SAFE_INTEGER
          return seqA - seqB
        }
      )

      // Messages already decrypted and saved on a previous visit. The persisted
      // senderGenerations already accounts for them, so re-decrypting would fail
      // with a generation mismatch. Use cached plaintext instead.
      const cachedById = new Map(
        (Array.isArray(cachedMessages) ? cachedMessages : [])
          .filter((m) => m?._id && m.text && m.text !== MLS_UNAVAILABLE_TEXT)
          .map((m) => [String(m._id), m])
      )

      // Prefer the device-specific MLS init private if present; fall back to ELD identity key.
      const identityKeys = await getIdentityKeys()
      const fallbackPriv =
        localStorage.getItem('echo-device-mls-priv') || identityKeys?.privateKeyX25519 || null

      for (const message of sortedMessages) {
        if (initialMeta?.mlsEnabled && message?.contentType === 'commit') {
          const commit = parseArtifactPayload(message)
          if (!commit) continue
          const systemMessage = buildCommitSystemMessage({
            commit,
            priorState: replayState,
            message,
            actorUsername: message?.username,
          })
          // Idempotent gate: skip if we already applied this commit or are ahead.
          if (Number.isInteger(replayState?.epoch) && commit.epoch <= replayState.epoch) {
            if (systemMessage) formattedMessages.push(systemMessage)
            continue
          }
          // Order gate: only attempt the exact next epoch. If we are missing
          // an earlier commit/welcome, let subsequent replay iterations handle
          // it after state catches up (e.g., once the corresponding Welcome is
          // processed). This avoids spurious "Invalid commit epoch" errors.
          if (
            Number.isInteger(replayState?.epoch) &&
            Number.isInteger(commit?.epoch) &&
            commit.epoch !== replayState.epoch + 1
          ) {
            // Defer this commit; a missing intermediate artifact should fill in
            // first. We still append the system row so UI reflects membership changes.
            if (systemMessage) formattedMessages.push(systemMessage)
            continue
          }

          try {
            replayState = await applyCommit({
              state: replayState,
              commit,
              myInitPrivKeyB64: resolveMyInitPrivKeyB64(replayState, fallbackPriv),
            })
            replayState = await saveGroupState(activeGroupId, replayState)
            replayMeta = {
              ...replayMeta,
              epoch: Number.isInteger(commit?.epoch) ? commit.epoch : replayMeta.epoch,
            }
            if (systemMessage) formattedMessages.push(systemMessage)
          } catch (err) {
            console.warn('[GroupChat] Skipping stored MLS commit during replay:', err)
            // Signal a device-leaf sweep in case drift is due to a missing or
            // stale device leaf; primary can publish a fresh welcome.
            requestDeviceLeafSweep()
          }
          continue
        }

        if (initialMeta?.mlsEnabled && message?.contentType === 'welcome') {
          const welcome = parseArtifactPayload(message)
          if (!welcome || String(welcome.recipientUserId ?? '') !== String(userId)) continue
          // Skip welcomes addressed to another device on this same account.
          // They are encrypted to a different init key and would noisily fail
          // unwrap with "Decryption failed".
          if (!isGroupWelcomeForThisDevice(welcome)) continue
          if (!shouldApplyGroupWelcome(replayState, welcome)) continue

          try {
            replayState = await processWelcome({
              welcome,
              selfUserId: userId,
              ...resolveProcessWelcomeOptions({
                userId,
                myInitPrivKeyB64: resolveMyInitPrivKeyB64(replayState, fallbackPriv),
              }),
            })
            replayState = await saveGroupState(activeGroupId, replayState)
          } catch (err) {
            console.warn('[GroupChat] Skipping stored MLS welcome during replay:', err)
          }
          continue
        }

        // If we already have the decrypted plaintext in cache, use it directly.
        // Attempting to re-decrypt would fail because senderGenerations has
        // already been advanced past this message's generation.
        const msgId = String(message?._id ?? '')
        if (msgId && cachedById.has(msgId)) {
          formattedMessages.push(cachedById.get(msgId))
          replayState = advanceCachedMessageGeneration(replayState, message)
          continue
        }

        const formatted = await formatMessage(message, replayState, replayMeta)
        replayState = formatted.nextState ?? replayState
        // Drop messages we can't decrypt during replay. These are typically
        // messages from epochs the current device was not a member for (e.g.
        // sent while the user was removed and before being re-added). Showing
        // them as "[Unable to decrypt message]" is noisy and misleading.
        if (formatted.formattedMessage?.text === MLS_UNAVAILABLE_TEXT) continue
        formattedMessages.push(formatted.formattedMessage)
      }

      return { formattedMessages, replayState, replayMeta }
    },
    [
      activeGroupId,
      buildCommitSystemMessage,
      formatMessage,
      parseArtifactPayload,
      requestDeviceLeafSweep,
      userId,
    ]
  )

  useEffect(() => {
    if (!activeGroupId) return
    if (removedInfo) {
      let cancelledRemoved = false
      ;(async () => {
        const cached = await getSavedMessages(userId, getGroupCacheId(activeGroupId)).catch(
          () => []
        )
        if (cancelledRemoved) return
        const placeholder = buildRemovedMessage(activeGroupId, removedInfo)
        // Strip any cached decryption-failure rows so the history view stays
        // clean. Plaintext rows from before the removal are preserved.
        const history = Array.isArray(cached)
          ? cached.filter((m) => m?._id !== placeholder._id && m?.text !== MLS_UNAVAILABLE_TEXT)
          : []
        setMessages([...history, placeholder])
      })()
      return () => {
        cancelledRemoved = true
      }
    }
    let cancelled = false

    setMessages([])
    setMembers([])
    setRole(null)
    setGroupCryptoState(null)
    setGroupMeta({
      mlsEnabled: false,
      epoch: 0,
      cipherSuite: null,
      createdBy: null,
    })
    groupMetaRef.current = {
      mlsEnabled: false,
      epoch: 0,
      cipherSuite: null,
      createdBy: null,
    }
    groupCryptoStateRef.current = null
    isInitialLoadRef.current = true
    liveMessageQueueRef.current = Promise.resolve()
    sendQueueRef.current = Promise.resolve()

    // Defined here so the initial load can be enqueued before any live-message
    // handler tasks, ensuring groupCryptoStateRef is fully up-to-date before
    // incoming newGroupMessage events attempt to decrypt with it.
    const enqueueLiveGroupMessageTask = (task) => {
      const queuedTask = liveMessageQueueRef.current.catch(() => {}).then(task)
      liveMessageQueueRef.current = queuedTask
      return queuedTask
    }

    // Serialise the full initial load (openGroup + fetchGroupMessages + replay)
    // with the live-message queue.  Any newGroupMessage that arrives while the
    // replay is in flight will wait in the queue and see the final state.
    enqueueLiveGroupMessageTask(async () => {
      const res = await new Promise((resolve) =>
        socket.emit('openGroup', { groupId: activeGroupId }, resolve)
      )
      if (cancelled || !res?.success) return

      const roster = buildRoster(res.members)
      const nextMeta = {
        mlsEnabled: res?.group?.mlsEnabled === true,
        epoch: Number.isInteger(res?.group?.epoch) ? res.group.epoch : 0,
        cipherSuite: res?.group?.cipherSuite ?? null,
        createdBy: res?.group?.createdBy ?? null,
      }

      setMembers(Array.isArray(res.members) ? res.members : [])
      setRole(res?.membership?.role ?? null)
      setGroupMeta(nextMeta)

      let localState = await syncLocalStateFromServer({
        roster,
        responseGroup: res?.group,
        responseMembership: res?.membership,
      })

      if (nextMeta.mlsEnabled) {
        try {
          let prepared = await prepareGroupMlsForSend({
            socket,
            groupId: activeGroupId,
            userId,
            currentState: localState,
          })
          if (prepared?.state) localState = prepared.state
          if (Number.isInteger(prepared?.serverEpoch)) {
            nextMeta.epoch = prepared.serverEpoch
            groupMetaRef.current = nextMeta
            setGroupMeta({ ...nextMeta })
          }
        } catch (err) {
          // Fallback: if state/server epoch mismatch, hard-align then retry once.
          try {
            const msg = String(err?.message || err || '')
            const isEpochMismatch =
              /mls state epoch\s+\d+\s+(is behind|is ahead of)\s+server epoch\s+\d+/i.test(msg)
            if (isEpochMismatch) {
              const liveEpoch = await fetchGroupServerEpoch(socket, activeGroupId).catch(() => null)
              if (Number.isInteger(liveEpoch)) {
                await bootstrapGroupMlsOnDevice({
                  socket,
                  groupId: activeGroupId,
                  userId,
                  targetEpoch: liveEpoch,
                }).catch(() => null)
                const prepared = await prepareGroupMlsForSend({
                  socket,
                  groupId: activeGroupId,
                  userId,
                  currentState: localState,
                })
                if (prepared?.state) localState = prepared.state
                if (Number.isInteger(prepared?.serverEpoch)) {
                  nextMeta.epoch = prepared.serverEpoch
                  groupMetaRef.current = nextMeta
                  setGroupMeta({ ...nextMeta })
                }
              }
            } else {
              console.warn('[GroupChat] MLS bootstrap on open failed:', err)
            }
          } catch (fallbackErr) {
            console.warn('[GroupChat] MLS bootstrap (fallback) on open failed:', fallbackErr)
            // Escalate: ask the account primary to sweep device leaves and
            // publish fresh welcomes to repair drift.
            requestDeviceLeafSweep()
          }
        }
      }

      const cachedMessages = await getSavedMessages(userId, getGroupCacheId(activeGroupId))

      if (cancelled) return

      setGroupCryptoState(localState)
      groupCryptoStateRef.current = localState
      // Defensively strip any cached decryption-failure rows persisted by
      // older versions before the replay completes.
      setMessages(
        Array.isArray(cachedMessages)
          ? cachedMessages.filter((m) => m?.text !== MLS_UNAVAILABLE_TEXT)
          : []
      )

      const msgRes = await new Promise((resolve) =>
        socket.emit('fetchGroupMessages', { groupId: activeGroupId, limit: 50 }, resolve)
      )
      if (cancelled || !msgRes?.success || !Array.isArray(msgRes.messages)) return

      const replayed = await replayFetchedMessages({
        fetchedMessages: msgRes.messages,
        initialState: localState,
        initialMeta: nextMeta,
        cachedMessages,
      })
      const persistedReplayState = replayed.replayState
        ? await saveGroupState(activeGroupId, replayed.replayState)
        : replayed.replayState
      const createdSystemMessage = buildGroupCreatedSystemMessage({
        createdBy: res?.group?.createdBy ?? nextMeta.createdBy,
        members: res.members,
        groupName: res?.group?.name,
        createdAt: res?.group?.createdAt,
      })
      const mergedMessages = mergeCachedMessages(cachedMessages, [
        createdSystemMessage,
        ...replayed.formattedMessages,
      ])
      // Drop any decryption-failure rows (e.g. cached UNAVAILABLE text from
      // older versions) so they neither render nor get re-persisted.
      const visibleMessages = mergedMessages.filter((m) => m?.text !== MLS_UNAVAILABLE_TEXT)

      // Save using mergedMessages so cached plaintext is never overwritten by a
      // decryption failure text from the replay pass. Batched (parallel writes,
      // one event) instead of an awaited write + event per message — the old
      // per-message loop was an O(messages) serial IndexedDB cost on every open.
      await storeSavedMessagesBatch(userId, getGroupCacheId(activeGroupId), visibleMessages)

      if (!cancelled) {
        setMessages(visibleMessages)
        setGroupCryptoState(persistedReplayState)
        groupCryptoStateRef.current = persistedReplayState
        setGroupMeta(replayed.replayMeta)
        groupMetaRef.current = replayed.replayMeta
      }
    })

    const handleMembershipChanged = (evt) => {
      if (String(evt?.groupId ?? '') !== String(activeGroupId)) return

      // Serialize with the commit/welcome/message handlers so the openGroup +
      // syncLocalStateFromServer write doesn't race with an in-flight commit
      // application and clobber the freshly-advanced epoch keys. Without this,
      // a `groupMemberAdded` that arrives near `groupCommit` can stomp the new
      // applicationSecret with the pre-add one and leave the input disabled
      // with "MLS state is not ready" until the user refreshes.
      const isPeerRemoval =
        evt?.removedByUserId != null && String(evt?.memberId ?? '') !== String(userId)

      return enqueueLiveGroupMessageTask(async () => {
        const res = await new Promise((resolve) =>
          socket.emit('openGroup', { groupId: activeGroupId }, resolve)
        )
        if (cancelled || !res?.success) return

        const roster = buildRoster(res.members)
        const nextMeta = {
          mlsEnabled: res?.group?.mlsEnabled === true,
          epoch: Number.isInteger(res?.group?.epoch) ? res.group.epoch : 0,
          cipherSuite: res?.group?.cipherSuite ?? null,
          createdBy: res?.group?.createdBy ?? null,
        }

        setMembers(Array.isArray(res.members) ? res.members : [])
        setRole(res?.membership?.role ?? null)
        setGroupMeta(nextMeta)
        groupMetaRef.current = nextMeta

        // When another member is removed, the server roster updates before peers
        // have applied the remove commit. Do not rewrite local MLS roster/tree
        // from that snapshot — groupCommit + replay below advance crypto state.
        let synced
        if (isPeerRemoval && nextMeta.mlsEnabled) {
          synced =
            (await loadGroupState(activeGroupId).catch(() => null)) ?? groupCryptoStateRef.current
        } else {
          synced = await syncLocalStateFromServer({
            roster,
            responseGroup: res?.group,
            responseMembership: res?.membership,
          })
        }

        // On peer removal, replay remove commits before prepareGroupMlsForSend.
        // prepare first was running catch-up with a stale roster and could persist
        // applicationSecretB64=null (see EchoLogs: myInitPrivKeyB64 ReferenceError).
        if (nextMeta.mlsEnabled && !isPeerRemoval) {
          try {
            let prepared = await prepareGroupMlsForSend({
              socket,
              groupId: activeGroupId,
              userId,
              currentState: synced,
            })
            if (prepared?.state) {
              synced = pickBetterState(synced, prepared.state) ?? prepared.state
            }
            if (Number.isInteger(prepared?.serverEpoch)) {
              nextMeta.epoch = prepared.serverEpoch
              groupMetaRef.current = nextMeta
              setGroupMeta({ ...nextMeta })
            }
          } catch (err) {
            // Fallback: align to server epoch then retry once
            try {
              const msg = String(err?.message || err || '')
              const isEpochMismatch =
                /mls state epoch\s+\d+\s+(is behind|is ahead of)\s+server epoch\s+\d+/i.test(msg)
              if (isEpochMismatch) {
                const liveEpoch = await fetchGroupServerEpoch(socket, activeGroupId).catch(
                  () => null
                )
                if (Number.isInteger(liveEpoch)) {
                  await bootstrapGroupMlsOnDevice({
                    socket,
                    groupId: activeGroupId,
                    userId,
                    targetEpoch: liveEpoch,
                  }).catch(() => null)
                  const prepared = await prepareGroupMlsForSend({
                    socket,
                    groupId: activeGroupId,
                    userId,
                    currentState: synced,
                  })
                  if (prepared?.state) {
                    synced = pickBetterState(synced, prepared.state) ?? prepared.state
                  }
                  if (Number.isInteger(prepared?.serverEpoch)) {
                    nextMeta.epoch = prepared.serverEpoch
                    groupMetaRef.current = nextMeta
                    setGroupMeta({ ...nextMeta })
                  }
                }
              } else {
                console.warn('[GroupChat] MLS bootstrap on membership change failed:', err)
              }
            } catch (fallbackErr) {
              console.warn(
                '[GroupChat] MLS bootstrap (fallback) on membership change failed:',
                fallbackErr
              )
              requestDeviceLeafSweep()
            }
          }
        }

        if (cancelled) return
        setGroupCryptoState(synced)
        groupCryptoStateRef.current = synced

        if (!nextMeta.mlsEnabled) return

        // The live `groupCommit` broadcast can be lost (handler not yet bound on
        // mount, queue race, transient disconnect). Use the membership event as
        // the recovery trigger: fetch persisted artifacts and replay any
        // commit/welcome that hasn't been applied locally yet. Replay is
        // idempotent — commits at or below the current epoch are skipped.
        let fetchedMessages = []
        if (isPeerRemoval) {
          fetchedMessages = await fetchAllGroupMessages(socket, activeGroupId).catch(() => [])
        } else {
          const msgRes = await new Promise((resolve) =>
            socket.emit('fetchGroupMessages', { groupId: activeGroupId, limit: 50 }, resolve)
          )
          if (cancelled || !msgRes?.success || !Array.isArray(msgRes.messages)) return
          fetchedMessages = msgRes.messages
        }
        if (cancelled) return

        const cachedMessages = await getSavedMessages(userId, getGroupCacheId(activeGroupId)).catch(
          () => []
        )
        const replayed = await replayFetchedMessages({
          fetchedMessages,
          initialState: synced,
          initialMeta: nextMeta,
          cachedMessages,
        })
        if (cancelled) return

        let finalState = pickBetterState(synced, replayed.replayState) ?? synced
        if (replayed.replayState && finalState === replayed.replayState) {
          finalState = await saveGroupState(activeGroupId, replayed.replayState)
        }

        if (isPeerRemoval && nextMeta.mlsEnabled && !hasGroupKeyMaterial(finalState)) {
          try {
            const prepared = await prepareGroupMlsForSend({
              socket,
              groupId: activeGroupId,
              userId,
              currentState: finalState,
            })
            if (prepared?.state) {
              const improved = pickBetterState(finalState, prepared.state)
              if (improved && hasGroupKeyMaterial(improved)) {
                finalState = await saveGroupState(activeGroupId, improved)
              }
            }
          } catch (err) {
            console.warn('[GroupChat] MLS prepare after peer removal replay failed:', err)
          }
        }

        setGroupCryptoState(finalState)
        groupCryptoStateRef.current = finalState
        setGroupMeta(replayed.replayMeta)
        groupMetaRef.current = replayed.replayMeta

        // Persist any system rows the replay produced for commits the live
        // handler never saw, so "X added Y" still appears without a refresh.
        for (const message of replayed.formattedMessages) {
          if (!message?._id || message.messageType !== 'system') continue
          await updateSavedMessages(userId, getGroupCacheId(activeGroupId), message, setMessages)
        }

        // Drain buffered ciphertext now that the local state may have caught up.
        const key = String(activeGroupId)
        const pending = pendingEncryptedGroupMessagesRef.current.get(key) || []
        if (pending.length > 0) {
          const stillPending = []
          for (const pendingMsg of pending) {
            try {
              await decryptIncomingGroupMessage({
                message: pendingMsg,
                userId,
                username,
                currentState: finalState,
                setMessages,
              })
            } catch {
              stillPending.push(pendingMsg)
            }
          }
          pendingEncryptedGroupMessagesRef.current.set(key, stillPending)
        }
      })
    }

    const handleStoredGroupMessage = (event) => {
      const targetId = String(event?.detail?.targetUserId ?? '')
      if (targetId !== getGroupCacheId(activeGroupId) || cancelled) return

      const storedMessage = event?.detail?.message
      if (!storedMessage?._id) return

      setMessages((prev) => {
        if (prev.some((message) => message._id === storedMessage._id)) return prev
        return [...prev, storedMessage].sort(
          (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        )
      })
    }

    const handleNewGroupMessage = ({ groupId, ...message }) => {
      if (String(groupId ?? '') !== String(activeGroupId)) return
      if (removedInfoRef.current) return

      return enqueueLiveGroupMessageTask(async () => {
        const currentMeta = groupMetaRef.current
        const currentState = groupCryptoStateRef.current
        let nextState = currentState
        let formattedMessage = null

        if (currentMeta?.mlsEnabled) {
          try {
            const decrypted = await decryptIncomingGroupMessage({
              message: { groupId, ...message },
              userId,
              username,
              currentState,
              setMessages,
            })
            formattedMessage = decrypted.formattedMessage
            nextState = decrypted.nextState ?? currentState
          } catch {
            // State may not be ready yet (e.g., Welcome/commit not processed). Buffer and retry
            // after state updates (groupWelcome, groupCommit, or groupStateSynced).
            const key = String(groupId)
            const list = pendingEncryptedGroupMessagesRef.current.get(key) || []
            list.push({ groupId, ...message })
            pendingEncryptedGroupMessagesRef.current.set(key, list)

            // Preview placeholder so the user sees activity in the sidebar.
            window.dispatchEvent(
              new CustomEvent('groupMessagePreview', {
                detail: {
                  groupId,
                  text: '[Awaiting group state…]',
                  timestamp: message?.createdAt || message?.timestamp || new Date().toISOString(),
                },
              })
            )
          }

          // Let Dashboard update the sidebar preview without touching crypto state.
          if (formattedMessage) {
            const previewImg = formattedMessage.image ?? null
            const previewText =
              formattedMessage.text ||
              (previewImg
                ? /\.gif($|\?)/i.test(previewImg) || previewImg.startsWith('data:image/gif')
                  ? '🎞️ GIF'
                  : '📷 Photo'
                : '')
            window.dispatchEvent(
              new CustomEvent('groupMessagePreview', {
                detail: {
                  groupId,
                  text: previewText,
                  timestamp: formattedMessage.createdAt ?? new Date().toISOString(),
                },
              })
            )
          }
        } else {
          const formatted = await formatMessage(message, currentState, currentMeta)
          formattedMessage = formatted.formattedMessage
          nextState = formatted.nextState ?? currentState
          await updateSavedMessages(
            userId,
            getGroupCacheId(activeGroupId),
            formattedMessage,
            setMessages
          )
        }

        if (cancelled) return

        if (nextState) {
          setGroupCryptoState(nextState)
          groupCryptoStateRef.current = nextState
        }
      })
    }

    const handleGroupWelcome = ({ groupId, welcome }) => {
      if (String(groupId ?? '') !== String(activeGroupId)) return

      // Each device only processes the Welcome addressed to it.
      const thisDeviceId = localStorage.getItem('echo-device-id')
      const targetClientId = welcome.recipientClientId ?? null
      if (targetClientId !== null && targetClientId !== thisDeviceId) return

      // Same queue as commits/membership so a Welcome can't race a parallel
      // commit application and leave a stale snapshot of crypto state behind.
      return enqueueLiveGroupMessageTask(async () => {
        try {
          if (cancelled) return
          // Use the device-specific MLS private key if available; fall back to ELD key.
          const myInitPrivKeyB64 =
            localStorage.getItem('echo-device-mls-priv') ||
            (await getIdentityKeys())?.privateKeyX25519 ||
            null

          const nextState = await processWelcome({
            welcome,
            selfUserId: userId,
            ...resolveProcessWelcomeOptions({ userId, myInitPrivKeyB64 }),
          })

          const persistedState = await saveGroupState(activeGroupId, nextState)
          forwardGroupStateToPairedDevices(userId, activeGroupId, persistedState).catch(() => {})

          if (cancelled) return
          setGroupCryptoState(persistedState)
          groupCryptoStateRef.current = persistedState
          // Clear local removed flag so live messages resume immediately
          removedInfoRef.current = null

          // Emit an event to let Dashboard clear any stale removed flag for this group
          try {
            window.dispatchEvent(new CustomEvent('groupStateSynced', { detail: { groupId } }))
          } catch {
            /* ignore */
          }

          // Add a local system message so the re-joined user sees a visual notification
          const joinedAt = new Date().toISOString()
          const joinedMessage = {
            _id: `group-joined:${String(groupId)}:${joinedAt}`,
            userId: '',
            username: '',
            text: 'You joined the group',
            createdAt: joinedAt,
            seenStatus: true,
            messageType: 'system',
          }
          await updateSavedMessages(
            userId,
            getGroupCacheId(activeGroupId),
            joinedMessage,
            setMessages
          )

          // Retry any buffered messages now that state is available
          const key = String(groupId)
          const pending = pendingEncryptedGroupMessagesRef.current.get(key) || []
          if (pending.length > 0) {
            const stillPending = []
            for (const pendingMsg of pending) {
              try {
                await decryptIncomingGroupMessage({
                  message: pendingMsg,
                  userId,
                  username,
                  currentState: persistedState,
                  setMessages,
                })
              } catch {
                // Keep buffered; a subsequent commit/welcome may fix it.
                stillPending.push(pendingMsg)
              }
            }
            pendingEncryptedGroupMessagesRef.current.set(key, stillPending)
          }
        } catch (err) {
          console.error('[GroupChat] Failed to process group welcome:', err)
        }
      })
    }

    const handleGroupCommit = ({ groupId, commit }) => {
      if (String(groupId ?? '') !== String(activeGroupId)) return
      if (removedInfoRef.current) return

      // Share the live-message queue so a commit can't be partially applied
      // while a membership-changed recovery is in flight (and vice versa).
      return enqueueLiveGroupMessageTask(async () => {
        try {
          if (cancelled) return
          // Use this device's MLS init private key when available to keep epoch
          // secrets consistent with the Welcome processed on this device.
          const identityKeys = await getIdentityKeys()
          const fallbackPriv =
            localStorage.getItem('echo-device-mls-priv') || identityKeys?.privateKeyX25519 || null
          const priorState = groupCryptoStateRef.current
          const myInitPrivKeyB64 = resolveMyInitPrivKeyB64(priorState, fallbackPriv)
          const systemMessage = buildCommitSystemMessage({ commit, priorState })

          if (
            Number.isInteger(priorState?.epoch) &&
            Number.isInteger(commit?.epoch) &&
            priorState.epoch >= commit.epoch
          ) {
            return
          }

          if (
            Number.isInteger(priorState?.epoch) &&
            Number.isInteger(commit?.epoch) &&
            commit.epoch !== priorState.epoch + 1
          ) {
            return
          }

          // Own-commit short-circuit: we already produced and persisted nextState
          // via buildAddCommit / buildRemoveCommit in GroupHeader, so re-applying
          // here would re-run applyUpdatePath with the stale localStorage device
          // init priv key after our leaf has rotated — yielding null commitSecret
          // and stranding us with applicationSecretB64=null. Adopt GroupHeader's
          // saved state when it's already on ELD; otherwise defer entirely —
          // GroupHeader's matching `groupStateSynced` dispatch will deliver the
          // correct state to handleGroupStateSynced. Falling through to applyCommit
          // here would write a broken state and risk clobbering that sync if it
          // arrives later in the event loop.
          const isOwnCommit =
            Number.isInteger(priorState?.selfLeafIndex) &&
            Number.isInteger(commit?.senderLeafIndex) &&
            priorState.selfLeafIndex === commit.senderLeafIndex
          if (isOwnCommit) {
            const fresh = await loadGroupState(activeGroupId)
            const freshIsAhead =
              fresh &&
              Number.isInteger(fresh.epoch) &&
              fresh.epoch >= commit.epoch &&
              (fresh.applicationSecretB64 || fresh.groupKeyB64)
            if (freshIsAhead) {
              if (cancelled) return
              setGroupCryptoState(fresh)
              groupCryptoStateRef.current = fresh
              setGroupMeta((prev) => {
                const nextMeta = {
                  ...prev,
                  epoch: Number.isInteger(commit?.epoch) ? commit.epoch : prev.epoch,
                }
                groupMetaRef.current = nextMeta
                return nextMeta
              })
              if (systemMessage) {
                await updateSavedMessages(
                  userId,
                  getGroupCacheId(activeGroupId),
                  systemMessage,
                  setMessages
                )
              }
            }
            // Whether fresh was ready or not, never applyCommit our own commit —
            // leaving the existing (pre-remove) ref state in place is safe
            // (applicationSecretB64 is still set from the previous epoch), and the
            // pending groupStateSynced dispatch will advance us when it fires.
            return
          }

          const nextState = await applyCommit({
            state: priorState,
            commit,
            myInitPrivKeyB64,
          })
          const persistedState = await saveGroupState(activeGroupId, nextState)
          forwardGroupStateToPairedDevices(userId, activeGroupId, persistedState).catch(() => {})

          if (cancelled) return
          setGroupCryptoState(persistedState)
          groupCryptoStateRef.current = persistedState
          setGroupMeta((prev) => {
            const nextMeta = {
              ...prev,
              epoch: Number.isInteger(commit?.epoch) ? commit.epoch : prev.epoch,
            }
            groupMetaRef.current = nextMeta
            return nextMeta
          })
          if (systemMessage) {
            await updateSavedMessages(
              userId,
              getGroupCacheId(activeGroupId),
              systemMessage,
              setMessages
            )
          }

          // Retry any buffered messages after commit updates keys/epochs
          const key = String(groupId)
          const pending = pendingEncryptedGroupMessagesRef.current.get(key) || []
          if (pending.length > 0) {
            const stillPending = []
            for (const pendingMsg of pending) {
              try {
                await decryptIncomingGroupMessage({
                  message: pendingMsg,
                  userId,
                  username,
                  currentState: persistedState,
                  setMessages,
                })
              } catch {
                // keep buffered for the next state advance
                stillPending.push(pendingMsg)
              }
            }
            pendingEncryptedGroupMessagesRef.current.set(key, stillPending)
          }
        } catch (err) {
          console.error('[GroupChat] Failed to apply group commit:', err)
        }
      })
    }

    const handleGroupStateSynced = async (event) => {
      const { groupId } = event.detail ?? {}
      if (String(groupId ?? '') !== String(activeGroupId)) return
      try {
        const fresh = await loadGroupState(activeGroupId)
        if (fresh && !cancelled) {
          setGroupCryptoState(fresh)
          groupCryptoStateRef.current = fresh

          // Retry buffered messages when state is externally synced
          const key = String(activeGroupId)
          const pending = pendingEncryptedGroupMessagesRef.current.get(key) || []
          if (pending.length > 0) {
            for (const pendingMsg of pending) {
              try {
                await decryptIncomingGroupMessage({
                  message: pendingMsg,
                  userId,
                  username,
                  currentState: fresh,
                  setMessages,
                })
              } catch {
                // keep buffered
              }
            }
            pendingEncryptedGroupMessagesRef.current.set(key, [])
          }
        }
      } catch {}
    }

    // ── Typing indicator (per-member, name-aware) ──────────────────────────────
    const buildTypistMap = (active, prev) =>
      active.reduce((acc, t) => {
        acc[t.userId] = prev[t.userId]
        return acc
      }, {})
    const scheduleTypingPrune = () => {
      if (typingPruneRef.current) clearTimeout(typingPruneRef.current)
      typingPruneRef.current = setTimeout(() => {
        setTypists((prev) => {
          const active = activeTypists(prev)
          return active.length === Object.keys(prev).length ? prev : buildTypistMap(active, prev)
        })
      }, TYPING_TTL_MS + 100)
    }
    const handleGroupTyping = ({ groupId, userId: typistId, username } = {}) => {
      if (String(groupId) !== String(activeGroupId)) return
      setTypists((prev) => upsertTypist(prev, { userId: typistId, username }))
      scheduleTypingPrune()
    }
    const handleGroupStopTyping = ({ groupId, userId: typistId } = {}) => {
      if (String(groupId) !== String(activeGroupId)) return
      setTypists((prev) => removeTypist(prev, typistId))
    }

    // A member changed the group picture/description (server `groupUpdated`).
    // On a picture change, drop a yellow "X changed group picture" system row
    // (deduped by `at` via the message _id), mirroring the commit system rows.
    const handleGroupUpdated = (evt) => {
      if (String(evt?.groupId ?? evt?.group?.groupId ?? '') !== String(activeGroupId)) return
      if (!evt?.pictureChanged) return
      const at = evt?.at || new Date().toISOString()
      const isSelf = String(evt?.changedByUserId ?? '') === String(userId)
      const changedBy = evt?.changedBy || 'A member'
      const systemMsg = {
        _id: `group-pic:${String(activeGroupId)}:${at}`,
        userId: String(evt?.changedByUserId ?? ''),
        username: changedBy,
        text: isSelf ? 'You changed group picture' : `${changedBy} changed group picture`,
        createdAt: at,
        messageType: 'system',
        seenStatus: true,
      }
      updateSavedMessages(userId, getGroupCacheId(activeGroupId), systemMsg, setMessages)
    }

    socket.on('groupCommit', handleGroupCommit)
    socket.on('groupUpdated', handleGroupUpdated)
    socket.on('groupWelcome', handleGroupWelcome)
    socket.on('newGroupMessage', handleNewGroupMessage)
    socket.on('groupMemberAdded', handleMembershipChanged)
    socket.on('groupMemberRemoved', handleMembershipChanged)
    socket.on('groupTyping', handleGroupTyping)
    socket.on('groupStopTyping', handleGroupStopTyping)
    window.addEventListener('localStorageUpdated', handleStoredGroupMessage)
    window.addEventListener('groupStateSynced', handleGroupStateSynced)

    return () => {
      cancelled = true
      socket.off('groupCommit', handleGroupCommit)
      socket.off('groupUpdated', handleGroupUpdated)
      socket.off('groupWelcome', handleGroupWelcome)
      socket.off('newGroupMessage', handleNewGroupMessage)
      socket.off('groupMemberAdded', handleMembershipChanged)
      socket.off('groupMemberRemoved', handleMembershipChanged)
      socket.off('groupTyping', handleGroupTyping)
      socket.off('groupStopTyping', handleGroupStopTyping)
      window.removeEventListener('localStorageUpdated', handleStoredGroupMessage)
      window.removeEventListener('groupStateSynced', handleGroupStateSynced)
      if (typingPruneRef.current) clearTimeout(typingPruneRef.current)
    }
  }, [
    activeGroupId,
    buildCommitSystemMessage,
    buildGroupCreatedSystemMessage,
    buildRoster,
    formatMessage,
    getGroupCacheId,
    replayFetchedMessages,
    removedInfo,
    requestDeviceLeafSweep,
    socket,
    syncLocalStateFromServer,
    userId,
    username,
  ])

  useEffect(() => {
    if (!messagesEndRef.current) return
    const behavior = isInitialLoadRef.current ? 'auto' : 'smooth'
    // block: 'nearest' keeps scrollIntoView confined to the nearest scrollable
    // ancestor (the messages container). With the default 'start' alignment,
    // mobile Safari walks up to the window scroller and yanks the whole
    // dashboard, which pushed the input visually toward the middle.
    messagesEndRef.current.scrollIntoView({ behavior, block: 'nearest' })
    isInitialLoadRef.current = false
  }, [messages])

  // If MLS is enabled but we don't yet have key material, proactively pull any
  // pending device envelopes to get forwarded epoch secrets sooner.
  useEffect(() => {
    if (groupMeta?.mlsEnabled && !hasGroupKeyMaterial(groupCryptoState)) {
      processIncomingEnvelopes(userId).catch(() => {})
    }
  }, [groupMeta?.mlsEnabled, groupCryptoState, userId])

  const sendMessageNow = async (text, imageData = null) => {
    if (removedInfoRef.current) {
      throw new Error('You are no longer a member of this group')
    }

    const currentMeta = groupMetaRef.current

    if (currentMeta?.mlsEnabled) {
      let prepared
      try {
        prepared = await prepareGroupMlsForSend({
          socket,
          groupId: activeGroupId,
          userId,
          currentState: groupCryptoStateRef.current,
          // Trust the locally-known epoch to skip a per-send openGroup round-trip;
          // the server validates and rejects a stale epoch, handled below.
          knownServerEpoch: Number.isInteger(currentMeta?.epoch) ? currentMeta.epoch : null,
        })
      } catch (err) {
        const raw = String(err?.message || err || '')
        const isEpochMismatch =
          /mls state epoch\s+\d+\s+(is behind|is ahead of)\s+server epoch\s+\d+/i.test(raw)
        if (isEpochMismatch) {
          // Align strictly to server epoch, then retry.
          const liveEpoch = await fetchGroupServerEpoch(socket, activeGroupId).catch(() => null)
          if (Number.isInteger(liveEpoch)) {
            await bootstrapGroupMlsOnDevice({
              socket,
              groupId: activeGroupId,
              userId,
              targetEpoch: liveEpoch,
            }).catch(() => null)
          }
          prepared = await prepareGroupMlsForSend({
            socket,
            groupId: activeGroupId,
            userId,
            currentState: groupCryptoStateRef.current,
          })
        } else {
          // Deep drift (e.g., confirmation tag mismatch during catch-up). Try a
          // full rebuild from welcome baseline + strict replay.
          try {
            const liveEpoch = await fetchGroupServerEpoch(socket, activeGroupId).catch(() => null)
            const rebuilt = await rebuildMlsStateForDecryptFailure({
              socket,
              groupId: activeGroupId,
              userId,
              targetEpoch: Number.isInteger(liveEpoch) ? liveEpoch : null,
            })
            if (rebuilt?.applicationSecretB64) {
              groupCryptoStateRef.current = rebuilt
              setGroupCryptoState(rebuilt)
              prepared = await prepareGroupMlsForSend({
                socket,
                groupId: activeGroupId,
                userId,
                currentState: rebuilt,
              })
            } else {
              // Ask primary to sweep device leaves, await a short sync signal.
              requestDeviceLeafSweep()
              await new Promise((resolve) => {
                let settled = false
                const to = setTimeout(() => {
                  if (settled) return
                  settled = true
                  try {
                    window.removeEventListener('groupStateSynced', handler)
                  } catch {}
                  resolve(false)
                }, 1200)
                const handler = (ev) => {
                  if (settled) return
                  if (String(ev?.detail?.groupId ?? '') !== String(activeGroupId)) return
                  settled = true
                  try {
                    clearTimeout(to)
                    window.removeEventListener('groupStateSynced', handler)
                  } catch {}
                  resolve(true)
                }
                window.addEventListener('groupStateSynced', handler)
              })
              prepared = await prepareGroupMlsForSend({
                socket,
                groupId: activeGroupId,
                userId,
                currentState: groupCryptoStateRef.current,
              })
            }
          } catch (rebuildErr) {
            // Trace abort so DebugPanel shows why send didn't start
            try {
              if (typeof window !== 'undefined' && window.__echoGroupTrace) {
                window.__echoGroupTrace.push({
                  direction: 'out',
                  phase: 'abort',
                  groupId: activeGroupId,
                  error: String(rebuildErr?.message || rebuildErr || 'prepare failed'),
                  time: new Date(),
                })
              }
            } catch {}
            throw err // bubble the original error; UI will show disabled reason
          }
        }
      }
      const currentState = prepared.state
      if (!hasGroupKeyMaterial(currentState)) {
        throw new Error(MLS_KEY_MISSING_REASON)
      }

      groupCryptoStateRef.current = currentState
      setGroupCryptoState(currentState)
      if (Number.isInteger(prepared.serverEpoch)) {
        const epochUpdate = prepared.serverEpoch
        groupMetaRef.current = { ...groupMetaRef.current, epoch: epochUpdate }
        setGroupMeta((prev) => ({ ...prev, epoch: epochUpdate }))
      }

      const encrypted = await encryptApplicationMessage({
        state: currentState,
        plaintextBytes: encodeGroupMessagePayload({ text, image: imageData }),
      })
      const pendingOutgoingMessage = {
        groupId: activeGroupId,
        encryptedSenderDataB64: encrypted.encryptedSenderDataB64 ?? null,
        headerB64: encrypted.headerB64,
        ciphertextB64: encrypted.ciphertextB64,
      }
      setPendingOutgoingGroupMessage({
        ...pendingOutgoingMessage,
        text,
        image: imageData ?? null,
      })

      return new Promise((resolve, reject) => {
        socket.emit(
          'sendGroupMessage',
          {
            groupId: activeGroupId,
            nonce: encrypted.nonceB64,
            messageType: imageData ? 'image' : 'text',
            contentType: 'application',
            encryptedSenderDataB64: encrypted.encryptedSenderDataB64 ?? null,
            headerB64: encrypted.headerB64,
            ciphertextB64: encrypted.ciphertextB64,
            epoch: encrypted.header.epoch,
            senderLeafIndex: encrypted.header.senderLeafIndex,
          },
          async (ack) => {
            if (ack?.success) {
              const persistedState = await saveGroupState(activeGroupId, encrypted.newState)
              forwardGroupStateToPairedDevices(userId, activeGroupId, persistedState).catch(
                () => {}
              )
              setGroupCryptoState(persistedState)
              groupCryptoStateRef.current = persistedState

              // Do not append a local echo here; rely on the server broadcast
              // (`newGroupMessage`) to render the outgoing row. Pending
              // plaintext is cached so the self-echo decrypts without delay.
              resolve(ack)
              return
            }

            // If server rejected due to epoch mismatch, hard-align then retry once.
            const errMsg = String(ack?.error || '')
            const isInvalidEpoch = /invalid message epoch/i.test(errMsg)
            if (isInvalidEpoch) {
              try {
                const liveEpoch = await fetchGroupServerEpoch(socket, activeGroupId)
                if (Number.isInteger(liveEpoch)) {
                  await bootstrapGroupMlsOnDevice({
                    socket,
                    groupId: activeGroupId,
                    userId,
                    targetEpoch: liveEpoch,
                  }).catch(() => null)
                  const retryState =
                    (await loadGroupState(activeGroupId).catch(() => null)) ||
                    groupCryptoStateRef.current
                  if (!isUsableMlsStateAtEpoch(retryState, liveEpoch)) {
                    deletePendingOutgoingGroupMessage(pendingOutgoingMessage)
                    requestDeviceLeafSweep()
                    reject(new Error(MLS_KEY_MISSING_REASON))
                    return
                  }
                  const retried = await encryptApplicationMessage({
                    state: retryState,
                    plaintextBytes: encodeGroupMessagePayload({ text, image: imageData }),
                  })
                  const retryPendingOutgoingMessage = {
                    groupId: activeGroupId,
                    encryptedSenderDataB64: retried.encryptedSenderDataB64 ?? null,
                    headerB64: retried.headerB64,
                    ciphertextB64: retried.ciphertextB64,
                  }
                  deletePendingOutgoingGroupMessage(pendingOutgoingMessage)
                  setPendingOutgoingGroupMessage({
                    ...retryPendingOutgoingMessage,
                    text,
                    image: imageData ?? null,
                  })
                  socket.emit(
                    'sendGroupMessage',
                    {
                      groupId: activeGroupId,
                      nonce: retried.nonceB64,
                      messageType: imageData ? 'image' : 'text',
                      contentType: 'application',
                      encryptedSenderDataB64: retried.encryptedSenderDataB64 ?? null,
                      headerB64: retried.headerB64,
                      ciphertextB64: retried.ciphertextB64,
                      epoch: retried.header.epoch,
                      senderLeafIndex: retried.header.senderLeafIndex,
                    },
                    async (ack2) => {
                      if (ack2?.success) {
                        const persistedState = await saveGroupState(activeGroupId, retried.newState)
                        forwardGroupStateToPairedDevices(
                          userId,
                          activeGroupId,
                          persistedState
                        ).catch(() => {})
                        setGroupCryptoState(persistedState)
                        groupCryptoStateRef.current = persistedState
                        resolve(ack2)
                      } else {
                        const msg2 = ack2?.details
                          ? `${ack2?.error || 'Failed to send group message'}: ${ack2.details}`
                          : ack2?.error || 'Failed to send group message'
                        deletePendingOutgoingGroupMessage(retryPendingOutgoingMessage)
                        reject(new Error(msg2))
                      }
                    }
                  )
                  return
                }
              } catch {}
            }

            const msg = ack?.details
              ? `${ack?.error || 'Failed to send group message'}: ${ack.details}`
              : ack?.error || 'Failed to send group message'
            deletePendingOutgoingGroupMessage(pendingOutgoingMessage)
            try {
              if (typeof window !== 'undefined' && window.__echoGroupTrace) {
                window.__echoGroupTrace.push({
                  direction: 'out',
                  phase: 'abort',
                  groupId: activeGroupId,
                  error: msg,
                  time: new Date(),
                })
              }
            } catch {}
            reject(new Error(msg))
          }
        )
      })
    }

    const nonce =
      (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) || String(Date.now())
    return new Promise((resolve, reject) => {
      socket.emit(
        'sendGroupMessage',
        { groupId: activeGroupId, payload: text, nonce, messageType: 'text' },
        (ack) => {
          if (ack?.success) resolve(ack)
          else {
            const msg = ack?.details
              ? `${ack?.error || 'Failed to send group message'}: ${ack.details}`
              : ack?.error || 'Failed to send group message'
            reject(new Error(msg))
          }
        }
      )
    })
  }

  const sendMessage = (text, imageData = null) => {
    const queuedSend = sendQueueRef.current
      .catch(() => {})
      .then(() => sendMessageNow(text, imageData))

    sendQueueRef.current = queuedSend.catch(() => {})
    return queuedSend
  }

  const sendDisabled =
    Boolean(removedInfo) || (groupMeta.mlsEnabled && !hasGroupKeyMaterial(groupCryptoState))
  const sendDisabledReason = removedInfo
    ? 'You are no longer a member of this group'
    : MLS_KEY_MISSING_REASON

  // Group: name-aware label — "Alice is typing…", "Alice and Bob are typing…",
  // "Alice, Bob and Carol are typing…", then "N people typing…" for >3.
  const typingText = formatTypingText(
    activeTypists(typists).map((t) => t.username),
    { isGroup: true }
  )

  return (
    <div className='app-container h-full min-h-0 min-w-0 flex flex-col'>
      <div className='chat-container flex-1 min-h-0 min-w-0 flex flex-col relative'>
        <div
          className='messages-container flex-1 min-h-0 relative overflow-y-auto overflow-x-hidden overscroll-contain'
          data-wallpaper={currentWallpaper}
        >
          <div className='relative z-10 flex flex-col min-h-full'>
            <DisplayText messages={messages} currentUserId={String(userId)} />
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <div className='shrink-0'>
        <TypingIndicator text={typingText} />
        <SendText
          sendMessage={sendMessage}
          disabled={sendDisabled}
          disabledReason={sendDisabledReason}
          groupId={String(activeGroupId)}
        />
      </div>
    </div>
  )
}

GroupChat.propTypes = {
  activeGroupId: PropTypes.string,
  activeGroupName: PropTypes.string,
  userId: PropTypes.string.isRequired,
  username: PropTypes.string,
  currentWallpaper: PropTypes.string,
  removedInfo: PropTypes.shape({
    groupId: PropTypes.string,
    memberId: PropTypes.string,
    removedByUserId: PropTypes.string,
    removedByUsername: PropTypes.string,
    groupName: PropTypes.string,
    at: PropTypes.string,
    text: PropTypes.string,
  }),
}

export default GroupChat
