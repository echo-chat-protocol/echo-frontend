import { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { ChevronDown, Search, Loader2 } from 'lucide-react'
import { fetchKlipyMedia, hasKlipyApiKey } from '@/utils/klipy'
import { EMOJI_CATEGORIES } from './emojiData'

const TABS = [
  { id: 'emoji', label: 'Emoji' },
  { id: 'gifs', label: 'GIFs' },
  { id: 'stickers', label: 'Stickers' },
]
const MEDIA_TABS = new Set(['gifs', 'stickers'])
const KEY_MISSING_MSG = 'Search is unavailable — set VITE_KLIPY_API_KEY.'

// WhatsApp-style inline panel that docks below the composer (taking the place of
// the on-screen keyboard on mobile). Emoji taps insert into the message;
// GIF/sticker taps are sent immediately by the parent.
export default function MediaPanel({
  open,
  initialTab = 'emoji',
  onClose,
  onEmoji,
  onMediaSelect,
}) {
  const [tab, setTab] = useState(initialTab)

  // Emoji state
  const [emojiCat, setEmojiCat] = useState(EMOJI_CATEGORIES[0].id)

  // KLIPY media state (shared by the GIFs/Stickers tabs)
  const [term, setTerm] = useState('')
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef(null)
  const abortRef = useRef(null)
  const configured = hasKlipyApiKey()

  const loadMedia = useCallback(async (media, query, nextPage, append) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError('')
    try {
      const result = await fetchKlipyMedia(media, {
        query,
        page: nextPage,
        signal: controller.signal,
      })
      setItems((prev) => (append ? [...prev, ...result.items] : result.items))
      setHasNext(result.hasNext)
      setPage(result.page)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError(
        err?.code === 'NO_API_KEY'
          ? KEY_MISSING_MSG
          : 'Could not load results. Check your connection and try again.'
      )
      if (!append) setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  // On open: jump to the requested tab and prime a media tab with trending.
  useEffect(() => {
    if (!open) return undefined
    setTab(initialTab)
    setTerm('')
    if (MEDIA_TABS.has(initialTab)) {
      if (configured) loadMedia(initialTab, '', 1, false)
      else {
        setItems([])
        setError(KEY_MISSING_MSG)
      }
    }
    return () => abortRef.current?.abort()
  }, [open, initialTab, configured, loadMedia])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const switchTab = (next) => {
    if (next === tab) return
    setTab(next)
    setTerm('')
    setItems([])
    setError('')
    if (MEDIA_TABS.has(next)) {
      if (configured) loadMedia(next, '', 1, false)
      else setError(KEY_MISSING_MSG)
    }
  }

  const onTermChange = (value) => {
    setTerm(value)
    if (!configured || !MEDIA_TABS.has(tab)) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadMedia(tab, value, 1, false), 350)
  }

  if (!open) return null

  const activeEmojis = EMOJI_CATEGORIES.find((c) => c.id === emojiCat)?.emojis ?? []
  const isMedia = MEDIA_TABS.has(tab)
  const activeLabel = TABS.find((t) => t.id === tab)?.label ?? 'Emoji'

  return (
    <div className='mt-2 flex h-[clamp(248px,42vh,380px)] flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c0c12]'>
      {/* Tabs + collapse */}
      <div className='flex shrink-0 items-center gap-1 border-b border-white/[0.06] px-2 py-1.5'>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition ${
              tab === t.id
                ? 'bg-violet-500/20 text-violet-100'
                : 'text-white/55 hover:bg-white/5 hover:text-white/85'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className='flex-1' />
        <button
          onClick={onClose}
          aria-label='Hide panel'
          title='Hide'
          className='grid h-8 w-8 place-items-center rounded-lg text-white/55 hover:bg-white/[0.04] hover:text-white'
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {/* Search row for media tabs */}
      {isMedia && (
        <div className='shrink-0 px-2 py-2'>
          <div className='relative'>
            <Search
              size={14}
              className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35'
            />
            <input
              value={term}
              onChange={(e) => onTermChange(e.target.value)}
              placeholder={configured ? `Search ${activeLabel}…` : 'Search unavailable'}
              disabled={!configured}
              className='echo-input w-full rounded-xl py-2 pl-9 pr-3 text-[13px] echo-focus-ring disabled:opacity-50'
            />
          </div>
        </div>
      )}

      {/* Content */}
      {tab === 'emoji' ? (
        <div className='flex min-h-0 flex-1 flex-col'>
          <div className='min-h-0 flex-1 overflow-y-auto px-2 py-2'>
            <div className='grid grid-cols-[repeat(9,minmax(0,1fr))] gap-0.5 sm:grid-cols-[repeat(15,minmax(0,1fr))]'>
              {activeEmojis.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type='button'
                  onClick={() => onEmoji(emoji)}
                  className='grid aspect-square place-items-center rounded-md text-[26px] leading-none hover:bg-white/[0.06]'
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          {/* Category bar */}
          <div className='flex shrink-0 items-center gap-0.5 overflow-x-auto border-t border-white/[0.06] px-2 py-1.5'>
            {EMOJI_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setEmojiCat(c.id)}
                title={c.label}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[17px] transition ${
                  emojiCat === c.id
                    ? 'bg-violet-500/20'
                    : 'opacity-60 hover:bg-white/[0.05] hover:opacity-100'
                }`}
              >
                {c.icon}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className='min-h-0 flex-1 overflow-y-auto px-2 pb-2'>
          {error && (
            <div className='mb-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200'>
              {error}
            </div>
          )}

          {items.length > 0 && (
            <div className='columns-3 gap-1.5 [&>*]:mb-1.5 sm:columns-4'>
              {items.map((item) => (
                <button
                  key={item.id}
                  type='button'
                  onClick={() => onMediaSelect(item)}
                  title={item.title}
                  className='block w-full overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02] transition hover:border-violet-400/40 hover:ring-2 hover:ring-violet-500/30'
                >
                  <img
                    src={item.previewUrl}
                    alt={item.title}
                    loading='lazy'
                    className='block w-full'
                  />
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className='grid place-items-center py-6 text-white/40'>
              <Loader2 size={20} className='animate-spin' />
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className='grid h-full place-items-center px-6 text-center text-[12px] text-white/40'>
              {term.trim()
                ? `No ${activeLabel.toLowerCase()} found.`
                : `Search for ${activeLabel.toLowerCase()}.`}
            </div>
          )}

          {hasNext && !loading && items.length > 0 && (
            <button
              onClick={() => loadMedia(tab, term, page + 1, true)}
              className='mt-1.5 w-full rounded-xl border border-white/[0.08] bg-white/[0.02] py-2 text-[12px] text-white/65 hover:bg-white/[0.04] hover:text-white'
            >
              Load more
            </button>
          )}
        </div>
      )}

      {isMedia && (
        <div className='shrink-0 border-t border-white/[0.06] px-3 py-1 text-center text-[9.5px] text-white/30 mono'>
          Powered by KLIPY
        </div>
      )}
    </div>
  )
}

MediaPanel.propTypes = {
  open: PropTypes.bool.isRequired,
  initialTab: PropTypes.oneOf(['emoji', 'gifs', 'stickers']),
  onClose: PropTypes.func.isRequired,
  onEmoji: PropTypes.func.isRequired,
  onMediaSelect: PropTypes.func.isRequired,
}
