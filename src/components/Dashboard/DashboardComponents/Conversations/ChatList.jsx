import { useMemo, useState, useEffect, useRef } from 'react'
import { Search, Pin, Bot, UsersRound, CheckCheck, Check, Plus, Loader2 } from 'lucide-react'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'groups', label: 'Groups' },
]

// Pull-to-refresh tuning. RESISTANCE < 1 means the finger must travel more than
// the visual pull distance, so a light/accidental drag won't reach THRESHOLD —
// triggering needs deliberate force. The wheel completes exactly one full turn
// (360°) at THRESHOLD.
const PTR_THRESHOLD = 95
const PTR_MAX_PULL = 135
const PTR_RESISTANCE = 0.5

function DeliveryIcon({ state }) {
  if (state === 'read')
    return (
      <CheckCheck
        size={17}
        strokeWidth={3}
        className='text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]'
      />
    )
  if (state === 'delivered')
    return <CheckCheck size={15} className='text-white/35' strokeWidth={2.2} />
  if (state === 'sent') return <Check size={15} className='text-white/35' strokeWidth={2.2} />
  return null
}

function Avatar({ src, name, isBot, isGroup }) {
  if (isBot) {
    return (
      <div className='grid h-[53px] w-[53px] place-items-center rounded-full echo-violet-gradient ring-1 ring-violet-300/40 echo-violet-glow'>
        <Bot size={24} className='text-white' />
      </div>
    )
  }
  if (isGroup || !src) {
    return (
      <div className='grid h-[53px] w-[53px] place-items-center rounded-full bg-gradient-to-br from-indigo-500/40 to-violet-700/60 ring-1 ring-white/10'>
        {isGroup ? (
          <UsersRound size={21} className='text-white/90' />
        ) : (
          <span className='text-white font-semibold text-[15px]'>{(name || '?')?.[0]}</span>
        )}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={name}
      className='h-[53px] w-[53px] rounded-full object-cover ring-1 ring-white/10'
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
  onCreatePeer,
  registerOpenAddMenu,
  onRefresh,
}) {
  const [tab, setTab] = useState('all')
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef(null)

  // ── Pull-to-refresh (drops down from under the tabs) ────────────────────────
  const listRef = useRef(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)

  useEffect(() => {
    const el = listRef.current
    if (!el) return

    let startX = 0
    let startY = 0
    let active = false
    let rawDy = 0
    let intentLocked = false
    let verticalIntent = false

    const onStart = (e) => {
      if (refreshingRef.current) return
      // Only start a pull when the list is already scrolled to the very top.
      if (el.scrollTop > 0) return
      const touch = e.touches && e.touches[0]
      if (!touch) return
      startX = touch.clientX
      startY = touch.clientY
      rawDy = 0
      active = true
      intentLocked = false
      verticalIntent = false
    }

    const onMove = (e) => {
      if (!active || refreshingRef.current) return
      if (el.scrollTop > 0) {
        active = false
        setPullDistance(0)
        return
      }
      const touch = e.touches && e.touches[0]
      if (!touch) return
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (!intentLocked) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        intentLocked = true
        verticalIntent = dy > 0 && Math.abs(dy) > Math.abs(dx)
        if (!verticalIntent) {
          active = false
          rawDy = 0
          setPullDistance(0)
          return
        }
      }
      if (dy <= 0) {
        rawDy = 0
        setPullDistance(0)
        return
      }
      rawDy = dy
      const dist = Math.min(PTR_MAX_PULL, dy * PTR_RESISTANCE)
      setPullDistance(dist)
      // Stop the native overscroll/bounce so our indicator owns the gesture.
      if (dist > 2 && e.cancelable) e.preventDefault()
    }

    const finish = async () => {
      if (!active) return
      active = false
      const dist = Math.min(PTR_MAX_PULL, rawDy * PTR_RESISTANCE)
      rawDy = 0
      if (dist < PTR_THRESHOLD) {
        setPullDistance(0)
        return
      }
      setRefreshing(true)
      refreshingRef.current = true
      setPullDistance(PTR_THRESHOLD)
      try {
        if (typeof onRefresh === 'function') {
          await onRefresh()
        } else {
          window.location.reload()
          return
        }
      } catch {
        /* ignore — still reset the indicator below */
      }
      refreshingRef.current = false
      setRefreshing(false)
      setPullDistance(0)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', finish, { passive: true })
    el.addEventListener('touchcancel', finish, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', finish)
      el.removeEventListener('touchcancel', finish)
    }
  }, [onRefresh])

  // Wheel finishes exactly one full turn at the trigger threshold; opacity fades
  // in over the first half of the pull so a tiny accidental drag stays subtle.
  const ptrRotation = refreshing ? 0 : (pullDistance / PTR_THRESHOLD) * 360
  const ptrOpacity = Math.min(1, pullDistance / (PTR_THRESHOLD * 0.5))
  const ptrHeight = refreshing ? PTR_THRESHOLD : pullDistance

  // Close the add menu on outside click (mobile)
  useEffect(() => {
    const onDocClick = (e) => {
      if (!addMenuOpen) return
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
        setAddMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [addMenuOpen])

  // Allow parent to programmatically open the add menu (unify sidebar + button behavior)
  useEffect(() => {
    if (typeof registerOpenAddMenu === 'function') {
      registerOpenAddMenu(() => setAddMenuOpen(true))
    }
  }, [registerOpenAddMenu])

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
    <div
      className='echo-floating relative flex h-full w-full md:w-[300px] lg:w-[340px] xl:w-[380px] shrink-0 flex-col overflow-hidden'
      style={{ touchAction: 'pan-y', overscrollBehaviorX: 'none' }}
    >
      {/* Title row (mobile menu + title aligned) */}
      <div
        className='px-4 md:pt-5 md:px-5 flex items-center justify-between'
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <h2 className='echo-display text-[22px]'>Conversations</h2>
        <span className='md:hidden h-8 w-8' aria-hidden='true' />
      </div>

      {/* Search row */}
      <div className='mt-4 px-4 md:px-5 flex items-center gap-3 md:gap-2'>
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
            className='echo-input w-full rounded-full h-12 pl-11 pr-4 text-[14px] echo-focus-ring'
          />
        </div>
        {onCreateGroup && (
          <div className='relative' ref={addMenuRef}>
            <button
              onClick={() => setAddMenuOpen((v) => !v)}
              title='New'
              className='grid h-12 w-12 shrink-0 place-items-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition'
              aria-haspopup='menu'
              aria-expanded={addMenuOpen ? 'true' : 'false'}
            >
              <Plus size={16} />
            </button>

            {/* Add menu (mobile and desktop) */}
            <div
              className={`absolute right-0 top-full mt-2 z-30 w-40 overflow-hidden rounded-xl border border-white/10 bg-[#0b0b10] shadow-[0_16px_60px_rgba(0,0,0,0.6)] origin-top transform-gpu transition-[opacity,transform] duration-200 ease-out ${addMenuOpen ? 'opacity-100 scale-y-100' : 'pointer-events-none opacity-0 scale-y-95'}`}
              role='menu'
            >
              <button
                role='menuitem'
                className='w-full px-3 py-2 text-left text-[13px] text-white/85 hover:bg-white/[0.06]'
                onClick={() => {
                  setAddMenuOpen(false)
                  onCreatePeer?.()
                }}
              >
                Peer
              </button>
              <button
                role='menuitem'
                className='w-full px-3 py-2 text-left text-[13px] text-white/85 hover:bg-white/[0.06]'
                onClick={() => {
                  setAddMenuOpen(false)
                  onCreateGroup?.()
                }}
              >
                Group
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs — sized up ~25% for easier tapping */}
      <div className='pt-4 px-4 md:pt-4 md:px-5'>
        <div className='relative flex items-center gap-5 md:gap-7 border-b border-white/[0.05]'>
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                data-testid={`chatlist-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`relative pb-2.5 pt-0.5 text-[14.5px] font-medium transition-colors ${
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

      {/* Pull-to-refresh indicator — drops down from directly under the tabs */}
      <div
        className='flex shrink-0 items-end justify-center overflow-hidden'
        style={{
          height: `${ptrHeight}px`,
          transition: pullDistance > 0 && !refreshing ? 'none' : 'height 220ms ease-out',
        }}
        aria-hidden={ptrHeight === 0}
      >
        <div className='pb-2'>
          <Loader2
            size={22}
            strokeWidth={2.4}
            className={`text-violet-300 ${refreshing ? 'animate-spin' : ''}`}
            style={
              refreshing
                ? { filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.6))' }
                : {
                    transform: `rotate(${ptrRotation}deg)`,
                    opacity: ptrOpacity,
                    filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.45))',
                  }
            }
          />
        </div>
      </div>

      {/* List */}
      <div
        ref={listRef}
        className='mt-2 md:mt-3 flex-1 overflow-y-auto overscroll-y-contain px-1 pb-3 md:px-2 md:pb-4'
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          touchAction: 'pan-y',
          overscrollBehaviorX: 'none',
        }}
      >
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
  const showTypingLabel = chat.typingText && chat.typingText !== 'typing…'

  return (
    <button
      data-testid={`chat-row-${chat.id}`}
      onClick={onClick}
      className={`group relative my-1 flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
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
          <span className='truncate text-[16px] font-medium tracking-[-0.01em] text-white'>
            {chat.name}
          </span>
          <span className='shrink-0 text-[13px] text-white/35 mono'>{chat.time}</span>
        </div>
        <div className='mt-0.5 flex items-center gap-1.5'>
          {chat.typing ? (
            <span
              className={`flex min-h-5 min-w-0 items-center gap-1 text-[14px] leading-5 text-violet-300 ${
                showTypingLabel ? '' : 'translate-y-0.5'
              }`}
            >
              <span className='shrink-0 typing-dot' />
              <span className='shrink-0 typing-dot' />
              <span className='shrink-0 typing-dot' />
              {showTypingLabel ? <span className='ml-1 truncate'>{chat.typingText}</span> : null}
            </span>
          ) : (
            <p className='truncate text-[14px] text-white/45'>{chat.last}</p>
          )}
        </div>
      </div>

      <div className='ml-1 mt-1 flex shrink-0 flex-col items-end gap-1'>
        {chat.unread > 0 ? (
          <span className='grid min-w-[25px] place-items-center rounded-full bg-violet-500 px-2.5 py-0.5 text-[12.5px] font-semibold text-white shadow-[0_0_12px_rgba(168,85,247,0.65)]'>
            {chat.unread}
          </span>
        ) : (
          <DeliveryIcon state={chat.delivered} />
        )}
        {chat.pinned && <Pin size={11} className='text-white/35' />}
      </div>
    </button>
  )
}
