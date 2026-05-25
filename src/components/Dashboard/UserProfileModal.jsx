import { useEffect, useState } from 'react'
import {
  X,
  Camera,
  ChevronRight,
  Fingerprint,
  ShieldCheck,
  LogOut,
  Bell,
  Lock,
  Eye,
  Globe,
} from 'lucide-react'

export default function UserProfileModal({ user = {}, open, onClose = () => {} }) {
  const [name, setName] = useState(user.name || user.username || '')
  const [about, setAbout] = useState(user.about || '')

  useEffect(() => {
    if (!open) return
    setName(user.name || user.username || '')
    setAbout(user.about || '')
  }, [open, user.name, user.username, user.about])

  if (!open) return null
  return (
    <div
      data-testid='profile-modal'
      className='fixed inset-0 z-50 grid place-items-center p-4 animate-fade-in'
      onClick={onClose}
    >
      <div className='absolute inset-0 bg-black/70 backdrop-blur-sm' />
      <div
        onClick={(e) => e.stopPropagation()}
        className='relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0e] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] animate-fade-up'
      >
        {/* Header glow */}
        <div className='relative h-32 overflow-hidden'>
          <div className='echo-aurora opacity-90' />
          <div className='absolute inset-0 echo-stars opacity-50' />
          <button
            onClick={onClose}
            className='absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-black/40 text-white/65 hover:text-white'
          >
            <X size={14} />
          </button>
        </div>

        <div className='px-7 pb-7'>
          {/* Avatar */}
          <div className='-mt-12 flex items-end gap-4'>
            <div className='relative'>
              <img
                src={user.avatar || user.profileImage}
                alt={user.name || user.username || 'Profile'}
                className='h-24 w-24 rounded-2xl object-cover ring-2 ring-[#0a0a0e]'
              />
              <button className='absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-lg echo-violet-gradient echo-violet-glow'>
                <Camera size={13} className='text-white' />
              </button>
            </div>
            <div className='pb-2'>
              <h2 className='text-[18px] font-semibold tracking-[-0.02em]'>My profile</h2>
              <p className='text-[11.5px] text-white/40 mono'>
                {user.fingerprint?.slice(0, 19) || 'No fingerprint'}…
              </p>
            </div>
          </div>

          {/* Form */}
          <div className='mt-6 space-y-4'>
            <Field label='Display name' hint='This is how others see you on ECHO.'>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className='echo-input w-full rounded-xl px-3.5 py-2.5 text-[13.5px] echo-focus-ring'
              />
            </Field>
            <Field label='ECHO handle'>
              <div className='echo-input flex w-full items-center rounded-xl px-3.5 py-2.5 text-[13.5px] mono text-white/80'>
                <span className='text-white/35 mr-1'>@</span>
                <span>{user.handle}</span>
              </div>
            </Field>
            <Field label='About' hint='Markdown supported. Visible only to your contacts.'>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                rows={3}
                className='echo-input w-full rounded-xl px-3.5 py-2.5 text-[13.5px] echo-focus-ring resize-none'
              />
            </Field>
          </div>

          {/* Crypto identity */}
          <div className='mt-6 echo-glass rounded-xl p-4'>
            <div className='mb-2 flex items-center gap-2'>
              <Fingerprint size={13} className='text-violet-300' />
              <span className='text-[10.5px] uppercase tracking-[0.18em] text-white/55'>
                Your cryptographic identity
              </span>
              <span className='ml-auto inline-flex items-center gap-1 text-[10px] text-emerald-300 mono'>
                <ShieldCheck size={11} /> verified
              </span>
            </div>
            <div className='grid grid-cols-4 gap-1.5'>
              {(user.fingerprint?.split(' ') || Array(8).fill('????')).map((g, i) => (
                <div
                  key={i}
                  className='rounded-md border border-white/[0.06] bg-black/40 py-1.5 text-center text-[11px] mono text-violet-200/90 tracking-widest'
                >
                  {g}
                </div>
              ))}
            </div>
            <p className='mt-2.5 text-[11px] text-white/40'>
              Keys live on this device only. Argon2id · X25519 · Ed25519.
            </p>
          </div>

          {/* Quick settings */}
          <div className='mt-5 grid grid-cols-2 gap-2'>
            <PrefRow icon={<Bell size={14} />} label='Notifications' />
            <PrefRow icon={<Lock size={14} />} label='Privacy' />
            <PrefRow icon={<Eye size={14} />} label='Read receipts' trailing='On' />
            <PrefRow icon={<Globe size={14} />} label='Language' trailing='EN' />
          </div>

          {/* Footer */}
          <div className='mt-6 flex items-center justify-between gap-3'>
            <button className='inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/[0.05] px-4 py-2.5 text-[12.5px] text-red-300 hover:border-red-500/40 hover:bg-red-500/[0.1] transition'>
              <LogOut size={14} /> Sign out
            </button>
            <div className='flex gap-2'>
              <button
                onClick={onClose}
                className='rounded-full border border-white/[0.08] bg-white/[0.02] px-5 py-2.5 text-[12.5px] text-white/65 hover:bg-white/[0.04] hover:text-white'
              >
                Cancel
              </button>
              <button
                onClick={onClose}
                data-testid='profile-save-btn'
                className='echo-cta rounded-full px-6 py-2.5 text-[12.5px] font-medium'
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className='mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.16em] text-white/45'>
        {label}
        {hint && (
          <span className='text-[10px] normal-case tracking-normal text-white/30'>{hint}</span>
        )}
      </label>
      {children}
    </div>
  )
}

function PrefRow({ icon, label, trailing }) {
  return (
    <button className='flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[12.5px] text-white/75 hover:border-violet-400/30 hover:bg-violet-500/[0.04] transition'>
      <span className='text-violet-300'>{icon}</span>
      <span className='flex-1 text-left'>{label}</span>
      {trailing && <span className='text-[10px] mono text-white/40'>{trailing}</span>}
      <ChevronRight size={13} className='text-white/30' />
    </button>
  )
}
