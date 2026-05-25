import { useMemo, useState } from 'react'
import { Search, Pin, Bot, UsersRound, CheckCheck, Check, Plus } from 'lucide-react'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'groups', label: 'Groups' },
]

function DeliveryIcon({ state }) {
  if (state === 'read') return <CheckCheck size={13} className='text-sky-400' strokeWidth={2.4} />
  if (state === 'delivered')
    return <CheckCheck size={13} className='text-white/35' strokeWidth={2.2} />
  if (state === 'sent') return <Check size={13} className='text-white/35' strokeWidth={2.2} />
  return null
}

function Avatar({ src, name, isBot, isGroup }) {
  if (isBot) {
    return (
      <div className='grid h-11 w-11 place-items-center rounded-full echo-violet-gradient ring-1 ring-violet-300/40 echo-violet-glow'>
        <Bot size={20} className='text-white' />
      </div>
    )
  }
  if (isGroup || !src) {
    return (
      <div className='grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-indigo-500/40 to-violet-700/60 ring-1 ring-white/10'>
        {isGroup ? (
          <UsersRound size={18} className='text-white/90' />
        ) : (
          <span className='text-white font-semibold text-sm'>{(name || '?')?.[0]}</span>
        )}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={name}
      className='h-11 w-11 rounded-full object-cover ring-1 ring-white/10'
      onError={(e) => {
        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '?')}&background=8e79f2&color=fff`
      }}
    />
  )
}

/**
 * Premium ChatList component.
 *
 * Props:
 *  - items: array of chat items (id, name, avatar, last, time, unread, status, isGroup, isBot, pinned, delivered)
 *  - activeId: currently selected chat id
 *  - searchTerm: controlled search value
 *  - onSearchChange: (val) => void
 *  - onSelect: (id) => void
 *  - onCreateGroup: () => void
 */
export default function ChatList({
  items = [],
  activeId,
  searchTerm = '',
  onSearchChange,
  onSelect,
  onCreateGroup,
}) {
  const [tab, setTab] = useState('all')

  const filtered = useMemo(() => {
    let list = items
    if (tab === 'unread') list = list.filter((c) => c.unread > 0)
    if (tab === 'groups') list = list.filter((c) => c.isGroup)
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase()
      list = list.filter(
        (c) => (c.name || '').toLowerCase().includes(s) || (c.last || '').toLowerCase().includes(s)
      )
    }
    return list
  }, [items, tab, searchTerm])

  const pinned = filtered.filter((c) => c.pinned)
  const recent = filtered.filter((c) => !c.pinned)

  return (
    <div className='echo-floating relative flex h-full w-[340px] shrink-0 flex-col overflow-hidden'>
      {/* Title */}
      <div className='px-5 pt-5'>
        <h2 className='echo-display text-[22px]'>Conversations.</h2>
        <p className='mt-1 text-[12px] text-white/40'>End-to-end encrypted — zero metadata.</p>
      </div>

      {/* Search row */}
      <div className='px-5 pt-4 flex items-center gap-2'>
        <div className='relative flex-1'>
          <Search
            size={14}
            className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35'
          />
          <input
            data-testid='chatlist-search'
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder='Search chats & groups…'
            className='echo-input w-full rounded-full py-2 pl-10 pr-3 text-[12.5px] echo-focus-ring'
          />
        </div>
        {onCreateGroup && (
          <button
            onClick={onCreateGroup}
            title='New group'
            className='grid h-9 w-9 shrink-0 place-items-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition'
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className='px-5 pt-4'>
        <div className='relative flex items-center gap-6 border-b border-white/[0.05]'>
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                data-testid={`chatlist-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`relative pb-2.5 text-[11.5px] font-medium transition-colors ${
                  active ? 'text-white' : 'text-white/40 hover:text-white/75'
                }`}
              >
                {t.label}
                {active && (
                  <span
                    className='absolute -bottom-px left-0 right-0 h-px'
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, #c084fc 25%, #a855f7 50%, #c084fc 75%, transparent)',
                      boxShadow: '0 0 10px rgba(168,85,247,0.6)',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div className='mt-3 flex-1 overflow-y-auto px-3 pb-4'>
        {pinned.length > 0 && (
          <div className='mb-1 px-3 pt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35'>
            <span className='inline-flex items-center gap-1.5'>
              <Pin size={10} /> Pinned
            </span>
          </div>
        )}
        {pinned.map((c) => (
          <ChatRow
            key={c.id}
            chat={c}
            active={String(activeId) === String(c.id)}
            onClick={() => onSelect?.(c.id)}
          />
        ))}

        {recent.length > 0 && (
          <div className='mb-1 mt-3 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35'>
            Recent
          </div>
        )}
        {recent.map((c) => (
          <ChatRow
            key={c.id}
            chat={c}
            active={String(activeId) === String(c.id)}
            onClick={() => onSelect?.(c.id)}
          />
        ))}

        {filtered.length === 0 && (
          <div className='px-4 py-12 text-center text-[12px] text-white/35'>
            {searchTerm ? 'No conversations match your search.' : 'No conversations yet.'}
          </div>
        )}
      </div>
    </div>
  )
}

function ChatRow({ chat, active, onClick }) {
  return (
    <button
      data-testid={`chat-row-${chat.id}`}
      onClick={onClick}
      className={`group relative my-0.5 flex w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all ${
        active
          ? 'border-violet-400/40 bg-gradient-to-b from-violet-500/[0.10] to-violet-500/[0.02] echo-violet-glow'
          : 'border-transparent hover:border-white/[0.05] hover:bg-white/[0.015]'
      }`}
    >
      <div className='relative shrink-0'>
        <Avatar src={chat.avatar} name={chat.name} isBot={chat.isBot} isGroup={chat.isGroup} />
        {chat.status && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 status-dot ${
              chat.status === 'online' ? 'status-online' : 'status-offline'
            }`}
          />
        )}
      </div>

      <div className='min-w-0 flex-1'>
        <div className='flex items-center justify-between gap-2'>
          <span className='truncate text-[13px] font-medium tracking-[-0.01em] text-white'>
            {chat.name}
          </span>
          <span className='shrink-0 text-[10.5px] text-white/35 mono'>{chat.time}</span>
        </div>
        <div className='mt-0.5 flex items-center gap-1.5'>
          {chat.typing ? (
            <span className='flex items-center gap-1 text-[11.5px] text-violet-300'>
              <span className='typing-dot' />
              <span className='typing-dot' />
              <span className='typing-dot' />
              <span className='ml-1'>typing…</span>
            </span>
          ) : (
            <p className='truncate text-[11.5px] text-white/45'>{chat.last}</p>
          )}
        </div>
      </div>

      <div className='ml-1 mt-1 flex shrink-0 flex-col items-end gap-1'>
        {chat.unread > 0 ? (
          <span className='grid min-w-[20px] place-items-center rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-[0_0_12px_rgba(168,85,247,0.65)]'>
            {chat.unread}
          </span>
        ) : (
          <DeliveryIcon state={chat.delivered} />
        )}
        {chat.pinned && <Pin size={9} className='text-white/35' />}
      </div>
    </button>
  )
}
