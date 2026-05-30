import { useState, useEffect, useRef } from 'react'
import SafetyNumberModal from './SafetyNumberModal'
import { jwtDecode } from 'jwt-decode'
import { getSocket } from '../../../socket'
import PropTypes from 'prop-types'
import SendText from './MessageInput/sendText'
import DisplayText from './MessageDisplay/displayText'
import { getWallpaperComponent, getWallpaperClasses } from '../DashboardComponents/utils/wallpaper'
import { formatProfileImage } from '../DashboardComponents/utils/helpers'
import { base64ToArrayBuffer } from './utils/helpers'

import { fetchLatestMessageNumber } from './utils/api'

import {
  updateSavedMessages,
  getIdentityKeys,
  getSavedMessages,
  updateMessageSeenStatus,
  updateMessageDeliveredStatus,
  storePeerIdentityKeys,
  getPeerIdentityKeys,
  getRootKey,
} from './utils/chat/keyManagement'

import { encryptOutgoingMessage } from './utils/chat/messageEncryption'
import { decryptIncomingMessage } from './utils/chat/messageDecryption'
import { hasUnreadInbound } from './utils/chat/readReceipts'
import { forwardMessageToDevices, requestSessionSync } from '../../../utils/deviceForward'
import {
  attachBundlesToFanoutTargets,
  buildDmFanoutTargetsIncludingSiblings,
} from './utils/chat/perDeviceSession'

