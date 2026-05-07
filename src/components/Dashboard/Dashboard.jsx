import { useState, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import './Dashboard.css'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, Plus, Lock, MessageCircle, Menu, ArrowLeft } from 'lucide-react'
import Friends from './Friends/Friends'
import Chat from './Chat/Chat'
import Sidebar from './DashboardComponents/Sidebar/Sidebar'
import ChatHeader from './DashboardComponents/Header/ChatHeader'
import GroupHeader from './DashboardComponents/Header/GroupHeader'
import ConversationList from './DashboardComponents/Conversations/ConversationList'

import { useConversations } from './DashboardComponents/hooks/useConversations'
import { useGroups } from './DashboardComponents/hooks/useGroups'

import {
  getUserData,
  fetchUserProfileFromSocket,
  getCachedUserProfile,
  formatProfileImage,
} from './DashboardComponents/utils/helpers'
import { WALLPAPER_PREVIEWS } from './DashboardComponents/utils/wallpaper'
import { getSocket } from '../../socket'
import IncomingCallNotification from '../VideoCall/IncomingCallNotification'
import {
  getIdentityKeys,
  getSavedMessages,
  updateSavedMessages,
} from './Chat/utils/chat/keyManagement'

import { decryptIncomingGroupMessage } from './Chat/utils/chat/groupMessageDecryption'
import { decryptIncomingMessage } from './Chat/utils/chat/messageDecryption'
import { base64ToArrayBuffer } from './Chat/utils/helpers'
import { generateOneTimePreKeys } from './Chat/utils/crypto/opk'
import { createOpkReplenishHandler, requestOpkStatusAndReplenish } from '../../utils/opk/replenish'
import eld from '../../utils/storage/EncryptedLocalDatabase'
import GroupList from './DashboardComponents/Groups/GroupList'
import CreateGroupModal from './Groups/CreateGroupModal'
import GroupChat from './Chat/GroupChat'

