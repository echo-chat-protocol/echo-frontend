import { useState } from 'react'
import PropTypes from 'prop-types'
import { Send } from 'lucide-react'

const GroupSendText = ({ sendMessage, disabled = false, disabledReason = '' }) => {
  const [text, setText] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (disabled) return
    const next = text.trim()
    if (!next) return
    try {
      await Promise.resolve(sendMessage(next))
      setText('')
    } catch (err) {
      console.error('[GroupSendText] Failed to send message:', err)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className='flex shrink-0 items-center border-t border-gray-800 bg-black p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:p-3 md:pb-3'
    >
      <div className='flex-1 min-w-0 flex items-center bg-white/10 rounded-full border border-gray-700 focus-within:ring-2 focus-within:ring-[#8e79f2]'>
        <input
          type='text'
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? disabledReason || 'Sending is disabled' : 'Type a message...'}
          disabled={disabled}
          className='min-w-0 flex-1 rounded-full border border-gray-700 bg-white/10 px-3.5 py-2.5 text-[16px] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8e79f2] md:px-5 md:py-3 md:text-sm'
        />
      </div>
      <button
        type='submit'
        disabled={disabled || !text.trim()}
        className={`ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full md:ml-3 ${
          !disabled && text.trim()
            ? 'bg-indigo-700 text-white hover:bg-[#8e79f2]'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        } transition-colors`}
        title={disabled ? disabledReason || 'Sending is disabled' : 'Send'}
      >
        <Send className='w-4 h-4 md:w-5 md:h-5' />
      </button>
    </form>
  )
}

GroupSendText.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  disabledReason: PropTypes.string,
}

export default GroupSendText