function Chat({ token: tokenProp, activeChat, currentWallpaper = 'default', contact = null }) {
  const socket = getSocket()

  const token =
    tokenProp ?? localStorage.getItem('echo_access_token') ?? localStorage.getItem('token') ?? ''

  const decodedToken = token ? jwtDecode(token) : null
  const userId = decodedToken?.id || ''
  const targetUserId = activeChat
  const username = decodedToken?.username || ''
  const ownDeviceUserId = decodedToken?.deviceUserId || null
  const [messages, setMessages] = useState([])
  const [privateKeyArray, setPrivateKeyArray] = useState(null)
  const [sendBlocked, setSendBlocked] = useState(false)
  const [sendBlockedReason, setSendBlockedReason] = useState('')
  const messagesContainerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const previousMessageCountRef = useRef(0)
  const isInitialLoadRef = useRef(true)
  const sendQueueRef = useRef(Promise.resolve())

  const [identityChangeDetail, setIdentityChangeDetail] = useState(null)
  const [ourPublicKeyB64, setOurPublicKeyB64] = useState(null)
  const [showVerifyModal, setShowVerifyModal] = useState(false)

  useEffect(() => {
    setSendBlocked(false)
    setSendBlockedReason('')
    setIdentityChangeDetail(null)
    setShowVerifyModal(false)

    const onPeerIdentityChanged = (event) => {
      const peerId = String(event?.detail?.peerId ?? '')
      if (!peerId) return
      if (peerId !== String(targetUserId ?? '')) return

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

  // Live-update peer avatar in this DM when they change their profile picture
  useEffect(() => {
    const s = socket
    const onUserProfileUpdated = ({ userId: updatedUserId, username, profilePicture }) => {
      if (String(updatedUserId ?? '') !== String(targetUserId ?? '')) return
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
    s.on('userProfileUpdated', onUserProfileUpdated)
    return () => s.off('userProfileUpdated', onUserProfileUpdated)
  }, [socket, targetUserId])

  useEffect(() => {
    const loadPrivateKey = async () => {
      const keys = await getIdentityKeys()
      if (keys?.privateKeyX25519) {
        setPrivateKeyArray(base64ToArrayBuffer(keys.privateKeyX25519))
      } else {
        console.error('[Chat] No private key available in ELD')
      }
      if (keys?.publicKeyX25519) {
        setOurPublicKeyB64(keys.publicKeyX25519)
      }
    }
    loadPrivateKey()
  }, [])

  useEffect(() => {
    isInitialLoadRef.current = true
    previousMessageCountRef.current = 0
  }, [targetUserId])

  useEffect(() => {
    if (!userId || !targetUserId) return

    // Ask other online devices for their current ratchet state for this
    // conversation. If this is a paired device whose snapshot is stale,
    // primary will respond immediately and align the sending number before
    // the first outgoing message.
    requestSessionSync(targetUserId)

    const loadSavedMessages = async () => {
      try {
        const savedMessages = await getSavedMessages(userId, targetUserId)
        if (savedMessages.length > 0) {
          setMessages(savedMessages)
        } else {
          setMessages([])
        }

        // Mark already-delivered-but-unread history as seen on chat-open.
        // Previously `messageSeen` only fired when a *live* message arrived
        // (handleChatMessage), so opening a chat full of unread messages never
        // produced a read receipt. Emit once if any inbound message is unread.
        if (socket && hasUnreadInbound(savedMessages, targetUserId)) {
          socket.emit('messageSeen', { targetUserId })
        }
      } catch (error) {
        console.error('Error loading saved messages:', error)
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

      const ownDeviceId = localStorage.getItem('echo-device-id') || null

      const messages = Array.isArray(payload) ? payload : [payload]

      for (const message of messages) {
        if (message.messageType === 'call_event') {
          const isInvolvedInCall =
            message.callData?.callerId === userId || message.callData?.receiverId === userId

          const isRelevantToActiveChat =
            (message.callData?.callerId === activeChat &&
              message.callData?.receiverId === userId) ||
            (message.callData?.receiverId === activeChat && message.callData?.callerId === userId)

          if (isInvolvedInCall && isRelevantToActiveChat) {
            updateSavedMessages(userId, activeChat, message, setMessages)
          }
          continue
        }

        let nonce
        try {
          nonce = base64ToArrayBuffer(message?.nonce)
        } catch (error) {
          console.warn('[Chat] Ignoring message with invalid nonce encoding', {
            messageId: message?._id,
            error: error?.message,
          })
          continue
        }

        // Per-device fan-out filter: if the message is tagged with a
        // peerDeviceId, only the matching device should decrypt it. Every
        // device of both the sender's and the recipient's accounts receives
        // every fanout copy via the user-id rooms — drop the ones that
        // aren't addressed to this device.
        if (
          message.peerDeviceId &&
          ownDeviceId &&
          String(message.peerDeviceId) !== String(ownDeviceId)
        ) {
          continue
        }

        // Sibling-display branch: message.userId === own user id, peerDeviceId
        // matches this device → another of our own devices sent this; we
        // receive a sibling-fanout copy and need to display it under the
        // peer conversation (message.targetUserId).
        const isSiblingFanout =
          Boolean(message.peerDeviceId) && String(message.userId) === String(userId)
        const conversationPartner = isSiblingFanout
          ? String(message.conversationUserId || targetUserId)
          : String(message.userId)
        const isLegacySiblingForward =
          !message.peerDeviceId && String(message.userId) === String(userId)

        if (conversationPartner === activeChat || isLegacySiblingForward) {
          try {
            if (!isSiblingFanout && conversationPartner === activeChat) {
              socket.emit('messageSeen', { targetUserId })
            }
            if (isLegacySiblingForward) {
              // Legacy single-target path: sent by another device of this
              // account via the deviceEnvelope channel (display-only).
              continue
            }

            if (conversationPartner === activeChat) {
              const resolvedPrivateKey = await ensurePrivateKey()

              const senderDeviceUserIdRaw = message.senderDeviceUserId
              const senderUserId = String(message.userId)
              const senderDeviceUserId =
                senderDeviceUserIdRaw && String(senderDeviceUserIdRaw) !== senderUserId
                  ? String(senderDeviceUserIdRaw)
                  : null
              const cryptoPeerUserId = senderDeviceUserId || senderUserId
              const sessionTargetId = senderDeviceUserId || null
              const decryptOptions = {
                ...(sessionTargetId
                  ? {
                      sessionTargetId,
                      peerUserId: cryptoPeerUserId,
                    }
                  : {}),
                conversationKeyOverride: isSiblingFanout
                  ? String(message.conversationUserId || targetUserId)
                  : senderUserId,
              }

              const decrypted = await decryptIncomingMessage(
                message,
                nonce,
                userId,
                cryptoPeerUserId,
                resolvedPrivateKey,
                socket,
                setMessages,
                decryptOptions
              )
              if (decrypted && !isSiblingFanout) {
                forwardMessageToDevices({
                  userId,
                  targetUserId: senderUserId,
                  text: decrypted.text ?? '',
                  image: decrypted.image ?? null,
                  direction: 'incoming',
                  messageId: decrypted._id,
                  createdAt: decrypted.createdAt,
                  seenStatus: decrypted.seenStatus ?? false,
                  username: message.username ?? '',
                }).catch(() => {})
              }
            }
          } catch (err) {
            console.error('❌ Error handling message:', err)
            continue
          }
        }
      }
    }

    const handleSeenUpdate = async ({ userId: seenByUserId, targetUserId: seenForUserId }) => {
      if (seenForUserId === userId && seenByUserId === targetUserId) {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => (msg.userId === userId ? { ...msg, seenStatus: true } : msg))
        )

        try {
          await updateMessageSeenStatus(userId, targetUserId)
        } catch (e) {
          console.error('Error updating seen status in ELD:', e)
        }
      }
    }

    // Peer's device received our message(s) but hasn't necessarily opened the
    // chat. Flip our outgoing bubbles to "delivered" (read still supersedes).
    const handleDeliveredUpdate = async ({
      userId: deliveredByUserId,
      targetUserId: deliveredForUserId,
      deliveredAt,
    }) => {
      if (deliveredForUserId === userId && deliveredByUserId === targetUserId) {
        const stamp = deliveredAt || new Date().toISOString()
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            String(msg.userId) === String(userId) && !msg.deliveredAt
              ? { ...msg, deliveredAt: stamp }
              : msg
          )
        )

        try {
          await updateMessageDeliveredStatus(userId, targetUserId, stamp)
        } catch (e) {
          console.error('Error updating delivered status in ELD:', e)
        }
      }
    }

    const handleEldUpdate = async (event) => {
      const { userId: updatedUserId, targetUserId: updatedTargetUserId } = event.detail
      if (
        (updatedUserId === userId && updatedTargetUserId === targetUserId) ||
        (updatedUserId === targetUserId && updatedTargetUserId === userId)
      ) {
        const savedMessages = await getSavedMessages(userId, targetUserId)
        setMessages(savedMessages)
      }
    }

    window.addEventListener('localStorageUpdated', handleEldUpdate)

    socket.on('newMessage', handleChatMessage)
    socket.on('messageSeenUpdate', handleSeenUpdate)
    socket.on('messageDeliveredUpdate', handleDeliveredUpdate)

    const initChat = async () => {
      // Ask sibling devices to push their current DR state for this peer.
      // Their reply arrives as a sessionSync deviceEnvelope and is merged
      // before the user has a chance to compose a message, preventing sends
      // built on a stale post-DH-ratchet snapshot.
      requestSessionSync(targetUserId)
      await fetchLatestMessageNumber(socket, targetUserId)
      socket.emit('ready', { targetUserId })
    }
    initChat()

    return () => {
      socket.off('newMessage', handleChatMessage)
      socket.off('messageSeenUpdate', handleSeenUpdate)
      socket.off('messageDeliveredUpdate', handleDeliveredUpdate)
      window.removeEventListener('localStorageUpdated', handleEldUpdate)
    }
  }, [activeChat, privateKeyArray, socket, targetUserId, userId])

  const sendMessageNow = async (text, imageData = null) => {
    if (sendBlocked) {
      throw new Error(sendBlockedReason || 'Sending is blocked')
    }

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
    const ownDeviceId = localStorage.getItem('echo-device-id') || null

    // Build per-device fan-out targets: every trusted device of the peer +
    // every trusted sibling device of this account (excluding ourselves).
    // If the peer has not yet published any per-device bundle (legacy peer),
    // fall back to a single user-level send so existing conversations still
    // work end-to-end.
    let fanoutTargets = await buildDmFanoutTargetsIncludingSiblings(
      userId,
      targetUserId,
      ownDeviceId
    ).catch(() => [])

    const targetsNeedingBundle = []
    for (const target of fanoutTargets) {
      if (target.bundle) continue
      const existingRoot = await getRootKey(userId, target.sessionTargetId)
      if (!existingRoot) targetsNeedingBundle.push(target)
    }
    if (targetsNeedingBundle.length > 0) {
      const hydratedTargets = await attachBundlesToFanoutTargets(targetsNeedingBundle)
      const hydratedByDelivery = new Map(
        hydratedTargets.map((target) => [
          `${target.ownerUserId || ''}:${target.deliveryUserId || target.sessionTargetId || ''}`,
          target,
        ])
      )
      fanoutTargets = fanoutTargets.map((target) => {
        const key = `${target.ownerUserId || ''}:${target.deliveryUserId || target.sessionTargetId || ''}`
        return hydratedByDelivery.get(key) ?? target
      })
    }

    const messageId = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const outgoingMsg = {
      _id: messageId,
      userId,
      targetUserId,
      username,
      text: text || '',
      image: imageData || null,
      seenStatus: false,
      createdAt,
    }

    const sendOnce = (payload) =>
      new Promise((resolve) => {
        socket.emit('newMessage', payload, (ack) => resolve(ack))
      })

    const sendWithResync = async (payload, target) => {
      // Each (sender_device, recipient_device) pair has its own conversation
      // sequence on the server. Probe the latest accepted number for this
      // specific pair, then send; on out_of_sync, re-probe and retry.
      const sequenceScope = target
        ? {
            peerDeviceId: target.peerDeviceId ?? null,
            peerDeviceUserId: target.peerDeviceUserId ?? null,
            senderDeviceId: ownDeviceId,
            senderDeviceUserId:
              ownDeviceUserId && String(ownDeviceUserId) !== String(userId)
                ? ownDeviceUserId
                : null,
          }
        : {}
      const lastAccepted = await fetchLatestMessageNumber(
        socket,
        payload.targetUserId || targetUserId,
        sequenceScope
      ).catch(() => -1)
      const lastInt = Number.isSafeInteger(lastAccepted) ? lastAccepted : -1
      payload.messageNumber = lastInt + 1
      let ack = await sendOnce(payload)
      if (!ack?.success && (ack?.error === 'out_of_sync' || ack?.error === 'replay_detected')) {
        const last = Number.isSafeInteger(ack?.lastAccepted) ? ack.lastAccepted : null
        if (last != null) {
          payload.messageNumber = last + 1
          ack = await sendOnce(payload)
        }
      }
      return ack
    }

    if (fanoutTargets.length === 0) {
      // Legacy single-target path: no per-device bundles published.
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

      const ack = await sendWithResync(outgoing, null)
      if (!ack?.success) throw new Error(ack?.error || 'Failed to send message')

      if (outgoing?.peerIdentityToPin) {
        storePeerIdentityKeys(targetUserId, {
          ...outgoing.peerIdentityToPin,
          firstSeenAt: Date.now(),
        })
      }

      await updateSavedMessages(userId, targetUserId, outgoingMsg, setMessages)

      // Legacy own-outbound display-sync (no-op under per-device IK; harmless).
      forwardMessageToDevices({
        userId,
        targetUserId,
        text: outgoingMsg.text,
        image: outgoingMsg.image,
        direction: 'outgoing',
        messageId: outgoingMsg._id,
        createdAt: outgoingMsg.createdAt,
        seenStatus: outgoingMsg.seenStatus,
        username,
      }).catch(() => {})
      return
    }

    // Per-device fan-out: one encrypt + emit per (sender_device, target_device)
    // pair. The peer's primary identity is pinned only on first contact (when
    // PEER_IDENTITY_CHANGED is raised) — and we pin per-compound-session via
    // the encrypt path so each device's session has its own identity scope.
    let anySucceeded = false
    let firstError = null

    for (const target of fanoutTargets) {
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
          sessionTargetId: target.sessionTargetId,
          peerUserId: target.peerUserId,
          precomputedBundle: target.bundle,
        })
      } catch (err) {
        if (err?.code === 'PEER_IDENTITY_CHANGED') {
          setSendBlocked(true)
          setSendBlockedReason(
            'A device identity key for this contact changed. Verify the contact before sending.'
          )
          setIdentityChangeDetail({
            savedPeer: err.savedPeer ?? null,
            fetchedPeer: err.fetchedPeer ?? null,
          })
          throw err
        }
        firstError = firstError ?? err
        continue
      }

      // Tag the wire payload with the device-pair so the server keys the
      // sequence by (senderDeviceId, peerDeviceId) and the recipient device
      // can self-filter on receive.
      outgoing.senderDeviceId = ownDeviceId
      outgoing.senderDeviceUserId =
        ownDeviceUserId && String(ownDeviceUserId) !== String(userId) ? ownDeviceUserId : null
      outgoing.peerDeviceId = target.peerDeviceId
      outgoing.peerDeviceUserId = target.peerDeviceUserId
      if (target.peerUserId !== targetUserId) outgoing.conversationUserId = targetUserId

      const ack = await sendWithResync(outgoing, target)
      if (!ack?.success) {
        firstError = firstError ?? new Error(ack?.error || 'Failed to send message')
        continue
      }
      anySucceeded = true

      if (outgoing?.peerIdentityToPin) {
        storePeerIdentityKeys(target.sessionTargetId, {
          ...outgoing.peerIdentityToPin,
          firstSeenAt: Date.now(),
        })
      }
    }

    if (!anySucceeded) {
      throw firstError ?? new Error('Failed to send message to any device')
    }

    // Persist the visual message once, under the user-level conversation key.
    await updateSavedMessages(userId, targetUserId, outgoingMsg, setMessages)
    return
  }

  const sendMessage = (text, imageData = null) => {
    const queuedSend = sendQueueRef.current
      .catch(() => {})
      .then(() => sendMessageNow(text, imageData))

    sendQueueRef.current = queuedSend.catch(() => {})
    return queuedSend
  }

  useEffect(() => {
    const messageCountIncreased = messages.length > previousMessageCountRef.current

    if (autoScroll && messageCountIncreased && messagesEndRef.current) {
      const behavior = isInitialLoadRef.current ? 'instant' : 'smooth'
      messagesEndRef.current.scrollIntoView({ behavior, block: 'nearest' })
      isInitialLoadRef.current = false
    }

    previousMessageCountRef.current = messages.length
  }, [messages, autoScroll])

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
      const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100

      setAutoScroll(isNearBottom)
    }
  }

  const contactInfo = {
    name: contact?.username || contact?.name || 'Unknown',
    avatar: contact?.profileImage || contact?.avatar || null,
  }

  return (
    <div className='app-container flex h-full min-h-0 min-w-0 flex-col overflow-hidden'>
      <div className='chat-container relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
        <div
          ref={messagesContainerRef}
          className={`messages-container relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain ${getWallpaperClasses(currentWallpaper)}`}
          onScroll={handleScroll}
        >
          {getWallpaperComponent(currentWallpaper)}

          <div className='relative z-10 flex min-h-full flex-col'>
            <DisplayText
              messages={messages}
              currentUserId={userId}
              wallpaperType={currentWallpaper}
              contact={contactInfo}
            />
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
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
        onReject={() => {
          setShowVerifyModal(false)
        }}
      />
      <div className='shrink-0'>
        <SendText
          sendMessage={sendMessage}
          disabled={sendBlocked}
          disabledReason={sendBlockedReason}
        />
      </div>
    </div>
  )
}

Chat.propTypes = {
  token: PropTypes.string,
  activeChat: PropTypes.string.isRequired,
  contact: PropTypes.shape({
    username: PropTypes.string,
    name: PropTypes.string,
    profileImage: PropTypes.string,
    avatar: PropTypes.string,
  }),
}

export default Chat
