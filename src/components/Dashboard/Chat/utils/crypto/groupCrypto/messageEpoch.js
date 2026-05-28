import { base64ToBytes } from '../../helpers.js'

const TEXT_DECODER = new TextDecoder()

// Read the MLS epoch a persisted group message was encrypted under.
export function resolveMessageEpoch(message) {
  if (Number.isInteger(message?.epoch)) return message.epoch
  if (Number.isInteger(message?.mlsEpoch)) return message.mlsEpoch

  const header = message?.header
  if (header && typeof header === 'object' && Number.isInteger(header.epoch)) {
    return header.epoch
  }

  if (typeof message?.headerB64 !== 'string' || message.headerB64.length === 0) {
    return null
  }

  try {
    const parsed = JSON.parse(TEXT_DECODER.decode(base64ToBytes(message.headerB64)))
    return Number.isInteger(parsed?.epoch) ? parsed.epoch : null
  } catch {
    return null
  }
}

// True when `state` has key material for this exact message epoch and the user
// was not in a post-removal gap when it was sent.
export function canDecryptMlsApplicationMessage(state, messageEpoch) {
  if (!Number.isInteger(messageEpoch)) return false
  if (!Number.isInteger(state?.epoch)) return false
  if (messageEpoch !== state.epoch) return false
  if (Number.isInteger(state.decryptFromEpoch) && messageEpoch < state.decryptFromEpoch) {
    return false
  }
  return Boolean(state.applicationSecretB64 || state.groupKeyB64)
}

// Drop cached plaintext from epochs the user was removed for (rejoin gap).
export function filterMessagesForMembershipWindow(messages, state) {
  if (!Array.isArray(messages)) return []
  const decryptFromEpoch = Number.isInteger(state?.decryptFromEpoch) ? state.decryptFromEpoch : null
  const leftAtEpoch = Number.isInteger(state?.leftAtEpoch) ? state.leftAtEpoch : null

  if (!Number.isInteger(decryptFromEpoch) && !Number.isInteger(leftAtEpoch)) {
    return messages
  }

  return messages.filter((message) => {
    if (message?.messageType === 'system') return true

    const messageEpoch = Number.isInteger(message?.mlsEpoch)
      ? message.mlsEpoch
      : resolveMessageEpoch(message)

    if (!Number.isInteger(messageEpoch)) {
      return !Number.isInteger(leftAtEpoch)
    }

    if (
      Number.isInteger(leftAtEpoch) &&
      Number.isInteger(decryptFromEpoch) &&
      messageEpoch >= leftAtEpoch &&
      messageEpoch < decryptFromEpoch
    ) {
      return false
    }

    return true
  })
}
