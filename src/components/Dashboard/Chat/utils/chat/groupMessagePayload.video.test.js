import { describe, it, expect } from 'vitest'
import { encodeGroupMessagePayload, decodeGroupMessagePayload } from './groupMessageDecryption'

const descriptor = {
  mediaId: 'abc123',
  keyB64: 'AAAA',
  scheme: 'echo-blob-v1',
  chunkSize: 1048576,
  size: 4242,
  mime: 'video/mp4',
  durationMs: 3200,
  width: 720,
  height: 1280,
  thumbnail: 'data:image/jpeg;base64,XYZ',
}

describe('group message payload codec — video', () => {
  it('round-trips a video descriptor with a caption', () => {
    const bytes = encodeGroupMessagePayload({ text: 'look', video: descriptor })
    const decoded = decodeGroupMessagePayload(bytes)
    expect(decoded.text).toBe('look')
    expect(decoded.image).toBeNull()
    expect(decoded.video).toEqual(descriptor)
  })

  it('round-trips a caption-less video', () => {
    const bytes = encodeGroupMessagePayload({ text: '', video: descriptor })
    const decoded = decodeGroupMessagePayload(bytes)
    expect(decoded.text).toBe('')
    expect(decoded.video.mediaId).toBe('abc123')
  })

  it('keeps the historical raw-text shape for plain text (no video key)', () => {
    const bytes = encodeGroupMessagePayload({ text: 'hi' })
    const decoded = decodeGroupMessagePayload(bytes)
    expect(decoded).toEqual({ text: 'hi', image: null })
    expect('video' in decoded).toBe(false)
  })

  it('round-trips an audio (voice note) descriptor', () => {
    const aud = {
      mediaId: 'aud9',
      keyB64: 'KK',
      scheme: 'echo-blob-v1',
      mime: 'audio/webm',
      durationMs: 4200,
    }
    const bytes = encodeGroupMessagePayload({ text: '', audio: aud })
    const decoded = decodeGroupMessagePayload(bytes)
    expect(decoded.audio).toEqual(aud)
    expect(decoded.image).toBeNull()
  })
})
