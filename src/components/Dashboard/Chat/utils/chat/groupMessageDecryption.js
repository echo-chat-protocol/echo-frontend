import {
  decryptApplicationMessage,
  loadGroupState,
  saveGroupState,
} from '../crypto/groupCryptoProvider'
import { consumePendingOutgoingGroupMessage, updateSavedMessages } from './keyManagement'

const TEXT_DECODER = new TextDecoder()
const GROUP_CACHE_PREFIX = 'group:'

const getGroupCacheId = (groupId) => `${GROUP_CACHE_PREFIX}${groupId}`

export async function decryptIncomingGroupMessage({
  message,
  userId,
  username = null,
  currentState = null,
  setMessages = null,
}) {
  const groupId = String(message?.groupId ?? '')
  if (!groupId) {
    throw new Error('decryptIncomingGroupMessage requires a groupId')
  }

  const createdAt = message?.createdAt || message?.timestamp || new Date().toISOString()
  const isOwnMessage = String(message?.userId ?? '') === String(userId ?? '')
  const fromUsername = message?.username || (isOwnMessage ? username : 'Member')

  let text =
    typeof message?.payload === 'string'
      ? message.payload
      : typeof message?.text === 'string'
        ? message.text
        : ''
  let nextState = currentState

  // Item #3: accept messages framed with encrypted sender data (preferred) or legacy
  // plaintext header.  Both carry ciphertextB64 as the actual content ciphertext.
  const hasAppMessage =
    message?.contentType === 'application' &&
    (message?.encryptedSenderDataB64 || message?.headerB64) &&
    message?.ciphertextB64

  if (hasAppMessage) {
    const pendingPlaintext = isOwnMessage
      ? consumePendingOutgoingGroupMessage({
          groupId,
          encryptedSenderDataB64: message.encryptedSenderDataB64 ?? null,
          headerB64: message.headerB64 ?? null,
          ciphertextB64: message.ciphertextB64,
        })
      : null

    if (typeof pendingPlaintext === 'string') {
      text = pendingPlaintext
    } else {
      const localState = currentState ?? (await loadGroupState(groupId))
      if (!localState) {
        throw new Error(`Missing local MLS state for group ${groupId}`)
      }

      const decrypted = await decryptApplicationMessage({
        state: localState,
        // Item #3: pass encrypted sender identity when available; messageFlow will use it
        // only if senderDataSecretB64 is in state, and falls back to header otherwise.
        encryptedSenderDataB64: message.encryptedSenderDataB64 ?? null,
        header: message.headerB64 ?? null,
        ciphertext: message.ciphertextB64,
        includeNewState: true,
      })
      const plaintextBytes = decrypted?.plaintextBytes ?? decrypted
      nextState = decrypted?.newState ?? localState
      text = TEXT_DECODER.decode(plaintextBytes)

      if (nextState && nextState !== localState) {
        nextState = await saveGroupState(groupId, nextState)
      }
    }
  }

  const formattedMessage = {
    _id: message?._id || `${groupId}:${String(message?.seq ?? createdAt)}`,
    userId: String(message?.userId ?? ''),
    username: fromUsername,
    text,
    createdAt,
    seenStatus: true,
  }

  await updateSavedMessages(userId, getGroupCacheId(groupId), formattedMessage, setMessages)

  return {
    formattedMessage,
    nextState,
  }
}

export default decryptIncomingGroupMessage
