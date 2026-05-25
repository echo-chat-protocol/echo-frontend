import { useState, useEffect, useRef } from 'react'
import SafetyNumberModal from './SafetyNumberModal'
import { jwtDecode } from 'jwt-decode'
import { getSocket } from '../../../socket'
import PropTypes from 'prop-types'
import SendText from './MessageInput/sendText'
import ChatThread from './ChatThread'
import { getWallpaperComponent, getWallpaperClasses } from '../DashboardComponents/utils/wallpaper'
import { base64ToArrayBuffer } from './utils/helpers'
import { fetchLatestMessageNumber } from './utils/api'
import {
  updateSavedMessages,
  getIdentityKeys,
  getSavedMessages,
  updateMessageSeenStatus,
  storePeerIdentityKeys,
  getPeerIdentityKeys,
} from './utils/chat/keyManagement'
import { encryptOutgoingMessage } from './utils/chat/messageEncryption'
import { decryptIncomingMessage } from './utils/chat/messageDecryption'

function Chat({ token: tokenProp, activeChat, currentWallpaper = 'default', contact }) {
  const socket = getSocket()
  const token = tokenProp ?? localStorage.getItem('token') ?? ''
  const userId = token ? jwtDecode(token).id : ''
  const targetUserId = activeChat
  const username = token ? jwtDecode(token).username : ''

  const [messages, setMessages] = useState([])
  const [privateKeyArray, setPrivateKeyArray] = useState(null)
  const [sendBlocked, setSendBlocked] = useState(false)
  const [sendBlockedReason, setSendBlockedReason] = useState('')
  const [identityChangeDetail, setIdentityChangeDetail] = useState(null)
  const [ourPublicKeyB64, setOurPublicKeyB64] = useState(null)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [isTyping, setIsTyping] = useState(false)

  const messagesContainerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const previousMessageCountRef = useRef(0)
  const isInitialLoadRef = useRef(true)
  const typingTimeoutRef = useRef(null)

  // ── Identity change / verify events ────────────────────────────────────────
  useEffect(() => {
    setSendBlocked(false)
    setSendBlockedReason('')
    setIdentityChangeDetail(null)
    setShowVerifyModal(false)

    const onPeerIdentityChanged = (event) => {
      const peerId = String(event?.detail?.peerId ?? '')
      if (!peerId || peerId !== String(targetUserId ?? '')) return
      setSendBlocked(true)
      setSendBlockedReason('Peer identity key changed. Verify this contact before sending.')
      setIdentityChangeDetail({
        savedPeer: event.detail.savedPeer ?? null,
        fetchedPeer: event.detail.fetchedPeer ?? null,
      })
    }

    const onVerifySafetyNumber = async (event) => {
      const peerId = String(event?.detail?.peerId ?? '')
      if (!peerId || peerId !== String(targetUserId ?? '')) return
      const peerKeys = await getPeerIdentityKeys(peerId)
      setIdentityChangeDetail({ savedPeer: peerKeys ?? null, fetchedPeer: null })
      setShowVerifyModal(true)
    }

    window.addEventListener('peerIdentityChanged', onPeerIdentityChanged)
    window.addEventListener('verifySafetyNumber', onVerifySafetyNumber)
    return () => {
      window.removeEventListener('peerIdentityChanged', onPeerIdentityChanged)
      window.removeEventListener('verifySafetyNumber', onVerifySafetyNumber)
    }
  }, [targetUserId])

  // ── Load private key ────────────────────────────────────────────────────────
  useEffect(() => {
    const loadPrivateKey = async () => {
      const keys = await getIdentityKeys()
      if (keys?.privateKeyX25519) setPrivateKeyArray(base64ToArrayBuffer(keys.privateKeyX25519))
      else console.error('[Chat] No private key available in ELD')
      if (keys?.publicKeyX25519) setOurPublicKeyB64(keys.publicKeyX25519)
    }
    loadPrivateKey()
  }, [])

  // ── Reset on chat switch ────────────────────────────────────────────────────
  useEffect(() => {
    isInitialLoadRef.current = true
    previousMessageCountRef.current = 0
    setIsTyping(false)
  }, [targetUserId])

  // ── Load messages + socket listeners ───────────────────────────────────────
  useEffect(() => {
    if (!userId || !targetUserId) return

    const loadSavedMessages = async () => {
      try {
        const saved = await getSavedMessages(userId, targetUserId)
        setMessages(saved.length > 0 ? saved : [])
      } catch {
        setMessages([])
      }
    }
    loadSavedMessages()

    const handleChatMessage = async (payload) => {
      const ensurePrivateKey = async () => {
        if (privateKeyArray instanceof Uint8Array) return privateKeyArray
        const keys = await getIdentityKeys()
        if (keys?.privateKeyX25519) {
          const loaded = base64ToArrayBuffer(keys.privateKeyX25519)
          setPrivateKeyArray(loaded)
          return loaded
        }
        throw new Error('No private key available in ELD')
      }

      const msgs = Array.isArray(payload) ? payload : [payload]
      for (const message of msgs) {
        const nonce = base64ToArrayBuffer(message.nonce)
        if (message.messageType === 'call_event') {
          const isInvolved =
            message.callData?.callerId === userId || message.callData?.receiverId === userId
          const isRelevant =
            (message.callData?.callerId === activeChat &&
              message.callData?.receiverId === userId) ||
            (message.callData?.receiverId === activeChat && message.callData?.callerId === userId)
          if (isInvolved && isRelevant)
            updateSavedMessages(userId, activeChat, message, setMessages)
          continue
        }
        if (message.userId == activeChat || message.userId == userId) {
          try {
            const sender = String(message.userId)
            if (activeChat === sender) socket.emit('messageSeen', { targetUserId })
            if (message.userId == userId) continue
            if (activeChat === sender) {
              const resolvedKey = await ensurePrivateKey()
              await decryptIncomingMessage(
                message,
                nonce,
                userId,
                sender,
                resolvedKey,
                socket,
                setMessages
              )
            }
          } catch (err) {
            console.error('❌ Error handling message:', err)
          }
        }
      }
    }

    const handleSeenUpdate = async ({ userId: seenByUserId, targetUserId: seenForUserId }) => {
      if (seenForUserId === userId && seenByUserId === targetUserId) {
        setMessages((prev) =>
          prev.map((msg) => (msg.userId === userId ? { ...msg, seenStatus: true } : msg))
        )
        try {
          await updateMessageSeenStatus(userId, targetUserId)
        } catch {
          /* ignore */
        }
      }
    }

    const handleEldUpdate = async (event) => {
      const { userId: uid, targetUserId: tid } = event.detail
      if ((uid === userId && tid === targetUserId) || (uid === targetUserId && tid === userId)) {
        setMessages(await getSavedMessages(userId, targetUserId))
      }
    }

    // ── Typing indicator ──────────────────────────────────────────────────────
    const handleTyping = ({ userId: typingUserId }) => {
      if (String(typingUserId) !== String(targetUserId)) return
      setIsTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000)
    }
    const handleStopTyping = ({ userId: typingUserId }) => {
      if (String(typingUserId) !== String(targetUserId)) return
      setIsTyping(false)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }

    window.addEventListener('localStorageUpdated', handleEldUpdate)
    socket.on('newMessage', handleChatMessage)
    socket.on('messageSeenUpdate', handleSeenUpdate)
    socket.on('typing', handleTyping)
    socket.on('stopTyping', handleStopTyping)

    const initChat = async () => {
      // Inform server of our last accepted message number for this peer
      await fetchLatestMessageNumber(socket, targetUserId)
      // Join/mark this conversation as active on the server
      socket.emit('ready', { targetUserId })
      // Proactively send a read receipt when opening the chat so existing
      // unread messages are marked as read without waiting for a new inbound
      // message. The server will broadcast a corresponding update to the peer.
      socket.emit('messageSeen', { targetUserId })
    }
    initChat()

    return () => {
      socket.off('newMessage', handleChatMessage)
      socket.off('messageSeenUpdate', handleSeenUpdate)
      socket.off('typing', handleTyping)
      socket.off('stopTyping', handleStopTyping)
      window.removeEventListener('localStorageUpdated', handleEldUpdate)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, targetUserId])

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async (text, imageData = null) => {
    if (sendBlocked) throw new Error(sendBlockedReason || 'Sending is blocked')

    const ensurePrivateKey = async () => {
      if (privateKeyArray instanceof Uint8Array) return privateKeyArray
      const keys = await getIdentityKeys()
      if (keys?.privateKeyX25519) {
        const loaded = base64ToArrayBuffer(keys.privateKeyX25519)
        setPrivateKeyArray(loaded)
        return loaded
      }
      throw new Error('No private key available in ELD')
    }

    const privateKey = await ensurePrivateKey()
    let outgoing
    try {
      outgoing = await encryptOutgoingMessage({
        text,
        imageData,
        userId,
        targetUserId,
        username,
        socket,
        privateKeyArray: privateKey,
      })
    } catch (err) {
      if (err?.code === 'PEER_IDENTITY_CHANGED') {
        setSendBlocked(true)
        setSendBlockedReason('Peer identity key changed. Verify this contact before sending.')
        setIdentityChangeDetail({
          savedPeer: err.savedPeer ?? null,
          fetchedPeer: err.fetchedPeer ?? null,
        })
      }
      throw err
    }

    const lastAccepted = await fetchLatestMessageNumber(socket, targetUserId)
    const lastInt = Number.isSafeInteger(lastAccepted) ? lastAccepted : -1
    outgoing.messageNumber = lastInt + 1

    const sendOnce = (payload) =>
      new Promise((resolve) => {
        socket.emit('newMessage', payload, (ack) => resolve(ack))
      })

    let ack = await sendOnce(outgoing)
    if (!ack?.success && (ack?.error === 'out_of_sync' || ack?.error === 'replay_detected')) {
      const last = Number.isSafeInteger(ack?.lastAccepted) ? ack.lastAccepted : null
      if (last != null) {
        outgoing.messageNumber = last + 1
        ack = await sendOnce(outgoing)
      }
    }
    if (!ack?.success) throw new Error(ack?.error || 'Failed to send message')

    if (ack?.success && outgoing?.peerIdentityToPin) {
      storePeerIdentityKeys(targetUserId, {
        ...outgoing.peerIdentityToPin,
        firstSeenAt: Date.now(),
      })
    }

    await updateSavedMessages(
      userId,
      targetUserId,
      {
        _id: crypto.randomUUID(),
        userId,
        targetUserId,
        username,
        text: text || '',
        image: imageData || null,
        seenStatus: false,
        createdAt: new Date().toISOString(),
      },
      setMessages
    )
  }

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const increased = messages.length > previousMessageCountRef.current
    if (autoScroll && increased && messagesEndRef.current) {
      const behavior = isInitialLoadRef.current ? 'instant' : 'smooth'
      messagesEndRef.current.scrollIntoView({ behavior })
      isInitialLoadRef.current = false
    }
    previousMessageCountRef.current = messages.length
  }, [messages, autoScroll])

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
      setAutoScroll(scrollHeight - scrollTop <= clientHeight + 100)
    }
  }

  // Contact info for the thread (avatar + name for received bubbles)
  const contactInfo = {
    name: contact?.username || contact?.name || 'Unknown',
    avatar: contact?.profileImage || contact?.avatar || null,
  }

  return (
    <div className='app-container h-full flex flex-col'>
      <div className='chat-container flex-1 flex flex-col relative overflow-hidden'>
        {/* Premium thread with typing */}
        <div
          ref={messagesContainerRef}
          className={`flex-1 relative overflow-y-auto ${getWallpaperClasses(currentWallpaper)}`}
          onScroll={handleScroll}
        >
          {currentWallpaper !== 'default' && getWallpaperComponent(currentWallpaper)}
          <ChatThread
            messages={messages}
            currentUserId={userId}
            contact={contactInfo}
            isTyping={isTyping}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Send blocked warning */}
      {sendBlocked && (
        <div className='px-4 py-2 text-sm bg-red-950/70 text-red-100 border-t border-red-900 flex items-center justify-between'>
          <span>{sendBlockedReason || 'Sending is blocked due to a safety warning.'}</span>
          <button
            onClick={() => setShowVerifyModal(true)}
            className='ml-4 px-3 py-1 text-xs bg-red-800 hover:bg-red-700 rounded shrink-0'
          >
            Verify
          </button>
        </div>
      )}

      <SafetyNumberModal
        open={showVerifyModal || (sendBlocked && !!identityChangeDetail)}
        onClose={() => setShowVerifyModal(false)}
        savedPeer={identityChangeDetail?.savedPeer ?? null}
        fetchedPeer={identityChangeDetail?.fetchedPeer ?? null}
        ourPublicKeyB64={ourPublicKeyB64}
        onAccept={async (newPeer) => {
          await storePeerIdentityKeys(targetUserId, { ...newPeer, firstSeenAt: Date.now() })
          setSendBlocked(false)
          setSendBlockedReason('')
          setIdentityChangeDetail(null)
          setShowVerifyModal(false)
        }}
        onReject={() => setShowVerifyModal(false)}
      />

      <SendText
        sendMessage={sendMessage}
        disabled={sendBlocked}
        disabledReason={sendBlockedReason}
        targetUserId={targetUserId}
      />
    </div>
  )
}

Chat.propTypes = {
  token: PropTypes.string,
  activeChat: PropTypes.string.isRequired,
  contact: PropTypes.object,
}

export default Chat
