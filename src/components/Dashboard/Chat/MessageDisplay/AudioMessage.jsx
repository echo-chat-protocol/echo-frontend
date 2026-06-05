import { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Play, Pause, Loader2, AlertCircle, Mic } from 'lucide-react'
import { getMediaObjectUrl } from '../utils/crypto/mediaCache'

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Voice-note bubble. The audio bytes are fetched from the local media cache
 * (downloaded + decrypted on receipt), so the first tap plays instantly when
 * already cached and never re-decrypts. Click to play/pause; the track shows
 * progress and can be scrubbed.
 */
export default function AudioMessage({ audio, isSelf }) {
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(audio?.durationMs ? audio.durationMs / 1000 : 0)
  const [errorText, setErrorText] = useState('')
  const elRef = useRef(null)
  const sourceUrlRef = useRef('')

  const ensureLoaded = useCallback(async () => {
    if (status === 'ready') return true
    setStatus('loading')
    setErrorText('')
    try {
      // One path for everyone: the sender plays the exact blob they recorded
      // (cached locally on send, guaranteed playable in their own browser); the
      // receiver plays the copy decrypted + cached on receipt.
      const url = await getMediaObjectUrl(audio)
      if (elRef.current) {
        if (sourceUrlRef.current !== url || elRef.current.src !== url) {
          sourceUrlRef.current = url
          elRef.current.src = url
        }
      }
      setStatus('ready')
      return true
    } catch (err) {
      console.error('[AudioMessage] Failed to load audio:', err)
      setErrorText(err?.message || 'Could not load voice note.')
      setStatus('error')
      return false
    }
  }, [status, audio])

  useEffect(() => {
    const el = elRef.current
    return () => {
      if (el) {
        el.pause()
        el.removeAttribute('src')
      }
      sourceUrlRef.current = ''
    }
  }, [])

  const stopBubbleEvent = (e) => {
    e.stopPropagation()
  }

  const toggle = useCallback(
    async (e) => {
      e?.stopPropagation?.()
      const el = elRef.current
      if (!el) return
      if (playing) {
        el.pause()
        return
      }
      if (status !== 'ready') {
        const ok = await ensureLoaded()
        if (!ok) return
      }
      try {
        await el.play()
      } catch (err) {
        console.error('[AudioMessage] Failed to play audio:', err)
        setErrorText(err?.message || 'Could not play voice note.')
      }
    },
    [playing, status, ensureLoaded]
  )

  const onSeek = (e) => {
    e.stopPropagation()
    const el = elRef.current
    if (!el || !Number.isFinite(duration) || duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    if (status === 'ready') {
      el.currentTime = ratio * duration
      setCurrent(el.currentTime)
    }
  }

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0
  const accent = isSelf ? 'text-white' : 'text-violet-200'

  return (
    <div
      className='flex min-w-[200px] max-w-[280px] items-center gap-3 px-1 py-0.5'
      onClick={stopBubbleEvent}
      onPointerDown={stopBubbleEvent}
      onTouchStart={stopBubbleEvent}
    >
      <button
        type='button'
        onClick={toggle}
        title={playing ? 'Pause' : 'Play'}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/30 ring-1 ring-white/15 transition hover:bg-black/45 ${accent}`}
      >
        {status === 'loading' ? (
          <Loader2 size={18} className='animate-spin' />
        ) : status === 'error' ? (
          <AlertCircle size={18} className='text-red-300' />
        ) : playing ? (
          <Pause size={18} fill='currentColor' />
        ) : (
          <Play size={18} className='translate-x-0.5' fill='currentColor' />
        )}
      </button>

      <div className='min-w-0 flex-1'>
        <div className='mb-1 flex items-center gap-1.5 text-[10px] text-white/45'>
          <Mic size={11} className='shrink-0' />
          <span className='mono'>{fmt(playing || current ? current : duration)}</span>
        </div>
        <audio
          ref={elRef}
          preload='none'
          className='hidden'
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false)
            setCurrent(0)
            if (elRef.current) elRef.current.currentTime = 0
          }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
              setDuration(e.currentTarget.duration)
            }
          }}
          onError={() => {
            setStatus('error')
            setPlaying(false)
            setErrorText('This browser could not decode the voice note.')
          }}
        />
        {errorText ? (
          <div className='mt-1 text-[10.5px] leading-tight text-red-200/90'>{errorText}</div>
        ) : null}
        {/* Seek track */}
        <div
          onClick={onSeek}
          className='group/track relative h-1.5 w-full cursor-pointer rounded-full bg-white/15'
        >
          <span
            className='absolute inset-y-0 left-0 rounded-full bg-violet-400'
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

AudioMessage.propTypes = {
  audio: PropTypes.shape({
    mediaId: PropTypes.string,
    keyB64: PropTypes.string,
    mime: PropTypes.string,
    durationMs: PropTypes.number,
  }).isRequired,
  isSelf: PropTypes.bool,
}
