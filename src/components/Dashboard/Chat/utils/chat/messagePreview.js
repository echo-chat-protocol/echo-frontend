/**
 * Build the short preview text shown for a message in the conversation list.
 *
 * Images have no body text, so a bare preview would render empty. Instead show
 * a 📷 with the caption when present, or "Photo" when not. GIFs (sent via the
 * media picker) keep their own marker when uncaptioned.
 *
 * @param {{ text?: string, image?: string|null }} [message]
 * @returns {string}
 */
export const getMessagePreview = (message) => {
  const caption = typeof message?.text === 'string' ? message.text.trim() : ''
  const image = message?.image

  if (image) {
    if (caption) return `📷 ${caption}`
    const isGif =
      typeof image === 'string' &&
      (/\.gif($|\?)/i.test(image) || image.startsWith('data:image/gif'))
    return isGif ? '🎞️ GIF' : '📷 Photo'
  }

  return caption
}
