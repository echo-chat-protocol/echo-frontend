import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, MessageSquareText, Loader2 } from 'lucide-react'
import PropTypes from 'prop-types'
import { UsersService } from '@services'
import { formatProfileImage } from '../utils/helpers'

/**
 * NewChatModal — search any user by username and start a DM,
 * even if they are not in your contacts list.
 */
export default function NewChatModal({ open, onClose, onStartChat }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  // Auto-focus input when modal opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSearched(false)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open])

  const doSearch = useCallback(async (term) => {
    const trimmed = term.trim()
    if (!trimmed) {
      setResults([])
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)

    try {
      const res = await UsersService.search({ searchTerm: trimmed })
      console.log('[NewChatModal] /users/search response:', res)
      const users = (res?.users || []).map((u) => ({
        ...u,
        profileImage: formatProfileImage(u.profilePicture, u.username),
      }))
      setResults(users)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 400)
  }

  const handleSelect = (user) => {
    onStartChat({ id: user.id, username: user.username, profileImage: user.profileImage })
    onClose()
  }

  const handleKey = (e) => {
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    /* Backdrop */
    <div
      className='fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[10vh]'
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKey}
      role='dialog'
      aria-modal='true'
      aria-label='New chat'
    >
      {/* Panel */}
      <div className='echo-floating w-full max-w-[480px] mx-4 rounded-2xl border border-white/[0.08] bg-[#0d0d0f] shadow-[0_24px_64px_rgba(0,0,0,0.7)] overflow-hidden animate-fade-in'>
        {/* Header */}
        <div className='flex items-center justify-between px-5 pt-5 pb-3'>
          <h2 className='text-[15px] font-semibold tracking-[-0.01em]'>New conversation</h2>
          <button
            onClick={onClose}
            className='grid h-7 w-7 place-items-center rounded-full text-white/40 hover:bg-white/[0.06] hover:text-white transition-all'
          >
            <X size={14} />
          </button>
        </div>

        {/* Search input */}
        <div className='px-5 pb-4'>
          <div className='relative'>
            <Search
              size={14}
              className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35'
            />
            {loading && (
              <Loader2
                size={13}
                className='absolute right-3.5 top-1/2 -translate-y-1/2 text-violet-400 animate-spin'
              />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={handleChange}
              placeholder='Search by username…'
              className='echo-input w-full rounded-xl py-2.5 pl-9 pr-9 text-[13px] echo-focus-ring'
            />
          </div>
        </div>

        {/* Results */}
        <div className='px-3 pb-4 max-h-[340px] overflow-y-auto'>
          {!searched && (
            <p className='py-8 text-center text-[12.5px] text-white/30'>
              Type a username to start searching
            </p>
          )}

          {searched && !loading && results.length === 0 && (
            <p className='py-8 text-center text-[12.5px] text-white/30'>
              No user found for <span className='text-white/60'>&ldquo;{query}&rdquo;</span>
            </p>
          )}

          {results.map((user) => (
            <div
              key={user.id}
              className='echo-hover-lift flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3 cursor-pointer group'
              onClick={() => handleSelect(user)}
            >
              {user.profileImage ? (
                <img
                  src={user.profileImage}
                  alt={user.username}
                  className='h-10 w-10 rounded-full object-cover ring-1 ring-white/10'
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${user.username}&background=8e79f2&color=fff`
                  }}
                />
              ) : (
                <div className='grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-violet-700/70 text-white text-[14px] font-semibold'>
                  {user.username?.[0]?.toUpperCase()}
                </div>
              )}

              <div className='min-w-0 flex-1'>
                <div className='truncate text-[13.5px] font-medium'>{user.username}</div>
                <div className='text-[11.5px] text-white/35 mono'>{user.id?.slice(0, 8)}…</div>
              </div>

              <span className='inline-flex items-center gap-1.5 rounded-full bg-violet-500/[0.12] px-3 py-1 text-[11px] text-violet-300 group-hover:bg-violet-500/20 transition-all'>
                <MessageSquareText size={11} /> Message
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

NewChatModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onStartChat: PropTypes.func.isRequired,
}
