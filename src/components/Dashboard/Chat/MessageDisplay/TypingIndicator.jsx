import PropTypes from 'prop-types'

/**
 * Typing indicator that "pops up" just above the chat composer. Renders the
 * three bouncing `.typing-dot`s (up/down wave, defined in index.css) plus a
 * label. Returns nothing when no one is typing, so it can be rendered
 * unconditionally with the formatted text passed in.
 *
 * @param {{ text: string|null }} props - `text` is the result of
 *   formatTypingText(...): "typing…", "Alice is typing…", etc. — or null.
 */
export default function TypingIndicator({ text }) {
  if (!text) return null
  const showLabel = text !== 'typing…'
  const dotOnlyOffset = showLabel ? '' : 'translate-y-1'

  return (
    <div className='pointer-events-none px-3 pb-1.5 md:px-6' aria-live='polite' aria-label={text}>
      <div
        className={`typing-pop inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-violet-400/20 bg-violet-500/[0.08] px-3 py-2 shadow-[0_6px_20px_-12px_rgba(168,85,247,0.75)] backdrop-blur ${dotOnlyOffset}`}
      >
        <span className='flex items-center gap-1' aria-hidden='true'>
          <span className='typing-dot' />
          <span className='typing-dot' />
          <span className='typing-dot' />
        </span>
        {showLabel && <span className='text-[12px] leading-none text-violet-300'>{text}</span>}
      </div>
    </div>
  )
}

TypingIndicator.propTypes = {
  text: PropTypes.string,
}
