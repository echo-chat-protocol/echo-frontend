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

import AudioMessage from './AudioMessage'

const audio = { mediaId: 'aud1', keyB64: 'AAAA', mime: 'audio/wav', durationMs: 9000 }
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('AudioMessage', () => {
  let container
  let root

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    getMediaObjectUrl.mockResolvedValue('blob:mock')
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue()
    window.HTMLMediaElement.prototype.pause = vi.fn()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('shows the duration and does not load until played', async () => {
    act(() => root.render(<AudioMessage audio={audio} />))
    await act(async () => {
      await flush()
    })
    expect(getMediaObjectUrl).not.toHaveBeenCalled()
    expect(container.textContent).toContain('0:09') // 9s
    expect(container.querySelector('audio')).toBeTruthy()
  })

  it('loads the blob from the local cache on play (receiver)', async () => {
    act(() => root.render(<AudioMessage audio={audio} />))
    const playBtn = container.querySelector('button[title="Play"]')
    await act(async () => {
      playBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
    })
    expect(getMediaObjectUrl).toHaveBeenCalledWith(audio)
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

  it('uses the same local-cache path for the sender (isSelf)', async () => {
    act(() => root.render(<AudioMessage audio={audio} isSelf />))
    const playBtn = container.querySelector('button[title="Play"]')
    await act(async () => {
      playBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
    })
    expect(getMediaObjectUrl).toHaveBeenCalledWith(audio)
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

  it('does not bubble play clicks to the message reply handler', async () => {
    const onParentClick = vi.fn()
    act(() =>
      root.render(
        <div onClick={onParentClick}>
          <AudioMessage audio={audio} />
        </div>
      )
    )
    const playBtn = container.querySelector('button[title="Play"]')
    await act(async () => {
      playBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
    })
    expect(onParentClick).not.toHaveBeenCalled()
  })
})
