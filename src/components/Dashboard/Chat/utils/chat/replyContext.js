// Compact "reply-to" context for swipe/click-to-reply. It travels *inside* the
// encrypted message payload (DM JSON payload and group application plaintext),
// so it stays end-to-end encrypted and must be kept small: an id, the original
// sender (userId is used to color the quote in groups), a short text snapshot,
// and a media-kind flag — never the image bytes themselves.

export const REPLY_SNIPPET_MAX = 140

const mediaKind = (image) => {
  if (!image) return null
  if (/\.gif($|\?)/i.test(image) || String(image).startsWith('data:image/gif')) return 'gif'
  return 'image'
}

// Build the embeddable reply context from a full (already-decrypted) message.
export const buildReplyContext = (message) => {
  if (!message) return null
  const kind = message.audio
    ? 'audio'
    : message.video
      ? 'video'
      : mediaKind(message.image) || 'text'
  const rawText = typeof message.text === 'string' ? message.text : ''
  const text =
    rawText.length > REPLY_SNIPPET_MAX ? `${rawText.slice(0, REPLY_SNIPPET_MAX)}…` : rawText
  return {
    id: String(message._id ?? ''),
    userId: String(message.userId ?? ''),
    username: message.username || 'Unknown',
    text,
    kind,
  }
}

// One-line preview for the quote chip and the composer's "replying to" bar.
export const replyPreviewText = (replyTo) => {
  if (!replyTo) return ''
  if (replyTo.text) return replyTo.text
  if (replyTo.kind === 'gif') return '🎞️ GIF'
  if (replyTo.kind === 'image') return '📷 Photo'
  if (replyTo.kind === 'video') return '🎥 Video'
  if (replyTo.kind === 'audio') return '🎤 Voice message'
  return ''
}
