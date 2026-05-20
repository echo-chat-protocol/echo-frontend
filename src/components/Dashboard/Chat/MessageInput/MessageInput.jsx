import { useState } from 'react'
import { Plus, Smile, Image as ImgIcon, Paperclip, Send, Mic } from 'lucide-react'

export default function MessageInput({ onSend, disabled }) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)

  const submit = () => {
    if (!value.trim() || disabled) return
    onSend?.(value.trim())
    setValue('')
  }

  return (
    <div className='border-t border-white/[0.05] px-6 py-4'>
      <div
        className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 backdrop-blur transition-all ${
          focused
            ? 'border-violet-400/45 bg-white/[0.025] shadow-[0_0_0_4px_rgba(168,85,247,0.10),inset_0_0_28px_rgba(168,85,247,0.06)]'
            : 'border-white/[0.06] bg-white/[0.015]'
        }`}
      >
        <button
          data-testid='msg-attach'
          title='Attach'
          className='grid h-9 w-9 place-items-center rounded-full text-white/55 hover:bg-white/[0.04] hover:text-white transition'
        >
          <Plus size={17} />
        </button>

        <input
          data-testid='msg-input'
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submit())}
          placeholder='Type a message or choose an option…'
          className='flex-1 bg-transparent px-1.5 py-2 text-[13.5px] text-white placeholder:text-white/30 focus:outline-none'
        />

        <div className='flex items-center gap-0.5 pr-1'>
          <IconBtn title='Emoji' testid='msg-emoji'>
            <Smile size={16} />
          </IconBtn>
          <IconBtn title='GIFs' testid='msg-gifs'>
            <span className='mono text-[10px] font-bold tracking-tight'>GIF</span>
          </IconBtn>
          <IconBtn title='Image' testid='msg-image'>
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
          data-testid='msg-send'
          onClick={submit}
          disabled={!value.trim() || disabled}
          className='echo-cta ml-1 grid h-10 w-10 place-items-center rounded-full disabled:opacity-40 disabled:saturate-50'
          title='Send'
        >
          <Send size={15} className='text-white' />
        </button>
      </div>
      <div className='mt-2 flex items-center justify-between px-2 text-[10px] text-white/30 mono'>
        <span>Argon2id · X25519 · ChaCha20-Poly1305</span>
        <span>Press ⏎ to send · ⇧⏎ for new line</span>
      </div>
    </div>
  )
}

function IconBtn({ children, title, testid }) {
  return (
    <button
      title={title}
      data-testid={testid}
      className='grid h-8 w-8 place-items-center rounded-full text-white/45 hover:bg-white/[0.04] hover:text-white transition-all'
    >
      {children}
    </button>
  )
}
