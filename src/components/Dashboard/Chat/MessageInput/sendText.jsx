import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import {
  Plus,
  Smile,
  Keyboard,
  Send,
  X,
  Reply,
  Film,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react'
import { compressImage } from '../utils/imageUtils'
import { extractVideoPoster, fileToBytes, MAX_VIDEO_BYTES } from '../utils/videoUtils'
import { encryptMediaBlob } from '../utils/crypto/mediaCrypto'
import MediaService from '@/services/media.service'
import { getSocket } from '../../../../socket'
import MediaPanel from './MediaPanel'
import { replyPreviewText } from '../utils/chat/replyContext'

/**
 * Premium MessageInput — keeps all existing send/image logic,
 * adds typing events, wraps in new premium pill UI.
 */
const SendText = ({
  sendMessage,
  disabled = false,
  disabledReason = '',
  targetUserId,
  groupId,
  replyTo = null,
  onCancelReply,
}) => {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [imageText, setImageText] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState('emoji')
  // ── Encrypted video attachment state ──
  const [videoFile, setVideoFile] = useState(null)
  const [videoObjUrl, setVideoObjUrl] = useState(null)
  const [videoMeta, setVideoMeta] = useState(null) // { thumbnail, durationMs, width, height }
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [videoCaption, setVideoCaption] = useState('')
  const [videoSending, setVideoSending] = useState(false)
  const [videoError, setVideoError] = useState('')
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [attachMenuPos, setAttachMenuPos] = useState({ left: 0, bottom: 0 })
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const attachBtnRef = useRef(null)
  const attachMenuRef = useRef(null)
  const inputRef = useRef(null)
  const caretRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const isTypingRef = useRef(false)

  // ── Typing events ──────────────────────────────────────────────────────────
  // A group composer emits group-scoped typing (relayed to all members); a DM
  // composer emits peer-scoped typing. One of `groupId`/`targetUserId` must be
  // set or typing is silently disabled.
  const emitTyping = useCallback(
    (start) => {
      try {
        if (groupId) {
          getSocket().emit(start ? 'groupTyping' : 'groupStopTyping', { groupId })
        } else if (targetUserId) {
          getSocket().emit(start ? 'typing' : 'stopTyping', { targetUserId })
        }
      } catch {
        /* ignore */
      }
    },
    [groupId, targetUserId]
  )

  const emitStopTyping = useCallback(() => {
    if (!isTypingRef.current) return
    emitTyping(false)
    isTypingRef.current = false
  }, [emitTyping])

  // Stop typing on unmount / chat change
  useEffect(() => {
    return () => {
      emitStopTyping()
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [emitStopTyping, targetUserId, groupId])

  // Focus the composer when a reply is started (e.g. via swipe).
  useEffect(() => {
    if (replyTo) inputRef.current?.focus()
  }, [replyTo])

  // Revoke any pending video preview object URL on unmount to avoid a leak.
  useEffect(() => {
    return () => {
      if (videoObjUrl) URL.revokeObjectURL(videoObjUrl)
    }
  }, [videoObjUrl])

  // Close the attach (+) popover on outside click or Escape. The menu is
  // portaled to <body>, so "inside" means inside the button OR the portaled menu.
  useEffect(() => {
    if (!attachMenuOpen) return undefined
    const onDocClick = (e) => {
      const inBtn = attachBtnRef.current?.contains(e.target)
      const inMenu = attachMenuRef.current?.contains(e.target)
      if (!inBtn && !inMenu) setAttachMenuOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setAttachMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [attachMenuOpen])

  // Toggle the attach popover, measuring the + button so the portaled menu pops
  // up from it (anchored to its top-left), never the middle of the screen.
  const toggleAttachMenu = () => {
    if (disabled) return
    setAttachMenuOpen((open) => {
      if (open) return false
      const r = attachBtnRef.current?.getBoundingClientRect()
      if (r) {
        setAttachMenuPos({
          left: Math.round(r.left),
          bottom: Math.round(window.innerHeight - r.top + 8),
        })
      }
      return true
    })
  }

  const handleChange = (e) => {
    setValue(e.target.value)

    // Emit typing start (debounced stop after 1.5 s idle)
    if (!disabled && (groupId || targetUserId)) {
      if (!isTypingRef.current) {
        emitTyping(true)
        isTypingRef.current = true
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(emitStopTyping, 1500)
    }
  }

  // ── Send text ──────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!value.trim() || disabled) return
    emitStopTyping()
    const text = value.trim()
    const reply = replyTo
    setValue('')
    onCancelReply?.()
    try {
      await Promise.resolve(sendMessage(text, null, reply))
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
    const reply = replyTo
    const reader = new FileReader()
    reader.onload = () => {
      Promise.resolve(sendMessage(imageText, reader.result, reply)).catch((err) =>
        console.error('[SendText] Failed to send image:', err)
      )
      onCancelReply?.()
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

  // ── Encrypted video flow ────────────────────────────────────────────────────
  const handleVideoClick = () => {
    if (disabled) return
    videoInputRef.current?.click()
  }

  const handleVideoChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setVideoError('Please choose a video file.')
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setVideoError(`Video is too large (max ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB).`)
      return
    }
    setVideoError('')
    setVideoCaption('')
    setVideoFile(file)
    setVideoObjUrl(URL.createObjectURL(file))
    setShowVideoModal(true)
    // Poster + metadata for the bubble (best-effort; null thumbnail is fine).
    try {
      const meta = await extractVideoPoster(file)
      setVideoMeta(meta)
    } catch {
      setVideoMeta({ thumbnail: null, durationMs: 0, width: 0, height: 0 })
    }
  }

  const handleCloseVideoModal = () => {
    if (videoSending) return
    setShowVideoModal(false)
    setVideoFile(null)
    setVideoMeta(null)
    setVideoCaption('')
    setVideoError('')
    if (videoObjUrl) URL.revokeObjectURL(videoObjUrl)
    setVideoObjUrl(null)
  }

  const handleVideoSend = async () => {
    if (disabled || !videoFile || videoSending) return
    const reply = replyTo
    setVideoSending(true)
    setVideoError('')
    try {
      // 1. Encrypt the bytes with a fresh per-message key (K never leaves here
      //    except inside the E2EE message payload). 2. Upload the opaque
      //    ciphertext. 3. Send a tiny descriptor through the encrypted channel.
      const bytes = await fileToBytes(videoFile)
      const { ciphertext, keyB64, scheme, chunkSize, size } = await encryptMediaBlob(bytes)
      const { mediaId } = await MediaService.upload(ciphertext)
      const descriptor = {
        mediaId,
        keyB64,
        scheme,
        chunkSize,
        size,
        mime: videoFile.type || 'video/mp4',
        durationMs: videoMeta?.durationMs ?? 0,
        width: videoMeta?.width ?? 0,
        height: videoMeta?.height ?? 0,
        thumbnail: videoMeta?.thumbnail ?? null,
      }
      await Promise.resolve(sendMessage(videoCaption.trim(), null, reply, { video: descriptor }))
      onCancelReply?.()
      handleCloseVideoModal()
    } catch (err) {
      console.error('[SendText] Failed to send video:', err)
      setVideoError(err?.message || 'Failed to send video.')
    } finally {
      setVideoSending(false)
    }
  }

  // ── Emoji / GIF / sticker panel ───────────────────────────────────────────────
  // The panel docks below the composer, taking the keyboard's place on mobile.
  // Opening it blurs the text field so the soft keyboard hides; focusing the
  // field again closes the panel — same dance as WhatsApp.
  const togglePanel = (tab) => {
    if (disabled) return
    setPanelTab(tab)
    setPanelOpen((prev) => {
      const next = !(prev && panelTab === tab) // same tab toggles closed; other tab switches
      if (next) inputRef.current?.blur()
      else inputRef.current?.focus()
      return next
    })
  }

  const handleInputFocus = () => {
    setFocused(true)
    if (panelOpen) setPanelOpen(false)
  }

  // Insert an emoji at the caret (falls back to append) without stealing focus,
  // so the soft keyboard stays hidden while the panel is open.
  const handleEmoji = (emoji) => {
    setValue((prev) => {
      const pos = caretRef.current ?? prev.length
      const at = Math.max(0, Math.min(pos, prev.length))
      const next = prev.slice(0, at) + emoji + prev.slice(at)
      caretRef.current = at + emoji.length
      return next
    })
  }

  // A GIF or sticker is just a remote animated image: send its URL through the
  // existing image field so it renders (and zooms) exactly like any other image.
  const handleMediaSelect = (media) => {
    if (disabled || !media?.fullUrl) return
    setPanelOpen(false)
    Promise.resolve(sendMessage('', media.fullUrl, replyTo)).catch((err) =>
      console.error('[SendText] Failed to send media:', err)
    )
    onCancelReply?.()
  }

  const trackCaret = (e) => {
    caretRef.current = e.target.selectionStart
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

      {/* Hidden file inputs */}
      <input
        type='file'
        ref={fileInputRef}
        onChange={handleImageChange}
        accept='image/*'
        className='hidden'
      />
      <input
        type='file'
        ref={videoInputRef}
        onChange={handleVideoChange}
        accept='video/*'
        className='hidden'
      />

      {/* Encrypted video preview modal — portaled like the image modal so it
          escapes the composer's backdrop-blur containing block. */}
      {showVideoModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className='fixed inset-0 z-[80] grid place-items-center bg-black/70 backdrop-blur-sm'
            onClick={handleCloseVideoModal}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className='relative mx-3 w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0e] p-5'
            >
              <button
                onClick={handleCloseVideoModal}
                aria-label='Close'
                disabled={videoSending}
                className='absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-white/55 hover:bg-white/[0.04] hover:text-white disabled:opacity-40'
              >
                <X size={14} />
              </button>
              {videoObjUrl && (
                <video
                  src={videoObjUrl}
                  poster={videoMeta?.thumbnail || undefined}
                  controls
                  playsInline
                  className='mx-auto mb-4 max-h-64 w-full rounded-xl bg-black object-contain'
                />
              )}
              <input
                type='text'
                value={videoCaption}
                onChange={(e) => setVideoCaption(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVideoSend()}
                placeholder='Add a caption…'
                disabled={videoSending}
                className='echo-input mb-3 w-full rounded-xl px-3.5 py-2.5 text-[13px] echo-focus-ring disabled:opacity-50'
              />
              {videoError && (
                <div className='mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-200'>
                  {videoError}
                </div>
              )}
              <button
                onClick={handleVideoSend}
                disabled={videoSending}
                className='echo-cta flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-medium disabled:opacity-60'
              >
                {videoSending ? (
                  <>
                    <Loader2 size={14} className='animate-spin' /> Encrypting &amp; uploading…
                  </>
                ) : (
                  'Send Video'
                )}
              </button>
              <p className='mt-2 text-center text-[10.5px] text-white/30 mono'>
                End-to-end encrypted · key never leaves your device
              </p>
            </div>
          </div>,
          document.body
        )}

      {/* Reply preview bar — shown above the composer while replying. */}
      {replyTo && (
        <div className='mx-1 mb-2 flex items-stretch gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 md:mx-2'>
          <span className='w-[3px] shrink-0 rounded-full bg-violet-400' />
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-1 truncate text-[11px] font-semibold text-violet-200'>
              <Reply size={12} />
              Replying to {replyTo.username || 'Unknown'}
            </div>
            <div className='truncate text-[12px] text-white/55'>{replyPreviewText(replyTo)}</div>
          </div>
          <button
            type='button'
            onClick={onCancelReply}
            aria-label='Cancel reply'
            className='grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/45 hover:bg-white/[0.06] hover:text-white'
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pill input bar */}
      <div
        className={`flex min-w-0 items-center gap-1.5 rounded-full border px-1.5 py-1.5 backdrop-blur transition-all md:gap-2 md:px-2.5 ${
          focused
            ? 'border-violet-400/45 bg-white/[0.025] shadow-[0_0_0_4px_rgba(168,85,247,0.10),inset_0_0_28px_rgba(168,85,247,0.06)]'
            : 'border-white/[0.06] bg-white/[0.015]'
        }`}
      >
        <button
          ref={attachBtnRef}
          data-testid='msg-attach'
          type='button'
          title='Attach'
          aria-haspopup='menu'
          aria-expanded={attachMenuOpen ? 'true' : 'false'}
          onClick={toggleAttachMenu}
          disabled={disabled}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:bg-white/[0.04] hover:text-white disabled:opacity-40 md:h-9 md:w-9 ${
            attachMenuOpen ? 'text-violet-300' : 'text-white/55'
          }`}
        >
          <Plus
            size={17}
            className={`transition-transform duration-200 ${attachMenuOpen ? 'rotate-45' : ''}`}
          />
        </button>

        {/* Attach popover — portaled to <body> (the composer sits under
            backdrop-filter/overflow ancestors that would clip or mis-stack an
            absolutely-positioned menu) and fixed-anchored just above the +. */}
        {attachMenuOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={attachMenuRef}
              role='menu'
              style={{ left: attachMenuPos.left, bottom: attachMenuPos.bottom }}
              className='fixed z-[85] w-40 origin-bottom-left overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d12] p-1 shadow-[0_18px_50px_rgba(0,0,0,0.6)] animate-fade-up'
            >
              <button
                role='menuitem'
                type='button'
                data-testid='attach-photo'
                onClick={() => {
                  setAttachMenuOpen(false)
                  handleImageClick()
                }}
                className='flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] text-white/85 transition hover:bg-white/[0.06]'
              >
                <ImageIcon size={16} className='text-violet-300' />
                Photo
              </button>
              <button
                role='menuitem'
                type='button'
                data-testid='attach-video'
                onClick={() => {
                  setAttachMenuOpen(false)
                  handleVideoClick()
                }}
                className='flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] text-white/85 transition hover:bg-white/[0.06]'
              >
                <Film size={16} className='text-violet-300' />
                Video
              </button>
            </div>,
            document.body
          )}

        <button
          data-testid='msg-emoji'
          type='button'
          title={panelOpen ? 'Keyboard' : 'Emoji, GIFs & stickers'}
          onClick={() => togglePanel('emoji')}
          disabled={disabled}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:bg-white/[0.04] hover:text-white disabled:opacity-40 md:h-9 md:w-9 ${
            panelOpen ? 'text-violet-300' : 'text-white/55'
          }`}
        >
          {panelOpen ? <Keyboard size={18} /> : <Smile size={18} />}
        </button>

        <input
          ref={inputRef}
          data-testid='chat-input'
          value={value}
          onChange={handleChange}
          onFocus={handleInputFocus}
          onBlur={() => setFocused(false)}
          onSelect={trackCaret}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submit())}
          placeholder={disabled ? disabledReason || 'Sending is disabled...' : 'Message...'}
          disabled={disabled}
          className='min-w-0 flex-1 bg-transparent px-1 py-2.5 text-[16px] text-white placeholder:text-white/30 focus:outline-none md:px-1.5 md:py-2 md:text-[13.5px]'
        />

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

      {!panelOpen && (
        <div className='mt-2 hidden items-center justify-between px-1 text-[10px] text-white/30 mono md:flex md:px-2'>
          <span>Argon2id · X25519 · ChaCha20-Poly1305</span>
          <span>Press ⏎ to send · ⇧⏎ new line</span>
        </div>
      )}

      {/* Emoji / GIF / sticker panel — docks here, in the keyboard's place */}
      <MediaPanel
        open={panelOpen}
        initialTab={panelTab}
        onClose={() => {
          setPanelOpen(false)
          inputRef.current?.focus()
        }}
        onEmoji={handleEmoji}
        onMediaSelect={handleMediaSelect}
      />
    </div>
  )
}

SendText.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  disabledReason: PropTypes.string,
  targetUserId: PropTypes.string,
  groupId: PropTypes.string,
  replyTo: PropTypes.object,
  onCancelReply: PropTypes.func,
}

export default SendText
