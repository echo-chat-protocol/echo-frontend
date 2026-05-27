import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react'

const DeviceSyncModal = lazy(() => import('../../features/devices/DeviceSyncModal'))
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Lock, MessageCircle, Menu, ArrowLeft } from 'lucide-react'
import PropTypes from 'prop-types'
import Friends from './Friends/Friends'
import Chat from './Chat/Chat'
import Sidebar from './DashboardComponents/Sidebar/Sidebar'
import ChatHeader from './DashboardComponents/Header/ChatHeader'
import GroupHeader from './DashboardComponents/Header/GroupHeader'
import SettingsView from './Settings/Settings'
import ChatList from './DashboardComponents/Conversations/ChatList'
import UserInfoPanel from './UserInfo/UserInfoPanel'
import ConstellationBg from './ConstellationBg'
import GroupsView from './Groups/GroupsView'
import NewChatModal from './DashboardComponents/NewChatModal/NewChatModal'

import { useConversations } from './DashboardComponents/hooks/useConversations'
import { useGroups } from './DashboardComponents/hooks/useGroups'

import {
  getUserData,
  fetchUserProfileFromSocket,
  getCachedUserProfile,
  formatProfileImage,
} from './DashboardComponents/utils/helpers'
import { WALLPAPER_PREVIEWS } from './DashboardComponents/utils/wallpaper'
import { getSocket, connectSocket } from '../../socket'
import IncomingCallNotification from '../VideoCall/IncomingCallNotification'
import {
  getIdentityKeys,
  getSavedMessages,
  updateSavedMessages,
} from './Chat/utils/chat/keyManagement'

import { decryptIncomingGroupMessage } from './Chat/utils/chat/groupMessageDecryption'
import {
  applyCommit,
  buildAddCommit,
  loadGroupState,
  saveGroupState,
  processWelcome,
} from './Chat/utils/crypto/groupCryptoProvider'
import { decryptIncomingMessage } from './Chat/utils/chat/messageDecryption'
import { base64ToArrayBuffer } from './Chat/utils/helpers'
import { generateOneTimePreKeys } from './Chat/utils/crypto/opk'
import { createOpkReplenishHandler, requestOpkStatusAndReplenish } from '../../utils/opk/replenish'
import { rotateSPKIfNeeded } from '../../utils/spk/rotate'
import eld from '../../utils/storage/EncryptedLocalDatabase'
import {
  processRawDeviceEnvelope,
  processIncomingEnvelopes,
  broadcastSessionSync,
  invalidatePairedDevicesCache,
  forwardGroupStateToPairedDevices,
} from '../../utils/deviceForward'
import wasmInit, { diffie_hellman } from '@mascaro101/echo-protocol'
import { getDeviceMetadata } from '../../features/devices/deviceMetadata'
import { revokeCurrentDeviceForLogout } from '../../features/devices/logoutDevice'
// import GroupList from './DashboardComponents/Groups/GroupList'
import CreateGroupModal from './Groups/CreateGroupModal'
import GroupChat from './Chat/GroupChat'
import { tokenStorage } from '@services/api'

