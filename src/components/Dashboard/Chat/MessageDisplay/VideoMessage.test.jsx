// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

const getMediaObjectUrl = vi.fn()
const prefetchMedia = vi.fn()
vi.mock('../utils/crypto/mediaCache', () => ({
  getMediaObjectUrl: (...a) => getMediaObjectUrl(...a),
  prefetchMedia: (...a) => prefetchMedia(...a),
}))

import VideoMessage from './VideoMessage'

const video = {
  mediaId: 'abc123',
  keyB64: 'AAAA',
  mime: 'video/mp4',
  thumbnail: 'data:image/jpeg;base64,XYZ',
  durationMs: 65000,
  width: 720,
  height: 1280,
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('VideoMessage', () => {
  let container
  let root

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    getMediaObjectUrl.mockResolvedValue('blob:mock')
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('shows a poster + duration, prefetches on mount, and does NOT open until clicked', () => {
    act(() => root.render(<VideoMessage video={video} />))
    const poster = container.querySelector('img[alt="Video"]')
    expect(poster).toBeTruthy()
    expect(poster.getAttribute('src')).toBe(video.thumbnail)
    expect(container.textContent).toContain('1:05') // 65s
    expect(prefetchMedia).toHaveBeenCalledWith(video) // cached locally on view
    expect(getMediaObjectUrl).not.toHaveBeenCalled() // nothing opened yet
  })

  it('opens a full-screen player on click that reads from the local cache', async () => {
    act(() => root.render(<VideoMessage video={video} />))
    const card = container.querySelector('button[title="Play video"]')
    await act(async () => {
      card.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
    })
    expect(getMediaObjectUrl).toHaveBeenCalledWith(video)
    // Lightbox is portaled to <body>, not the component container.
    const el = document.body.querySelector('video')
    expect(el).toBeTruthy()
    expect(el.getAttribute('src')).toBe('blob:mock')
  })

  it('shows an error in the player when the cache load fails', async () => {
    getMediaObjectUrl.mockRejectedValueOnce(new Error('boom'))
    act(() => root.render(<VideoMessage video={video} />))
    const card = container.querySelector('button[title="Play video"]')
    await act(async () => {
      card.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
    })
    expect(document.body.textContent).toContain('Couldn’t load')
  })
})
