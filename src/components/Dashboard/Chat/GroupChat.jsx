import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { getSocket } from '../../../socket'
import DisplayText from './MessageDisplay/displayText'
import GroupSendText from './MessageInput/GroupSendText'

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
  updateSavedMessages,
} from './utils/chat/keyManagement'
import { decryptIncomingGroupMessage } from './utils/chat/groupMessageDecryption'
import {
  forwardGroupStateToPairedDevices,
  processIncomingEnvelopes,
} from '../../../utils/deviceForward'

const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()
const MLS_UNAVAILABLE_TEXT = '[Unable to decrypt message]'
const MLS_KEY_MISSING_REASON = 'MLS state is not ready on this device yet'
const DEFAULT_MLS_CIPHER_SUITE = 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256'
const GROUP_CACHE_PREFIX = 'group:'
const hasGroupKeyMaterial = (state) => Boolean(state?.applicationSecretB64 || state?.groupKeyB64)

const GroupChat = ({ activeGroupId, userId, username, currentWallpaper }) => {
  const socket = useMemo(() => getSocket(), [])
  const [messages, setMessages] = useState([])
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
  const pendingEncryptedGroupMessagesRef = useRef(new Map()) // groupId -> array of messages

  useEffect(() => {
    groupCryptoStateRef.current = groupCryptoState
  }, [groupCryptoState])

  useEffect(() => {
    groupMetaRef.current = groupMeta
  }, [groupMeta])

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

  const buildCommitSystemMessage = useCallback(
    ({ commit, priorState, message, actorUsername }) => {
      if (!commit || typeof commit !== 'object') return null

      const createdAt = message?.createdAt || message?.timestamp || new Date().toISOString()
      const actorName =
        actorUsername ||
        findMemberByLeafIndex(priorState?.roster, commit?.senderLeafIndex)?.username ||
        findMemberByLeafIndex(commit?.roster, commit?.senderLeafIndex)?.username ||
        'A member'
      const targetName =
        findMemberByUserId(priorState?.roster, commit?.targetUserId)?.username ||
        findMemberByUserId(commit?.roster, commit?.targetUserId)?.username ||
        'a member'

      let text = `${actorName} updated the group`
      if (commit?.type === 'add') {
        text = `${actorName} added ${targetName} to the group`
      } else if (commit?.type === 'remove') {
        const actorWasTarget =
          String(commit?.targetUserId ?? '') ===
          String(findMemberByLeafIndex(priorState?.roster, commit?.senderLeafIndex)?.userId ?? '')
        text = actorWasTarget
          ? `${actorName} left the group`
          : `${actorName} removed ${targetName} from the group`
      }

      return {
        _id:
          message?._id ||
          `commit:${String(commit?.groupId ?? activeGroupId)}:${String(commit?.epoch ?? createdAt)}`,
        userId: '',
        username: '',
        text,
        createdAt,
        seenStatus: true,
        messageType: 'system',
      }
    },
    [activeGroupId, findMemberByLeafIndex, findMemberByUserId]
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
        if (
          responseGroup?.mlsEnabled &&
          String(responseGroup?.createdBy ?? '') !== String(userId)
        ) {
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

        return createNewGroupState({
          groupId: activeGroupId,
          creatorUserId: userId,
          roster,
          cipherSuite: responseGroup?.cipherSuite ?? DEFAULT_MLS_CIPHER_SUITE,
        })
      }

      const nextState = {
        ...currentState,
        selfLeafIndex: serverLeafIndex,
        roster,
      }

      const rosterChanged = JSON.stringify(currentState.roster ?? []) !== JSON.stringify(roster)
      const needsSave = rosterChanged || currentState.selfLeafIndex !== nextState.selfLeafIndex

      return needsSave ? saveGroupState(activeGroupId, nextState) : nextState
    },
    [activeGroupId, userId]
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
      let nextState = cryptoState

      const hasAppMessage =
        meta?.mlsEnabled &&
        message?.contentType === 'application' &&
        (message?.encryptedSenderDataB64 || message?.headerB64) &&
        message?.ciphertextB64
      if (hasAppMessage) {
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
          text = TEXT_DECODER.decode(plaintextBytes)
        } catch (err) {
          console.error('[GroupChat] Failed to decrypt MLS message:', err)
          text = MLS_UNAVAILABLE_TEXT
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
      const myInitPrivKeyB64 =
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
          if (Number.isInteger(replayState?.epoch) && commit.epoch <= replayState.epoch) {
            if (systemMessage) formattedMessages.push(systemMessage)
            continue
          }

          try {
            replayState = await applyCommit({ state: replayState, commit, myInitPrivKeyB64 })
            replayState = await saveGroupState(activeGroupId, replayState)
            replayMeta = {
              ...replayMeta,
              epoch: Number.isInteger(commit?.epoch) ? commit.epoch : replayMeta.epoch,
            }
            if (systemMessage) formattedMessages.push(systemMessage)
          } catch (err) {
            console.warn('[GroupChat] Skipping stored MLS commit during replay:', err)
          }
          continue
        }

        if (initialMeta?.mlsEnabled && message?.contentType === 'welcome') {
          const welcome = parseArtifactPayload(message)
          if (!welcome || String(welcome.recipientUserId ?? '') !== String(userId)) continue
          const hasKeyMaterial = Boolean(
            replayState?.applicationSecretB64 || replayState?.groupKeyB64
          )
          if (
            hasKeyMaterial &&
            Number.isInteger(replayState?.epoch) &&
            welcome.epoch <= replayState.epoch
          ) {
            continue
          }

          try {
            replayState = await processWelcome({ welcome, selfUserId: userId, myInitPrivKeyB64 })
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
          continue
        }

        const formatted = await formatMessage(message, replayState, replayMeta)
        replayState = formatted.nextState ?? replayState
        formattedMessages.push(formatted.formattedMessage)
      }

      return { formattedMessages, replayState, replayMeta }
    },
    [activeGroupId, buildCommitSystemMessage, formatMessage, parseArtifactPayload, userId]
  )

  useEffect(() => {
    if (!activeGroupId) return
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

      const localState = await syncLocalStateFromServer({
        roster,
        responseGroup: res?.group,
        responseMembership: res?.membership,
      })
      const cachedMessages = await getSavedMessages(userId, getGroupCacheId(activeGroupId))

      if (cancelled) return

      setGroupCryptoState(localState)
      groupCryptoStateRef.current = localState
      setMessages(Array.isArray(cachedMessages) ? cachedMessages : [])

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
      const mergedMessages = mergeCachedMessages(cachedMessages, replayed.formattedMessages)

      // Save using mergedMessages so cached plaintext is never overwritten by a
      // decryption failure text from the replay pass.
      for (const message of mergedMessages) {
        if (!message?._id) continue
        await updateSavedMessages(userId, getGroupCacheId(activeGroupId), message)
      }

      if (!cancelled) {
        setMessages(mergedMessages)
        setGroupCryptoState(persistedReplayState)
        groupCryptoStateRef.current = persistedReplayState
        setGroupMeta(replayed.replayMeta)
        groupMetaRef.current = replayed.replayMeta
      }
    })

    const handleMembershipChanged = (evt) => {
      if (String(evt?.groupId ?? '') !== String(activeGroupId)) return

      socket.emit('openGroup', { groupId: activeGroupId }, async (res) => {
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

        const nextState = await syncLocalStateFromServer({
          roster,
          responseGroup: res?.group,
          responseMembership: res?.membership,
        })

        if (!cancelled) {
          setGroupCryptoState(nextState)
          groupCryptoStateRef.current = nextState
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
            window.dispatchEvent(
              new CustomEvent('groupMessagePreview', {
                detail: {
                  groupId,
                  text: formattedMessage.text ?? '',
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

    const handleGroupWelcome = async ({ groupId, welcome }) => {
      if (String(groupId ?? '') !== String(activeGroupId)) return

      // Each device only processes the Welcome addressed to it.
      const thisDeviceId = localStorage.getItem('echo-device-id')
      const targetClientId = welcome.recipientClientId ?? null
      if (targetClientId !== null && targetClientId !== thisDeviceId) return

      try {
        // Use the device-specific MLS private key if available; fall back to ELD key.
        const myInitPrivKeyB64 =
          localStorage.getItem('echo-device-mls-priv') ||
          (await getIdentityKeys())?.privateKeyX25519 ||
          null

        const nextState = await processWelcome({
          welcome,
          selfUserId: userId,
          myInitPrivKeyB64,
        })

        const persistedState = await saveGroupState(activeGroupId, nextState)
        forwardGroupStateToPairedDevices(userId, activeGroupId, persistedState).catch(() => {})

        if (cancelled) return
        setGroupCryptoState(persistedState)
        groupCryptoStateRef.current = persistedState

        // Retry any buffered messages now that state is available
        const key = String(groupId)
        const pending = pendingEncryptedGroupMessagesRef.current.get(key) || []
        if (pending.length > 0) {
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
              // If it still fails, keep it buffered; a subsequent commit may fix it
            }
          }
          // Clear only those that succeeded; simplest: clear all and rely on future arrival to re-buffer if still failing
          pendingEncryptedGroupMessagesRef.current.set(key, [])
        }
      } catch (err) {
        console.error('[GroupChat] Failed to process group welcome:', err)
      }
    }

    const handleGroupCommit = async ({ groupId, commit }) => {
      if (String(groupId ?? '') !== String(activeGroupId)) return

      try {
        // Use this device's MLS init private key when available to keep epoch
        // secrets consistent with the Welcome processed on this device.
        const identityKeys = await getIdentityKeys()
        const myInitPrivKeyB64 =
          localStorage.getItem('echo-device-mls-priv') || identityKeys?.privateKeyX25519 || null
        const priorState = groupCryptoStateRef.current
        const systemMessage = buildCommitSystemMessage({ commit, priorState })

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
              // keep buffered
            }
          }
          pendingEncryptedGroupMessagesRef.current.set(key, [])
        }
      } catch (err) {
        console.error('[GroupChat] Failed to apply group commit:', err)
      }
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

    socket.on('groupCommit', handleGroupCommit)
    socket.on('groupWelcome', handleGroupWelcome)
    socket.on('newGroupMessage', handleNewGroupMessage)
    socket.on('groupMemberAdded', handleMembershipChanged)
    socket.on('groupMemberRemoved', handleMembershipChanged)
    window.addEventListener('localStorageUpdated', handleStoredGroupMessage)
    window.addEventListener('groupStateSynced', handleGroupStateSynced)

    return () => {
      cancelled = true
      socket.off('groupCommit', handleGroupCommit)
      socket.off('groupWelcome', handleGroupWelcome)
      socket.off('newGroupMessage', handleNewGroupMessage)
      socket.off('groupMemberAdded', handleMembershipChanged)
      socket.off('groupMemberRemoved', handleMembershipChanged)
      window.removeEventListener('localStorageUpdated', handleStoredGroupMessage)
      window.removeEventListener('groupStateSynced', handleGroupStateSynced)
    }
  }, [
    activeGroupId,
    buildCommitSystemMessage,
    buildRoster,
    formatMessage,
    getGroupCacheId,
    replayFetchedMessages,
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

  const sendMessage = async (text) => {
    const currentMeta = groupMetaRef.current

    if (currentMeta?.mlsEnabled) {
      const currentState = groupCryptoStateRef.current
      if (!hasGroupKeyMaterial(currentState)) {
        throw new Error(MLS_KEY_MISSING_REASON)
      }

      const encrypted = await encryptApplicationMessage({
        state: currentState,
        plaintextBytes: TEXT_ENCODER.encode(text),
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
      })

      return new Promise((resolve, reject) => {
        socket.emit(
          'sendGroupMessage',
          {
            groupId: activeGroupId,
            nonce: encrypted.nonceB64,
            messageType: 'text',
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
              resolve(ack)
              return
            }

            const msg = ack?.details
              ? `${ack?.error || 'Failed to send group message'}: ${ack.details}`
              : ack?.error || 'Failed to send group message'
            deletePendingOutgoingGroupMessage(pendingOutgoingMessage)
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

  const sendDisabled = groupMeta.mlsEnabled && !hasGroupKeyMaterial(groupCryptoState)

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
        <GroupSendText
          sendMessage={sendMessage}
          disabled={sendDisabled}
          disabledReason={MLS_KEY_MISSING_REASON}
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
}

export default GroupChat
