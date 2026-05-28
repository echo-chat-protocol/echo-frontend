import { useState, useEffect, useRef } from 'react'

export const useConversations = (userId) => {
  const [recentConversations, setRecentConversations] = useState([])
  const [unreadMessages, setUnreadMessages] = useState({})
  const initializedUserId = useRef(null) // prevents overwrite before the active user loads
  const skipNextSave = useRef(false)

  // Load whenever the active account changes so cached chats cannot bleed between users.
  useEffect(() => {
    if (!userId) {
      initializedUserId.current = null
      setRecentConversations([])
      setUnreadMessages({})
      return
    }

    if (initializedUserId.current === userId) return

    const saved = localStorage.getItem(`recentConversations-${userId}`)
    let nextConversations = []
    let nextUnreads = {}
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          nextConversations = parsed

          nextUnreads = {}
          parsed.forEach((conv) => {
            const count = Number(localStorage.getItem(`unread-${userId}-${conv.id}`)) || 0
            nextUnreads[conv.id] = count
          })
        }
      } catch (e) {
        console.error('Failed to parse localStorage conversations', e)
      }
    }

    skipNextSave.current = true
    setRecentConversations(nextConversations)
    setUnreadMessages(nextUnreads)
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
    setRecentConversations((prev) => {
      const existingIndex = prev.findIndex((chat) => chat.id === friendData.id)
      let updated = [...prev]

      if (existingIndex >= 0) {
        updated[existingIndex] = {
          ...updated[existingIndex],
          lastMessage: message?.text || updated[existingIndex].lastMessage,
          lastMessageTime: message?.timestamp || updated[existingIndex].lastMessageTime,
        }
        const [moved] = updated.splice(existingIndex, 1)
        updated.unshift(moved)
      } else {
        updated.unshift({
          ...friendData,
          lastMessage: message?.text || '',
          lastMessageTime: message?.timestamp || new Date().toISOString(),
        })
      }

      return updated.slice(0, 20) // Keep recent 20
    })

    if (message && message.userId !== userId) {
      setUnreadMessages((prev) => {
        const newCount = (prev[friendData.id] || 0) + 1
        localStorage.setItem(`unread-${userId}-${friendData.id}`, newCount)
        return {
          ...prev,
          [friendData.id]: newCount,
        }
      })
    }
  }

  return { recentConversations, unreadMessages, updateRecentConversations }
}
