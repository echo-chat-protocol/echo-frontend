import { useState, useRef, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'

const DeviceSyncModal = lazy(() => import('../../features/devices/DeviceSyncModal'))
const DebugPanel = lazy(() => import('./Debug/DebugPanel'))
import { useNavigate } from 'react-router-dom'
import DebugToggleButton from './Debug/DebugToggleButton'
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
import {
  resolveMyInitPrivKeyB64,
  fetchAndApplyPendingWelcomes,
  catchUpGroupMlsFromServer,
} from './Chat/utils/crypto/groupCrypto/groupMlsReplay'
import { decryptIncomingMessage } from './Chat/utils/chat/messageDecryption'
import { isOwnReadReceipt } from './Chat/utils/chat/readReceipts'
import { getMessagePreview } from './Chat/utils/chat/messagePreview'
import {
  upsertTypist,
  removeTypist,
  activeTypists,
  formatTypingText,
  TYPING_TTL_MS,
} from './Chat/utils/chat/typing'
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
import {
  getOrCreateDeviceMlsKeyPackage,
  resolveProcessWelcomeOptions,
} from '../../features/devices/mlsDeviceKeyPackage'
// import GroupList from './DashboardComponents/Groups/GroupList'
import CreateGroupModal from './Groups/CreateGroupModal'
import GroupChat from './Chat/GroupChat'
import { tokenStorage } from '@services/api'
import EmptyState from './EmptyState'

const DRAWER_SNAP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DRAWER_MIN_SNAP_MS = 150
const DRAWER_MAX_SNAP_MS = 280
const DRAWER_VELOCITY_OPEN_THRESHOLD = 0.45
const DRAWER_VELOCITY_PROJECTION_MS = 140

const getDrawerSnapDuration = (distance, velocity) => {
  if (distance <= 0) return DRAWER_MIN_SNAP_MS
  const duration = velocity > 0.05 ? distance / velocity : 240
  return Math.round(Math.max(DRAWER_MIN_SNAP_MS, Math.min(DRAWER_MAX_SNAP_MS, duration)))
}

const Dashboard = () => {
  const token = tokenStorage.getAccess()
  const navigate = useNavigate()
  const { username, userId, profileImage } = getUserData(token)

  // Estados
  const [activeChat, setActiveChat] = useState(null)
  const [activeView, setActiveView] = useState(() => {
    const saved = localStorage.getItem('dashboardView')
    // 'friends' (the old "Your circle" view) was removed — fall back to the
    // conversations list, which is now the main view.
    const allowed = ['chats', 'groups', 'settings']
    return allowed.includes(saved) ? saved : 'chats'
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
  // Live "typing…" state for conversation-list previews, keyed by conversation
  // id (peer userId for DMs, groupId for groups): { isGroup, typists }.
  const [typingByConv, setTypingByConv] = useState({})
  const typingPruneRef = useRef(null)

  const currentWallpaper = (() => {
    const saved = localStorage.getItem('chatWallpaper')
    return saved && WALLPAPER_PREVIEWS[saved] ? saved : 'default'
  })()

  const [userProfileImage, setUserProfileImage] = useState(profileImage)
  const [socket, setSocket] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  // The left panel is finger-dragged straight through DOM refs (writing
  // transform on each rAF tick) instead of React state — re-rendering this large
  // component on every touchmove was the source of the jank. The backdrop stays
  // mounted at opacity 0, so the first swipe frame doesn't pay a mount cost.
  const sidebarPanelRef = useRef(null)
  const drawerBackdropRef = useRef(null)
  const drawerRafRef = useRef(0)
  const drawerEndTimerRef = useRef(null)
  const drawerDragRef = useRef({
    active: false,
    decided: false,
    horizontal: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    width: 0,
    lastX: 0,
    previousX: 0,
    previousTime: 0,
    velocityX: 0,
  })
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true'
  })
  const [showDeviceSync, setShowDeviceSync] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [removedGroups, setRemovedGroups] = useState({})
  // When navigating to Settings, this lets us open a specific section (e.g., 'devices') once
  const [settingsInitialSection, setSettingsInitialSection] = useState(null)
  const GROUP_CACHE_PREFIX = 'group:'
  // Neutral sidebar preview shown while a group message can't be decrypted yet
  // (Welcome/commit not applied on this device). Replaced with the real
  // plaintext once handleGroupStateSynced re-decrypts the buffered message.
  const GROUP_PREVIEW_PENDING_TEXT = 'New message'
  // Hooks personalizados - must be before useEffects that use them
  const { recentConversations, updateRecentConversations, setConversationReceipt } =
    useConversations(userId)
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
  const setConversationReceiptRef = useRef(setConversationReceipt)
  const setAllGroupsRef = useRef(setAllGroups)
  const upsertGroupRef = useRef(upsertGroup)
  const removeGroupRef = useRef(removeGroup)

  // Prepare notifications (request permission once per mount)
  useEffect(() => {
    import('../../utils/notifications')
      .then((m) => m.ensureNotificationPermission?.())
      .catch(() => {})
  }, [])

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
      // Leaving the chat on mobile closes it: clearing activeChat unmounts Chat
      // so the background handler (and thus notifications + unread) take over for
      // that peer — "in the app but not in the chat" should alert.
      setActiveChat(null)
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
    setConversationReceiptRef.current = setConversationReceipt
  }, [setConversationReceipt])

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

  // Ctrl+` (or Cmd+`) toggles the debug panel
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        setShowDebugPanel((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

        // Publish a FULL signed KeyPackage (leafSigningPubKey + credential + signature),
        // not just an initKey. Without the signing pubkey, buildAddCommit writes a leaf
        // with leafSigningPubKeyB64=null, which makes the recipient's processWelcome
        // diverge on treeHash the moment the recipient generates its own signing key.
        // That divergence is what breaks message delivery across devices.
        let keyPackagePayload = null
        if (userId) {
          try {
            const record = await getOrCreateDeviceMlsKeyPackage({
              userId,
              clientId: deviceId || null,
              initKeyB64: mlsPub,
            })
            keyPackagePayload = record?.keyPackage ?? null
          } catch (err) {
            console.warn('[MLS] Could not build device KeyPackage:', err)
          }
        }

        return await new Promise((resolve) => {
          const payload = keyPackagePayload
            ? { keyPackage: keyPackagePayload, clientId: deviceId || null }
            : { initKeyB64: mlsPub, clientId: deviceId || null }
          sharedSocket.emit('publishKeyPackage', payload, (res) => {
            if (res?.success) {
              mlsKeyPackagePublishedRef.current = true
              clearMlsKeyPackageRetry()
              resolve(true)
              return
            }

            console.warn('[MLS] Failed to publish KeyPackage:', res?.error)
            scheduleMlsKeyPackageRetry()
            resolve(false)
          })
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
            const base = formatProfileImage(profileData.profilePicture, username)
            const busted = base ? `${base}${base.includes('?') ? '&' : '?'}v=${Date.now()}` : null
            setUserProfileImage(busted || base)
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
      const caller = callData?.callerName || callData?.fromUsername || callData?.from || 'Unknown'
      // Notify if app is not visibly focused (typical on mobile Tauri)
      try {
        if (typeof document === 'undefined' || document.hidden) {
          void import('../../utils/notifications').then((m) =>
            m.notify?.({ title: 'Incoming call', body: `From ${caller}`, icon: '/echo-logo.svg' })
          )
        }
      } catch {}
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
            const base = formatProfileImage(profilePicture, username)
            const busted = base ? `${base}${base.includes('?') ? '&' : '?'}v=${Date.now()}` : null
            return {
              ...conv,
              username: username || conv.username,
              profileImage: busted || base,
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
          const base = formatProfileImage(profilePicture, username)
          const busted = base ? `${base}${base.includes('?') ? '&' : '?'}v=${Date.now()}` : null
          return {
            ...prevActiveChat,
            username: username || prevActiveChat.username,
            profileImage: busted || base,
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
      // Seed the sidebar preview so a brand-new group reads "You created the
      // group" (creator's own copy: addedByUserId is self) or
      // "<adder> added you to the group" (invited / re-added). The first real
      // message preview overwrites this once one arrives.
      const addedById = String(g.addedByUserId ?? '')
      const isSelfActor = addedById !== '' && addedById === String(userIdRef.current ?? '')
      const adderName = g.addedByUsername || 'Someone'
      const activityText = isSelfActor
        ? 'You created the group'
        : `${adderName} added you to the group`
      // Clearing the removed flag is essential when this is a re-add after a
      // prior removal: the merged group entry would otherwise inherit
      // `removedFromGroup: true` from the previous handleGroupRemoved call,
      // which gates message notifications at handleNewGroupMessageNotification.
      upsertGroupRef.current?.(
        {
          ...g,
          groupId,
          name: g.name || g.groupName || 'Group',
          joinedAt: g.joinedAt || g.at,
          removedFromGroup: false,
          removedInfo: null,
        },
        { text: activityText, timestamp: g.at || g.joinedAt || new Date().toISOString() }
      )
      clearRemovalForGroup(groupId)
    }

    const handleGroupUpdated = (payload) => {
      const group = payload?.group ?? payload
      if (!group) return

      const groupId = String(group.groupId ?? group.id ?? '')
      if (!groupId) return

      let profilePicture = group.profilePicture || null
      // Only cache-bust server-hosted images (e.g. /uploads). A data: URL is
      // self-contained — appending `?v=` corrupts the base64 payload — and a new
      // data URL is already fresh content, so it needs no cache-bust.
      if (profilePicture && !profilePicture.startsWith('data:')) {
        const base = formatProfileImage(profilePicture, group.name || 'Group')
        profilePicture = `${base}${base.includes('?') ? '&' : '?'}v=${Date.now()}`
      }

      upsertGroupRef.current?.({
        ...group,
        profilePicture: profilePicture || group.profilePicture || '',
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
          profilePicture: profilePicture || group.profilePicture || prevActiveChat.profilePicture,
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

    // Bring a group's MLS state up to date in the BACKGROUND so the sidebar
    // preview can decrypt the first incoming message without the user opening
    // the group. The live `groupWelcome` event can be missed (room-join timing),
    // and nothing else fetches *pending* welcomes off the server outside of
    // group-open — so a brand-new group's first message would otherwise stay
    // "[New message]" until opened. Deduped per group; pending welcomes (cheap)
    // first, commit catch-up only if still not ready. `fetchAndApplyPendingWelcomes`
    // and our own dispatch fire `groupStateSynced`, which drives the buffered
    // re-decrypt + preview refresh in handleGroupStateSynced.
    const groupCatchUpInFlight = new Set()
    const ensureGroupMlsReadyInBackground = async (gid) => {
      if (!gid || groupCatchUpInFlight.has(gid)) return
      groupCatchUpInFlight.add(gid)
      try {
        await fetchAndApplyPendingWelcomes({
          socket: sharedSocket,
          userId: userIdRef.current,
          groupId: gid,
        }).catch(() => {})
        const state = await loadGroupState(gid).catch(() => null)
        if (!state?.applicationSecretB64) {
          await catchUpGroupMlsFromServer({
            socket: sharedSocket,
            groupId: gid,
            userId: userIdRef.current,
          }).catch(() => {})
        }
        window.dispatchEvent(new CustomEvent('groupStateSynced', { detail: { groupId: gid } }))
      } finally {
        groupCatchUpInFlight.delete(gid)
      }
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
          // Image-aware preview: "📷 caption" when captioned, else "📷 Photo"
          // (or "🎞️ GIF"); plain text otherwise.
          msgText = getMessagePreview(result?.formattedMessage)
        } catch {
          console.warn('[Dashboard] Failed to decrypt incoming group message')
          // Do not persist placeholder into storage — background state may not be ready yet
          // (e.g., Welcome not processed). Buffer the ciphertext so handleGroupStateSynced
          // re-decrypts it once epoch secrets land (that path calls updateSavedMessages,
          // which fires localStorageUpdated and refreshes this preview with the real
          // plaintext). Meanwhile show a neutral preview instead of a scary
          // "[Unable to decrypt message]" that flashes before recovery.
          const buffered = pendingEncryptedGroupMessagesRef.current.get(gid) || []
          if (!buffered.some((m) => String(m?._id ?? '') === String(message?._id ?? ''))) {
            buffered.push(message)
            pendingEncryptedGroupMessagesRef.current.set(gid, buffered)
          }
          msgText = GROUP_PREVIEW_PENDING_TEXT
          // Pull the (possibly pending) Welcome + commits in the background so the
          // buffered message re-decrypts and the preview updates without a manual
          // group open.
          void ensureGroupMlsReadyInBackground(gid)
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
          // The early `if (isActiveGroup) return` above already excludes the
          // group the user is viewing, so reaching here means "in the app but
          // not in this chat" (or app backgrounded) — both should notify.
          // `msgText` is the decrypted plaintext.
          // Only notify when we actually decrypted the message — skip rather than
          // posting a generic placeholder when decryption isn't ready yet.
          try {
            const hasPreview = msgText && msgText !== GROUP_PREVIEW_PENDING_TEXT
            if (hasPreview) {
              const sender = message.username ? `${message.username}: ` : ''
              // Prefer the group's profile picture for group notifications; fall
              // back to the sender's avatar if the group has none.
              const senderId = String(message?.userId ?? '')
              let avatar = null
              // Find group metadata from state if available
              try {
                const grp = (Array.isArray(groups) ? groups : []).find(
                  (g) => String(g.groupId) === gid
                )
                if (grp?.profilePicture) {
                  avatar = formatProfileImage(grp.profilePicture, message.groupName || 'Group')
                }
              } catch {}
              if (!avatar && senderId) {
                const conv = recentConversationsRef.current.find((c) => String(c.id) === senderId)
                if (conv?.profileImage) avatar = conv.profileImage
                if (!avatar) {
                  let cachedPic = null
                  try {
                    cachedPic = JSON.parse(
                      localStorage.getItem(`profile-${senderId}`) || 'null'
                    )?.profilePicture
                  } catch {
                    cachedPic = null
                  }
                  avatar = formatProfileImage(cachedPic, message.username || `User ${senderId}`)
                }
              }
              const mod = await import('../../utils/notifications')
              await mod.notifyMessage?.({
                conversationKey: `group:${gid}`,
                title: message.groupName || 'Group',
                body: `${sender}${msgText}`,
                avatar,
              })
            }
          } catch {}
        }
      })
    }

    // When any of my own devices marks a peer's messages as seen, the server
    // echoes `messageSeenUpdate` to my user room with `userId === my id`. Clear
    // this device's unread badge for that conversation so the count doesn't
    // linger after I've already read the thread on another device.
    const handleSeenSiblingClear = (payload = {}) => {
      // Reader side: one of my own devices read the peer's messages → clear
      // this device's unread badge for that conversation.
      if (isOwnReadReceipt(payload, userIdRef.current)) {
        const pid = String(payload.targetUserId ?? '')
        if (!pid) return
        setUnreadMessages((prev) => {
          if (!prev[pid]) return prev
          localStorage.setItem(`unread-${userIdRef.current}-${pid}`, 0)
          return { ...prev, [pid]: 0 }
        })
        return
      }

      // Sender side: the peer read MY messages (payload.targetUserId is me) →
      // flip that conversation's preview receipt to "read".
      if (String(payload.targetUserId ?? '') === String(userIdRef.current)) {
        const peerId = String(payload.userId ?? '')
        if (peerId) setConversationReceiptRef.current?.(peerId, 'read')
      }
    }

    // Sender side: the peer's device received MY message(s) → mark the
    // conversation preview "delivered" (read still supersedes it).
    const handleDeliveredPreviewUpdate = (payload = {}) => {
      if (String(payload.targetUserId ?? '') !== String(userIdRef.current)) return
      const peerId = String(payload.userId ?? '')
      if (peerId) setConversationReceiptRef.current?.(peerId, 'delivered')
    }

    // ── Typing previews (DM + group), keyed by conversation id ──────────────────
    // A single rescheduled prune drops entries whose TTL lapsed, so a missed
    // stop event can't leave a preview stuck on "typing…".
    const scheduleConvTypingPrune = () => {
      if (typingPruneRef.current) clearTimeout(typingPruneRef.current)
      typingPruneRef.current = setTimeout(() => {
        setTypingByConv((prev) => {
          let changed = false
          const next = {}
          for (const [convId, entry] of Object.entries(prev)) {
            const active = activeTypists(entry.typists)
            if (active.length === 0) {
              changed = true
              continue
            }
            if (active.length !== Object.keys(entry.typists).length) {
              changed = true
              const typists = {}
              for (const t of active) typists[t.userId] = entry.typists[t.userId]
              next[convId] = { ...entry, typists }
            } else {
              next[convId] = entry
            }
          }
          return changed ? next : prev
        })
      }, TYPING_TTL_MS + 100)
    }
    const upsertConvTypist = (convId, isGroup, typist) => {
      setTypingByConv((prev) => {
        const entry = prev[convId] || { isGroup, typists: {} }
        return { ...prev, [convId]: { isGroup, typists: upsertTypist(entry.typists, typist) } }
      })
      scheduleConvTypingPrune()
    }
    const removeConvTypist = (convId, typistId) => {
      setTypingByConv((prev) => {
        const entry = prev[convId]
        if (!entry) return prev
        const typists = removeTypist(entry.typists, typistId)
        if (typists === entry.typists) return prev
        if (Object.keys(typists).length === 0) {
          const next = { ...prev }
          delete next[convId]
          return next
        }
        return { ...prev, [convId]: { ...entry, typists } }
      })
    }

    // DM: conversation id is the peer's user id; group: it's the group id.
    const handlePeerTypingPreview = ({ userId: typistId } = {}) => {
      const id = String(typistId ?? '')
      if (id) upsertConvTypist(id, false, { userId: id })
    }
    const handlePeerStopTypingPreview = ({ userId: typistId } = {}) => {
      const id = String(typistId ?? '')
      if (id) removeConvTypist(id, id)
    }
    const handleGroupTypingPreview = ({ groupId, userId: typistId, username } = {}) => {
      const id = String(groupId ?? '')
      if (id && typistId) upsertConvTypist(id, true, { userId: typistId, username })
    }
    const handleGroupStopTypingPreview = ({ groupId, userId: typistId } = {}) => {
      const id = String(groupId ?? '')
      if (id && typistId) removeConvTypist(id, typistId)
    }

    const handleNewMessageNotification = async (messageData) => {
      const messages = Array.isArray(messageData) ? messageData : [messageData]

      const identityKeys = await getIdentityKeys()
      if (!identityKeys?.privateKeyX25519) {
        console.error('[Dashboard] No private key available in ELD')
        return
      }

      const privateKeyArray = base64ToArrayBuffer(identityKeys.privateKeyX25519)

      const ownDeviceId = localStorage.getItem('echo-device-id') || null

      for (const message of messages) {
        const currentUserId = String(userIdRef.current)
        const messageSenderId = String(message.userId)
        const activeChatId = activeChatRef.current?.id ? String(activeChatRef.current.id) : null

        // Per-device fan-out: each of the recipient's devices receives a copy of
        // every message via the user-id room, but only the copy addressed to THIS
        // device (matching peerDeviceId) can be decrypted. Skip the rest so we
        // don't run a doomed decrypt and emit a bogus "New message" notification
        // for copies meant for sibling devices. (Mirrors the filter in Chat.jsx.)
        if (
          message.peerDeviceId &&
          ownDeviceId &&
          String(message.peerDeviceId) !== String(ownDeviceId)
        ) {
          continue
        }

        if (message.userId && messageSenderId !== currentUserId) {
          const senderId = messageSenderId
          let decrypted = null

          if (senderId === activeChatId) {
            continue
          }

          const existingMessages = await getSavedMessages(userIdRef.current, senderId)
          if (existingMessages.some((msg) => msg._id === message._id)) {
            continue
          }

          // The message reached this device but the conversation isn't open
          // (active-chat copies `continue` above and emit `messageSeen` from
          // Chat instead). Tell the sender it was delivered — a state distinct
          // from read. Skip call events, which carry their own status.
          if (message.messageType !== 'call_event') {
            sharedSocket.emit('messageDelivered', { targetUserId: senderId })
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
            // Use the SAME per-device session scoping as the in-chat decryptor
            // (Chat.jsx). Per-device messages key their Double Ratchet session
            // under the sender's DEVICE user id, not the user-level id. Decrypting
            // with the user-level id derives the wrong message key and throws
            // "Decryption failed" — which is exactly why the first message (chat
            // closed, so handled here) notified as a bare "New message".
            const senderDeviceUserIdRaw = message.senderDeviceUserId
            const senderDeviceUserId =
              senderDeviceUserIdRaw && String(senderDeviceUserIdRaw) !== senderId
                ? String(senderDeviceUserIdRaw)
                : null
            const cryptoPeerUserId = senderDeviceUserId || senderId
            const sessionTargetId = senderDeviceUserId || null
            const decryptOptions = {
              ...(sessionTargetId ? { sessionTargetId, peerUserId: cryptoPeerUserId } : {}),
              // Always store under the user-level conversation so all of a peer's
              // devices roll up into one thread.
              conversationKeyOverride: senderId,
            }
            decrypted = await decryptIncomingMessage(
              message,
              nonce,
              userIdRef.current,
              cryptoPeerUserId,
              privateKeyArray,
              sharedSocket,
              null,
              decryptOptions
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

          // Reaching here means the message is NOT from the conversation the
          // user currently has open — the `senderId === activeChatId` check
          // above already `continue`s that case. So notify whether the app is
          // backgrounded OR just on a different screen ("in the app but not in
          // this chat" must still alert). Body is the DECRYPTED plaintext, never
          // the ciphertext payload.
          // Only notify when we actually have something to show. If decryption
          // failed (decrypted == null) we skip rather than spamming the tray with
          // generic "New message" placeholders — the unread badge already flags
          // that something arrived, and the real text shows once the chat opens.
          try {
            const img = typeof decrypted?.image === 'string' ? decrypted.image : null
            const text = typeof decrypted?.text === 'string' ? decrypted.text.trim() : ''
            if (text || img) {
              const title = message.username || decrypted?.username || `User ${senderId}`
              const isGif = img && (/\.gif($|\?)/i.test(img) || img.startsWith('data:image/gif'))
              const preview = text || (isGif ? '🎞️ GIF' : '📷 Photo')
              // Sender's profile picture as the notification avatar. Prefer the
              // conversation's stored image; otherwise derive from the cached
              // profile (falls back to a generated initials avatar).
              const conv = recentConversationsRef.current.find((c) => String(c.id) === senderId)
              let avatar = conv?.profileImage ? formatProfileImage(conv.profileImage, title) : null
              if (!avatar) {
                let cachedPic = null
                try {
                  cachedPic = JSON.parse(
                    localStorage.getItem(`profile-${senderId}`) || 'null'
                  )?.profilePicture
                } catch {
                  cachedPic = null
                }
                avatar = formatProfileImage(cachedPic, title)
              }
              const mod = await import('../../utils/notifications')
              await mod.notifyMessage?.({
                conversationKey: `dm:${senderId}`,
                title,
                body: preview,
                image: img,
                avatar,
              })
            }
          } catch {}

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

    // Retry buffered encrypted group messages after group state lands on this
    // device. Serialized per group with a coalescing flag: the same
    // `groupStateSynced` is dispatched by several paths (Welcome bg handler,
    // background catch-up, GroupHeader) and can overlap — running two retries on
    // the same buffer concurrently double-advances the message ratchet and makes
    // the second attempt fail and re-buffer a message that already decrypted.
    const groupSyncRetryInFlight = new Set()
    const groupSyncRetryPending = new Set()
    const runGroupSyncRetry = async (gid) => {
      const pending = pendingEncryptedGroupMessagesRef.current.get(gid) || []
      if (pending.length === 0) return
      const stillPending = []
      let latest = null
      for (const m of pending) {
        try {
          const res = await decryptIncomingGroupMessage({
            message: m,
            userId: userIdRef.current,
            username,
          })
          const fm = res?.formattedMessage
          if (fm) {
            const ts = fm.createdAt || m.createdAt || m.timestamp || new Date().toISOString()
            if (!latest || new Date(ts).getTime() >= new Date(latest.timestamp).getTime()) {
              latest = { fm, timestamp: ts }
            }
          }
        } catch {
          stillPending.push(m)
        }
      }
      pendingEncryptedGroupMessagesRef.current.set(gid, stillPending)
      // Refresh the sidebar preview with the now-decrypted newest message. We set
      // it explicitly (rather than relying on the localStorageUpdated event) so an
      // image-only message shows a media placeholder instead of an empty preview.
      if (latest) {
        const img = latest.fm.image ?? null
        const previewText =
          latest.fm.text ||
          (img
            ? /\.gif($|\?)/i.test(img) || img.startsWith('data:image/gif')
              ? '🎞️ GIF'
              : '📷 Photo'
            : '')
        upsertGroupRef.current?.(
          { groupId: gid },
          { text: previewText, timestamp: latest.timestamp }
        )
      }
    }

    const handleGroupStateSynced = async (event) => {
      const gid = String(event?.detail?.groupId ?? '')
      if (!gid) return
      if (groupSyncRetryInFlight.has(gid)) {
        // A retry is already running for this group; mark that the buffer should
        // be swept again afterwards so a late-arriving message isn't stranded.
        groupSyncRetryPending.add(gid)
        return
      }
      groupSyncRetryInFlight.add(gid)
      try {
        do {
          groupSyncRetryPending.delete(gid)
          await runGroupSyncRetry(gid)
        } while (groupSyncRetryPending.has(gid))
      } finally {
        groupSyncRetryInFlight.delete(gid)
      }
    }

    sharedSocket.on('newMessage', handleNewMessageNotification)
    sharedSocket.on('messageSeenUpdate', handleSeenSiblingClear)
    sharedSocket.on('messageDeliveredUpdate', handleDeliveredPreviewUpdate)
    sharedSocket.on('peerTyping', handlePeerTypingPreview)
    sharedSocket.on('peerStopTyping', handlePeerStopTypingPreview)
    sharedSocket.on('groupTyping', handleGroupTypingPreview)
    sharedSocket.on('groupStopTyping', handleGroupStopTypingPreview)
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
          ...resolveProcessWelcomeOptions({ userId: userIdRef.current, myInitPrivKeyB64 }),
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
          // Placeholder state (created by syncLocalStateFromServer when this
          // device sees the group on the server but has no MLS material yet)
          // carries a server-derived roster with no leafSigningPubKey entries.
          // Trying to applyCommit against it throws "No signing pub key for
          // commit sender at leafIndex …", losing the commit; the right path
          // is to wait for the Welcome or GroupChat-open replay to land real
          // leafData first.
          if (!existing.applicationSecretB64 || !existing.initSecretB64) return

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

          // Never re-apply our own commit here. GroupHeader already persisted
          // nextState before broadcasting; re-running applyUpdatePath with the
          // device fallback init key yields null commitSecret and can strand the
          // sender at the previous epoch.
          const isOwnCommit =
            Number.isInteger(existing.selfLeafIndex) &&
            Number.isInteger(commit.senderLeafIndex) &&
            existing.selfLeafIndex === commit.senderLeafIndex
          if (isOwnCommit) {
            const fresh = await loadGroupState(gid).catch(() => null)
            if (
              fresh &&
              Number.isInteger(fresh.epoch) &&
              Number.isInteger(commit.epoch) &&
              fresh.epoch >= commit.epoch &&
              (fresh.applicationSecretB64 || fresh.groupKeyB64)
            ) {
              window.dispatchEvent(
                new CustomEvent('groupStateSynced', { detail: { groupId: gid } })
              )
            }
            return
          }

          const identityKeys = await getIdentityKeys()
          const fallbackPriv =
            localStorage.getItem('echo-device-mls-priv') || identityKeys?.privateKeyX25519 || null
          const myInitPrivKeyB64 = resolveMyInitPrivKeyB64(existing, fallbackPriv)

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
    let deviceLeafSweepInterval = null
    let handleDeviceLeafSweepRequest = null
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
          // Same constraint as deviceGroupLeaves.js: only consider packages that
          // carry a full signed KeyPackage. A bare initKey would force
          // buildAddCommit to write leafSigningPubKeyB64=null and desync the
          // treeHash across devices, which silently breaks message decryption.
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

        // Stable per-device identity in the tree is the leaf signing pub key,
        // not the node publicKey. Every commit's update path rotates the
        // sender's leaf node publicKey, so matching by initKeyB64 would treat
        // an already-added device as "missing" after the very first commit and
        // re-add it on every poll — that's how one send turns into N phantom
        // leaves.
        const leafSigningPubKeys = new Set(
          Object.values(state.tree?.leafData ?? {})
            .map((leaf) => leaf?.leafSigningPubKeyB64)
            .filter((value) => typeof value === 'string' && value.length > 0)
        )
        const thisDeviceId = localStorage.getItem('echo-device-id')
        const seenSigningPubKeys = new Set()
        const missingPackages = packages.filter((pkg) => {
          const signingPubKeyB64 = pkg.keyPackage?.leafSigningPubKeyB64 ?? null
          // No signing key in the KP means buildAddCommit would reject it
          // anyway (see fetchOwnMlsKeyPackages filter), so drop it here too.
          if (!signingPubKeyB64) return false
          if (leafSigningPubKeys.has(signingPubKeyB64)) return false
          // Never try to add ourselves as a second leaf — if our current
          // identity isn't in the tree, the right answer is an Update commit,
          // not a duplicate Add for the same device.
          if (pkg.clientId && thisDeviceId && pkg.clientId === thisDeviceId) return false
          // De-dupe within this sweep: if two KP rows somehow share a signing
          // pub key (legacy bare-initKey row + a refreshed full KP, an old
          // unconsumed row from a re-paired clientId, etc.), only add once.
          if (seenSigningPubKeys.has(signingPubKeyB64)) return false
          seenSigningPubKeys.add(signingPubKeyB64)
          return true
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

    // Re-run the device-leaf sweep on demand: a synced sibling that just
    // came online dispatches `echo-request-device-leaf-sweep` from its
    // bootstrap path, and we also re-sweep periodically because the server
    // does not push a "sibling published KP" event.  Without this, the
    // primary device only ever sweeps once at Dashboard mount — if the
    // sibling's KeyPackage hadn't reached the server yet, the new leaf is
    // never added, the Add commit never fires, and the epoch stays put.
    let deviceLeafSweepInFlight = false
    let deviceLeafSweepPending = false
    const runDeviceLeafSweep = async (reason) => {
      if (deviceLeafSweepInFlight) {
        // Coalesce: a sweep is already running, mark that another pass is
        // wanted so we don't drop request-event signals (the in-flight pass
        // loaded state before this request arrived).
        deviceLeafSweepPending = true
        return
      }
      deviceLeafSweepInFlight = true
      try {
        do {
          deviceLeafSweepPending = false
          await ensureOwnDeviceLeavesForKnownGroups()
        } while (deviceLeafSweepPending)
      } catch (err) {
        console.warn(`[MLS] Device-leaf sweep (${reason}) failed:`, err)
      } finally {
        deviceLeafSweepInFlight = false
      }
    }
    handleDeviceLeafSweepRequest = () => {
      void runDeviceLeafSweep('request')
    }
    window.addEventListener('echo-request-device-leaf-sweep', handleDeviceLeafSweepRequest)
    deviceLeafSweepInterval = setInterval(() => {
      void runDeviceLeafSweep('poll')
    }, 12_000)

    const handleDeviceEnvelope = (rawEnvelope) => {
      processRawDeviceEnvelope(userId, rawEnvelope).catch(() => {})
    }
    sharedSocket.on('deviceEnvelope', handleDeviceEnvelope)

    const handleDeviceSessionRequest = ({ targetUserId: reqTargetUserId }) => {
      if (reqTargetUserId) broadcastSessionSync(userId, reqTargetUserId).catch(() => {})
    }
    sharedSocket.on('deviceSessionRequest', handleDeviceSessionRequest)

    // A sibling device (e.g. a freshly paired phone) is asking us to add it
    // into a group as its own MLS leaf. Only act on it if we hold initSecret
    // for that group (i.e. we are an active member with epoch material).
    // Route through runDeviceLeafSweep so this serializes with the 12s poll
    // and the `echo-request-device-leaf-sweep` event — the sibling's bootstrap
    // path fires both signals back-to-back, and unsynchronized handlers each
    // load stale state then build a duplicate Add, producing phantom leaves.
    const handleSiblingGroupMlsBootstrapRequest = async ({ groupId }) => {
      const gid = String(groupId ?? '')
      if (!gid) return
      try {
        await runDeviceLeafSweep('sibling-bootstrap')
      } catch (err) {
        console.warn('[MLS] sibling bootstrap response failed:', err)
      }
    }
    sharedSocket.on('siblingGroupMlsBootstrapRequest', handleSiblingGroupMlsBootstrapRequest)

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
      sharedSocket.off('messageSeenUpdate', handleSeenSiblingClear)
      sharedSocket.off('messageDeliveredUpdate', handleDeliveredPreviewUpdate)
      sharedSocket.off('peerTyping', handlePeerTypingPreview)
      sharedSocket.off('peerStopTyping', handlePeerStopTypingPreview)
      sharedSocket.off('groupTyping', handleGroupTypingPreview)
      sharedSocket.off('groupStopTyping', handleGroupStopTypingPreview)
      sharedSocket.off('groupAdded', handleGroupAdded)
      if (typingPruneRef.current) clearTimeout(typingPruneRef.current)
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
      sharedSocket.off('siblingGroupMlsBootstrapRequest', handleSiblingGroupMlsBootstrapRequest)
      sharedSocket.off('deviceSessionRequest', handleDeviceSessionRequest)
      sharedSocket.off('deviceRevoked', handleDeviceRevoked)
      sharedSocket.off('connect_error', handleConnectError)
      if (devicePollInterval) clearInterval(devicePollInterval)
      if (deviceLeafSweepInterval) clearInterval(deviceLeafSweepInterval)
      if (handleDeviceLeafSweepRequest) {
        window.removeEventListener('echo-request-device-leaf-sweep', handleDeviceLeafSweepRequest)
      }
      clearMlsKeyPackageRetry()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId])

  useEffect(() => {
    const handleStorageUpdate = (event) => {
      const targetId = String(event?.detail?.targetUserId ?? '')
      const latestText = event?.detail?.latestMessage ?? ''
      const ts = event?.detail?.timestamp || new Date().toISOString()
      // The dispatched message carries who sent it + its receipt fields, so the
      // preview can show the correct check (only for our own outgoing message).
      const msg = event?.detail?.message ?? null

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
      updateRecentConversationsRef.current?.(friend, {
        text: latestText,
        timestamp: ts,
        userId: msg?.userId,
        seenStatus: msg?.seenStatus,
        seenAt: msg?.seenAt,
        deliveredAt: msg?.deliveredAt,
      })
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
    // Reset this conversation's notification stack + dismiss its system notification.
    import('../../utils/notifications')
      .then((m) => m.clearMessageNotif?.(`dm:${conversationId}`))
      .catch(() => {})

    // Proactively refresh this peer's latest profile so header + bubbles pick it up
    try {
      const s = getSocket()
      s.emit('getUserInfo', { userId: conversationId }, (response) => {
        try {
          if (response?.success && response?.user) {
            const base = formatProfileImage(response.user.profilePicture, response.user.username)
            const busted = base ? `${base}${base.includes('?') ? '&' : '?'}v=${Date.now()}` : null
            // Update active chat immediately
            setActiveChat((prev) =>
              prev &&
              (String(prev.id) === conversationId || String(prev.targetUserId) === conversationId)
                ? {
                    ...prev,
                    username: response.user.username || prev.username,
                    profileImage: busted || base,
                  }
                : prev
            )
            // Update recent conversations entry
            updateRecentConversations(
              {
                id: conversationId,
                username: response.user.username,
                profileImage: busted || base,
                targetUserId: conversationId,
              },
              null
            )
            // Update local cache for fallback lookups
            localStorage.setItem(
              `profile-${conversationId}`,
              JSON.stringify({
                username: response.user.username,
                profilePicture: response.user.profilePicture,
              })
            )
          }
        } catch {}
      })
    } catch {}
  }

  // Pull-to-refresh for the conversation list: re-pull groups, the user's own
  // avatar, and every conversation's profile (name + picture) WITHOUT reloading
  // the page. New messages already stream in over the socket; this surfaces
  // membership/profile-picture changes that arrived while the tab was idle.
  const refreshConversationsData = useCallback(async () => {
    const socket = getSocket()
    const startedAt = Date.now()

    const groupsPromise = new Promise((resolve) => {
      try {
        socket.emit('listMyGroups', {}, (res) => {
          if (res?.success && Array.isArray(res.groups)) setAllGroupsRef.current?.(res.groups)
          resolve()
        })
      } catch {
        resolve()
      }
    })

    const ownProfilePromise = fetchUserProfileFromSocket(socket, userId)
      .then((profileData) => {
        if (profileData?.profilePicture) {
          const base = formatProfileImage(profileData.profilePicture, username)
          const busted = base ? `${base}${base.includes('?') ? '&' : '?'}v=${Date.now()}` : null
          setUserProfileImage(busted || base)
        }
      })
      .catch(() => {})

    const convos = recentConversationsRef.current || []
    const convosPromise = Promise.all(
      convos.map(
        (conversation) =>
          new Promise((resolve) => {
            const conversationUserId = conversation.id || conversation.targetUserId
            if (!conversationUserId) {
              resolve()
              return
            }
            try {
              socket.emit('getUserInfo', { userId: conversationUserId }, (response) => {
                if (response?.success && response.user) {
                  const formattedImage = formatProfileImage(
                    response.user.profilePicture,
                    response.user.username
                  )
                  updateRecentConversationsRef.current?.(
                    {
                      id: conversationUserId,
                      username: response.user.username,
                      profileImage: formattedImage,
                      targetUserId: conversationUserId,
                    },
                    null
                  )
                  try {
                    localStorage.setItem(
                      `profile-${conversationUserId}`,
                      JSON.stringify({
                        username: response.user.username,
                        profilePicture: response.user.profilePicture,
                      })
                    )
                  } catch {
                    /* ignore quota errors */
                  }
                }
                resolve()
              })
            } catch {
              resolve()
            }
          })
      )
    )

    await Promise.all([groupsPromise, ownProfilePromise, convosPromise])
    // Keep the wheel spinning long enough to read as a deliberate refresh even
    // when the round-trips return almost instantly.
    const elapsed = Date.now() - startedAt
    if (elapsed < 600) await new Promise((resolve) => setTimeout(resolve, 600 - elapsed))
  }, [userId, username])

  // Finger-drag the left panel like a tab: it tracks the touch in real time and
  // snaps open/closed on release. Shared by the conversation list (drag to open
  // when closed), the panel itself and the dim backdrop (drag to close when
  // open). Direction is locked on the first few px so a vertical scroll / the
  // pull-to-refresh isn't hijacked.
  // Write the panel (and backdrop dim) straight to the DOM — no React render.
  const paintDrawer = (x, width) => {
    const panel = sidebarPanelRef.current
    if (panel) {
      panel.style.transition = 'none'
      panel.style.transform = `translate3d(${x}px, 0, 0)`
    }
    const backdrop = drawerBackdropRef.current
    if (backdrop) {
      const fraction = Math.max(0, Math.min(1, (width + x) / width))
      backdrop.style.transition = 'none'
      backdrop.style.opacity = String(fraction)
    }
  }
  const handleDrawerTouchStart = (e) => {
    const touch = e.touches?.[0]
    if (!touch) return
    if (drawerEndTimerRef.current) {
      clearTimeout(drawerEndTimerRef.current)
      drawerEndTimerRef.current = null
    }
    const width = sidebarPanelRef.current?.offsetWidth || 230
    const baseX = isMobileMenuOpen ? 0 : -width
    drawerDragRef.current = {
      active: true,
      decided: false,
      horizontal: false,
      startX: touch.clientX,
      startY: touch.clientY,
      baseX,
      width,
      lastX: baseX,
      previousX: touch.clientX,
      previousTime: performance.now(),
      velocityX: 0,
    }
  }
  const handleDrawerTouchMove = (e) => {
    const drag = drawerDragRef.current
    if (!drag.active) return
    const touch = e.touches?.[0]
    if (!touch) return
    const dx = touch.clientX - drag.startX
    const dy = touch.clientY - drag.startY
    if (!drag.decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      drag.decided = true
      drag.horizontal = Math.abs(dx) > Math.abs(dy)
      if (!drag.horizontal) {
        // Vertical intent — let the list scroll / pull-to-refresh own it.
        drag.active = false
        return
      }
    }
    if (e.cancelable) e.preventDefault()
    const now = performance.now()
    const elapsed = Math.max(1, now - drag.previousTime)
    const instantVelocity = (touch.clientX - drag.previousX) / elapsed
    drag.velocityX = drag.velocityX * 0.72 + instantVelocity * 0.28
    drag.previousX = touch.clientX
    drag.previousTime = now
    drag.lastX = Math.max(-drag.width, Math.min(0, drag.baseX + dx))
    // Coalesce multiple touchmoves into one paint per animation frame.
    if (drawerRafRef.current) return
    drawerRafRef.current = requestAnimationFrame(() => {
      drawerRafRef.current = 0
      paintDrawer(drawerDragRef.current.lastX, drawerDragRef.current.width)
    })
  }
  const handleDrawerTouchEnd = () => {
    const drag = drawerDragRef.current
    if (!drag.active) return
    drag.active = false
    if (drawerRafRef.current) {
      cancelAnimationFrame(drawerRafRef.current)
      drawerRafRef.current = 0
    }
    if (!drag.decided || !drag.horizontal) return

    // Snap with a little momentum so a quick flick doesn't feel sticky.
    const projectedX = drag.lastX + drag.velocityX * DRAWER_VELOCITY_PROJECTION_MS
    const open =
      Math.abs(drag.velocityX) > DRAWER_VELOCITY_OPEN_THRESHOLD
        ? drag.velocityX > 0
        : projectedX > -drag.width / 2
    const targetX = open ? 0 : -drag.width
    const distance = Math.abs(targetX - drag.lastX)
    const snapDuration = getDrawerSnapDuration(distance, Math.abs(drag.velocityX))
    const panel = sidebarPanelRef.current
    const backdrop = drawerBackdropRef.current
    if (panel) {
      panel.style.transition = `transform ${snapDuration}ms ${DRAWER_SNAP_EASE}`
      panel.style.transform = `translate3d(${targetX}px, 0, 0)`
    }
    if (backdrop) {
      backdrop.style.transition = `opacity ${snapDuration}ms ${DRAWER_SNAP_EASE}`
      backdrop.style.opacity = open ? '1' : '0'
    }
    setIsMobileMenuOpen(open)
    // After the snap animation, hand styling back to the class transform.
    drawerEndTimerRef.current = setTimeout(() => {
      drawerEndTimerRef.current = null
      if (panel) {
        panel.style.transition = ''
        panel.style.transform = ''
      }
      if (backdrop) {
        backdrop.style.transition = ''
        backdrop.style.opacity = ''
      }
    }, snapDuration + 20)
  }

  useEffect(() => {
    return () => {
      if (drawerRafRef.current) cancelAnimationFrame(drawerRafRef.current)
      if (drawerEndTimerRef.current) clearTimeout(drawerEndTimerRef.current)
    }
  }, [])

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
    // Reset this group's notification stack + dismiss its system notification.
    import('../../utils/notifications')
      .then((m) => m.clearMessageNotif?.(`group:${gid}`))
      .catch(() => {})
  }

  const handleMobileBack = () => {
    if (mobileChatHistoryPushedRef.current) {
      // history.back() fires popstate → handlePopState clears activeChat.
      window.history.back()
      return
    }
    setShowMobileChat(false)
    setActiveChat(null)
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

  const handleLogout = () => {
    // Fire-and-forget device revoke: it captures the token internally so it
    // survives the local-state wipe below, and it must not block navigation
    // (the network call could otherwise hang for ~20-30s).
    revokeCurrentDeviceForLogout().catch((err) => {
      console.warn('[Dashboard] Failed to revoke current device during logout:', err)
    })

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
  const conversationsSearch = conversationsSearchTerm.toLowerCase()
  const filteredConversations = recentConversations
    // Drop malformed entries (e.g. a property-less row a buggy updater could
    // once inject) so the search below never reads `.toLowerCase()` of undefined.
    .filter((conv) => conv && conv.id != null)
    .filter(
      (conv) =>
        (conv.username || '').toLowerCase().includes(conversationsSearch) ||
        (conv.lastMessage || '').toLowerCase().includes(conversationsSearch)
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

  // ── Build ChatList items from recentConversations + groups ──────────────────
  const chatListItems = useMemo(() => {
    const typingTextFor = (id, isGroup) => {
      const entry = typingByConv[String(id)]
      if (!entry) return null
      return formatTypingText(
        activeTypists(entry.typists).map((t) => t.username),
        { isGroup }
      )
    }

    const directItems = filteredConversations.map((conv) => {
      const typingText = typingTextFor(conv.id, false)
      return {
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
        // Only OUR outgoing last message carries a receipt; an inbound last
        // message shows no check. null → DeliveryIcon renders nothing.
        delivered: conv.lastMessageFromMe ? conv.lastMessageState || 'sent' : null,
        typing: Boolean(typingText),
        typingText,
        status: null,
        isGroup: false,
        isBot: false,
        pinned: false,
      }
    })

    const groupItems = filteredGroups.map((g) => {
      const typingText = typingTextFor(g.groupId, true)
      return {
        id: g.groupId,
        name: g.name || 'Group',
        avatar: g.profilePicture || null,
        last: g.lastActivityText || '',
        time: g.lastActivityAt
          ? new Date(g.lastActivityAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '',
        unread: g.unreadCount || 0,
        // Groups have no per-message receipts yet (Phase 3) — show no check.
        delivered: null,
        typing: Boolean(typingText),
        typingText,
        status: null,
        isGroup: true,
        isBot: false,
        pinned: false,
      }
    })

    return [...directItems, ...groupItems]
  }, [filteredConversations, filteredGroups, typingByConv])

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

      {/* Debug panel toggle — floating, draggable so it never permanently blocks UI */}
      <DebugToggleButton active={showDebugPanel} onToggle={() => setShowDebugPanel((v) => !v)} />

      {/* Debug panel — slides in from the right; resizable up to full width */}
      <Suspense fallback={null}>
        <DebugPanel
          open={showDebugPanel}
          onClose={() => setShowDebugPanel(false)}
          activeChat={activeChat}
          userId={userId}
          removedGroups={removedGroups}
        />
      </Suspense>

      {/* Floating shell */}
      <div className='relative flex h-full min-h-0 w-full gap-0 p-0 md:gap-3 md:p-3'>
        {/* Incoming Call Notification */}
        {incomingCall && (
          <IncomingCallNotification callData={incomingCall} onClose={() => setIncomingCall(null)} />
        )}

        {/* Mobile Menu Overlay — always mounted at opacity 0, then driven straight
            to the DOM during a drag so it tracks the finger without re-rendering. */}
        <div
          ref={drawerBackdropRef}
          className='fixed inset-0 z-40 bg-black/50 md:hidden'
          aria-hidden={!isMobileMenuOpen}
          style={{
            opacity: isMobileMenuOpen ? 1 : 0,
            pointerEvents: isMobileMenuOpen ? 'auto' : 'none',
            touchAction: 'none',
            // Constant transition so the snap-render can't kill it; the live
            // drag overrides this to 'none' directly (see paintDrawer).
            transition: `opacity 240ms ${DRAWER_SNAP_EASE}`,
          }}
          onClick={() => setIsMobileMenuOpen(false)}
          onTouchStart={handleDrawerTouchStart}
          onTouchMove={handleDrawerTouchMove}
          onTouchEnd={handleDrawerTouchEnd}
          onTouchCancel={handleDrawerTouchEnd}
        />

        {/* Global hamburger removed — per-view headers own their menu buttons */}

        {/* Sidebar - Hidden on mobile, shown via menu / finger-drag. While
            dragging, transform/transition are written directly to this node
            (see paintDrawer); the class transform governs at rest + snap. */}
        <div
          ref={sidebarPanelRef}
          onTouchStart={handleDrawerTouchStart}
          onTouchMove={handleDrawerTouchMove}
          onTouchEnd={handleDrawerTouchEnd}
          onTouchCancel={handleDrawerTouchEnd}
          style={{
            backfaceVisibility: 'hidden',
            touchAction: 'pan-y',
            willChange: 'transform',
          }}
          className={`
          fixed md:relative inset-y-0 left-0 z-50 h-full
          transform-gpu ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:!transform-none
          transition-transform duration-300 ease-out
        `}
        >
          <Sidebar
            active={activeView}
            onChange={(view) => {
              handleViewChange(view)
              // If opening settings via nav, show the top-level grid
              if (view === 'settings') setSettingsInitialSection(null)
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
          />
        </div>

        {/* Navigation Panel — Premium ChatList (left panel) */}
        <div
          onTouchStart={handleDrawerTouchStart}
          onTouchMove={handleDrawerTouchMove}
          onTouchEnd={handleDrawerTouchEnd}
          onTouchCancel={handleDrawerTouchEnd}
          style={{ touchAction: 'pan-y', overscrollBehaviorX: 'none' }}
          className={`
          ${showMobileChat || activeView === 'settings' || activeView === 'groups' ? 'hidden' : 'flex'}
          ${activeView === 'settings' || activeView === 'groups' ? 'md:hidden' : 'md:flex'}
          w-full md:w-auto shrink-0
        `}
        >
          {activeView === 'settings' || activeView === 'groups' ? null : (
            <ChatList
              items={chatListItems}
              activeId={activeChat?.type === 'group' ? activeChat?.groupId : activeChat?.id}
              searchTerm={conversationsSearchTerm}
              onSearchChange={setConversationsSearchTerm}
              onRefresh={refreshConversationsData}
              onCreatePeer={() => setNewChatOpen(true)}
              onCreateGroup={() => setCreateGroupOpen(true)}
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
            />
          )}
        </div>

        {/* Main Content Area - Full screen on mobile when chat shown */}
        <div
          className={`
          ${showMobileChat || activeView === 'settings' || activeView === 'groups' ? 'flex' : 'hidden'} md:flex
          flex-1 min-h-0 min-w-0 flex-col bg-transparent
        `}
        >
          {activeView === 'settings' ? (
            <SettingsView
              key={settingsInitialSection || 'root'}
              initialSection={settingsInitialSection}
            />
          ) : activeView === 'groups' ? (
            <GroupsView onCreate={() => setCreateGroupOpen(true)} groups={filteredGroups} />
          ) : activeChat ? (
            <div className='echo-floating relative flex h-full min-h-0 flex-1 overflow-hidden rounded-none md:rounded-[20px]'>
              <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
                {activeChat?.type === 'group' ? (
                  <GroupHeader
                    groupId={activeChat.groupId}
                    groupName={activeChat.name}
                    groupDescription={activeChat.description}
                    groupProfilePicture={activeChat.profilePicture}
                    userId={userId}
                    onOpenMenu={() => setIsMobileMenuOpen(true)}
                    onBack={handleMobileBack}
                  />
                ) : (
                  <ChatHeader
                    activeChat={activeChat}
                    userId={userId}
                    token={token}
                    onOpenInfo={() => setShowInfoPanel((v) => !v)}
                    onOpenMenu={() => setIsMobileMenuOpen(true)}
                    onBack={handleMobileBack}
                  />
                )}
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
            <EmptyState />
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