const Dashboard = () => {
  const { t } = useTranslation()
  const token = tokenStorage.getAccess()
  const navigate = useNavigate()
  const { username, userId, profileImage } = getUserData(token)

  // Estados
  const [activeChat, setActiveChat] = useState(null)
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('dashboardView') || 'chats'
  })
  const [conversationsSearchTerm, setConversationsSearchTerm] = useState('')

  const [unreadMessages, setUnreadMessages] = useState(() => {
    const unread = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(`unread-${userId}-`)) {
        const senderId = String(key.replace(`unread-${userId}-`, ''))
        const count = parseInt(localStorage.getItem(key) || '0', 10)
        if (count > 0) {
          unread[senderId] = count
        }
      }
    }
    return unread
  })
  const [unreadGroupMessages, setUnreadGroupMessages] = useState(() => {
    const unread = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(`unreadGroup-${userId}-`)) {
        const gid = String(key.replace(`unreadGroup-${userId}-`, ''))
        const count = parseInt(localStorage.getItem(key) || '0', 10)
        if (count > 0) unread[gid] = count
      }
    }
    return unread
  })
  const currentWallpaper = (() => {
    const saved = localStorage.getItem('chatWallpaper')
    return saved && WALLPAPER_PREVIEWS[saved] ? saved : 'default'
  })()

  const [userProfileImage, setUserProfileImage] = useState(profileImage)
  const [socket, setSocket] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true'
  })
  const [showDeviceSync, setShowDeviceSync] = useState(false)
  const [removedGroups, setRemovedGroups] = useState({})
  // When navigating to Settings, this lets us open a specific section (e.g., 'devices') once
  const [settingsInitialSection, setSettingsInitialSection] = useState(null)
  const GROUP_CACHE_PREFIX = 'group:'
  // Hooks personalizados - must be before useEffects that use them
  const { recentConversations, updateRecentConversations } = useConversations(userId)
  const { groups, setAllGroups, upsertGroup, removeGroup } = useGroups(userId)
  const messagesEndRef = useRef(null)
  // const conversationsListRef = useRef(null)
  const showMobileChatRef = useRef(showMobileChat)
  const mobileChatHistoryPushedRef = useRef(false)
  const hasRefreshedProfiles = useRef(false)
  const activeChatRef = useRef(activeChat)
  const recentConversationsRef = useRef(recentConversations)
  const userIdRef = useRef(userId)
  const mlsKeyPackagePublishedRef = useRef(false)
  const mlsKeyPackageRetryTimeoutRef = useRef(null)
  const pendingGroupMessageTasksRef = useRef(new Map())
  const pendingEncryptedGroupMessagesRef = useRef(new Map())
  const removedGroupsRef = useRef(removedGroups)

  const updateRecentConversationsRef = useRef(updateRecentConversations)
  const setAllGroupsRef = useRef(setAllGroups)
  const upsertGroupRef = useRef(upsertGroup)
  const removeGroupRef = useRef(removeGroup)

  const enqueueGroupMessageTask = (groupId, task) => {
    const queue = pendingGroupMessageTasksRef.current
    const previousTask = queue.get(groupId) ?? Promise.resolve()
    const currentTask = previousTask.catch(() => {}).then(task)

    queue.set(groupId, currentTask)
    currentTask.finally(() => {
      if (queue.get(groupId) === currentTask) {
        queue.delete(groupId)
      }
    })

    return currentTask
  }

  useEffect(() => {
    activeChatRef.current = activeChat
  }, [activeChat])

  useEffect(() => {
    showMobileChatRef.current = showMobileChat
  }, [showMobileChat])

  useEffect(() => {
    const isMobileViewport = () =>
      typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

    if (showMobileChat && isMobileViewport() && !mobileChatHistoryPushedRef.current) {
      window.history.pushState({ echoMobileChat: true }, '', window.location.href)
      mobileChatHistoryPushedRef.current = true
    }
  }, [showMobileChat])

  useEffect(() => {
    const handlePopState = () => {
      if (!mobileChatHistoryPushedRef.current || !showMobileChatRef.current) return
      mobileChatHistoryPushedRef.current = false
      setShowMobileChat(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    recentConversationsRef.current = recentConversations
  }, [recentConversations])

  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  useEffect(() => {
    removedGroupsRef.current = removedGroups
  }, [removedGroups])

  useEffect(() => {
    updateRecentConversationsRef.current = updateRecentConversations
  }, [updateRecentConversations])

  useEffect(() => {
    setAllGroupsRef.current = setAllGroups
  }, [setAllGroups])

  useEffect(() => {
    upsertGroupRef.current = upsertGroup
  }, [upsertGroup])

  useEffect(() => {
    removeGroupRef.current = removeGroup
  }, [removeGroup])

  useEffect(() => {
    return () => {
      if (mlsKeyPackageRetryTimeoutRef.current) {
        clearTimeout(mlsKeyPackageRetryTimeoutRef.current)
        mlsKeyPackageRetryTimeoutRef.current = null
      }
    }
  }, [])

  // Persist userId once on mount
  useEffect(() => {
    if (userId) localStorage.setItem('userId', userId)
  }, [userId])

  // Rotate SPK if older than 30 days
  useEffect(() => {
    if (!socket || !eld.isUnlocked?.()) return
    rotateSPKIfNeeded({ socket, eld }).catch(console.error)
  }, [socket])

  useEffect(() => {
    if (!token || !userId) return

    const sharedSocket = getSocket()
    setSocket(sharedSocket)

    // Always (re)attach auth and connect. If already connected with a stale/empty auth,
    // connectSocket() will reconnect with the latest token.
    connectSocket()

    const handleOpkReplenishRequested = createOpkReplenishHandler({
      socket: sharedSocket,
      eld,
      generateOneTimePreKeys,
      maxBatch: 200,
    })

    const clearMlsKeyPackageRetry = () => {
      if (mlsKeyPackageRetryTimeoutRef.current) {
        clearTimeout(mlsKeyPackageRetryTimeoutRef.current)
        mlsKeyPackageRetryTimeoutRef.current = null
      }
    }

    const scheduleMlsKeyPackageRetry = () => {
      if (mlsKeyPackagePublishedRef.current || mlsKeyPackageRetryTimeoutRef.current) return

      mlsKeyPackageRetryTimeoutRef.current = setTimeout(() => {
        mlsKeyPackageRetryTimeoutRef.current = null
        void publishMlsKeyPackage()
      }, 3000)
    }

    const publishMlsKeyPackage = async () => {
      if (!sharedSocket.connected) {
        scheduleMlsKeyPackageRetry()
        return false
      }

      try {
        const identityKeys = await getIdentityKeys()
        if (!identityKeys?.publicKeyX25519) {
          scheduleMlsKeyPackageRetry()
          return false
        }

        const deviceId = localStorage.getItem('echo-device-id')
        const mlsPub = localStorage.getItem('echo-device-mls-pub') || identityKeys.publicKeyX25519
        return await new Promise((resolve) => {
          sharedSocket.emit(
            'publishKeyPackage',
            { initKeyB64: mlsPub, clientId: deviceId || null },
            (res) => {
              if (res?.success) {
                mlsKeyPackagePublishedRef.current = true
                clearMlsKeyPackageRetry()
                resolve(true)
                return
              }

              console.warn('[MLS] Failed to publish KeyPackage:', res?.error)
              scheduleMlsKeyPackageRetry()
              resolve(false)
            }
          )
        })
      } catch (err) {
        console.warn('[MLS] Could not load identity keys for KeyPackage publish:', err)
        scheduleMlsKeyPackageRetry()
        return false
      }
    }

    const onConnect = () => {
      mlsKeyPackagePublishedRef.current = false
      clearMlsKeyPackageRetry()

      sharedSocket.emit('listMyGroups', {}, (res) => {
        if (res?.success && Array.isArray(res.groups)) {
          setAllGroupsRef.current?.(res.groups)
        }
      })

      fetchUserProfileFromSocket(sharedSocket, userId)
        .then((profileData) => {
          if (profileData.profilePicture) {
            const formattedImage = formatProfileImage(profileData.profilePicture, username)
            setUserProfileImage(formattedImage)
          }
        })
        .catch((error) => {
          console.error('Error fetching user profile:', error)
        })

      if (!hasRefreshedProfiles.current && recentConversations.length > 0) {
        hasRefreshedProfiles.current = true

        recentConversations.forEach((conversation) => {
          const conversationUserId = conversation.id || conversation.targetUserId
          if (conversationUserId) {
            sharedSocket.emit('getUserInfo', { userId: conversationUserId }, (response) => {
              if (response.success && response.user) {
                const formattedImage = formatProfileImage(
                  response.user.profilePicture,
                  response.user.username
                )
                const updatedUser = {
                  id: conversationUserId,
                  username: response.user.username,
                  profileImage: formattedImage,
                  targetUserId: conversationUserId,
                }

                updateRecentConversations(updatedUser, null)

                localStorage.setItem(
                  `profile-${conversationUserId}`,
                  JSON.stringify({
                    username: response.user.username,
                    profilePicture: response.user.profilePicture,
                  })
                )
              }
            })
          }
        })
      }

      requestOpkStatusAndReplenish({ socket: sharedSocket, handler: handleOpkReplenishRequested })

      void publishMlsKeyPackage()
    }

    if (sharedSocket.connected) {
      onConnect()
    } else {
      sharedSocket.on('connect', onConnect)
    }

    const handleDisconnect = () => {
      mlsKeyPackagePublishedRef.current = false
      clearMlsKeyPackageRetry()
    }

    sharedSocket.on('disconnect', handleDisconnect)

    sharedSocket.on('incomingCall', (callData) => {
      setIncomingCall(callData)
    })

    sharedSocket.on('callEnded', ({ callId }) => {
      setIncomingCall((current) => {
        if (current && current.callId === callId) {
          return null
        }
        return current
      })
    })

    // Server-requested OPK replenishment (public keys only).
    sharedSocket.on('replenishOPKs', handleOpkReplenishRequested)

    sharedSocket.on('userProfileUpdated', (data) => {
      const { userId: updatedUserId, username, profilePicture } = data

      updateRecentConversations((prevConversations) => {
        return prevConversations.map((conv) => {
          if (conv.id === updatedUserId || conv.targetUserId === updatedUserId) {
            const formattedImage = formatProfileImage(profilePicture, username)
            return {
              ...conv,
              username: username || conv.username,
              profileImage: formattedImage,
            }
          }
          return conv
        })
      })

      setActiveChat((prevActiveChat) => {
        if (
          prevActiveChat &&
          (prevActiveChat.id === updatedUserId || prevActiveChat.targetUserId === updatedUserId)
        ) {
          const formattedImage = formatProfileImage(profilePicture, username)
          return {
            ...prevActiveChat,
            username: username || prevActiveChat.username,
            profileImage: formattedImage,
          }
        }
        return prevActiveChat
      })

      const cachedProfile = localStorage.getItem(`profile-${updatedUserId}`)
      if (cachedProfile) {
        try {
          const parsed = JSON.parse(cachedProfile)
          localStorage.setItem(
            `profile-${updatedUserId}`,
            JSON.stringify({
              ...parsed,
              username: username || parsed.username,
              profilePicture: profilePicture,
            })
          )
        } catch (e) {
          console.error('Error updating cached profile:', e)
        }
      }
    })

    const handleGroupAdded = (g) => {
      if (!g) return
      const groupId = String(g.groupId ?? g.id ?? '')
      if (!groupId) return
      // Clearing the removed flag is essential when this is a re-add after a
      // prior removal: the merged group entry would otherwise inherit
      // `removedFromGroup: true` from the previous handleGroupRemoved call,
      // which gates message notifications at handleNewGroupMessageNotification.
      upsertGroupRef.current?.({
        ...g,
        groupId,
        name: g.name || g.groupName || 'Group',
        joinedAt: g.joinedAt || g.at,
        removedFromGroup: false,
        removedInfo: null,
      })
      clearRemovalForGroup(groupId)
    }

    const handleGroupUpdated = (payload) => {
      const group = payload?.group ?? payload
      if (!group) return

      const groupId = String(group.groupId ?? group.id ?? '')
      if (!groupId) return

      upsertGroupRef.current?.({
        ...group,
        groupId,
        name: group.name || 'Group',
      })

      setActiveChat((prevActiveChat) => {
        if (prevActiveChat?.type !== 'group' || String(prevActiveChat.groupId) !== groupId) {
          return prevActiveChat
        }

        return {
          ...prevActiveChat,
          ...group,
          type: 'group',
          groupId,
          name: group.name || prevActiveChat.name || 'Group',
        }
      })
    }

    const buildRemovedGroupInfo = (payload = {}) => {
      const gid = String(payload?.groupId ?? '')
      const removerName =
        payload?.removedByUsername ||
        (String(payload?.removedByUserId ?? '') === String(userIdRef.current ?? '')
          ? 'You'
          : 'Someone')
      const at = payload?.at || new Date().toISOString()

      return {
        groupId: gid,
        memberId: String(payload?.memberId ?? userIdRef.current ?? ''),
        removedByUserId: payload?.removedByUserId ? String(payload.removedByUserId) : null,
        removedByUsername: removerName,
        groupName: payload?.groupName || 'Group',
        at,
        text:
          String(payload?.removedByUserId ?? '') === String(userIdRef.current ?? '')
            ? 'You left the group'
            : `${removerName} removed you from the group`,
      }
    }

    const handleGroupRemoved = (payload = {}) => {
      const { groupId } = payload
      const gid = String(groupId ?? '')
      if (!gid) return
      const removedInfo = buildRemovedGroupInfo(payload)
      removedGroupsRef.current = {
        ...removedGroupsRef.current,
        [gid]: removedInfo,
      }
      setRemovedGroups(removedGroupsRef.current)
      upsertGroupRef.current?.(
        {
          groupId: gid,
          name: payload?.groupName || activeChatRef.current?.name || 'Group',
          removedFromGroup: true,
          removedInfo,
        },
        { timestamp: removedInfo.at, text: removedInfo.text }
      )
      setUnreadGroupMessages((prev) => {
        const next = { ...prev }
        delete next[gid]
        localStorage.removeItem(`unreadGroup-${userIdRef.current}-${gid}`)
        return next
      })
      const currentActive = activeChatRef.current
      if (currentActive?.type === 'group' && String(currentActive.groupId) === gid) {
        setActiveChat({
          ...currentActive,
          removedFromGroup: true,
          removedInfo,
        })
      }
    }

    const handleGroupMemberRemoved = (payload = {}) => {
      if (String(payload?.memberId ?? '') !== String(userIdRef.current ?? '')) return
      handleGroupRemoved(payload)
    }

    const clearRemovalForGroup = (gidRaw) => {
      const gid = String(gidRaw ?? '')
      if (!gid) return
      if (!removedGroupsRef.current[gid]) return
      const next = { ...removedGroupsRef.current }
      delete next[gid]
      removedGroupsRef.current = next
      setRemovedGroups(next)
      // If the active chat is this group, clear its removed flags
      setActiveChat((prev) => {
        if (prev?.type !== 'group' || String(prev.groupId) !== gid) return prev
        return {
          ...prev,
          type: 'group',
          groupId: prev.groupId,
          removedFromGroup: false,
          removedInfo: null,
        }
      })
      upsertGroupRef.current?.({ groupId: gid, removedFromGroup: false, removedInfo: null })
    }

    const handleGroupMemberAdded = (payload = {}) => {
      // If the current user was re-added, clear any stale removed flag
      if (String(payload?.memberId ?? '') !== String(userIdRef.current ?? '')) return
      clearRemovalForGroup(payload?.groupId)
    }

    const handleNewGroupMessageNotification = async (message) => {
      if (!message?.groupId) return
      const gid = String(message.groupId)
      if (removedGroupsRef.current[gid]) return
      return enqueueGroupMessageTask(gid, async () => {
        const currentActive = activeChatRef.current
        const isActiveGroup =
          currentActive?.type === 'group' && String(currentActive.groupId) === gid
        const isOwnMessage = String(message?.userId ?? '') === String(userIdRef.current ?? '')
        const timestamp = message.createdAt || message.timestamp || new Date().toISOString()

        if (isActiveGroup) {
          return
        }

        let msgText =
          typeof message.payload === 'string'
            ? message.payload
            : typeof message.text === 'string'
              ? message.text
              : ''

        try {
          const result = await decryptIncomingGroupMessage({
            message,
            userId: userIdRef.current,
            username,
          })
          msgText = result?.formattedMessage?.text ?? msgText
        } catch {
          console.warn('[Dashboard] Failed to decrypt incoming group message')
          // Do not persist placeholder into storage — background state may not be ready yet
          // (e.g., Welcome not processed). The GroupChat replay will fetch and decrypt
          // properly on first open. For the sidebar preview, show a generic placeholder.
          msgText = '[Unable to decrypt message]'
        }

        upsertGroupRef.current?.(
          { groupId: gid, name: message.groupName || 'Group' },
          { timestamp, text: msgText }
        )

        if (!isActiveGroup && !isOwnMessage) {
          setUnreadGroupMessages((prev) => {
            const nextCount = (prev[gid] || 0) + 1
            const next = { ...prev, [gid]: nextCount }
            localStorage.setItem(`unreadGroup-${userIdRef.current}-${gid}`, String(nextCount))
            return next
          })
        }
      })
    }

    const handleNewMessageNotification = async (messageData) => {
      const messages = Array.isArray(messageData) ? messageData : [messageData]

      const identityKeys = await getIdentityKeys()
      if (!identityKeys?.privateKeyX25519) {
        console.error('[Dashboard] No private key available in ELD')
        return
      }

      const privateKeyArray = base64ToArrayBuffer(identityKeys.privateKeyX25519)

      for (const message of messages) {
        const currentUserId = String(userIdRef.current)
        const messageSenderId = String(message.userId)
        const activeChatId = activeChatRef.current?.id ? String(activeChatRef.current.id) : null

        if (message.userId && messageSenderId !== currentUserId) {
          const senderId = messageSenderId

          if (senderId === activeChatId) {
            continue
          }

          const existingMessages = await getSavedMessages(userIdRef.current, senderId)
          if (existingMessages.some((msg) => msg._id === message._id)) {
            continue
          }

          try {
            if (message.messageType === 'call_event') {
              await updateSavedMessages(userIdRef.current, senderId, message, null)
              continue
            }

            if (!message.payload || !message.nonce || !message.publicEphemeralKey) {
              console.warn('⚠️ [Dashboard] Skipping background decryption (missing fields)')
              continue
            }

            const nonce = base64ToArrayBuffer(message.nonce || '')
            await decryptIncomingMessage(
              message,
              nonce,
              userIdRef.current,
              senderId,
              privateKeyArray,
              sharedSocket,
              null
            )
          } catch (error) {
            console.error('❌ [Dashboard] Failed to decrypt message in background:', error)
          }

          if (senderId !== activeChatId)
            setUnreadMessages((prev) => {
              const currentUnread = prev[senderId] || 0
              const newCount = currentUnread + 1

              localStorage.setItem(`unread-${userIdRef.current}-${senderId}`, newCount)

              return {
                ...prev,
                [senderId]: newCount,
              }
            })

          const conversationExists = recentConversationsRef.current.some(
            (conv) => String(conv.id) === senderId
          )

          if (!conversationExists) {
            const placeholderUser = {
              id: senderId,
              username: message.username || `User ${senderId}`,
              profileImage: null,
            }

            updateRecentConversationsRef.current?.(placeholderUser, {
              text: '',
              timestamp: message.timestamp || message.createdAt || new Date().toISOString(),
            })

            sharedSocket.emit('getUserInfo', { userId: senderId }, (response) => {
              if (response.success && response.user) {
                const conversationUser = {
                  id: senderId,
                  username: response.user.username,
                  profileImage: response.user.profilePicture,
                }

                updateRecentConversationsRef.current?.(conversationUser, null)
              } else {
                console.error('❌ Failed to fetch user info')
              }
            })
          } else {
            const existingConv = recentConversationsRef.current.find(
              (conv) => String(conv.id) === senderId
            )
            if (existingConv) {
              updateRecentConversationsRef.current?.(existingConv, {
                text: '',
                timestamp: message.timestamp || message.createdAt || new Date().toISOString(),
              })
            }
          }
        }
      }
    }

    // Retry buffered encrypted group messages after group state lands on this device
    const handleGroupStateSynced = async (event) => {
      const gid = String(event?.detail?.groupId ?? '')
      if (!gid) return
      const pending = pendingEncryptedGroupMessagesRef.current.get(gid) || []
      if (pending.length === 0) return
      const stillPending = []
      for (const m of pending) {
        try {
          await decryptIncomingGroupMessage({ message: m, userId: userIdRef.current, username })
        } catch {
          stillPending.push(m)
        }
      }
      pendingEncryptedGroupMessagesRef.current.set(gid, stillPending)
    }

    sharedSocket.on('newMessage', handleNewMessageNotification)
    sharedSocket.on('groupAdded', handleGroupAdded)
    sharedSocket.on('groupUpdated', handleGroupUpdated)
    sharedSocket.on('groupRemoved', handleGroupRemoved)
    sharedSocket.on('groupMemberRemoved', handleGroupMemberRemoved)
    sharedSocket.on('groupMemberAdded', handleGroupMemberAdded)
    sharedSocket.on('newGroupMessage', handleNewGroupMessageNotification)
    window.addEventListener('groupStateSynced', handleGroupStateSynced)

    // Process Welcome messages in the background so sibling devices receive
    // epoch secrets even if the group view isn't open on this device.
    const handleGroupWelcomeBackground = async ({ groupId, welcome }) => {
      if (!groupId || !welcome) return
      const gid = String(groupId)

      // Process only if addressed to this device (when specified)
      const thisDeviceId = localStorage.getItem('echo-device-id')
      const targetClientId = welcome.recipientClientId ?? null
      if (targetClientId !== null && targetClientId !== thisDeviceId) return

      try {
        const existing = await loadGroupState(gid).catch(() => null)
        // Only skip when the stored state is at least as fresh as the incoming
        // welcome. A leftover state from a prior membership (before a removal)
        // will still have applicationSecretB64 set but a lower epoch — that
        // case must process the welcome, otherwise the re-added user keeps
        // stale keys and the removed flag never clears.
        const incomingEpoch = Number.isInteger(welcome?.epoch) ? welcome.epoch : 0
        const existingEpoch = Number.isInteger(existing?.epoch) ? existing.epoch : -1
        if (existing?.applicationSecretB64 && existingEpoch >= incomingEpoch) return

        const identityKeys = await getIdentityKeys()
        const myInitPrivKeyB64 =
          localStorage.getItem('echo-device-mls-priv') || identityKeys?.privateKeyX25519 || null
        if (!myInitPrivKeyB64) return

        const nextState = await processWelcome({
          welcome,
          selfUserId: userIdRef.current,
          myInitPrivKeyB64,
        })
        const persisted = await saveGroupState(gid, nextState)
        forwardGroupStateToPairedDevices(userIdRef.current, gid, persisted).catch(() => {})

        // Nudge any listeners (e.g., GroupChat) to refresh state
        window.dispatchEvent(new CustomEvent('groupStateSynced', { detail: { groupId: gid } }))

        // Clear any stale removed flag for this group (user has been welcomed back)
        clearRemovalForGroup(gid)
      } catch (err) {
        console.warn('[Dashboard] Background Welcome processing failed:', err)
      }
    }
    sharedSocket.on('groupWelcome', handleGroupWelcomeBackground)

    // Apply MLS commits at the Dashboard level so sibling devices (and any
    // device whose GroupChat for the affected group isn't currently mounted)
    // still advance their local epoch on add/remove. Without this, only the
    // primary device that has the chat open processes `groupCommit`, and the
    // synced sibling's roster and key material drift until they manually
    // open the group.
    //
    // Serialized via a per-group promise queue so two commits for the same
    // group can't race on EncryptedLocalDatabase reads/writes. Idempotent on
    // epoch: if our state already covers this commit, we no-op so GroupChat's
    // in-component handler can still take ownership when it's mounted.
    const groupCommitQueues = new Map()
    const enqueueGroupCommitTask = (groupId, task) => {
      const gid = String(groupId)
      const prev = groupCommitQueues.get(gid) ?? Promise.resolve()
      const next = prev.catch(() => {}).then(task)
      groupCommitQueues.set(
        gid,
        next.catch(() => {})
      )
      return next
    }

    const handleGroupCommitBackground = ({ groupId, commit }) => {
      if (!groupId || !commit || typeof commit !== 'object') return
      const gid = String(groupId)

      enqueueGroupCommitTask(gid, async () => {
        try {
          const existing = await loadGroupState(gid).catch(() => null)
          // No local state yet — a Welcome will bootstrap it. Commits that
          // arrive before our Welcome are recovered via fetchGroupMessages
          // replay when GroupChat opens.
          if (!existing) return

          // Idempotent epoch gate. The in-component GroupChat handler may
          // already have advanced our state to this commit's epoch (or
          // beyond), in which case applyCommit would throw "Invalid commit
          // epoch". Skip cleanly instead of producing a misleading error.
          if (
            Number.isInteger(existing.epoch) &&
            Number.isInteger(commit.epoch) &&
            existing.epoch >= commit.epoch
          ) {
            return
          }

          // Without an applicable epoch+1 commit we can't advance. If commit
          // is too far ahead (e.g. we missed an earlier commit while offline),
          // let GroupChat's replay-on-open path catch up from server history.
          if (
            Number.isInteger(existing.epoch) &&
            Number.isInteger(commit.epoch) &&
            commit.epoch !== existing.epoch + 1
          ) {
            return
          }

          const identityKeys = await getIdentityKeys()
          const myInitPrivKeyB64 =
            localStorage.getItem('echo-device-mls-priv') || identityKeys?.privateKeyX25519 || null

          const nextState = await applyCommit({
            state: existing,
            commit,
            myInitPrivKeyB64,
          })
          const persisted = await saveGroupState(gid, nextState)
          forwardGroupStateToPairedDevices(userIdRef.current, gid, persisted).catch(() => {})

          // Tell any mounted GroupChat to reload from disk so its React state
          // mirrors the new epoch without re-applying the commit (which would
          // now throw on the epoch check).
          window.dispatchEvent(new CustomEvent('groupStateSynced', { detail: { groupId: gid } }))
        } catch (err) {
          console.warn('[Dashboard] Background commit application failed:', err)
        }
      })
    }
    sharedSocket.on('groupCommit', handleGroupCommitBackground)

    // ── Device sync — persists across view/chat changes ──────────────────────
    let devicePollInterval = null
    // Bumped to v3: prior v2 runs could complete with an unlocked-ELD bypass
    // that left ELD.privatePreKey out of sync with Device.signedPreKey.
    const DEVICE_BUNDLE_FLAG = 'echo-device-bundle-uploaded-v3'
    localStorage.removeItem('echo-device-bundle-uploaded-v2')

    const emitWithAck = (event, payload) =>
      new Promise((resolve, reject) => {
        sharedSocket.emit(event, payload, (ack) => {
          if (ack?.success) resolve(ack)
          else reject(new Error(ack?.error || `Failed to ${event}`))
        })
      })

    const fetchOwnMlsKeyPackages = () =>
      new Promise((resolve) => {
        sharedSocket.emit('fetchAllKeyPackages', { userId }, (res) => {
          if (!res?.success || !Array.isArray(res.packages)) {
            resolve([])
            return
          }
          resolve(
            res.packages
              .filter((pkg) => pkg?.initKeyB64 || pkg?.keyPackage?.initKeyB64)
              .map((pkg) => ({
                userId,
                clientId: pkg.clientId ?? null,
                initKeyB64: pkg.initKeyB64 ?? pkg.keyPackage?.initKeyB64 ?? null,
                keyPackage: pkg.keyPackage ?? null,
              }))
          )
        })
      })

    const ensureOwnDeviceLeavesForKnownGroups = async () => {
      const isBenignMlsEpochError = (err) => {
        const msg = String(err?.message || err || '')
        return /invalid commit epoch/i.test(msg) || /conflict/i.test(msg) || err?.status === 409
      }
      const packages = await fetchOwnMlsKeyPackages()
      if (packages.length === 0) return

      let groups = []
      try {
        groups = JSON.parse(localStorage.getItem(`groups-${userId}`) || '[]')
      } catch {
        groups = []
      }

      for (const group of Array.isArray(groups) ? groups : []) {
        const groupId = String(group?.groupId ?? group?.id ?? '')
        if (!groupId || group?.removedFromGroup || group?.mlsEnabled === false) continue

        let state = await loadGroupState(groupId).catch(() => null)
        if (!state?.initSecretB64 || !Array.isArray(state?.roster)) continue

        const nodePublicKeys = new Set(
          (state.tree?.nodes ?? [])
            .map((node) => node?.publicKeyB64)
            .filter((value) => typeof value === 'string' && value.length > 0)
        )
        const missingPackages = packages.filter((pkg) => {
          const initKeyB64 = pkg.keyPackage?.initKeyB64 ?? pkg.initKeyB64
          return initKeyB64 && !nodePublicKeys.has(initKeyB64)
        })
        if (missingPackages.length === 0) continue

        let nextLeafIndex =
          state.roster.reduce(
            (max, member) =>
              Number.isInteger(member?.leafIndex) && member.leafIndex > max
                ? member.leafIndex
                : max,
            -1
          ) + 1

        for (const pkg of missingPackages) {
          const leafIndex = nextLeafIndex
          nextLeafIndex += 1
          const memberInitKeys = [{ ...pkg, leafIndex }]
          const { commit, welcome, welcomes, nextState } = await buildAddCommit({
            state,
            newMember: {
              userId,
              username,
              leafIndex,
            },
            memberInitKeys,
          })

          try {
            await emitWithAck('sendGroupCommit', { groupId, commit })
          } catch (err) {
            if (isBenignMlsEpochError(err)) {
              // Another owned device or this device already advanced the epoch.
              // Stop trying to add remaining missing packages for this group.
              break
            }
            // Non-epoch errors are unexpected; log and stop attempting further adds for this group.
            console.warn('[MLS] sendGroupCommit failed while ensuring device leaves:', err)
            break
          }
          for (const welcomeMessage of (Array.isArray(welcomes) ? welcomes : [welcome]).filter(
            Boolean
          )) {
            try {
              await emitWithAck('sendGroupWelcome', {
                groupId,
                recipientUserId: welcomeMessage.recipientUserId,
                welcome: welcomeMessage,
              })
            } catch (err) {
              if (!isBenignMlsEpochError(err)) {
                console.warn('[MLS] sendGroupWelcome failed while ensuring device leaves:', err)
              }
              // Do not throw — move on to the next welcome or group.
            }
          }

          state = await saveGroupState(groupId, nextState)
          forwardGroupStateToPairedDevices(userId, groupId, state).catch(() => {})
        }
      }
    }

    const initDeviceSync = async () => {
      const deviceMetadata = getDeviceMetadata()
      const deviceId = deviceMetadata.deviceId

      if (!localStorage.getItem(DEVICE_BUNDLE_FLAG)) {
        try {
          const { generateAndUploadDeviceKeyBundle } =
            await import('@/features/devices/deviceKeyBundle')
          await generateAndUploadDeviceKeyBundle(deviceId)
          localStorage.setItem(DEVICE_BUNDLE_FLAG, '1')
          invalidatePairedDevicesCache()
        } catch (err) {
          console.warn('[Dashboard] Initial device bundle upload failed:', err)
          // Leave the flag unset so we retry on the next mount.
        }
      }

      // Per-device X25519 keypair for MLS group membership (one leaf per device).
      if (
        !localStorage.getItem('echo-device-mls-pub') ||
        !localStorage.getItem('echo-device-mls-priv')
      ) {
        try {
          await wasmInit()
          const privBytes = crypto.getRandomValues(new Uint8Array(32))
          const basePoint = new Uint8Array(32)
          basePoint[0] = 9
          const pubBytes = diffie_hellman(privBytes, basePoint)
          const b64 = (b) => btoa(String.fromCharCode(...b))
          localStorage.setItem('echo-device-mls-priv', b64(privBytes))
          localStorage.setItem('echo-device-mls-pub', b64(pubBytes))
        } catch {
          // non-fatal — fall back to identity key
        }
      }

      await publishMlsKeyPackage()
      ensureOwnDeviceLeavesForKnownGroups().catch((err) => {
        console.warn('[MLS] Failed to ensure synced device leaves:', err)
      })

      const poll = () => {
        if (!eld.isUnlocked?.()) return
        processIncomingEnvelopes(userId).catch(() => {})
      }
      poll()
      devicePollInterval = setInterval(poll, 3_000)
    }
    initDeviceSync()

    const handleDeviceEnvelope = (rawEnvelope) => {
      processRawDeviceEnvelope(userId, rawEnvelope).catch(() => {})
    }
    sharedSocket.on('deviceEnvelope', handleDeviceEnvelope)

    const handleDeviceSessionRequest = ({ targetUserId: reqTargetUserId }) => {
      if (reqTargetUserId) broadcastSessionSync(userId, reqTargetUserId).catch(() => {})
    }
    sharedSocket.on('deviceSessionRequest', handleDeviceSessionRequest)

    // Primary device revoked this one — tear down and bounce to landing.
    const evictThisDevice = (reason) => {
      try {
        eld.lock?.()
      } catch {
        /* eld may already be locked */
      }
      const uid = userIdRef.current
      if (uid) {
        sessionStorage.removeItem(`eld-pass-${uid}`)
        localStorage.setItem(`lastDisconnectAt-${uid}`, new Date().toISOString())
      }
      tokenStorage.clear()
      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      localStorage.removeItem('username')
      localStorage.removeItem('echo-device-id')
      localStorage.removeItem('echo_sync_account')
      try {
        sharedSocket.disconnect()
      } catch {
        /* ignore */
      }
      if (typeof window !== 'undefined') {
        window.alert(
          reason === 'device_not_registered'
            ? 'This device is no longer registered with the account. Re-pair it from your primary device.'
            : 'This device was removed from your account. Re-pair it from your primary device to continue.'
        )
      }
      navigate('/')
    }

    const handleDeviceRevoked = () => evictThisDevice('revoked_by_owner')
    sharedSocket.on('deviceRevoked', handleDeviceRevoked)

    const handleConnectError = (err) => {
      const reason = err?.message || ''
      if (
        reason === 'device_revoked' ||
        reason === 'device_not_registered' ||
        reason === 'device_forbidden'
      ) {
        evictThisDevice(reason)
      }
    }
    sharedSocket.on('connect_error', handleConnectError)

    return () => {
      sharedSocket.off('connect', onConnect)
      sharedSocket.off('disconnect', handleDisconnect)
      sharedSocket.off('incomingCall')
      sharedSocket.off('callEnded')
      sharedSocket.off('replenishOPKs', handleOpkReplenishRequested)
      sharedSocket.off('opkReplenishRequested', handleOpkReplenishRequested)
      sharedSocket.off('userProfileUpdated')
      sharedSocket.off('newMessage', handleNewMessageNotification)
      sharedSocket.off('groupAdded', handleGroupAdded)
      sharedSocket.off('groupUpdated', handleGroupUpdated)
      sharedSocket.off('groupRemoved', handleGroupRemoved)
      sharedSocket.off('groupMemberRemoved', handleGroupMemberRemoved)
      sharedSocket.off('groupMemberAdded', handleGroupMemberAdded)
      sharedSocket.off('groupWelcome', handleGroupWelcomeBackground)
      sharedSocket.off('groupCommit', handleGroupCommitBackground)
      sharedSocket.off('newGroupMessage', handleNewGroupMessageNotification)
      window.removeEventListener('groupStateSynced', handleGroupStateSynced)
      sharedSocket.off('deviceEnvelope', handleDeviceEnvelope)
      sharedSocket.off('deviceSessionRequest', handleDeviceSessionRequest)
      sharedSocket.off('deviceRevoked', handleDeviceRevoked)
      sharedSocket.off('connect_error', handleConnectError)
      if (devicePollInterval) clearInterval(devicePollInterval)
      clearMlsKeyPackageRetry()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId])

  useEffect(() => {
    const handleStorageUpdate = (event) => {
      const targetId = String(event?.detail?.targetUserId ?? '')
      const latestText = event?.detail?.latestMessage ?? ''
      const ts = event?.detail?.timestamp || new Date().toISOString()

      // Group conversation preview update
      if (targetId.startsWith(GROUP_CACHE_PREFIX)) {
        const gid = targetId.slice(GROUP_CACHE_PREFIX.length)
        if (!gid) return
        upsertGroupRef.current?.(
          { groupId: gid },
          {
            text: latestText,
            timestamp: ts,
          }
        )
        return
      }

      // Direct conversation preview update
      const existing = recentConversationsRef.current.find((c) => String(c.id) === String(targetId))
      const friend = existing || {
        id: targetId,
        username: existing?.username || `User ${targetId}`,
      }
      updateRecentConversationsRef.current?.(friend, { text: latestText, timestamp: ts })
    }

    window.addEventListener('localStorageUpdated', handleStorageUpdate)
    return () => window.removeEventListener('localStorageUpdated', handleStorageUpdate)
  }, [])

  useEffect(() => {
    const totalUnread =
      Object.values(unreadMessages).reduce((sum, count) => sum + count, 0) +
      Object.values(unreadGroupMessages).reduce((sum, count) => sum + count, 0)

    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Echo`
    } else {
      document.title = 'Echo'
    }

    return () => {
      document.title = 'Echo'
    }
  }, [unreadMessages, unreadGroupMessages])

  // Listen for profile updates from localStorage
  useEffect(() => {
    const handleProfileUpdate = () => {
      if (userId) {
        const cachedProfile = getCachedUserProfile(userId)
        if (cachedProfile && cachedProfile.profilePicture) {
          const formattedImage = formatProfileImage(cachedProfile.profilePicture, username)
          setUserProfileImage(formattedImage)
        }
      }
    }

    window.addEventListener('profileUpdated', handleProfileUpdate)
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate)
  }, [userId, username])

  // Precarga los recursos de los wallpapers
  useEffect(() => {
    Object.values(WALLPAPER_PREVIEWS).forEach((wp) => {
      if (wp.type === 'image' && wp.imageUrl) {
        new Image().src = wp.imageUrl
      }
      if (wp.type === 'video' && wp.posterUrl) {
        new Image().src = wp.posterUrl
      }
      if (wp.type === 'video' && wp.videoUrl) {
        const video = document.createElement('video')
        video.src = wp.videoUrl
      }
    })
  }, [])

  // Handlers
  const handleChatSelect = (conversation) => {
    setActiveChat({ ...conversation, type: 'direct' })
    setShowMobileChat(true)
    const conversationId = String(conversation.id)
    setUnreadMessages((prev) => ({
      ...prev,
      [conversationId]: 0,
    }))
    localStorage.setItem(`unread-${userId}-${conversationId}`, 0)
  }

  const handleGroupSelect = (group) => {
    const gid = String(group?.groupId ?? '')
    if (!gid) return
    setActiveChat({
      ...group,
      type: 'group',
      groupId: gid,
      name: group.name || 'Group',
      description: group.description || '',
      profilePicture: group.profilePicture || '',
    })
    setShowMobileChat(true)
    setUnreadGroupMessages((prev) => {
      const next = { ...prev, [gid]: 0 }
      localStorage.setItem(`unreadGroup-${userId}-${gid}`, '0')
      return next
    })
  }

  const handleMobileBack = () => {
    if (mobileChatHistoryPushedRef.current) {
      window.history.back()
      return
    }
    setShowMobileChat(false)
  }

  const handleActiveChatChange = (friendData) => {
    handleChatSelect(friendData)
    updateRecentConversations(friendData)
    handleViewChange('chats')
  }

  const handleNewMessage = (message) => {
    if (message.userId === activeChat?.id) {
      updateRecentConversations(activeChat, message)
    } else {
      const friend = recentConversations.find((c) => c.id === message.userId) || {
        id: message.userId,
        username: message.username,
      }
      updateRecentConversations(friend, message)
    }
  }

  const handleProfileClick = () => {
    navigate(`/profile/${userId}`, { state: { username, userId } })
  }

  const handleLogout = async () => {
    await revokeCurrentDeviceForLogout()

    eld.lock()

    // Record disconnect time before clearing keys so the next login can detect
    // messages that arrived while this device was offline.
    if (userId) {
      localStorage.setItem(`lastDisconnectAt-${userId}`, new Date().toISOString())
    }

    sessionStorage.removeItem(`eld-pass-${userId}`)
    tokenStorage.clear()
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    localStorage.removeItem('echo-device-id')
    localStorage.removeItem('echo_sync_account')

    if (socket) {
      socket.disconnect()
    }
    navigate('/')
  }

  const handleViewChange = (view) => {
    setActiveView(view)
    localStorage.setItem('dashboardView', view)
  }

  // Filtrado de conversaciones
  const filteredConversations = recentConversations
    .filter(
      (conv) =>
        conv.username.toLowerCase().includes(conversationsSearchTerm.toLowerCase()) ||
        (conv.lastMessage &&
          conv.lastMessage.toLowerCase().includes(conversationsSearchTerm.toLowerCase()))
    )
    .map((conv) => ({
      ...conv,
      unreadCount: unreadMessages[String(conv.id)] || 0,
    }))
    .sort((a, b) => {
      const aHasUnread = a.unreadCount > 0
      const bHasUnread = b.unreadCount > 0

      if (aHasUnread && !bHasUnread) return -1
      if (!aHasUnread && bHasUnread) return 1

      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    })

  const filteredGroups = groups
    .filter((g) => {
      const term = conversationsSearchTerm.toLowerCase()
      if (!term) return true
      return (
        (g.name || '').toLowerCase().includes(term) ||
        (g.lastActivityText || '').toLowerCase().includes(term)
      )
    })
    .map((g) => ({
      ...g,
      unreadCount: unreadGroupMessages[String(g.groupId)] || 0,
    }))
    .sort((a, b) => {
      const aHasUnread = (a.unreadCount || 0) > 0
      const bHasUnread = (b.unreadCount || 0) > 0
      if (aHasUnread && !bHasUnread) return -1
      if (!aHasUnread && bHasUnread) return 1
      const ta = new Date(a.lastActivityAt || a.createdAt || 0).getTime()
      const tb = new Date(b.lastActivityAt || b.createdAt || 0).getTime()
      return tb - ta
    })

  // ─── Extracted to avoid re-creation on every Dashboard render ─────────────────
  const EmptyState = ({ activeView, t }) => (
    <div className='echo-floating flex justify-center items-center h-full p-8 relative overflow-hidden'>
      <div className='echo-aurora opacity-25' />
      <div className='text-center max-w-[300px] relative z-10'>
        <div className='animate-bounce mb-6'>
          <MessageCircle size={64} strokeWidth={1.5} className='text-gray-400 mx-auto' />
        </div>
        <h3 className='text-xl font-semibold text-white mt-4 mb-2'>
          {activeView === 'chats'
            ? t('dashboard.emptyState.selectChat')
            : t('dashboard.emptyState.noChatSelected')}
        </h3>
        <p className='text-gray-300 max-w-md text-center'>
          {activeView === 'chats'
            ? 'Choose a conversation from the list or start a new chat with a friend'
            : 'Search for a friend to start a new conversation'}
        </p>

        <div className='flex items-center justify-center text-xs text-gray-400 mt-8 pt-8 pb-4 border-t border-gray-700'>
          <Lock className='w-4 h-4 mr-1.5' />
          <span>Your messages are encrypted using</span>
          <img src='/EchoProtocolLogo.png' alt='Echo Protocol' className='h-12 ml-1.5' />
        </div>
      </div>
    </div>
  )
  EmptyState.propTypes = { activeView: PropTypes.string.isRequired, t: PropTypes.func.isRequired }

  // ── Build ChatList items from recentConversations + groups ──────────────────
  const chatListItems = useMemo(() => {
    const directItems = filteredConversations.map((conv) => ({
      id: conv.id,
      name: conv.username,
      avatar: conv.profileImage || null,
      last: conv.lastMessage || '',
      time: conv.lastMessageTime
        ? new Date(conv.lastMessageTime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '',
      unread: conv.unreadCount || 0,
      delivered: conv.seenStatus ? 'read' : 'delivered',
      status: null,
      isGroup: false,
      isBot: false,
      pinned: false,
    }))

    const groupItems = filteredGroups.map((g) => ({
      id: g.groupId,
      name: g.name || 'Group',
      avatar: g.profilePicture || null,
      last: g.lastActivityText || '',
      time: g.lastActivityAt
        ? new Date(g.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
      unread: g.unreadCount || 0,
      delivered: 'delivered',
      status: null,
      isGroup: true,
      isBot: false,
      pinned: false,
    }))

    return [...directItems, ...groupItems]
  }, [filteredConversations, filteredGroups])

  return (
    <div
      data-testid='echo-dashboard'
      className='relative h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-black text-white'
    >
      {/* Landing-style ambient bg — only when wallpaper is constellation */}
      {currentWallpaper === 'constellation' && <ConstellationBg density={70} />}

      {/* Device Sync overlay */}
      {showDeviceSync && (
        <Suspense fallback={null}>
          <DeviceSyncModal onClose={() => setShowDeviceSync(false)} />
        </Suspense>
      )}

      {/* Floating shell */}
      <div className='relative flex h-full min-h-0 w-full gap-0 p-0 md:gap-3 md:p-3'>
        {/* Incoming Call Notification */}
        {incomingCall && (
          <IncomingCallNotification callData={incomingCall} onClose={() => setIncomingCall(null)} />
        )}

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            className='fixed inset-0 bg-black/50 z-40 md:hidden'
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile hamburger visible on small screens when chat is not shown */}
        {!showMobileChat && (
          <button
            className='md:hidden fixed top-4 left-4 z-40 p-2 text-gray-400 hover:text-white'
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className='h-6 w-6' />
          </button>
        )}

        {/* Sidebar - Hidden on mobile, shown via menu */}
        <div
          className={`
          fixed md:relative inset-y-0 left-0 z-50 h-full
          transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 transition-transform duration-300 ease-in-out
        `}
        >
          <Sidebar
            active={activeView === 'friends' ? 'contacts' : activeView}
            onChange={(view) => {
              const mappedView = view === 'contacts' ? 'friends' : view
              handleViewChange(mappedView)
              // If opening settings via nav, show the top-level grid
              if (mappedView === 'settings') setSettingsInitialSection(null)
              setIsMobileMenuOpen(false)
            }}
            user={{
              name: username,
              avatar: userProfileImage,
            }}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => {
              const nextVal = !sidebarCollapsed
              setSidebarCollapsed(nextVal)
              localStorage.setItem('sidebarCollapsed', String(nextVal))
            }}
            onOpenProfile={() => {
              handleProfileClick()
              setIsMobileMenuOpen(false)
            }}
            onOpenDeviceSync={() => {
              setShowDeviceSync(true)
              setIsMobileMenuOpen(false)
            }}
            onLogout={handleLogout}
            unreadMessages={unreadMessages}
            onNewChat={() => setNewChatOpen(true)}
          />
        </div>

        {/* Navigation Panel — Premium ChatList (left panel) */}
        <div
          className={`
          ${showMobileChat || activeView === 'settings' || activeView === 'friends' || activeView === 'groups' ? 'hidden' : 'flex'} 
          ${activeView === 'settings' || activeView === 'friends' || activeView === 'groups' ? 'md:hidden' : 'md:flex'}
          shrink-0
        `}
        >
          {activeView === 'settings' ||
          activeView === 'friends' ||
          activeView === 'groups' ? null : (
            <ChatList
              items={chatListItems}
              activeId={activeChat?.type === 'group' ? activeChat?.groupId : activeChat?.id}
              searchTerm={conversationsSearchTerm}
              onSearchChange={setConversationsSearchTerm}
              onSelect={(id) => {
                // Try group first
                const group = filteredGroups.find((g) => String(g.groupId) === String(id))
                if (group) {
                  handleGroupSelect(group)
                  return
                }
                // Otherwise direct conversation
                const conv = filteredConversations.find((c) => String(c.id) === String(id))
                if (conv) {
                  handleChatSelect(conv)
                  return
                }
              }}
              onCreateGroup={() => setCreateGroupOpen(true)}
            />
          )}
        </div>

        {/* Main Content Area - Full screen on mobile when chat shown */}
        <div
          className={`
          ${showMobileChat || activeView === 'settings' || activeView === 'friends' || activeView === 'groups' ? 'flex' : 'hidden'} md:flex
          flex-1 min-h-0 min-w-0 flex-col bg-transparent
        `}
        >
          {activeView === 'settings' ? (
            <SettingsView
              key={settingsInitialSection || 'root'}
              initialSection={settingsInitialSection}
            />
          ) : activeView === 'friends' ? (
            <div className='echo-floating relative flex h-full flex-1 flex-col overflow-hidden'>
              <Friends
                token={token}
                onActiveChatChange={handleActiveChatChange}
                onAddContact={() => setNewChatOpen(true)}
              />
            </div>
          ) : activeView === 'groups' ? (
            <GroupsView onCreate={() => setCreateGroupOpen(true)} groups={filteredGroups} />
          ) : activeChat ? (
            <div className='echo-floating relative flex h-full min-h-0 flex-1 overflow-hidden rounded-none md:rounded-[20px]'>
              <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
                {/* Mobile back button */}
                <div className='flex shrink-0 items-center md:block'>
                  <button
                    className='md:hidden p-3 text-gray-400 hover:text-white'
                    onClick={handleMobileBack}
                  >
                    <ArrowLeft className='h-6 w-6' />
                  </button>
                  <div className='flex-1'>
                    {activeChat?.type === 'group' ? (
                      <GroupHeader
                        groupId={activeChat.groupId}
                        groupName={activeChat.name}
                        groupDescription={activeChat.description}
                        groupProfilePicture={activeChat.profilePicture}
                        userId={userId}
                      />
                    ) : (
                      <ChatHeader
                        activeChat={activeChat}
                        userId={userId}
                        token={token}
                        onOpenInfo={() => setShowInfoPanel((v) => !v)}
                        onCompareNumbers={() => {
                          window.dispatchEvent(
                            new CustomEvent('verifySafetyNumber', {
                              detail: { peerId: String(activeChat.id) },
                            })
                          )
                        }}
                      />
                    )}
                  </div>
                </div>
                <div className='min-h-0 flex-1 overflow-hidden'>
                  {activeChat?.type === 'group' ? (
                    <GroupChat
                      token={token}
                      activeGroupId={activeChat.groupId}
                      activeGroupName={activeChat.name}
                      userId={userId}
                      username={username}
                      currentWallpaper={currentWallpaper}
                      removedInfo={
                        activeChat.removedInfo || removedGroups[String(activeChat.groupId)]
                      }
                    />
                  ) : (
                    <Chat
                      token={token}
                      activeChat={activeChat.id}
                      onNewMessage={handleNewMessage}
                      currentWallpaper={currentWallpaper}
                      contact={activeChat}
                    />
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* UserInfoPanel — slide in from right for direct chats */}
              {showInfoPanel && activeChat?.type !== 'group' && (
                <UserInfoPanel contact={activeChat} onClose={() => setShowInfoPanel(false)} />
              )}
            </div>
          ) : (
            <EmptyState activeView={activeView} t={t} />
          )}
        </div>

        <CreateGroupModal
          open={createGroupOpen}
          onClose={() => setCreateGroupOpen(false)}
          userId={userId}
          onCreated={(group) => {
            if (!group?.groupId) return
            handleGroupSelect(group)
          }}
        />

        <NewChatModal
          open={newChatOpen}
          onClose={() => setNewChatOpen(false)}
          onStartChat={(user) => {
            handleActiveChatChange(user)
          }}
        />
      </div>
    </div>
  )
}

export default Dashboard
