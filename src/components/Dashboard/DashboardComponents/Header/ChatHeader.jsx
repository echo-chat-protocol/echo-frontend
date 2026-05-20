import { useState, useRef, useEffect } from 'react'
import { Phone, Video, Lock, Fingerprint, MoreVertical, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getSocket } from '../../../../socket'

/**
 * Premium ChatHeader — keeps all existing socket logic (online tracking,
 * add-friend, safety-number verify) with the new premium UI design.
 */
const ChatHeader = ({ userId, activeChat, token, onOpenInfo, onCompareNumbers }) => {
  const navigate = useNavigate()
  const [onlineUsers, setOnlineUsers] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [isFriend, setIsFriend] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const menuRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Reset on chat change
  useEffect(() => {
    setMenuOpen(false)
  }, [activeChat])

  // Track online status via shared socket
  useEffect(() => {
    const socket = getSocket()

    socket.emit('getOnlineUsers', ({ onlineUsers }) => {
      setOnlineUsers(onlineUsers || [])
    })

    const onOnline = ({ userId: uid }) =>
      setOnlineUsers((prev) => (prev.includes(uid) ? prev : [...prev, uid]))
    const onOffline = ({ userId: uid }) => setOnlineUsers((prev) => prev.filter((id) => id !== uid))

    socket.on('userOnline', onOnline)
    socket.on('userOffline', onOffline)
    return () => {
      socket.off('userOnline', onOnline)
      socket.off('userOffline', onOffline)
    }
  }, [token])

  const handleAddFriend = () => {
    const socket = getSocket()
    if (!socket?.connected) return alert('Not connected to server.')
    if (!userId) return alert('You need to be logged in.')
    if (!activeChat?.id) return alert('No user selected.')

    setIsLoading(true)
    setMenuOpen(false)
    socket.emit('addFriend', { userId, targetUserId: activeChat.id }, (res) => {
      setIsLoading(false)
      if (res?.success) {
        setIsFriend(true)
        alert(`You are now friends with ${activeChat.username}!`)
      } else {
        alert(res?.error || 'Failed to add friend')
      }
    })
  }

  const handleVerifySafetyNumber = () => {
    setMenuOpen(false)
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

  const isOnline = onlineUsers.includes(activeChat.id)

  // Normalise field names — existing code uses .username/.profileImage
  const chat = {
    name: activeChat.username || activeChat.name || 'Unknown',
    avatar: activeChat.profileImage || activeChat.avatar || null,
    status: isOnline ? 'online' : 'offline',
    isGroup: activeChat.type === 'group',
  }

  return (
    <div className='relative flex items-center gap-3 border-b border-white/[0.05] px-6 py-3.5 bg-black/30 backdrop-blur-sm'>
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
      <div className='flex items-center gap-1'>
        <IconBtn label='Voice call' testid='chat-header-voice'>
          <Phone size={15} />
        </IconBtn>
        <IconBtn
          label='Video call'
          testid='chat-header-video'
          onClick={() => navigate(`/video-call/${activeChat.id}`)}
        >
          <Video size={15} />
        </IconBtn>
        <IconBtn label='Info' testid='chat-header-info' onClick={onOpenInfo}>
          <Info size={15} />
        </IconBtn>

        {/* More menu */}
        <div className='relative' ref={menuRef}>
          <IconBtn label='More' testid='chat-header-more' onClick={() => setMenuOpen((o) => !o)}>
            <MoreVertical size={15} />
          </IconBtn>

          {menuOpen && (
            <div className='absolute right-0 top-11 z-50 min-w-[160px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0e] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)]'>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false)
                  navigate(`/profile/${activeChat.id}`)
                }}
              >
                Profile
              </MenuItem>
              {!isFriend && (
                <MenuItem onClick={handleAddFriend} disabled={isLoading}>
                  {isLoading ? 'Adding…' : 'Add Friend'}
                </MenuItem>
              )}
              {isFriend && (
                <MenuItem disabled className='text-emerald-400/80'>
                  Your Friend ✓
                </MenuItem>
              )}
              <MenuItem onClick={handleVerifySafetyNumber}>Verify Safety Number</MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false)
                  alert('Block clicked!')
                }}
                className='text-red-400'
              >
                Block
              </MenuItem>
            </div>
          )}
        </div>
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

function MenuItem({ children, onClick, disabled, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-4 py-2.5 text-left text-[13px] text-white/80 hover:bg-white/[0.04] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  )
}

export default ChatHeader