const Dashboard = () => {
  const { t } = useTranslation()
  const token = localStorage.getItem('token')
  const navigate = useNavigate()
  const { username, userId, profileImage } = getUserData(token)

  // Estados
  const [activeChat, setActiveChat] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
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
  const [currentWallpaper, setCurrentWallpaper] = useState(() => {
    const saved = localStorage.getItem('chatWallpaper')
    return saved && WALLPAPER_PREVIEWS[saved] ? saved : 'default'
  })
  const [userProfileImage, setUserProfileImage] = useState(profileImage)
  const [socket, setSocket] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const GROUP_CACHE_PREFIX = 'group:'

  // Hooks personalizados - must be before useEffects that use them
  const { recentConversations, updateRecentConversations } = useConversations(userId)
  const { groups, setAllGroups, upsertGroup, removeGroup } = useGroups(userId)
  const messagesEndRef = useRef(null)
  const conversationsListRef = useRef(null)
  const hasRefreshedProfiles = useRef(false)
  const activeChatRef = useRef(activeChat)
  const recentConversationsRef = useRef(recentConversations)
  const userIdRef = useRef(userId)
  const mlsKeyPackagePublishedRef = useRef(false)
  const mlsKeyPackageRetryTimeoutRef = useRef(null)
  const pendingGroupMessageTasksRef = useRef(new Map())

  const updateRecentConversationsRef = useRef(updateRecentConversations)
  const setAllGroupsRef = useRef(setAllGroups)
  const upsertGroupRef = useRef(upsertGroup)
  const removeGroupRef = useRef(removeGroup)

  const getGroupCacheId = (groupId) => `${GROUP_CACHE_PREFIX}${groupId}`

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
    recentConversationsRef.current = recentConversations
  }, [recentConversations])

  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

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

  useEffect(() => {
    if (!token || !userId) return

    const sharedSocket = getSocket()
    setSocket(sharedSocket)

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

        return await new Promise((resolve) => {
          sharedSocket.emit(
            'publishKeyPackage',
            { initKeyB64: identityKeys.publicKeyX25519 },
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
      upsertGroupRef.current?.({
        ...g,
        groupId,
        name: g.name || g.groupName || 'Group',
        joinedAt: g.joinedAt || g.at,
      })
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

    const handleGroupRemoved = ({ groupId }) => {
      const gid = String(groupId ?? '')
      if (!gid) return
      removeGroupRef.current?.(gid)
      setUnreadGroupMessages((prev) => {
        const next = { ...prev }
        delete next[gid]
        localStorage.removeItem(`unreadGroup-${userIdRef.current}-${gid}`)
        return next
      })
      const currentActive = activeChatRef.current
      if (currentActive?.type === 'group' && String(currentActive.groupId) === gid) {
        setActiveChat(null)
      }
    }

    const handleNewGroupMessageNotification = async (message) => {
      if (!message?.groupId) return
      const gid = String(message.groupId)
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
          msgText = '[Unable to decrypt message]'
          await updateSavedMessages(userIdRef.current, getGroupCacheId(gid), {
            _id: message._id || `${gid}:${String(message?.seq ?? timestamp)}`,
            userId: String(message?.userId ?? ''),
            username: message?.username || 'Member',
            text: msgText,
            createdAt: timestamp,
            seenStatus: true,
          })
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

    sharedSocket.on('newMessage', handleNewMessageNotification)
    sharedSocket.on('groupAdded', handleGroupAdded)
    sharedSocket.on('groupUpdated', handleGroupUpdated)
    sharedSocket.on('groupRemoved', handleGroupRemoved)
    sharedSocket.on('newGroupMessage', handleNewGroupMessageNotification)

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
      sharedSocket.off('newGroupMessage', handleNewGroupMessageNotification)
      clearMlsKeyPackageRetry()
    }
  }, [token, userId])

  useEffect(() => {
    const handleStorageUpdate = (event) => {
      const targetId = String(event?.detail?.targetUserId ?? '')
      if (!targetId.startsWith(GROUP_CACHE_PREFIX)) return

      const gid = targetId.slice(GROUP_CACHE_PREFIX.length)
      if (!gid) return

      upsertGroupRef.current?.(
        { groupId: gid },
        {
          text: event?.detail?.latestMessage ?? '',
          timestamp: event?.detail?.timestamp || new Date().toISOString(),
        }
      )
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
    setShowMobileChat(false)
  }

  const handleWallpaperChange = (wallpaper) => {
    if (WALLPAPER_PREVIEWS[wallpaper]) {
      setCurrentWallpaper(wallpaper)
      localStorage.setItem('chatWallpaper', wallpaper)
    }
  }

  const handleActiveChatChange = (friendData) => {
    handleChatSelect(friendData)
    updateRecentConversations(friendData)
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
    eld.lock()

    sessionStorage.removeItem(`eld-pass-${userId}`)
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')

    if (socket) {
      socket.disconnect()
    }
    navigate('/')
  }

  const handleSearch = () => {}

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
    <div className='flex justify-center items-center h-full p-8'>
      <div className='text-center max-w-[300px]'>
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

  EmptyState.propTypes = {
    activeView: PropTypes.string,
    t: PropTypes.func,
  }

  return (
    <div className='flex h-screen bg-black text-white echo-dashboard'>
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

      {/* Sidebar - Hidden on mobile, shown via menu */}
      <div
        className={`
        fixed md:relative inset-y-0 left-0 z-50
        transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 transition-transform duration-300 ease-in-out
      `}
      >
        <Sidebar
          activeView={activeView}
          handleViewChange={(view) => {
            handleViewChange(view)
            setIsMobileMenuOpen(false)
          }}
          handleProfileClick={() => {
            handleProfileClick()
            setIsMobileMenuOpen(false)
          }}
          handleLogout={handleLogout}
          profileImage={userProfileImage}
          username={username}
          unreadMessages={unreadMessages}
          onWallpaperChange={handleWallpaperChange}
          currentWallpaper={currentWallpaper}
        />
      </div>

      {/* Navigation Panel - Full width on mobile when chat not shown */}
      <div
        className={`
        ${showMobileChat ? 'hidden' : 'flex'} md:flex
        w-full md:w-80 bg-black border-r border-gray-700 flex-col
      `}
      >
        <div className='p-4 border-b border-gray-700'>
          <div className='flex items-center gap-3 mb-4'>
            {/* Mobile menu button */}
            <button
              className='md:hidden p-2 -ml-2 text-gray-400 hover:text-white'
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className='h-6 w-6' />
            </button>
            <img src='./echo-logo-text.png' alt='ECHO Logo' className='h-8' />
          </div>

          <div className='flex gap-2 mb-4'>
            <div className='relative w-full'>
              <input
                data-testid='dashboard-search'
                type='text'
                placeholder={
                  activeView === 'friends' ? 'Search for friends...' : 'Search chats & groups...'
                }
                className='w-full px-6 py-3 bg-white/10 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-[#8e79f2] focus:border-[#8e79f2] text-white placeholder-gray-400 backdrop-blur-sm transition-all duration-300'
                value={activeView === 'friends' ? searchTerm : conversationsSearchTerm}
                onChange={(e) =>
                  activeView === 'friends'
                    ? setSearchTerm(e.target.value)
                    : setConversationsSearchTerm(e.target.value)
                }
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                className='absolute right-4 top-3 text-gray-400 hover:text-white'
                onClick={handleSearch}
              >
                <Search className='h-6 w-6' />
              </button>
            </div>
            {activeView !== 'friends' && (
              <button
                className='p-2 rounded-full bg-indigo-700 text-white hover:bg-[#8e79f2] transition-colors'
                title='Create group'
                onClick={() => setCreateGroupOpen(true)}
              >
                <Plus className='h-5 w-5' />
              </button>
            )}
          </div>
        </div>

        <div className='flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-black'>
          {activeView === 'friends' ? (
            <Friends
              token={token}
              onActiveChatChange={handleActiveChatChange}
              searchTerm={searchTerm}
            />
          ) : (
            <div>
              {filteredGroups.length > 0 && (
                <div className='px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Groups
                </div>
              )}
              {filteredGroups.length > 0 && (
                <GroupList
                  groups={filteredGroups}
                  activeChat={activeChat}
                  onSelect={handleGroupSelect}
                  unreadByGroupId={unreadGroupMessages}
                />
              )}

              {filteredConversations.length > 0 && (
                <div className='px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Direct messages
                </div>
              )}
              {filteredConversations.length > 0 ? (
                <ConversationList
                  conversations={filteredConversations}
                  activeChat={activeChat}
                  userId={userId}
                  handleChatSelect={handleChatSelect}
                  setIsHovered={() => {}}
                  ref={conversationsListRef}
                />
              ) : (
                <p className='text-gray-400 text-sm p-4'>
                  {conversationsSearchTerm
                    ? 'No conversations match your search'
                    : 'No recent conversations'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area - Full screen on mobile when chat shown */}
      <div
        className={`
        ${showMobileChat ? 'flex' : 'hidden'} md:flex
        flex-1 flex-col bg-black
      `}
      >
        {activeChat ? (
          <div className='flex flex-col h-full'>
            {/* Mobile back button integrated with ChatHeader */}
            <div className='flex items-center md:block'>
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
                  <ChatHeader activeChat={activeChat} userId={userId} token={token} />
                )}
              </div>
            </div>
            <div className='flex-1 overflow-hidden'>
              {activeChat?.type === 'group' ? (
                <GroupChat
                  token={token}
                  activeGroupId={activeChat.groupId}
                  activeGroupName={activeChat.name}
                  userId={userId}
                  username={username}
                  currentWallpaper={currentWallpaper}
                />
              ) : (
                <Chat
                  token={token}
                  activeChat={activeChat.id}
                  onNewMessage={handleNewMessage}
                  currentWallpaper={currentWallpaper}
                />
              )}
              <div ref={messagesEndRef} />
            </div>
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
    </div>
  )
}

export default Dashboard
