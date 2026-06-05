import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { X, Download, Loader2, AlertCircle } from 'lucide-react'
import { getMediaObjectUrl } from '../utils/crypto/mediaCache'

// Full-screen encrypted-video player. Reads the decrypted blob from the local
// media cache (which downloaded + decrypted it on receipt); only the very first
// open of an un-prefetched video touches the network. The key came in the E2EE
// message, never from the server. Portaled to <body> so a
// `backdrop-filter`/`transform` ancestor can't re-anchor the fixed overlay.
export default function VideoLightbox({ video, onClose }) {
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Object URL is owned + reused by the cache for the session, so we do
        // NOT revoke it here (other bubbles may share it).
        const objUrl = await getMediaObjectUrl(video)
        if (cancelled) return
        setUrl(objUrl)
        setStatus('ready')
      } catch (err) {
        if (!cancelled) {
          console.error('[VideoLightbox] Failed to load video:', err)
          setStatus('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [video])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleDownload = (e) => {
    e.stopPropagation()
    if (!url) return
    const ext = (video.mime || 'video/mp4').split('/')[1] || 'mp4'
    const a = document.createElement('a')
    a.href = url
    a.download = `video-${video.mediaId}.${ext}`
    a.click()
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className='fixed inset-0 z-[90] flex flex-col bg-black/90 backdrop-blur-sm'
      onClick={onClose}
    >
      <div
        className='flex shrink-0 items-center justify-end gap-1 px-3 py-2'
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type='button'
          title='Download'
          onClick={handleDownload}
          disabled={status !== 'ready'}
          className='grid h-9 w-9 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30'
        >
          <Download size={15} />
        </button>
        <button
          type='button'
          title='Close (Esc)'
          onClick={onClose}
          className='grid h-9 w-9 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white'
        >
          <X size={17} />
        </button>
      </div>

      <div
        className='grid min-h-0 flex-1 place-items-center overflow-hidden p-4'
        onClick={(e) => e.stopPropagation()}
      >
        {status === 'ready' && url ? (
          <video
            src={url}
            poster={video.thumbnail || undefined}
            controls
            autoPlay
            playsInline
            className='select-none rounded-lg bg-black object-contain'
            style={{ maxWidth: 'calc(100vw - 2rem)', maxHeight: 'calc(100vh - 7rem)' }}
          />
        ) : status === 'error' ? (
          <div className='flex flex-col items-center gap-2 text-white/70'>
            <AlertCircle size={32} className='text-red-300' />
            <p className='text-[13px]'>Couldn’t load this video.</p>
          </div>
        ) : (
          <div className='flex flex-col items-center gap-3 text-white/60'>
            <Loader2 size={30} className='animate-spin text-violet-300' />
            <p className='text-[12px]'>Decrypting…</p>
          </div>
        )}
      </div>

      <div className='shrink-0 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1 text-center text-[10.5px] text-white/35'>
        End-to-end encrypted · Esc to close
      </div>
    </div>,
    document.body
  )
}

VideoLightbox.propTypes = {
  video: PropTypes.shape({
    mediaId: PropTypes.string,
    keyB64: PropTypes.string,
    mime: PropTypes.string,
    thumbnail: PropTypes.string,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
}
