import { describe, it, expect } from 'vitest'
import { buildReplyContext, replyPreviewText } from './replyContext'

describe('reply context — media kinds', () => {
  it('tags a video message as kind "video" and previews it with the cam emoji', () => {
    const ctx = buildReplyContext({
      _id: 'm1',
      userId: 'u1',
      username: 'Alice',
      text: '',
      video: { mediaId: 'abc', keyB64: 'k' },
    })
    expect(ctx.kind).toBe('video')
    expect(replyPreviewText(ctx)).toBe('🎥 Video')
  })

  it('prefers a video caption over the generic label (like photos)', () => {
    const ctx = buildReplyContext({
      _id: 'm2',
      userId: 'u1',
      username: 'Alice',
      text: 'my clip',
      video: { mediaId: 'abc', keyB64: 'k' },
    })
    expect(ctx.kind).toBe('video')
    expect(replyPreviewText(ctx)).toBe('my clip')
  })

  it('tags a voice message as kind "audio" with the mic emoji', () => {
    const ctx = buildReplyContext({ _id: 'm3', userId: 'u1', audio: { mediaId: 'a1' } })
    expect(ctx.kind).toBe('audio')
    expect(replyPreviewText(ctx)).toBe('🎤 Voice message')
  })

  it('still tags image/gif/text correctly', () => {
    expect(buildReplyContext({ image: 'x.png' }).kind).toBe('image')
    expect(buildReplyContext({ image: 'cat.gif' }).kind).toBe('gif')
    expect(buildReplyContext({ text: 'hi' }).kind).toBe('text')
    expect(replyPreviewText({ kind: 'image' })).toBe('📷 Photo')
    expect(replyPreviewText({ kind: 'gif' })).toBe('🎞️ GIF')
  })
})
