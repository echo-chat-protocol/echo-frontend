import { useState, useEffect, useRef } from 'react'
import { previewReceiptState, advancePreviewReceipt } from '../../Chat/utils/chat/readReceipts'

export const useConversations = (userId) => {
  const [recentConversations, setRecentConversations] = useState([])
  const initializedUserId = useRef(null) // prevents overwrite before the active user loads
  const skipNextSave = useRef(false)

  // Load whenever the active account changes so previous-account chats never
  // persist into the next synced/logged-in account.
  useEffect(() => {
    if (!userId) {
      initializedUserId.current = null
      setRecentConversations([])
      return
    }

    if (initializedUserId.current === userId) return

    const saved = localStorage.getItem(`recentConversations-${userId}`)
    let nextConversations = []
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Drop any malformed rows (missing id/username) that a past bug may have
        // persisted, so they can't crash the conversation list on render.
        if (Array.isArray(parsed)) {
          nextConversations = parsed.filter((conv) => conv && conv.id != null)
        }
      } catch (e) {
        console.error('Failed to parse localStorage conversations', e)
      }
    }

    skipNextSave.current = true
    setRecentConversations(nextConversations)
    initializedUserId.current = userId
  }, [userId])

  // Save to localStorage **only after initial load**
  useEffect(() => {
    if (!userId || initializedUserId.current !== userId) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    localStorage.setItem(`recentConversations-${userId}`, JSON.stringify(recentConversations))
  }, [recentConversations, userId])

  const updateRecentConversations = (friendData, message = null) => {
    // Support a functional updater form, e.g. the `userProfileUpdated` handler
    // remaps many conversations at once with `updateRecentConversations(prev =>
    // prev.map(...))`. Without this branch the function was treated as a
    // `friendData` object: spreading it added a property-less garbage entry
    // (no id, no username), and the conversation-list filter then crashed on
    // `conv.username.toLowerCase()`.
    if (typeof friendData === 'function') {
      setRecentConversations(friendData)
      return
    }

    // A receipt only makes sense for OUR outgoing last message — an inbound last
    // message shows no check. Only touch receipt fields when the update carries
    // the author id; a direction-less update (e.g. a profile/metadata refresh)
    // must not clobber a known outgoing receipt back to "no check".
    const hasDirection = message && typeof message === 'object' && message.userId != null
    const fromMe = hasDirection && String(message.userId) === String(userId)
    const lastMessageState = previewReceiptState(message, userId)

    setRecentConversations((prev) => {
      const existingIndex = prev.findIndex((chat) => chat.id === friendData.id)
      let updated = [...prev]

      if (existingIndex >= 0) {
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...friendData,
          lastMessage: message?.text || updated[existingIndex].lastMessage,
          lastMessageTime: message?.timestamp || updated[existingIndex].lastMessageTime,
          ...(hasDirection ? { lastMessageFromMe: fromMe, lastMessageState } : {}),
        }
        if (message) {
          const [moved] = updated.splice(existingIndex, 1)
          updated.unshift(moved)
        }
      } else {
        updated.unshift({
          ...friendData,
          lastMessage: message?.text || '',
          lastMessageTime: message?.timestamp || new Date().toISOString(),
          lastMessageFromMe: fromMe,
          lastMessageState,
        })
      }

      return updated.slice(0, 20) // Keep recent 20
    })
  }

  // Advance a conversation's outgoing-message receipt state in response to a
  // live messageSeenUpdate / messageDeliveredUpdate. No-op for conversations
  // whose last message wasn't ours, and never regresses a higher state.
  const setConversationReceipt = (peerId, state) => {
    setRecentConversations((prev) => {
      let changed = false
      const next = prev.map((conv) => {
        if (String(conv.id) !== String(peerId)) return conv
        if (!conv.lastMessageFromMe) return conv
        const advanced = advancePreviewReceipt(conv.lastMessageState, state)
        if (advanced === conv.lastMessageState) return conv
        changed = true
        return { ...conv, lastMessageState: advanced }
      })
      return changed ? next : prev
    })
  }

  return { recentConversations, updateRecentConversations, setConversationReceipt }
}
