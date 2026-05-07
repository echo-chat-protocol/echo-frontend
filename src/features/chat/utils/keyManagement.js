const storeKey = (userId, targetUserId, messageNumber, keyUint8Array) => {
  const sessionId = [userId, targetUserId].join('-')
  const keyStorageKey = `chatKeys-${sessionId}`
  const keyListJSON = localStorage.getItem(keyStorageKey)
  const keyList = keyListJSON ? JSON.parse(keyListJSON) : []

  // Ensure we're not overwriting existing keys
  if (keyList[messageNumber]) {
    console.warn(`⚠️ Key already exists at index ${messageNumber}, not overwriting`)
    return
  }

  // Store the key at its messageNumber index
  keyList[messageNumber] = Array.from(keyUint8Array)
  localStorage.setItem(keyStorageKey, JSON.stringify(keyList))
  console.log(`🔑 Stored key at index ${messageNumber}`)
}

const getLatestKey = (userId, targetUserId) => {
  const sessionId = [userId, targetUserId].join('-')
  const keyStorageKey = `chatKeys-${sessionId}`
  const keyListJSON = localStorage.getItem(keyStorageKey)
  if (!keyListJSON) return null

  const keyList = JSON.parse(keyListJSON)

  // Find the last non-null key
  for (let i = keyList.length - 1; i >= 0; i--) {
    if (keyList[i]) {
      const key = new Uint8Array(keyList[i])
      if (key.length === 32) {
        console.log(`🔑 Retrieved latest key at index ${i}`)
        return key
      }
    }
  }

  console.error('❌ No valid keys found in storage')
  return null
}

const getKey = (userId, targetUserId, index) => {
  const sessionId = [userId, targetUserId].join('-')
  const keyStorageKey = `chatKeys-${sessionId}`
  const keyListJSON = localStorage.getItem(keyStorageKey)
  if (!keyListJSON) return null

  const keyList = JSON.parse(keyListJSON)
  if (index >= keyList.length || !keyList[index]) {
    console.error(`❌ No key found at index ${index}`)
    return null
  }

  const key = new Uint8Array(keyList[index])
  console.log(`🔑 Retrieved key for index ${index} (length ${key.length})`)
  return key
}

const updateSavedMessages = (userId, targetUserId, message, setMessages) => {
  console.log('📂 Updating saved messages')
  console.log('📂 Saved message:', message)

  const savedSessionKey = `chatSession-${userId}-${targetUserId}`
  const savedSession = localStorage.getItem(savedSessionKey)
  let savedMessages = []

  if (savedSession) {
    const parsedSession = JSON.parse(savedSession)
    savedMessages = parsedSession.savedMessages || []

    if (savedMessages.some((msg) => msg._id === message._id)) {
      console.log('⚠️ Duplicate message ignored:', message._id)

      return
    }
  }

  savedMessages.push(message)
  const updatedSession = {
    savedMessages,
  }
  localStorage.setItem(savedSessionKey, JSON.stringify(updatedSession))
  window.dispatchEvent(new Event('localStorageUpdated'))
  console.log('📂 Updated saved messages:', savedMessages)

  setMessages(savedMessages)
}

export { storeKey, getLatestKey, getKey, updateSavedMessages }
