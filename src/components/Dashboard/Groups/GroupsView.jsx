import { Plus, UsersRound, ShieldCheck, Menu } from 'lucide-react'
import PropTypes from 'prop-types'

function GroupsView({ onCreate, groups, onOpenMenu }) {
  return (
    <div className='echo-floating relative flex flex-1 flex-col overflow-hidden'>
      {/* ── Header ── */}
      <div className='border-b border-white/[0.05] px-4 md:px-10 pb-5 pt-4 md:pt-9 md:pb-6'>
        <div className='flex items-center gap-3'>
          {/* Mobile hamburger */}
          {onOpenMenu && (
            <button
              onClick={onOpenMenu}
              aria-label='Open menu'
              className='md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.04] text-white/70 transition-all active:scale-95 hover:text-white'
            >
              <Menu size={17} />
            </button>
          )}

          <div className='flex-1 min-w-0'>
            <h1 className='echo-display text-[24px] md:text-[34px] leading-tight'>
              <span className='echo-text-gradient'>Encrypted</span> groups.
            </h1>
            <p className='mt-1 md:mt-2 text-[12px] md:text-[13px] text-white/45 hidden sm:block'>
              Sealed-sender, MLS-style ratchets — zero metadata leakage.
            </p>
          </div>

          <button
            data-testid='create-group-btn'
            onClick={onCreate}
            className='echo-cta shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 md:px-5 py-2 md:py-2.5 text-[12px] md:text-[13px] font-medium'
          >
            <Plus size={14} />
            <span className='hidden sm:inline'>New group</span>
            <span className='sm:hidden'>New</span>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className='flex-1 overflow-y-auto px-3 md:px-10 py-4 md:py-7'>
        {groups.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full gap-4 text-white/40 py-16'>
            <UsersRound size={48} strokeWidth={1.2} />
            <p className='text-[13px] md:text-[14px] text-center px-4'>
              No groups yet — create one to get started.
            </p>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-3 md:gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {groups.map((g) => (
              <div
                key={g.groupId ?? g.id}
                className='echo-hover-lift relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 md:p-5 cursor-pointer'
              >
                <div className='echo-aurora opacity-30' />
                <div className='relative flex items-start gap-3'>
                  <div className='grid h-11 w-11 md:h-12 md:w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/40 to-violet-700/70 ring-1 ring-white/10'>
                    {g.profilePicture ? (
                      <img
                        src={g.profilePicture}
                        alt={g.name}
                        className='h-11 w-11 md:h-12 md:w-12 rounded-2xl object-cover'
                      />
                    ) : (
                      <UsersRound size={19} className='text-white/95' />
                    )}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-[13.5px] md:text-[14px] font-semibold tracking-[-0.01em]'>
                      {g.name || 'Group'}
                    </div>
                    <div className='text-[11px] md:text-[11.5px] text-white/45'>
                      {g.members ?? g.memberCount ?? '—'} members
                    </div>
                  </div>
                  {(g.unread > 0 || g.unreadCount > 0) && (
                    <span className='grid min-w-[20px] place-items-center rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-[0_0_12px_rgba(168,85,247,0.55)]'>
                      {g.unread ?? g.unreadCount}
                    </span>
                  )}
                </div>

                {g.lastActivityText && (
                  <div className='relative mt-3 truncate text-[12px] md:text-[12.5px] text-white/55'>
                    {g.lastFrom && <span className='text-violet-300/85'>{g.lastFrom}: </span>}
                    {g.lastActivityText}
                  </div>
                )}

                <div className='relative mt-3 md:mt-4 flex items-center justify-between text-[10px] md:text-[10.5px] text-white/35 font-mono'>
                  <span className='inline-flex items-center gap-1 text-emerald-300/80'>
                    <ShieldCheck size={10} /> sealed
                  </span>
                  <span>
                    {g.lastActivityAt
                      ? new Date(g.lastActivityAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : (g.time ?? '')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

GroupsView.propTypes = {
  onCreate: PropTypes.func.isRequired,
  groups: PropTypes.array.isRequired,
  onOpenMenu: PropTypes.func,
}

export default GroupsView
