import { useState } from 'react'
import PropTypes from 'prop-types'
import { CheckCheck, Check, Download, FileImage } from 'lucide-react'
import { format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import CallEventMessage from './CallEventMessage'
import ImageLightbox from './ImageLightbox'

// Plain text rendering. GIFs are now sent as animated images (message.image,
// via the KLIPY picker), so message text no longer embeds GIF links or ids.
const renderMessageContent = (text) => {
  if (!text) return null
  return <p>{text}</p>
}

function State({ seen }) {
  if (seen) return <CheckCheck size={13} strokeWidth={2.4} className='text-violet-200' />
  return <Check size={12} className='text-white/45' />
}

function AvatarFallback({ name }) {
  return (
    <div className='grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-violet-700/70 text-[10px] font-semibold text-white/90'>
      {(name || '?')?.[0]}
    </div>
  )
}

function MessageBubble({ message, currentUserId, contact, showName = true, showAvatar = true }) {
  const isSelf = String(message.userId) === String(currentUserId)
  const senderName = message.username || contact?.name || 'Member'
  const avatar = !isSelf ? contact?.avatar || message.profileImage || null : null
  const time = message.createdAt ? format(new Date(message.createdAt), 'HH:mm') : ''
  const [lightboxOpen, setLightboxOpen] = useState(false)

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
      className={`flex min-w-0 gap-2.5 ${isSelf ? 'justify-end' : 'justify-start'} animate-fade-up`}
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

      <div
        className={`flex min-w-0 max-w-[82%] flex-col gap-1 sm:max-w-[70%] ${
          isSelf ? 'items-end' : 'items-start'
        }`}
      >
        {!isSelf && showName && message.username ? (
          <span className='px-1 text-[10.5px] font-medium text-violet-200/75'>{senderName}</span>
        ) : null}

        {message.image ? (
          <div
            className={`group relative w-full overflow-hidden rounded-2xl border ${
              isSelf ? 'border-violet-500/30' : 'border-white/[0.07]'
            } bg-black/40`}
          >
            <img
              src={message.image}
              alt='Shared image'
              className='block max-h-52 w-full cursor-zoom-in object-cover'
              onClick={() => setLightboxOpen(true)}
            />
            <button
              onClick={handleDownload}
              title='Download'
              className='absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 opacity-0 backdrop-blur transition hover:bg-violet-500/40 group-hover:opacity-100'
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
                {isSelf && <State seen={message.seenStatus} />}
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
            className={`relative whitespace-pre-line break-words rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-snug ${
              isSelf ? 'bubble-sent rounded-br-md' : 'bubble-received rounded-bl-md'
            }`}
            style={{ overflowWrap: 'anywhere' }}
          >
            {message.text && renderMessageContent(message.text)}
            <div className='-mb-1 mt-1 flex justify-end'>
              <span className='ml-2 inline-flex items-center gap-1 text-[10px] text-white/35 mono'>
                {time}
                {isSelf && <State seen={message.seenStatus} />}
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

const DisplayText = ({ messages = [], currentUserId, contact = null }) => {
  const shouldShowDate = (index) => {
    if (index === 0) return true
    const currentDate = new Date(messages[index].createdAt)
    const prevDate = new Date(messages[index - 1].createdAt)
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
      {messages.map((message, index) => {
        const prev = messages[index - 1]
        const next = messages[index + 1]
        const newDay = shouldShowDate(index)
        // First bubble of a run → show name; last bubble of a run → show avatar.
        const isRunStart = newDay || !isSameRun(prev, message)
        const isRunEnd = !isSameRun(message, next)

        return (
          <div
            key={message._id}
            className={index === 0 || newDay ? '' : isRunStart ? 'mt-3 md:mt-4' : 'mt-0.5'}
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
}

export default DisplayText
