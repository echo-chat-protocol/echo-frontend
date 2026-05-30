import { useEffect, useRef } from 'react'
import { CheckCheck, Check, Loader2, AlertCircle, Download, FileImage } from 'lucide-react'
import { format, isSameDay } from 'date-fns'
import Wallpaper from '@/components/Dashboard/Wallpaper'
import { receiptState } from './utils/chat/readReceipts'

/**
 * State icon for self-sent messages.
 */
function State({ s }) {
  if (s === 'sending') return <Loader2 size={11} className='animate-spin-slow text-white/45' />
  if (s === 'failed') return <AlertCircle size={12} className='text-red-400' />
  if (s === 'sent') return <Check size={12} className='text-white/45' />
  if (s === 'delivered') return <CheckCheck size={12} className='text-white/45' />
  if (s === 'read') return <CheckCheck size={13} strokeWidth={2.4} className='text-sky-400' />
  return null
}

/**
 * Individual message bubble — handles text, images, and attachments.
 */
function Bubble({ msg, isSelf, contact }) {
  const time = (
    <span className='ml-2 inline-flex items-center gap-1 text-[10px] text-white/35 mono'>
      {msg.time}
      {isSelf && <State s={msg.state} />}
    </span>
  )

  return (
    <div
      className={`flex min-w-0 gap-2.5 ${isSelf ? 'justify-end' : 'justify-start'} animate-fade-up`}
    >
      {!isSelf && (
        <div className='mt-auto shrink-0'>
          {contact?.avatar ? (
            <img
              src={contact.avatar}
              alt=''
              className='h-7 w-7 rounded-full object-cover ring-1 ring-white/10'
            />
          ) : (
            <div className='grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-violet-700/70 text-white/90 text-[10px] font-semibold'>
              {(contact?.name || '?')?.[0]}
            </div>
          )}
        </div>
      )}
      <div
        className={`max-w-[70%] min-w-0 ${isSelf ? 'items-end' : 'items-start'} flex flex-col gap-1`}
      >
        {/* Image attachment */}
        {msg.image ? (
          <div
            className={`group relative overflow-hidden rounded-2xl border ${
              isSelf ? 'border-violet-500/30' : 'border-white/[0.07]'
            } bg-black/40 w-full`}
          >
            <img
              src={msg.image}
              alt='Shared image'
              className='block max-h-52 w-full h-auto object-cover cursor-pointer'
              onClick={() => window.open(msg.image, '_blank')}
            />
            <button className='absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 backdrop-blur opacity-0 transition group-hover:opacity-100 hover:bg-violet-500/40'>
              <Download size={14} className='text-white' />
            </button>
            {msg.text && (
              <div className='flex items-center gap-2 border-t border-white/[0.06] bg-black/50 px-3 py-2'>
                <FileImage size={13} className='text-violet-300' />
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-[12px] text-white/80'>{msg.text}</p>
                </div>
                {time}
              </div>
            )}
          </div>
        ) : (
          /* Text bubble */
          <div
            className={`relative whitespace-pre-line break-words rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-snug ${
              isSelf ? 'bubble-sent rounded-br-md' : 'bubble-received rounded-bl-md'
            }`}
            style={{ overflowWrap: 'anywhere' }}
          >
            {msg.text}
            <div className='-mb-1 mt-1 flex justify-end'>{time}</div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Animated typing indicator bubble.
 */
function TypingBubble({ contact }) {
  return (
    <div className='flex items-end gap-2.5 animate-fade-up'>
      {contact?.avatar ? (
        <img
          src={contact.avatar}
          alt=''
          className='h-7 w-7 rounded-full object-cover ring-1 ring-white/10'
        />
      ) : (
        <div className='grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-violet-700/70 text-white/90 text-[10px] font-semibold'>
          {(contact?.name || '?')?.[0]}
        </div>
      )}
      <div className='rounded-2xl rounded-bl-md bubble-received px-4 py-3'>
        <div className='flex items-center gap-1.5'>
          <span className='typing-dot' />
          <span className='typing-dot' />
          <span className='typing-dot' />
        </div>
      </div>
    </div>
  )
}

/**
 * ChatThread — renders message history with premium UI.
 *
 * Props:
 *  - messages: existing message array from ELD (userId, text, image, seenStatus, createdAt)
 *  - currentUserId: logged-in user's ID
 *  - contact: { name, avatar } of the chat partner
 *  - isTyping: boolean — whether the contact is currently typing
 */
export default function ChatThread({ messages, currentUserId, contact, isTyping }) {
  const ref = useRef(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [messages?.length, isTyping])

  /**
   * Map an ELD message to the shape expected by <Bubble>
   */
  const toVM = (msg) => ({
    id: msg._id,
    text: msg.text || '',
    image: msg.image || null,
    time: msg.createdAt ? format(new Date(msg.createdAt), 'HH:mm') : '',
    state: receiptState(msg),
    from: msg.userId === currentUserId ? 'self' : msg.userId,
    messageType: msg.messageType,
    callData: msg.callData,
    createdAt: msg.createdAt,
  })

  /**
   * Group messages by day, showing a date separator between days.
   */
  const groupedByDay = []
  ;(messages || []).forEach((msg, idx) => {
    const prev = messages[idx - 1]
    const showDate = idx === 0 || !isSameDay(new Date(msg.createdAt), new Date(prev.createdAt))
    groupedByDay.push({ msg: toVM(msg), showDate })
  })

  return (
    <div ref={ref} className='relative flex-1 overflow-y-auto'>
      <Wallpaper />
      <div
        className='relative mx-auto flex max-w-[860px] flex-col gap-3 px-6 py-6'
        style={{ zIndex: 1 }}
      >
        {groupedByDay.map(({ msg, showDate }) => {
          if (msg.messageType === 'call_event') {
            return (
              <div key={msg.id} className='flex justify-center'>
                <span className='rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-[10.5px] mono text-white/40'>
                  📞 Call event
                </span>
              </div>
            )
          }
          if (msg.messageType === 'system') {
            return (
              <div key={msg.id} className='flex justify-center'>
                <span className='rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-[10.5px] mono text-white/40'>
                  {msg.text}
                </span>
              </div>
            )
          }
          return (
            <div key={msg.id}>
              {showDate && (
                <div className='flex justify-center my-3'>
                  <div className='rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-[10.5px] uppercase tracking-[0.18em] text-white/40 mono'>
                    {format(new Date(msg.createdAt), 'PPPP')}
                  </div>
                </div>
              )}
              <Bubble msg={msg} isSelf={msg.from === 'self'} contact={contact} />
            </div>
          )
        })}

        {isTyping && <TypingBubble contact={contact} />}
      </div>
    </div>
  )
}
