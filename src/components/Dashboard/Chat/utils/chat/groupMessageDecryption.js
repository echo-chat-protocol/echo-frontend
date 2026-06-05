import {
  decryptApplicationMessage,
  loadGroupState,
  saveGroupState,
} from '../crypto/groupCryptoProvider'
import { consumePendingOutgoingGroupMessage, updateSavedMessages } from './keyManagement'

const TEXT_DECODER = new TextDecoder()
const TEXT_ENCODER = new TextEncoder()
const GROUP_CACHE_PREFIX = 'group:'

const getGroupCacheId = (groupId) => `${GROUP_CACHE_PREFIX}${groupId}`

/**
 * Encode a group application-message plaintext. Text-only messages stay raw
 * bytes (the historical format, so older clients keep working both ways);
 * messages carrying an image are wrapped as JSON `{ text, image }` — mirroring
 * the DM payload shape. `image` is a data URL (compressed upload) or a remote
 * GIF/sticker URL.
 */
export function encodeGroupMessagePayload({
  text,
  image = null,
  replyTo = null,
  video = null,
  audio = null,
}) {
  if (image || replyTo || video || audio) {
    // Keep the historical { text, image } byte-shape unchanged when there's no
    // reply/video, so existing clients and vectors are unaffected; only add
    // `replyTo`/`video` when present. `video` is an encrypted-blob descriptor
    // { mediaId, keyB64, thumbnail, ... } — the decryption key rides here,
    // inside the MLS application plaintext, so it stays end-to-end encrypted.
    const payload = { text: text || '', image: image || null }
    if (replyTo) payload.replyTo = replyTo
    if (video) payload.video = video
    if (audio) payload.audio = audio
    return TEXT_ENCODER.encode(JSON.stringify(payload))
  }
  return TEXT_ENCODER.encode(text || '')
}

/** Inverse of encodeGroupMessagePayload; tolerant of legacy raw-text payloads. */
export function decodeGroupMessagePayload(plaintextBytes) {
  const raw = TEXT_DECODER.decode(plaintextBytes)
  try {
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      ('text' in parsed ||
        'image' in parsed ||
        'replyTo' in parsed ||
        'video' in parsed ||
        'audio' in parsed)
    ) {
      const decoded = {
        text: typeof parsed.text === 'string' ? parsed.text : '',
        image: parsed.image ?? null,
      }
      // Only surface replyTo/video/audio when present, so non-reply messages
      // keep their historical { text, image } shape.
      if (parsed.replyTo) decoded.replyTo = parsed.replyTo
      if (parsed.video) decoded.video = parsed.video
      if (parsed.audio) decoded.audio = parsed.audio
      return decoded
    }
  } catch {
    /* legacy raw-text message — fall through */
  }
  return { text: raw, image: null }
}

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
  let image = null
  let replyTo = null
  let video = null
  let audio = null
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

    if (pendingPlaintext) {
      text = pendingPlaintext.text
      image = pendingPlaintext.image ?? null
      replyTo = pendingPlaintext.replyTo ?? null
      video = pendingPlaintext.video ?? null
      audio = pendingPlaintext.audio ?? null
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
      const payload = decodeGroupMessagePayload(plaintextBytes)
      text = payload.text
      image = payload.image
      replyTo = payload.replyTo ?? null
      video = payload.video ?? null
      audio = payload.audio ?? null

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
    image,
    createdAt,
    seenStatus: true,
  }
  // Only attach replyTo/video when present so plain messages keep their prior shape.
  if (replyTo) formattedMessage.replyTo = replyTo
  if (video) {
    formattedMessage.video = video
    // Eagerly cache the decrypted blob locally on receipt (fire-and-forget) so
    // opening it later needs no network fetch or re-decrypt.
    import('../crypto/mediaCache').then((m) => m.prefetchMedia(video)).catch(() => {})
  }
  if (audio) {
    formattedMessage.audio = audio
    import('../crypto/mediaCache').then((m) => m.prefetchMedia(audio)).catch(() => {})
  }

  await updateSavedMessages(userId, getGroupCacheId(groupId), formattedMessage, setMessages)

  if (typeof globalThis !== 'undefined' && globalThis.__echoGroupTrace) {
    try {
      globalThis.__echoGroupTrace.push({
        direction: 'in',
        phase: 'arrive',
        groupId,
        messageId: formattedMessage._id,
        senderUserId: formattedMessage.userId,
        senderUsername: fromUsername,
        isOwnMessage,
        createdAt,
        contentType: message?.contentType ?? null,
        framing: message?.encryptedSenderDataB64
          ? 'encrypted-sender-data'
          : message?.headerB64
            ? 'plaintext-header'
            : 'plaintext',
        sizes: {
          ciphertextB64: message?.ciphertextB64?.length ?? 0,
          encryptedSenderDataB64: message?.encryptedSenderDataB64?.length ?? 0,
          headerB64: message?.headerB64?.length ?? 0,
        },
        plaintext: text,
        usedPendingPlaintext: isOwnMessage && hasAppMessage && typeof text === 'string',
      })
    } catch {
      /* trace is best-effort */
    }
  }

  return {
    formattedMessage,
    nextState,
  }
}

export default decryptIncomingGroupMessage
