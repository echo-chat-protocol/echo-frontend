import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Loader2 } from 'lucide-react'
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
  forwardGroupMessageToPairedDevices,
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
import { buildReplyContext } from './utils/chat/replyContext'

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
  // stays true until we know mls is ready, keeps the securing bar up
  // instead of flashing the input then yanking it
  const [opening, setOpening] = useState(true)
  const [typists, setTypists] = useState({})
  // reply target for the composer
  const [replyTarget, setReplyTarget] = useState(null)
  const typingPruneRef = useRef(null)
  // reset reply + typing when the group changes
  useEffect(() => {
    setReplyTarget(null)
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
      // don't clear history here, the load effect below does that and keeps
      // cached plaintext. just drop crypto state + any in-flight ciphertext
      // whose keys we'll never get.
      setGroupCryptoState(null)
      groupCryptoStateRef.current = null
      pendingEncryptedGroupMessagesRef.current.set(String(activeGroupId), [])
      return
    }

    if (!wasRemoved) return
    // re-add path. we nulled groupCryptoState above and nothing puts it back
    // on its own. the Welcome handler can land in the rebind gap and get missed,
    // leaving the input stuck on "MLS state is not ready" with no error. reload
    // from disk so we pick up whatever the Welcome already saved.
    void (async () => {
      try {
        const fresh = await loadGroupState(activeGroupId)
        if (fresh) {
          setGroupCryptoState(fresh)
          groupCryptoStateRef.current = fresh
          // wake up listeners (dashboard, buffered decrypts)
          try {
            window.dispatchEvent(
              new CustomEvent('groupStateSynced', { detail: { groupId: activeGroupId } })
            )
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* best-effort, the live handlers retry anyway */
      }
    })()
  }, [activeGroupId, removedInfo])

  // refresh visible avatars when someone changes their pfp
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

  // nudge dashboard to re-sweep device leaves, can republish a Welcome
  // for this device if it drifted
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
      // sibling-device add: the userId already has a leaf, so this is device
      // management not a real join, no system row. catch it either via the prior
      // roster, or by the userId owning more than one leaf after the add.
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

  // fake "X created <group>" row at the top of every group. built locally from
  // the openGroup response so it never goes over the wire. fixed _id keeps it
  // deduped across reopens.
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
        // never createNewGroupState for mls here. creation lives in
        // CreateGroupModal, so if local state is missing this device is either a
        // freshly-synced sibling still waiting on its Welcome, or one whose
        // storage got wiped. either way: placeholder now, catch up later. minting
        // a fresh epoch-0 state would fork the group with the wrong roster
        // (account-level, no primary device leaf) and it'd never advance, since
        // real Add commits target the actual epoch not this synthetic one.
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

        // legacy non-mls groups keep the old behaviour
        return createNewGroupState({
          groupId: activeGroupId,
          creatorUserId: userId,
          roster,
          cipherSuite: responseGroup?.cipherSuite ?? DEFAULT_MLS_CIPHER_SUITE,
        })
      }

      const nextSelfLeafIndex = resolveLocalSelfLeafIndex(currentState, serverLeafIndex)
      // account roster is one row per user, mls roster is one leaf per device
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
      let replyTo = null
      let nextState = cryptoState

      const hasAppMessage =
        meta?.mlsEnabled &&
        message?.contentType === 'application' &&
        (message?.encryptedSenderDataB64 || message?.headerB64) &&
        message?.ciphertextB64
      if (hasAppMessage) {
        // no key material for this epoch (e.g. sent while we were removed,
        // before the re-add Welcome processed). skip quietly, replay drops the
        // UNAVAILABLE row and mergeCachedMessages keeps the old plaintext.
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
            replyTo = payload.replyTo ?? null
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
          replyTo,
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

      // already decrypted on a past visit. senderGenerations counts them, so
      // re-decrypting would fail on a gen mismatch. use the cache.
      const cachedById = new Map(
        (Array.isArray(cachedMessages) ? cachedMessages : [])
          .filter((m) => m?._id && m.text && m.text !== MLS_UNAVAILABLE_TEXT)
          .map((m) => [String(m._id), m])
      )

      // device-specific mls init priv if we have it, else the eld identity key
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
          // skip if we already applied this commit or we're ahead
          if (Number.isInteger(replayState?.epoch) && commit.epoch <= replayState.epoch) {
            if (systemMessage) formattedMessages.push(systemMessage)
            continue
          }
          // only try the exact next epoch. if an earlier commit/welcome is
          // missing, let later replay passes get it once state catches up.
          // avoids bogus "Invalid commit epoch" errors.
          if (
            Number.isInteger(replayState?.epoch) &&
            Number.isInteger(commit?.epoch) &&
            commit.epoch !== replayState.epoch + 1
          ) {
            // defer this commit, a missing piece should land first. still add
            // the system row so the ui shows the membership change.
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
            // ask for a device-leaf sweep in case a stale leaf caused the drift,
            // primary can then send a fresh welcome
            requestDeviceLeafSweep()
          }
          continue
        }

        if (initialMeta?.mlsEnabled && message?.contentType === 'welcome') {
          const welcome = parseArtifactPayload(message)
          if (!welcome || String(welcome.recipientUserId ?? '') !== String(userId)) continue
          // welcomes for another device on this account use a different init key
          // and would just spam "Decryption failed", so skip them
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

        // use cached plaintext if we have it. re-decrypting fails here because
        // senderGenerations already moved past this message's gen.
        const msgId = String(message?._id ?? '')
        if (msgId && cachedById.has(msgId)) {
          formattedMessages.push(cachedById.get(msgId))
          replayState = advanceCachedMessageGeneration(replayState, message)
          continue
        }

        const formatted = await formatMessage(message, replayState, replayMeta)
        replayState = formatted.nextState ?? replayState
        // toss anything we can't decrypt on replay, usually from epochs this
        // device wasn't a member for. showing "[Unable to decrypt message]" is
        // just noise.
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
        // drop cached decrypt-failure rows to keep history clean, real plaintext
        // from before the removal stays
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
    setOpening(true)
    // paint cached messages from eld right away, before the slow openGroup +
    // mls prep + replay below. new ones merge in after replay. this is what
    // makes reopening a group feel instant.
    getSavedMessages(userId, getGroupCacheId(activeGroupId))
      .then((cached) => {
        if (cancelled || !Array.isArray(cached) || cached.length === 0) return
        setMessages(cached.filter((m) => m?.text !== MLS_UNAVAILABLE_TEXT))
      })
      .catch(() => {})
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

    // defined up here so initial load queues before any live-message handler,
    // so groupCryptoStateRef is current before newGroupMessage tries to decrypt
    const enqueueLiveGroupMessageTask = (task) => {
      const queuedTask = liveMessageQueueRef.current.catch(() => {}).then(task)
      liveMessageQueueRef.current = queuedTask
      return queuedTask
    }

    // run the whole initial load on the live-message queue so a newGroupMessage
    // that shows up mid-replay waits and sees the final state
    enqueueLiveGroupMessageTask(async () => {
      const res = await new Promise((resolve) =>
        socket.emit('openGroup', { groupId: activeGroupId }, resolve)
      )
      if (cancelled || !res?.success) {
        if (!cancelled) setOpening(false)
        return
      }

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
      // now we know if it's mls. mlsPreparing drives the composer from here
      // (down while securing, up once keys land)
      setOpening(false)

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
            // openGroup already gave us the server epoch, pass it as a hint so
            // prepare can skip a second round-trip when our state is current
            knownServerEpoch: Number.isInteger(nextMeta.epoch) ? nextMeta.epoch : null,
          })
          if (prepared?.state) localState = prepared.state
          if (Number.isInteger(prepared?.serverEpoch)) {
            nextMeta.epoch = prepared.serverEpoch
            groupMetaRef.current = nextMeta
            setGroupMeta({ ...nextMeta })
          }
        } catch (err) {
          // epoch mismatch: hard-align then retry once
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
            // last resort, get the primary to sweep device leaves and resend
            // welcomes to fix the drift
            requestDeviceLeafSweep()
          }
        }
      }

      const cachedMessages = await getSavedMessages(userId, getGroupCacheId(activeGroupId))

      if (cancelled) return

      setGroupCryptoState(localState)
      groupCryptoStateRef.current = localState
      // older builds saved decrypt-failure rows, strip them before replay
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
      // drop decrypt-failure rows (old UNAVAILABLE text) so they don't render
      // or get saved again
      const visibleMessages = mergedMessages.filter((m) => m?.text !== MLS_UNAVAILABLE_TEXT)

      // save mergedMessages so cached plaintext doesn't get clobbered by a
      // replay failure. batched (parallel writes, one event) instead of the old
      // per-message loop that hit indexeddb serially on every open.
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

      // run on the same queue as the commit/welcome/message handlers so the
      // syncLocalStateFromServer write can't race an in-flight commit and stomp
      // the freshly-advanced epoch keys. otherwise a groupMemberAdded landing
      // near a groupCommit overwrites applicationSecret with the pre-add one and
      // the input sticks on "MLS state is not ready" until a refresh.
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

        // server roster updates before peers apply the remove commit, so don't
        // rewrite local roster/tree from it. groupCommit + replay handle that.
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

        // replay remove commits before prepareGroupMlsForSend. doing prepare
        // first ran catch-up on a stale roster and could save a null
        // applicationSecretB64 (the myInitPrivKeyB64 ReferenceError in EchoLogs).
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
            // align to server epoch then retry
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

        // the live groupCommit can get lost (handler not bound yet, queue race,
        // a brief disconnect). use the membership event to recover: fetch saved
        // artifacts and replay whatever we haven't applied. replay is idempotent,
        // commits at or below the current epoch are skipped.
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

        // save system rows replay made for commits the live handler missed, so
        // "X added Y" shows up without a refresh
        for (const message of replayed.formattedMessages) {
          if (!message?._id || message.messageType !== 'system') continue
          await updateSavedMessages(userId, getGroupCacheId(activeGroupId), message, setMessages)
        }

        // local state may have caught up, flush buffered ciphertext
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
            // state might not be ready (welcome/commit not in yet). buffer and
            // retry once it updates (groupWelcome, groupCommit, groupStateSynced)
            const key = String(groupId)
            const list = pendingEncryptedGroupMessagesRef.current.get(key) || []
            list.push({ groupId, ...message })
            pendingEncryptedGroupMessagesRef.current.set(key, list)

            // placeholder so the sidebar shows something happened
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

          // let dashboard bump the sidebar preview, no crypto state touched
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

      // only handle the welcome meant for this device
      const thisDeviceId = localStorage.getItem('echo-device-id')
      const targetClientId = welcome.recipientClientId ?? null
      if (targetClientId !== null && targetClientId !== thisDeviceId) return

      // same queue as commits/membership so a welcome can't race a commit
      // and leave stale crypto state behind
      return enqueueLiveGroupMessageTask(async () => {
        try {
          if (cancelled) return
          // device-specific mls priv if available, else the eld key
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
          // clear the removed flag so live messages flow again
          removedInfoRef.current = null

          // tell dashboard to drop any stale removed flag for this group
          try {
            window.dispatchEvent(new CustomEvent('groupStateSynced', { detail: { groupId } }))
          } catch {
            /* ignore */
          }

          // local system msg so the re-joined user gets a heads up
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

          // state's ready now, retry buffered messages
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
                // keep buffered, a later commit/welcome might fix it
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

      // share the live-message queue so a commit and a membership recovery
      // can't half-apply over each other
      return enqueueLiveGroupMessageTask(async () => {
        try {
          if (cancelled) return
          // use this device's mls init priv when we have it, keeps epoch secrets
          // in line with the welcome this device handled
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

          // our own commit: GroupHeader already built + saved nextState via
          // buildAddCommit/buildRemoveCommit. re-applying would rerun
          // applyUpdatePath with the stale device init priv after our leaf
          // rotated, giving a null commitSecret and applicationSecretB64=null.
          // grab GroupHeader's state if it's on eld already, otherwise just wait
          // for its groupStateSynced. falling through to applyCommit would write
          // junk and maybe clobber that sync if it lands later.
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
            // either way, never applyCommit our own commit. keeping the pre-remove
            // ref state is fine (applicationSecretB64 is still set from the last
            // epoch), and the pending groupStateSynced moves us forward when it fires.
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

          // commit bumped keys/epoch, retry buffered messages
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

          // retry buffered messages on external sync
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

    // typing indicator, per-member and name-aware
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

    // someone changed the group pic/description (server groupUpdated). on a pic
    // change drop a yellow "X changed group picture" row, deduped by _id like
    // the commit rows.
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
    // block: 'nearest' keeps scrollIntoView inside the messages container.
    // with 'start', mobile safari scrolls the whole window and shoves the
    // input toward the middle.
    messagesEndRef.current.scrollIntoView({ behavior, block: 'nearest' })
    isInitialLoadRef.current = false
  }, [messages])

  // mls on but no keys yet, pull pending device envelopes to get the
  // forwarded epoch secrets sooner
  useEffect(() => {
    if (groupMeta?.mlsEnabled && !hasGroupKeyMaterial(groupCryptoState)) {
      processIncomingEnvelopes(userId).catch(() => {})
    }
  }, [groupMeta?.mlsEnabled, groupCryptoState, userId])

  const sendMessageNow = async (text, imageData = null, replyTo = null) => {
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
          // trust the local epoch to skip an openGroup per send, server rejects
          // a stale one anyway (handled below)
          knownServerEpoch: Number.isInteger(currentMeta?.epoch) ? currentMeta.epoch : null,
        })
      } catch (err) {
        const raw = String(err?.message || err || '')
        const isEpochMismatch =
          /mls state epoch\s+\d+\s+(is behind|is ahead of)\s+server epoch\s+\d+/i.test(raw)
        if (isEpochMismatch) {
          // align to server epoch, then retry
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
          // deep drift (confirmation tag mismatch on catch-up). rebuild from
          // the welcome baseline + strict replay.
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
              // ask primary to sweep device leaves, wait briefly for sync
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
            // trace the abort so gecho shows why send didn't start
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
            throw err // rethrow, ui shows the disabled reason
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
        plaintextBytes: encodeGroupMessagePayload({ text, image: imageData, replyTo }),
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
        replyTo: replyTo ?? null,
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
              forwardGroupMessageToPairedDevices({
                userId,
                groupId: activeGroupId,
                text,
                image: imageData ?? null,
                replyTo: replyTo ?? null,
                messageId: ack.messageId,
                createdAt: ack.createdAt,
                seenStatus: true,
                username,
              }).catch(() => {})
              setGroupCryptoState(persistedState)
              groupCryptoStateRef.current = persistedState

              // no local echo, let the server broadcast (newGroupMessage) render
              // the outgoing row. pending plaintext is cached so the self-echo
              // decrypts right away.
              resolve(ack)
              return
            }

            // server rejected on epoch mismatch, hard-align then retry once
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
                    plaintextBytes: encodeGroupMessagePayload({ text, image: imageData, replyTo }),
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
                    replyTo: replyTo ?? null,
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
                        forwardGroupMessageToPairedDevices({
                          userId,
                          groupId: activeGroupId,
                          text,
                          image: imageData ?? null,
                          replyTo: replyTo ?? null,
                          messageId: ack2.messageId,
                          createdAt: ack2.createdAt,
                          seenStatus: true,
                          username,
                        }).catch(() => {})
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

  const sendMessage = (text, imageData = null, replyTo = null) => {
    const queuedSend = sendQueueRef.current
      .catch(() => {})
      .then(() => sendMessageNow(text, imageData, replyTo))

    sendQueueRef.current = queuedSend.catch(() => {})
    return queuedSend
  }

  // composer sits "down" (slim securing bar) while opening or waiting on mls
  // keys, pops up to the full input once mls is ready (or it's not mls).
  // removed members keep the disabled input so they can still read history.
  const mlsPreparing =
    !removedInfo && (opening || (groupMeta.mlsEnabled && !hasGroupKeyMaterial(groupCryptoState)))

  // name-aware label: "Alice is typing", "Alice and Bob are typing",
  // "Alice, Bob and Carol are typing", then "N people typing" past 3
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
            <DisplayText
              messages={messages}
              currentUserId={String(userId)}
              colorizeSenders
              onReply={(m) => setReplyTarget(buildReplyContext(m))}
            />
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <div className='shrink-0'>
        {mlsPreparing ? (
          // "down" state: mls not ready, just a spinner where the composer
          // will pop up
          <div className='flex items-center justify-center py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]'>
            <Loader2 size={32} className='animate-spin text-violet-300' />
          </div>
        ) : (
          // ready, full composer pops up into place
          <div className='composer-pop'>
            <TypingIndicator text={typingText} />
            <SendText
              sendMessage={sendMessage}
              disabled={Boolean(removedInfo)}
              disabledReason={removedInfo ? 'You are no longer a member of this group' : ''}
              groupId={String(activeGroupId)}
              replyTo={replyTarget}
              onCancelReply={() => setReplyTarget(null)}
            />
          </div>
        )}
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
