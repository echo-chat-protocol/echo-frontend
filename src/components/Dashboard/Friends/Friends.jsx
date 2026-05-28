import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getSocket } from '../../../socket'
import PropTypes from 'prop-types'
import { UsersService } from '@services'
import { formatProfileImage } from '../DashboardComponents/utils/helpers'
import { Search, MessageSquareText, Phone, Video, UserPlus, UserCheck } from 'lucide-react'

const TABS = [
  { id: 'online', label: 'Online' },
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'blocked', label: 'Blocked' },
]

/**
 * FriendsView (Friends.jsx) — premium contact list.
 * Keeps real socket-based search, adds tabbed contacts grid.
 */
const Friends = ({ token, onActiveChatChange, onAddContact }) => {
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [chatList, setSearchList] = useState([])
  const [onlineUsers, setOnlineUsers] = useState([])
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = getSocket()
    socketRef.current = socket

    // Track online status
    socket.emit('getOnlineUsers', ({ onlineUsers: list }) => {
      setOnlineUsers((list || []).map((id) => String(id)))
    })
    const onOnline = ({ userId }) =>
      setOnlineUsers((prev) => {
        const normalizedId = String(userId)
        return prev.includes(normalizedId) ? prev : [...prev, normalizedId]
      })
    const onOffline = ({ userId }) =>
      setOnlineUsers((prev) => prev.filter((id) => id !== String(userId)))

    socket.on('userOnline', onOnline)
    socket.on('userOffline', onOffline)

    return () => {
      socket.off('userOnline', onOnline)
      socket.off('userOffline', onOffline)
    }
  }, [token])

  const handleSearch = useCallback(
    async (term) => {
      const searchQuery = (term ?? q).trim()
      if (!searchQuery) {
        setSearchList([])
        return
      }

      try {
        const res = await UsersService.search({ searchTerm: searchQuery })
        const users = (res?.users || []).map((u) => ({
          ...u,
          profileImage: formatProfileImage(u.profilePicture, u.username),
        }))
        setSearchList(users)
      } catch {
        setSearchList([])
      }
    },
    [q]
  )

  useEffect(() => {
    if (q?.trim()) {
      handleSearch(q)
    } else {
      setSearchList([])
    }
  }, [q, handleSearch])

  // Filter by tab
  const displayList = useMemo(() => {
    let list = chatList.map((u) => ({
      ...u,
      status: onlineUsers.includes(String(u.id)) ? 'online' : 'offline',
    }))
    if (tab === 'online') list = list.filter((u) => u.status === 'online')
    return list
  }, [chatList, tab, onlineUsers])

  const onlineCount = chatList.filter((u) => onlineUsers.includes(String(u.id))).length

  return (
    <div className='relative flex h-full flex-1 flex-col overflow-hidden'>
      {/* Header */}
      <div className='border-b border-white/[0.05] px-10 pb-6 pt-9'>
        <div className='flex items-end justify-between gap-4'>
          <div>
            <h1 className='echo-display text-[28px]'>
              Your <span className='echo-text-gradient'>circle</span>.
            </h1>
            <p className='mt-2 text-[13px] text-white/45'>
              {chatList.length} contacts · {onlineCount} online
            </p>
          </div>
          <button
            data-testid='add-friend-btn'
            onClick={onAddContact}
            className='echo-cta inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium'
          >
            <UserPlus size={15} /> Add contact
          </button>
        </div>

        {/* Tabs */}
        <div className='mt-6 flex flex-wrap items-center gap-1.5'>
          {TABS.map((t) => {
            const active = tab === t.id
            const badge =
              t.id === 'online'
                ? onlineCount
                : t.id === 'pending' || t.id === 'blocked'
                  ? 0
                  : chatList.length
            return (
              <button
                key={t.id}
                data-testid={`friends-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                  active
                    ? 'echo-tab-active text-white'
                    : 'border-white/[0.06] bg-white/[0.015] text-white/55 hover:text-white/90'
                }`}
              >
                {t.label}
                <span
                  className={`mono text-[10px] ${active ? 'text-violet-300' : 'text-white/35'}`}
                >
                  {badge}
                </span>
              </button>
            )
          })}
          <div className='ml-auto relative'>
            <Search
              size={13}
              className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35'
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder='Filter results…'
              className='echo-input w-[220px] rounded-full py-1.5 pl-9 pr-3 text-[12px] echo-focus-ring'
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className='flex-1 overflow-y-auto px-10 py-7'>
        {tab === 'pending' ? (
          <EmptyState
            title='No pending requests'
            sub="When someone sends you a request, it'll show up here."
          />
        ) : tab === 'blocked' ? (
          <EmptyState title='Nothing blocked' sub="You haven't blocked anyone." />
        ) : displayList.length === 0 ? (
          <EmptyState
            title={q ? 'No results' : 'Search for someone'}
            sub={
              q
                ? `No contacts match "${q}"`
                : 'Use the search bar above to find contacts and start chatting.'
            }
          />
        ) : (
          <ContactsGrid items={displayList} onSelect={onActiveChatChange} />
        )}
      </div>
    </div>
  )
}

function ContactsGrid({ items, onSelect }) {
  return (
    <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'>
      {items.map((c) => (
        <div
          key={c.id}
          data-testid={`friend-card-${c.id}`}
          className='echo-hover-lift flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4'
        >
          <div className='relative'>
            {c.profileImage ? (
              <img
                src={c.profileImage}
                alt={c.username}
                className='h-12 w-12 rounded-full object-cover ring-1 ring-white/10'
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${c.username}&background=8e79f2&color=fff`
                }}
              />
            ) : (
              <div className='grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-violet-700/70 text-white font-semibold'>
                {c.username?.[0]}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 status-dot ${
                c.status === 'online' ? 'status-online' : 'status-offline'
              }`}
            />
          </div>
          <div className='min-w-0 flex-1'>
            <div className='truncate text-[13.5px] font-medium tracking-[-0.01em]'>
              {c.username}
            </div>
            <div className='text-[11.5px] text-white/40'>{c.status}</div>
          </div>
          <div className='flex items-center gap-1'>
            <SmallIcon
              onClick={() =>
                onSelect({ id: c.id, username: c.username, profileImage: c.profileImage })
              }
            >
              <MessageSquareText size={14} />
            </SmallIcon>
            <SmallIcon>
              <Phone size={14} />
            </SmallIcon>
            <SmallIcon>
              <Video size={14} />
            </SmallIcon>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ title, sub }) {
  return (
    <div className='grid place-items-center px-6 py-20 text-center'>
      <div className='mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.02]'>
        <UserCheck size={20} className='text-violet-300' />
      </div>
      <h3 className='text-[15px] font-semibold'>{title}</h3>
      <p className='mt-1 text-[12.5px] text-white/40'>{sub}</p>
    </div>
  )
}

function SmallIcon({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className='grid h-8 w-8 place-items-center rounded-full border border-transparent text-white/55 hover:border-violet-400/30 hover:bg-violet-500/[0.06] hover:text-white transition-all'
    >
      {children}
    </button>
  )
}

Friends.propTypes = {
  token: PropTypes.string.isRequired,
  onActiveChatChange: PropTypes.func.isRequired,
  onAddContact: PropTypes.func,
}

export default Friends
