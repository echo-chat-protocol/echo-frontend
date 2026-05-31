import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Phone, PhoneOff, Video } from 'lucide-react'
import { getSocket } from '../../socket'

const AUTO_DISMISS_MS = 30000

const IncomingCallNotification = ({ callData, onClose }) => {
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(false)
  const closedRef = useRef(false)

  const close = (after = 300) => {
    if (closedRef.current) return
    closedRef.current = true
    setIsVisible(false)
    setTimeout(() => onClose(), after)
  }

  const handleAnswer = () => {
    setIsVisible(false)
    setTimeout(() => {
      onClose()
      navigate(`/video-call/${callData.callerId}`, {
        state: { callId: callData.callId, callerName: callData.callerName },
      })
    }, 300)
  }

  const handleDecline = () => {
    try {
      getSocket().emit('declineCall', { callId: callData.callId })
    } catch {
      /* ignore */
    }
    close()
  }

  // Slide in on mount; auto-decline after the timeout.
  useEffect(() => {
    const showTimer = setTimeout(() => setIsVisible(true), 50)
    const autoDismiss = setTimeout(() => handleDecline(), AUTO_DISMISS_MS)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(autoDismiss)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const callerName = callData?.callerName || 'Unknown caller'

  return (
    <div
      className={`fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pointer-events-none transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0' : '-translate-y-[140%]'
      }`}
    >
      <div className='echo-floating pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]'>
        {/* Auto-dismiss progress bar */}
        <div className='h-0.5 w-full bg-white/[0.06]'>
          <div
            className='h-full bg-gradient-to-r from-violet-500 to-violet-300'
            style={{ animation: `echo-call-countdown ${AUTO_DISMISS_MS}ms linear forwards` }}
          />
        </div>

        <div className='flex items-center gap-4 p-4'>
          {/* Caller avatar */}
          <div className='relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-violet-700/70 ring-1 ring-violet-300/40'>
            <span className='absolute inset-0 animate-ping rounded-full ring-2 ring-violet-400/40' />
            <Video size={22} className='relative text-violet-100' />
          </div>

          {/* Call info */}
          <div className='min-w-0 flex-1'>
            <h3 className='truncate text-[15px] font-semibold tracking-[-0.01em] text-white'>
              {callerName}
            </h3>
            <p className='mt-0.5 flex items-center gap-1.5 text-[12px] text-white/55'>
              <span className='inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400' />
              Incoming call…
            </p>
          </div>

          {/* Actions */}
          <div className='flex shrink-0 items-center gap-2'>
            <button
              onClick={handleDecline}
              aria-label='Decline call'
              title='Decline'
              className='grid h-12 w-12 place-items-center rounded-full bg-red-500/90 text-white shadow-lg transition hover:bg-red-500 active:scale-95'
            >
              <PhoneOff size={18} />
            </button>
            <button
              onClick={handleAnswer}
              aria-label='Answer call'
              title='Answer'
              className='grid h-12 w-12 animate-bounce place-items-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-400 active:scale-95'
            >
              <Phone size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

IncomingCallNotification.propTypes = {
  callData: PropTypes.shape({
    callId: PropTypes.string,
    callerId: PropTypes.string,
    callerName: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
}

export default IncomingCallNotification
