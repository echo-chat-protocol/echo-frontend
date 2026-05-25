import {
  MessageSquareText,
  Users,
  UsersRound,
  Settings,
  LogOut,
  Plus,
  ChevronLeft,
  Smartphone,
} from 'lucide-react'
import PropTypes from 'prop-types'

const NAV = [
  { id: 'chats', label: 'Chats', icon: MessageSquareText },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'groups', label: 'Groups', icon: UsersRound },
  { id: 'settings', label: 'Settings', icon: Settings },
]

/* Echo logo (matches landing) */
function EchoMark({ size = 30 }) {
  return (
    <img
      src='/echo-logo.svg'
      alt='ECHO Logo'
      style={{ width: size, height: size }}
      className='object-contain'
    />
  )
}

EchoMark.propTypes = {
  size: PropTypes.number,
}

const getConsistentColor = (username = '') => {
  const colors = ['FF5733', '33FF57', '3357FF', 'F033FF', 'FF33F0']
  const index = username.length % colors.length
  return colors[index]
}

export default function Sidebar({
  active,
  onChange,
  user,
  collapsed,
  onToggleCollapsed,
  onOpenProfile,
  onOpenDeviceSync,
  onLogout,
  unreadMessages = {},
  onNewChat,
}) {
  const totalUnread = Object.values(unreadMessages).reduce((a, b) => a + b, 0)

  return (
    <aside
      data-testid='echo-sidebar'
      className={`echo-floating relative flex h-full shrink-0 flex-col items-stretch transition-[width] duration-300 ease-out border-r border-white/[0.06] ${
        collapsed ? 'w-[78px]' : 'w-[230px]'
      }`}
    >
      {/* Brand — matches landing nav style */}
      <div className='flex items-center gap-2.5 px-5 pt-6 pb-5'>
        <EchoMark size={28} />
        {!collapsed && (
          <div className='leading-tight animate-fade-in'>
            <div className='text-[15px] font-semibold tracking-[-0.04em]'>ECHO</div>
            <div className='text-[9.5px] uppercase tracking-[0.22em] text-white/35 mono mt-0.5'>
              v3.2.0
            </div>
          </div>
        )}
      </div>

      <div className='mx-5 mb-4 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent' />

      {/* New chat CTA — landing pill style */}
      <div className='px-3.5'>
        <button
          data-testid='sidebar-compose-btn'
          onClick={onNewChat}
          className='echo-cta group inline-flex w-full items-center justify-center gap-2 rounded-full px-3.5 py-2.5 text-[12.5px] font-medium'
        >
          <Plus size={15} strokeWidth={2.4} />
          {!collapsed && <span className='animate-fade-in'>New chat</span>}
        </button>
      </div>

      {/* Nav — left accent bar, no pill bg */}
      <nav className='mt-5 flex flex-col px-2.5 gap-1'>
        {NAV.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              data-testid={`sidebar-${id}`}
              onClick={() => onChange(id)}
              className={`group relative flex items-center gap-3 px-4 py-2.5 transition-colors rounded-xl hover:bg-white/[0.02] ${
                isActive ? 'text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {/* Left accent bar */}
              <span
                aria-hidden
                className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full transition-all ${
                  isActive
                    ? 'bg-violet-400 shadow-[0_0_10px_rgba(168,85,247,0.85)]'
                    : 'bg-transparent group-hover:bg-white/15'
                }`}
              />
              <Icon size={16.5} strokeWidth={1.6} className={isActive ? 'text-violet-300' : ''} />
              {!collapsed && (
                <span className='text-[12.5px] font-medium tracking-[-0.01em] animate-fade-in'>
                  {label}
                </span>
              )}

              {/* Unread badge */}
              {id === 'chats' && totalUnread > 0 && (
                <span
                  className={`absolute bg-violet-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ${
                    collapsed ? 'top-1 right-2 h-4 w-4' : 'right-4 h-4 min-w-[16px] px-1'
                  }`}
                >
                  {totalUnread}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer — terminal ticker */}
      <div className='mt-auto px-5 pb-3'>
        {!collapsed && (
          <div className='mb-3 flex flex-col gap-1.5 animate-fade-in'>
            <div className='mono flex items-center gap-2 text-[9.5px] uppercase tracking-[0.22em] text-emerald-300/80'>
              <span className='h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.7)] animate-pulse' />
              256<span className='text-white/25'>·</span>bit · sealed
            </div>
            <div className='mono text-[10px] tracking-[0.05em] text-white/30 leading-relaxed'>
              <span className='text-white/55'>argon2id</span>
              <span className='text-white/25'> / </span>
              <span className='text-white/55'>x25519</span>
            </div>
          </div>
        )}
      </div>

      <button
        data-testid='sidebar-collapse-btn'
        onClick={onToggleCollapsed}
        className='mx-3.5 mb-2 flex items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.015] py-1.5 text-white/45 hover:border-violet-400/40 hover:text-white transition-all'
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        <ChevronLeft
          size={13}
          className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
        />
      </button>

      <button
        data-testid='sidebar-device-sync-btn'
        onClick={onOpenDeviceSync}
        className='mx-3.5 mb-2 flex items-center justify-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.015] py-1.5 text-white/45 hover:border-violet-400/40 hover:text-white transition-all'
        title='Device sync'
      >
        <Smartphone size={13} />
        {!collapsed && <span className='text-[11px] animate-fade-in'>Device sync</span>}
      </button>

      {/* Profile */}
      <div
        data-testid='sidebar-profile'
        className='mx-2.5 mb-3 flex items-center gap-3 rounded-2xl border border-transparent p-2 text-left transition-all hover:border-white/[0.07] hover:bg-white/[0.02]'
      >
        <button
          onClick={onOpenProfile}
          className='relative shrink-0 focus:outline-none group/avatar'
          title='View profile'
        >
          <img
            src={
              user.avatar ||
              `https://ui-avatars.com/api/?name=${user.name}&background=${getConsistentColor(user.name)}&color=fff`
            }
            alt={user.name}
            className='h-9 w-9 rounded-full object-cover ring-1 ring-white/10 group-hover/avatar:ring-violet-400 transition-all'
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${user.name}&background=${getConsistentColor(user.name)}&color=fff`
            }}
          />
          <span className='absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-black bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.7)]' />
        </button>

        {!collapsed && (
          <button
            onClick={onOpenProfile}
            className='min-w-0 flex-1 text-left focus:outline-none animate-fade-in'
          >
            <div className='truncate text-[12.5px] font-medium leading-tight text-white hover:text-violet-300 transition-colors'>
              {user.name}
            </div>
            <div className='truncate text-[9.5px] uppercase tracking-[0.18em] text-emerald-400/80 mono mt-0.5'>
              Online
            </div>
          </button>
        )}

        {!collapsed && (
          <button
            onClick={onLogout}
            className='ml-auto p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all animate-fade-in'
            title='Log out'
          >
            <LogOut size={13} />
          </button>
        )}
      </div>
    </aside>
  )
}

Sidebar.propTypes = {
  active: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  user: PropTypes.shape({
    name: PropTypes.string.isRequired,
    avatar: PropTypes.string,
  }).isRequired,
  collapsed: PropTypes.bool.isRequired,
  onToggleCollapsed: PropTypes.func.isRequired,
  onOpenProfile: PropTypes.func.isRequired,
  onOpenDeviceSync: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  unreadMessages: PropTypes.object,
  onNewChat: PropTypes.func,
}
