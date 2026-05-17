import eld from '@/utils/storage/EncryptedLocalDatabase'

const HISTORY_PACKAGE_VERSION = 'echo-history-package-v1'
const passKeyForUser = (userId) => `eld-pass-${userId}`

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function storageEntriesForUser(userId) {
  if (!userId) return []
  const prefixes = [
    `recentConversations-${userId}`,
    `groups-${userId}`,
    `unread-${userId}-`,
    `unreadGroup-${userId}-`,
  ]
  const entries = []

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key || !prefixes.some((prefix) => key.startsWith(prefix))) continue
    entries.push({ key, value: localStorage.getItem(key) })
  }

  return entries
}

export async function buildHistoryPackage() {
  if (!eld.isUnlocked()) {
    throw new Error('Unlock ECHO on this device before compiling chat history.')
  }

  const userId = eld.getCurrentUserId() || localStorage.getItem('userId')
  if (!userId) throw new Error('Missing current user id.')

  const messages = await eld.exportMessagesForCurrentUser()
  const mlsGroupStates = await eld.exportMlsGroupStatesForCurrentUser()
  const localStorageEntries = storageEntriesForUser(userId)

  return {
    version: HISTORY_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    user: {
      userId,
      username: localStorage.getItem('username') || null,
    },
    auth: {
      token: localStorage.getItem('token') || null,
      userId,
      username: localStorage.getItem('username') || null,
    },
    chats: safeJsonParse(localStorage.getItem(`recentConversations-${userId}`), []),
    groups: safeJsonParse(localStorage.getItem(`groups-${userId}`), []),
    messages,
    mlsGroupStates,
    localStorageEntries,
  }
}

export async function unlockOrCreateHistoryDatabase(historyPackage, unlockSecret) {
  if (historyPackage?.version !== HISTORY_PACKAGE_VERSION) {
    throw new Error('Unsupported history package.')
  }
  const userId = historyPackage.user?.userId || localStorage.getItem('userId')
  if (!userId) throw new Error('History package is missing a user id.')
  if (!unlockSecret) throw new Error('History package unlock secret is missing.')

  if (eld.isUnlocked() && eld.getCurrentUserId?.() === userId) {
    sessionStorage.setItem(passKeyForUser(userId), unlockSecret)
    return
  }

  if (eld.isUnlocked() && eld.getCurrentUserId?.() !== userId) {
    eld.lock()
  }

  const exists = await eld.userExists(userId)
  if (exists) {
    try {
      await eld.unlock(userId, unlockSecret)
    } catch (error) {
      if (error?.message !== 'Invalid password') throw error
      await eld.resetUser(userId)
      await eld.createUser(userId, unlockSecret)
    }
  } else {
    await eld.createUser(userId, unlockSecret)
  }
  sessionStorage.setItem(passKeyForUser(userId), unlockSecret)
}

export async function importHistoryPackage(historyPackage, { unlockSecret } = {}) {
  await unlockOrCreateHistoryDatabase(historyPackage, unlockSecret)

  const userId =
    eld.getCurrentUserId() || historyPackage.user?.userId || localStorage.getItem('userId')
  if (historyPackage.auth?.token) {
    localStorage.setItem('token', historyPackage.auth.token)
  }
  if (historyPackage.auth?.userId) {
    localStorage.setItem('userId', historyPackage.auth.userId)
  }
  if (historyPackage.auth?.username) {
    localStorage.setItem('username', historyPackage.auth.username)
  }
  if (historyPackage.user?.userId && !localStorage.getItem('userId')) {
    localStorage.setItem('userId', historyPackage.user.userId)
  }
  if (historyPackage.user?.username && !localStorage.getItem('username')) {
    localStorage.setItem('username', historyPackage.user.username)
  }

  for (const entry of historyPackage.localStorageEntries || []) {
    if (entry?.key && typeof entry.value === 'string') localStorage.setItem(entry.key, entry.value)
  }

  if (userId) {
    localStorage.setItem(
      `recentConversations-${userId}`,
      JSON.stringify(historyPackage.chats || [])
    )
    localStorage.setItem(`groups-${userId}`, JSON.stringify(historyPackage.groups || []))
  }

  const importedMessages = await eld.importMessagesForCurrentUser(historyPackage.messages || [])
  const importedGroupStates = await eld.importMlsGroupStatesForCurrentUser(
    historyPackage.mlsGroupStates || []
  )

  window.dispatchEvent(new CustomEvent('localStorageUpdated', { detail: { userId } }))

  return {
    importedMessages,
    importedGroupStates,
    chats: historyPackage.chats?.length || 0,
    groups: historyPackage.groups?.length || 0,
  }
}
