import { useCallback, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { CheckCheck, Check, Clock, AlertCircle, Download, FileImage, Reply } from 'lucide-react'
import { format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import CallEventMessage from './CallEventMessage'
import ImageLightbox from './ImageLightbox'
import { receiptState, RECEIPT_STATE } from '../utils/chat/readReceipts'
import { replyPreviewText } from '../utils/chat/replyContext'
import {
  userColorName,
  userBorderColor,
  userBubbleStyle,
} from '../../DashboardComponents/utils/userColor'

// Plain text rendering. GIFs are now sent as animated images (message.image,
// via the KLIPY picker), so message text no longer embeds GIF links or ids.
const renderMessageContent = (text) => {
  if (!text) return null
  return <p>{text}</p>
}

// Read-receipt indicator for our own outgoing bubbles.
//  sending  → clock           delivered → grey double-check
//  failed   → red alert       read      → violet double-check
//  sent     → grey single-check
function State({ message }) {
  switch (receiptState(message)) {
    case RECEIPT_STATE.SENDING:
      return <Clock size={11} className='text-white/40' aria-label='Sending' />
    case RECEIPT_STATE.FAILED:
      return <AlertCircle size={12} className='text-red-400' aria-label='Not sent' />
    case RECEIPT_STATE.READ:
      return (
        <span className='inline-flex items-center gap-0.5 font-semibold text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]'>
          <CheckCheck size={15} strokeWidth={3} aria-label='Read' />
        </span>
      )
    case RECEIPT_STATE.DELIVERED:
      return <CheckCheck size={13} className='text-white/45' aria-label='Delivered' />
    case RECEIPT_STATE.SENT:
    default:
      return <Check size={12} className='text-white/45' aria-label='Sent' />
  }
}

function AvatarFallback({ name }) {
  return (
    <div className='grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-violet-700/70 text-[10px] font-semibold text-white/90'>
      {(name || '?')?.[0]}
    </div>
  )
}

// Quoted-reply preview rendered at the top of a bubble. In group chats the
// accent (stripe + name) uses the replied-to sender's color so it matches their
// bubbles; in DMs it falls back to violet. Tapping it jumps to the original.
function ReplyQuote({ replyTo, accent, onClick }) {
  const color = accent || 'rgb(196 181 253)'
  return (
    <button
      type='button'
      onClick={onClick}
      className='mb-1 flex w-full items-stretch gap-2 overflow-hidden rounded-lg bg-black/30 px-2 py-1 text-left ring-1 ring-white/10 transition hover:bg-black/45'
    >
      <span className='w-[3px] shrink-0 rounded-full' style={{ backgroundColor: color }} />
      <span className='min-w-0 flex-1 py-0.5'>
        <span className='block truncate text-[11px] font-semibold' style={{ color }}>
          {replyTo.username || 'Unknown'}
        </span>
        <span className='block truncate text-[11.5px] text-white/55'>
          {replyPreviewText(replyTo)}
        </span>
      </span>
    </button>
  )
}

ReplyQuote.propTypes = {
  replyTo: PropTypes.object,
  accent: PropTypes.string,
  onClick: PropTypes.func,
}

// Drag distance (px) past which releasing a swipe fires a reply, and the visual
// cap on how far the bubble follows the finger.
const SWIPE_TRIGGER = 52
const SWIPE_MAX = 76

function MessageBubble({
  message,
  currentUserId,
  contact,
  showName = true,
  showAvatar = true,
  colorizeSenders = false,
  onReply = null,
  onQuoteClick = null,
}) {
  const isSelf = String(message.userId) === String(currentUserId)
  const senderName = message.username || contact?.name || 'Member'
  const avatar = !isSelf ? contact?.avatar || message.profileImage || null : null
  const time = message.createdAt ? format(new Date(message.createdAt), 'HH:mm') : ''
  const [lightboxOpen, setLightboxOpen] = useState(false)

  // In group chats every member gets a distinct, deterministic color so their
  // bubble matches their name color in the Group info panel. DMs leave this off
  // and fall back to the default sent/received bubble theme.
  const accentColor = colorizeSenders ? userColorName(message.userId) : null
  const tintedBubbleStyle = colorizeSenders ? userBubbleStyle(message.userId) : null

  // ── Swipe-to-reply (mobile) ────────────────────────────────────────────────
  // Drag the bubble horizontally toward the center; release past the threshold
  // to reply. Received bubbles swipe right, our own swipe left. We never call
  // preventDefault, so vertical scrolling is unaffected.
  const [dragX, setDragX] = useState(0)
  const startXRef = useRef(null)
  const swipingRef = useRef(false)
  const dir = isSelf ? -1 : 1

  const handleTouchStart = (e) => {
    if (!onReply) return
    const touch = e.touches?.[0]
    if (!touch) return
    startXRef.current = touch.clientX
    swipingRef.current = true
  }
  const handleTouchMove = (e) => {
    if (!swipingRef.current || startXRef.current == null) return
    const touch = e.touches?.[0]
    if (!touch) return
    const eff = (touch.clientX - startXRef.current) * dir // + when swiping toward reply
    if (eff <= 0) {
      if (dragX !== 0) setDragX(0)
      return
    }
    setDragX(Math.min(eff, SWIPE_MAX) * dir)
  }
  const handleTouchEnd = () => {
    if (!swipingRef.current) return
    const triggered = Math.abs(dragX) >= SWIPE_TRIGGER
    swipingRef.current = false
    startXRef.current = null
    setDragX(0)
    if (triggered) onReply?.(message)
  }

  // Desktop: click the text bubble to reply. Gated to hover-capable pointers so
  // a plain tap on mobile (where swipe is the gesture) never fires a reply, and
  // never while the user is selecting text.
  const handleBubbleClick = () => {
    if (!onReply || typeof window === 'undefined') return
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches) return
    if (window.getSelection && String(window.getSelection())) return
    onReply(message)
  }

  const swipeRevealOpacity = Math.min(1, Math.abs(dragX) / SWIPE_TRIGGER)

  const handleDownload = (e) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = message.image
    a.download = ''
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  return (
    <div
      className={`group flex min-w-0 items-center gap-2.5 ${
        isSelf ? 'justify-end' : 'justify-start'
      } animate-fade-up`}
    >
      {!isSelf &&
        (showAvatar ? (
          <div className='mt-auto shrink-0'>
            {avatar ? (
              <img
                src={avatar}
                alt=''
                className='h-7 w-7 rounded-full object-cover ring-1 ring-white/10'
              />
            ) : (
              <AvatarFallback name={senderName} />
            )}
          </div>
        ) : (
          // Spacer keeps grouped continuation bubbles aligned under the avatar.
          <div className='w-7 shrink-0' aria-hidden='true' />
        ))}

      {/* Desktop hover affordance: a Reply button beside the bubble. It always
          sits on the inner (toward-center) side of the bubble: order-first puts
          it left of our own right-aligned messages, order-last puts it right of
          received left-aligned messages — never out toward the chat edge. */}
      {onReply && (
        <button
          type='button'
          onClick={() => onReply(message)}
          title='Reply'
          aria-label='Reply'
          className={`hidden h-8 w-8 shrink-0 self-center place-items-center rounded-full text-white/35 opacity-0 transition hover:bg-white/10 hover:text-violet-200 group-hover:opacity-100 md:grid ${
            isSelf ? 'order-first' : 'order-last'
          }`}
        >
          <Reply size={15} />
        </button>
      )}

      <div
        className={`relative flex min-w-0 max-w-[82%] flex-col gap-1 sm:max-w-[70%] ${
          isSelf ? 'items-end' : 'items-start'
        }`}
        style={{
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: swipingRef.current ? 'none' : 'transform 160ms ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Reply icon revealed under the finger while swiping. */}
        {onReply && dragX !== 0 && (
          <span
            className='pointer-events-none absolute top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-violet-200'
            style={{ [isSelf ? 'right' : 'left']: -34, opacity: swipeRevealOpacity }}
          >
            <Reply size={14} />
          </span>
        )}

        {!isSelf && showName && message.username ? (
          <span
            className={`px-1 text-[10.5px] font-medium ${accentColor ? '' : 'text-violet-200/75'}`}
            style={accentColor ? { color: accentColor } : undefined}
          >
            {senderName}
          </span>
        ) : null}

        {message.image ? (
          <div
            className={`group/bubble relative w-full overflow-hidden rounded-2xl border ${
              tintedBubbleStyle ? '' : isSelf ? 'border-violet-500/30' : 'border-white/[0.07]'
            } bg-black/40`}
            style={tintedBubbleStyle ? { borderColor: userBorderColor(message.userId) } : undefined}
          >
            {message.replyTo && (
              <div className='px-2 pt-2'>
                <ReplyQuote
                  replyTo={message.replyTo}
                  accent={colorizeSenders ? userColorName(message.replyTo.userId) : null}
                  onClick={() => onQuoteClick?.(message.replyTo.id)}
                />
              </div>
            )}
            <img
              src={message.image}
              alt='Shared image'
              className='block max-h-52 w-full cursor-zoom-in object-cover'
              onClick={() => setLightboxOpen(true)}
            />
            <button
              onClick={handleDownload}
              title='Download'
              className='absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 opacity-0 backdrop-blur transition hover:bg-violet-500/40 group-hover/bubble:opacity-100'
            >
              <Download size={14} className='text-white' />
            </button>
            <div className='flex items-center justify-end gap-1 border-t border-white/[0.06] bg-black/50 px-3 py-2'>
              {message.text ? (
                <>
                  <FileImage size={13} className='shrink-0 text-violet-300' />
                  <div className='min-w-0 flex-1 text-[12px] text-white/80'>
                    {renderMessageContent(message.text)}
                  </div>
                </>
              ) : null}
              <span className='ml-2 inline-flex shrink-0 items-center gap-1 text-[10px] text-white/35 mono'>
                {time}
                {isSelf && <State message={message} />}
              </span>
            </div>
            {lightboxOpen && (
              <ImageLightbox
                src={message.image}
                alt='Shared image'
                onClose={() => setLightboxOpen(false)}
              />
            )}
          </div>
        ) : (
          <div
            onClick={handleBubbleClick}
            className={`relative whitespace-pre-line break-words rounded-2xl text-[13.5px] leading-snug ${
              message.replyTo ? 'px-2 py-1.5' : 'px-3.5 py-2.5'
            } ${isSelf ? 'rounded-br-md' : 'rounded-bl-md'} ${
              tintedBubbleStyle ? 'text-white' : isSelf ? 'bubble-sent' : 'bubble-received'
            }`}
            style={{ overflowWrap: 'anywhere', ...(tintedBubbleStyle || {}) }}
          >
            {message.replyTo && (
              <ReplyQuote
                replyTo={message.replyTo}
                accent={colorizeSenders ? userColorName(message.replyTo.userId) : null}
                onClick={(e) => {
                  e.stopPropagation()
                  onQuoteClick?.(message.replyTo.id)
                }}
              />
            )}
            {message.text && renderMessageContent(message.text)}
            <div className='-mb-1 mt-1 flex justify-end'>
              <span className='ml-2 inline-flex items-center gap-1 text-[10px] text-white/35 mono'>
                {time}
                {isSelf && <State message={message} />}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Messages from the same sender are "grouped": consecutive bubbles only repeat
// the username/avatar on the first/last bubble of the run. A run is broken by a
// different sender, a non-chat message (call/system), a new day, or a gap > 5min.
const GROUP_GAP_MS = 5 * 60 * 1000

const isChatMessage = (m) => m && m.messageType !== 'call_event' && m.messageType !== 'system'

const DisplayText = ({
  messages = [],
  currentUserId,
  contact = null,
  colorizeSenders = false,
  onReply = null,
}) => {
  // Tapping a quoted reply scrolls to and briefly highlights the original.
  const [highlightId, setHighlightId] = useState(null)
  const highlightTimerRef = useRef(null)
  const scrollToMessage = useCallback((id) => {
    if (!id || typeof document === 'undefined') return
    const el = document.getElementById(`echo-msg-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(String(id))
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => setHighlightId(null), 1600)
  }, [])

  // Run-grouping (hiding the repeated username/avatar for consecutive messages
  // from the same sender) relies on array adjacency being chronological. P2P
  // history is already time-ordered, but group messages arrive via several
  // merge/replay paths and can land out of order — which broke grouping and
  // made every consecutive group message repeat the username. Sort a shallow
  // copy by createdAt (Array.sort is stable, so equal timestamps keep their
  // insertion order) before computing runs.
  const ordered = [...messages].sort(
    (a, b) => new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0)
  )

  const shouldShowDate = (index) => {
    if (index === 0) return true
    const currentDate = new Date(ordered[index].createdAt)
    const prevDate = new Date(ordered[index - 1].createdAt)
    return !isSameDay(currentDate, prevDate)
  }

  // Whether `b` continues the same grouped run started by `a` (a precedes b).
  const isSameRun = (a, b) => {
    if (!isChatMessage(a) || !isChatMessage(b)) return false
    if (String(a.userId) !== String(b.userId)) return false
    const aDate = new Date(a.createdAt)
    const bDate = new Date(b.createdAt)
    if (!isSameDay(aDate, bDate)) return false
    return Math.abs(bDate - aDate) <= GROUP_GAP_MS
  }

  return (
    <div className='min-h-full p-3 md:p-4'>
      {ordered.map((message, index) => {
        const prev = ordered[index - 1]
        const next = ordered[index + 1]
        const newDay = shouldShowDate(index)
        // First bubble of a run → show name; last bubble of a run → show avatar.
        const isRunStart = newDay || !isSameRun(prev, message)
        const isRunEnd = !isSameRun(message, next)
        const spacing = index === 0 || newDay ? '' : isRunStart ? 'mt-3 md:mt-4' : 'mt-0.5'
        const highlighted = highlightId === String(message._id)

        return (
          <div
            key={message._id}
            id={`echo-msg-${message._id}`}
            className={`${spacing} ${highlighted ? 'echo-reply-highlight rounded-2xl' : ''}`}
          >
            {newDay && (
              <div className='my-4 flex justify-center'>
                <span className='rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-[10.5px] uppercase tracking-[0.18em] text-white/40 mono'>
                  {format(new Date(message.createdAt), 'PPPP', { locale: es })}
                </span>
              </div>
            )}

            {/* Render call event messages */}
            {message.messageType === 'call_event' ? (
              <CallEventMessage callData={message.callData} currentUserId={currentUserId} />
            ) : message.messageType === 'system' ? (
              <div className='flex justify-center'>
                <div className='rounded-full border border-yellow-400/25 bg-yellow-400/[0.08] px-3 py-1 text-[10.5px] text-yellow-300/90 mono'>
                  {message.text}
                </div>
              </div>
            ) : (
              <MessageBubble
                message={message}
                currentUserId={currentUserId}
                contact={contact}
                showName={isRunStart}
                showAvatar={isRunEnd}
                colorizeSenders={colorizeSenders}
                onReply={onReply}
                onQuoteClick={scrollToMessage}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

DisplayText.propTypes = {
  messages: PropTypes.array.isRequired,
  currentUserId: PropTypes.string.isRequired,
  contact: PropTypes.shape({
    name: PropTypes.string,
    avatar: PropTypes.string,
  }),
  colorizeSenders: PropTypes.bool,
  onReply: PropTypes.func,
}

export default DisplayText
