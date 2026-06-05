import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Play, Film } from 'lucide-react'
import VideoLightbox from './VideoLightbox'
import { prefetchMedia } from '../utils/crypto/mediaCache'

function formatDuration(ms) {
  if (!ms || ms < 0) return null
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * A large, clickable video card in the chat. The poster (thumbnail) shows
 * immediately from the message descriptor — it arrived inside the E2EE payload,
 * so nothing is fetched from the server until the user opens the video. Click
 * opens a full-screen player (VideoLightbox) that downloads + decrypts on
 * demand.
 */
export default function VideoMessage({ video }) {
  const [open, setOpen] = useState(false)

  // Fallback prefetch: if this video wasn't cached on receipt (e.g. it arrived
  // while the app was closed), warm the local cache as soon as the bubble
  // mounts so opening it is still instant.
  useEffect(() => {
    prefetchMedia(video)
  }, [video])

  // Reserve space with the real aspect ratio so the poster doesn't cause a
  // layout jump; clamp portrait clips so they stay a "big object" without
  // taking over the whole column.
  const ratio =
    video?.width && video?.height
      ? Math.max(0.6, Math.min(1.9, video.width / video.height))
      : 16 / 9
  const duration = formatDuration(video?.durationMs)

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        title='Play video'
        className='relative block w-full overflow-hidden bg-black'
        style={{ aspectRatio: String(ratio), maxHeight: '22rem', minHeight: '11rem' }}
      >
        {video?.thumbnail ? (
          <img
            src={video.thumbnail}
            alt='Video'
            className='absolute inset-0 h-full w-full object-cover'
          />
        ) : (
          <div className='absolute inset-0 grid place-items-center bg-gradient-to-br from-violet-900/40 to-black text-white/30'>
            <Film size={44} />
          </div>
        )}

        {/* Subtle gradient so the play glyph and duration stay legible. */}
        <span className='pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15' />

        {/* Big centered play button — the primary affordance. */}
        <span className='absolute inset-0 grid place-items-center'>
          <span className='grid h-20 w-20 place-items-center rounded-full bg-black/45 backdrop-blur-md ring-1 ring-white/20 transition group-hover/bubble:scale-105 group-hover/bubble:bg-violet-500/55'>
            <Play size={34} className='translate-x-1 text-white' fill='currentColor' />
          </span>
        </span>

        {duration && (
          <span className='absolute bottom-2 right-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white/90 mono'>
            {duration}
          </span>
        )}
      </button>

      {open && <VideoLightbox video={video} onClose={() => setOpen(false)} />}
    </>
  )
}

VideoMessage.propTypes = {
  video: PropTypes.shape({
    mediaId: PropTypes.string,
    keyB64: PropTypes.string,
    mime: PropTypes.string,
    thumbnail: PropTypes.string,
    durationMs: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number,
  }).isRequired,
}
