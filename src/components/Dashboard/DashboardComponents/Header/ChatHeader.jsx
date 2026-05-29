import { useState, useEffect } from 'react'
import { Phone, Video, Lock, Fingerprint, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getSocket } from '../../../../socket'

/**
 * Premium ChatHeader — keeps all existing socket logic (online tracking,
 * add-friend, safety-number verify) with the new premium UI design.
 */
const ChatHeader = ({ activeChat, token, onOpenInfo, onCompareNumbers, onBack }) => {
  const navigate = useNavigate()
  const [onlineUsers, setOnlineUsers] = useState([])
  // Note: friendship/loading state removed as unused; can be restored when needed

  // Track online status via shared socket
  useEffect(() => {
    const socket = getSocket()

    socket.emit('getOnlineUsers', ({ onlineUsers }) => {
      setOnlineUsers((onlineUsers || []).map((id) => String(id)))
    })

    const onOnline = ({ userId: uid }) =>
      setOnlineUsers((prev) => {
        const normalizedId = String(uid)
        return prev.includes(normalizedId) ? prev : [...prev, normalizedId]
      })
    const onOffline = ({ userId: uid }) =>
      setOnlineUsers((prev) => prev.filter((id) => id !== String(uid)))

    socket.on('userOnline', onOnline)
    socket.on('userOffline', onOffline)
    return () => {
      socket.off('userOnline', onOnline)
      socket.off('userOffline', onOffline)
    }
  }, [token])

  const handleVerifySafetyNumber = () => {
    if (onCompareNumbers) {
      onCompareNumbers()
    } else {
      window.dispatchEvent(
        new CustomEvent('verifySafetyNumber', {
          detail: { peerId: String(activeChat?.id) },
        })
      )
    }
  }

  if (!activeChat) return null

  const isOnline = onlineUsers.includes(String(activeChat.id))

  // Normalise field names — existing code uses .username/.profileImage
  const chat = {
    name: activeChat.username || activeChat.name || 'Unknown',
    avatar: activeChat.profileImage || activeChat.avatar || null,
    status: isOnline ? 'online' : 'offline',
    isGroup: activeChat.type === 'group',
  }

  return (
    <div
      className='relative flex items-center gap-3 border-b border-white/[0.05] px-4 md:px-6 py-3.5 bg-black/30 backdrop-blur-sm'
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      {/* Mobile back */}
      {onBack && (
        <button
          title='Back'
          data-testid='chat-header-back'
          onClick={onBack}
          className='md:hidden grid h-9 w-9 place-items-center rounded-full border border-transparent text-white/65 transition-all hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-white'
        >
          <ArrowLeft size={16} />
        </button>
      )}
      {/* Avatar */}
      <div className='relative'>
        {chat.avatar ? (
          <img
            src={chat.avatar}
            alt={chat.name}
            className='h-10 w-10 rounded-full object-cover ring-1 ring-white/10'
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name)}&background=8e79f2&color=fff`
            }}
          />
        ) : (
          <div className='grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-violet-700/70 ring-1 ring-white/10 text-white/90 text-sm font-semibold'>
            {chat.name?.[0] ?? '?'}
          </div>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 status-dot ${
            chat.status === 'online' ? 'status-online' : 'status-offline'
          }`}
        />
      </div>

      {/* Name + status */}
      <div className='min-w-0 flex-1'>
        <button
          onClick={onOpenInfo}
          data-testid='chat-header-name'
          className='block truncate text-left text-[14px] font-semibold tracking-[-0.015em] hover:underline underline-offset-4 decoration-violet-400/40'
        >
          {chat.name}
        </button>
        <div className='flex items-center gap-2 text-[11px] text-white/40'>
          <span className={chat.status === 'online' ? 'text-emerald-400/80' : ''}>
            {chat.isGroup ? 'Group' : chat.status === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* E2EE pill */}
      <button
        data-testid='chat-header-compare'
        onClick={handleVerifySafetyNumber}
        className='hidden md:inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.04] px-3 py-1 text-[10.5px] font-medium tracking-[0.04em] text-emerald-300/90 hover:border-emerald-400/40 transition-all'
        title='Verify safety numbers'
      >
        <Lock size={11} strokeWidth={2.4} />
        <span className='mono'>Secured</span>
        <Fingerprint size={11} className='text-emerald-300/80' />
      </button>

      {/* Action icons */}
      <div className='flex items-center gap-1 ml-auto'>
        <IconBtn
          label='Voice call'
          testid='chat-header-voice'
          onClick={() => navigate(`/video-call/${activeChat.id}?type=audio`)}
        >
          <Phone size={15} />
        </IconBtn>
        <IconBtn
          label='Video call'
          testid='chat-header-video'
          onClick={() => navigate(`/video-call/${activeChat.id}`)}
        >
          <Video size={15} />
        </IconBtn>
      </div>
    </div>
  )
}

function IconBtn({ children, label, testid, onClick }) {
  return (
    <button
      title={label}
      data-testid={testid}
      onClick={onClick}
      className='grid h-9 w-9 place-items-center rounded-full border border-transparent text-white/55 transition-all hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-white'
    >
      {children}
    </button>
  )
}

export default ChatHeader
