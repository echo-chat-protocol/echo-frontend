import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { Plus, Smile, Image as ImgIcon, Paperclip, Send, Mic, X } from 'lucide-react'
import { compressImage } from '../utils/imageUtils'
import { getSocket } from '../../../../socket'

/**
 * Premium MessageInput — keeps all existing send/image logic,
 * adds typing events, wraps in new premium pill UI.
 */
const SendText = ({ sendMessage, disabled = false, disabledReason = '', targetUserId }) => {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [imageText, setImageText] = useState('')
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const isTypingRef = useRef(false)

  // ── Typing events ──────────────────────────────────────────────────────────
  const emitStopTyping = useCallback(() => {
    if (isTypingRef.current && targetUserId) {
      try {
        getSocket().emit('stopTyping', { targetUserId })
      } catch {
        /* ignore */
      }
      isTypingRef.current = false
    }
  }, [targetUserId])

  // Stop typing on unmount / chat change
  useEffect(() => {
    return () => {
      emitStopTyping()
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [emitStopTyping, targetUserId])

  const handleChange = (e) => {
    setValue(e.target.value)

    // Emit typing start (debounced stop after 1.5 s idle)
    if (!disabled && targetUserId) {
      try {
        if (!isTypingRef.current) {
          getSocket().emit('typing', { targetUserId })
          isTypingRef.current = true
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(emitStopTyping, 1500)
      } catch {
        /* ignore */
      }
    }
  }

  // ── Send text ──────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!value.trim() || disabled) return
    emitStopTyping()
    const text = value.trim()
    setValue('')
    try {
      await Promise.resolve(sendMessage(text))
    } catch (err) {
      console.error('[SendText] Failed to send message:', err)
    }
  }

  // ── Image flow ─────────────────────────────────────────────────────────────
  const handleImageClick = () => {
    if (disabled) return
    fileInputRef.current?.click()
  }

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedImage(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target.result)
      setShowImageModal(true)
    }
    reader.readAsDataURL(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }

  const handleImageSend = async () => {
    if (disabled || !selectedImage) return
    const compressed = await compressImage(selectedImage)
    const reader = new FileReader()
    reader.onload = () => {
      Promise.resolve(sendMessage(imageText, reader.result)).catch((err) =>
        console.error('[SendText] Failed to send image:', err)
      )
      handleCloseModal()
    }
    reader.readAsDataURL(compressed)
  }

  const handleCloseModal = () => {
    setShowImageModal(false)
    setSelectedImage(null)
    setImagePreview(null)
    setImageText('')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className='shrink-0 border-t border-white/[0.05] bg-black/70 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur md:bg-transparent md:px-6 md:py-4 md:pb-4'>
      {/* Image preview modal — portaled to <body> so it escapes the composer's
          `backdrop-blur` container. A backdrop-filter ancestor establishes a
          containing block for `position: fixed`, which would otherwise anchor
          this overlay to the short composer bar instead of the viewport
          (rendering it half off-screen with an unreachable close button). */}
      {showImageModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className='fixed inset-0 z-[80] grid place-items-center bg-black/70 backdrop-blur-sm'
            onClick={handleCloseModal}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className='relative mx-3 w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0e] p-5'
            >
              <button
                onClick={handleCloseModal}
                aria-label='Close'
                className='absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-white/55 hover:bg-white/[0.04] hover:text-white'
              >
                <X size={14} />
              </button>
              <img
                src={imagePreview}
                alt='Preview'
                className='mx-auto mb-4 max-h-64 rounded-xl object-contain'
              />
              <input
                type='text'
                value={imageText}
                onChange={(e) => setImageText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleImageSend()}
                placeholder='Add a caption…'
                className='echo-input mb-3 w-full rounded-xl px-3.5 py-2.5 text-[13px] echo-focus-ring'
              />
              <button
                onClick={handleImageSend}
                className='echo-cta w-full rounded-full py-2.5 text-[13px] font-medium'
              >
                Send Image
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Hidden file input */}
      <input
        type='file'
        ref={fileInputRef}
        onChange={handleImageChange}
        accept='image/*'
        className='hidden'
      />

      {/* Pill input bar */}
      <div
        className={`flex min-w-0 items-center gap-1.5 rounded-full border px-1.5 py-1.5 backdrop-blur transition-all md:gap-2 md:px-2.5 ${
          focused
            ? 'border-violet-400/45 bg-white/[0.025] shadow-[0_0_0_4px_rgba(168,85,247,0.10),inset_0_0_28px_rgba(168,85,247,0.06)]'
            : 'border-white/[0.06] bg-white/[0.015]'
        }`}
      >
        <button
          data-testid='msg-attach'
          type='button'
          title='Attach image'
          onClick={handleImageClick}
          disabled={disabled}
          className='grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/55 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-40 md:h-9 md:w-9'
        >
          <Plus size={17} />
        </button>

        <input
          data-testid='chat-input'
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submit())}
          placeholder={disabled ? disabledReason || 'Sending is disabled...' : 'Message...'}
          disabled={disabled}
          className='min-w-0 flex-1 bg-transparent px-1 py-2.5 text-[16px] text-white placeholder:text-white/30 focus:outline-none md:px-1.5 md:py-2 md:text-[13.5px]'
        />

        <div className='hidden min-w-0 items-center gap-0.5 pr-1 sm:flex'>
          <IconBtn title='Emoji' testid='msg-emoji'>
            <Smile size={16} />
          </IconBtn>
          <IconBtn title='GIFs' testid='msg-gifs'>
            <span className='mono text-[10px] font-bold tracking-tight'>GIF</span>
          </IconBtn>
          <IconBtn title='Image' testid='msg-image' onClick={handleImageClick}>
            <ImgIcon size={16} />
          </IconBtn>
          <IconBtn title='File' testid='msg-file'>
            <Paperclip size={15} />
          </IconBtn>
          <IconBtn title='Voice' testid='msg-voice'>
            <Mic size={15} />
          </IconBtn>
        </div>

        <button
          data-testid='chat-send'
          type='button'
          onClick={submit}
          disabled={!value.trim() || disabled}
          title={disabled ? disabledReason || 'Sending is disabled' : 'Send'}
          className='echo-cta ml-0 grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-40 disabled:saturate-50 md:ml-1 md:h-10 md:w-10'
        >
          <Send size={15} className='text-white' />
        </button>
      </div>

      <div className='mt-2 hidden items-center justify-between px-1 text-[10px] text-white/30 mono md:flex md:px-2'>
        <span>Argon2id · X25519 · ChaCha20-Poly1305</span>
        <span>Press ⏎ to send · ⇧⏎ new line</span>
      </div>
    </div>
  )
}

function IconBtn({ children, title, testid, onClick }) {
  return (
    <button
      type='button'
      title={title}
      data-testid={testid}
      onClick={onClick}
      className='grid h-8 w-8 place-items-center rounded-full text-white/45 hover:bg-white/[0.04] hover:text-white transition-all'
    >
      {children}
    </button>
  )
}

SendText.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  disabledReason: PropTypes.string,
  targetUserId: PropTypes.string,
}

export default SendText
