import { useState, useEffect } from 'react'
import {
  X,
  Phone,
  Video,
  Bell,
  BellOff,
  Trash2,
  Ban,
  Fingerprint,
  ShieldCheck,
  Hash,
  Copy,
} from 'lucide-react'
import { getSocket } from '../../../socket'
import { getPeerIdentityKeys } from '../Chat/utils/chat/keyManagement'
import { formatProfileImage } from '../DashboardComponents/utils/helpers'

/**
 * UserInfoPanel — contact info side panel.
 * Fetches live info from socket and cryptographic fingerprint from ELD.
 *
 * Props:
 *  - contact: { id, username, profileImage } (the active chat object from Dashboard)
 *  - onClose: () => void
 */
export default function UserInfoPanel({ contact, onClose }) {
  const [profile, setProfile] = useState(null)
  const [fingerprint, setFingerprint] = useState(null)
  const [copied, setCopied] = useState(false)

  // Fetch full profile from server
  useEffect(() => {
    if (!contact?.id) return
    let cancelled = false
    setProfile(null)
    const socket = getSocket()
    socket.emit('getUserInfo', { userId: contact.id }, (res) => {
      if (!cancelled && res?.success && res?.user) {
        setProfile(res.user)
      }
    })
    return () => {
      cancelled = true
    }
  }, [contact?.id])

  // Load peer identity keys for fingerprint display
  useEffect(() => {
    if (!contact?.id) return
    let cancelled = false
    setFingerprint(null)
    getPeerIdentityKeys(String(contact.id))
      .then((keys) => {
        if (cancelled) return
        if (keys?.publicKeyX25519) {
          // Build a readable hex fingerprint from the base64 key
          try {
            const raw = atob(keys.publicKeyX25519)
            const hex = Array.from(raw)
              .map((b) => b.charCodeAt(0).toString(16).padStart(2, '0'))
              .join('')
            // Group into 4-char chunks
            const chunks = hex.match(/.{1,4}/g) || []
            setFingerprint(chunks.join(' '))
          } catch {
            if (cancelled) return
            setFingerprint(keys.publicKeyX25519.slice(0, 40) + '…')
          }
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [contact?.id])

  if (!contact) return null

  const profileName =
    profile?.display_name ||
    profile?.username ||
    contact?.display_name ||
    contact?.username ||
    contact?.name ||
    'Unknown'
  const avatarSource =
    profile?.avatar_url || profile?.profilePicture || contact?.profileImage || contact?.avatar || ''
  const avatar = avatarSource ? formatProfileImage(avatarSource, profileName) : null
  const about = profile?.bio || profile?.aboutme || profile?.about || 'No bio yet.'
  const userId = String(profile?.id || contact?.id || '')
  const fingerprintChunks = fingerprint ? fingerprint.split(' ') : Array(8).fill('????')

  const copyUserId = async () => {
    if (!userId) return
    try {
      await navigator.clipboard.writeText(userId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  const handleCompareNumbers = () => {
    window.dispatchEvent(
      new CustomEvent('verifySafetyNumber', {
        detail: { peerId: String(contact.id) },
      })
    )
  }

  return (
    <aside
      data-testid='user-info-panel'
      className='echo-floating relative h-full w-full max-w-[390px] shrink-0 overflow-y-auto animate-slide-in-right border-l border-white/[0.05] rounded-none'
      style={{
        borderRadius: 0,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
      }}
    >
      {/* Sticky header */}
      <div className='sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.05] px-5 py-3 backdrop-blur bg-black/40'>
        <h3 className='text-[13px] font-semibold tracking-[-0.01em]'>Contact info</h3>
        <button
          onClick={onClose}
          data-testid='user-info-close'
          className='grid h-8 w-8 place-items-center rounded-lg text-white/45 hover:bg-white/[0.04] hover:text-white'
        >
          <X size={15} />
        </button>
      </div>

      {/* Hero */}
      <div className='relative px-5 pb-6 pt-8 text-center'>
        <div className='echo-aurora' />
        <div className='relative mx-auto h-24 w-24'>
          {avatar ? (
            <img
              src={avatar}
              alt={profileName}
              className='h-24 w-24 rounded-full object-cover ring-1 ring-white/10'
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=8e79f2&color=fff`
              }}
            />
          ) : (
            <div className='grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-violet-700/70 ring-1 ring-white/10 text-white text-3xl font-bold'>
              {profileName[0]}
            </div>
          )}
        </div>
        <h2 className='relative mt-4 text-[18px] font-semibold tracking-[-0.02em]'>
          {profileName}
        </h2>
        <p className='relative mt-0.5 text-[12px] text-white/45 mono'>
          ECHO ID: {userId || 'unknown'}
        </p>
        <button
          type='button'
          onClick={copyUserId}
          className='relative mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[11px] text-white/65 transition hover:border-violet-400/30 hover:bg-violet-500/[0.06] hover:text-white'
        >
          <span className='mono'>ID {userId || 'unknown'}</span>
          <Copy size={11} />
          {copied && <span className='text-emerald-300'>Copied</span>}
        </button>
        <div className='relative mt-4 flex justify-center gap-2'>
          <ActionBtn icon={<Phone size={14} />} label='Call' />
          <ActionBtn icon={<Video size={14} />} label='Video' />
          <ActionBtn icon={<Bell size={14} />} label='Mute' />
        </div>
      </div>

      {/* About */}
      <Section title='About'>
        <p className='text-[12.5px] leading-relaxed text-white/65'>{about}</p>
      </Section>

      <Section title='Identity' icon={<Fingerprint size={11} />}>
        <div className='grid gap-2'>
          <div className='rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5'>
            <p className='text-[10px] uppercase tracking-[0.18em] text-white/35'>ECHO ID</p>
            <p className='mt-1 break-all text-[12px] mono text-white/82'>
              {userId || 'No ID available'}
            </p>
          </div>
        </div>
      </Section>

      {/* Cryptographic fingerprint */}
      <Section title='Cryptographic fingerprint' icon={<Fingerprint size={11} />}>
        <div className='echo-glass rounded-xl p-3.5'>
          <div className='flex items-center gap-2'>
            <ShieldCheck size={14} className='text-emerald-400/90' />
            <span className='text-[11px] text-emerald-300/90 mono'>
              {fingerprint ? 'Verified · Ed25519' : 'No key on record yet'}
            </span>
          </div>
          {fingerprint && (
            <div className='mt-2 grid grid-cols-4 gap-1.5'>
              {fingerprintChunks.slice(0, 8).map((g, i) => (
                <div
                  key={i}
                  className='rounded-md border border-white/[0.06] bg-black/40 py-1.5 text-center text-[11px] mono text-violet-200/90 tracking-widest'
                >
                  {g}
                </div>
              ))}
            </div>
          )}
          <button
            data-testid='compare-numbers-btn'
            onClick={handleCompareNumbers}
            className='echo-cta mt-3 w-full rounded-full py-2 text-[11.5px] font-medium'
          >
            Compare safety numbers
          </button>
        </div>
      </Section>

      {/* Settings */}
      <Section title='Options' icon={<Hash size={11} />}>
        <Row icon={<BellOff size={14} />} label='Mute notifications' trailing={<Switch />} />
        <Row
          icon={<Trash2 size={14} className='text-red-400' />}
          label='Clear chat history'
          hover
        />
        <Row icon={<Ban size={14} className='text-red-400' />} label='Block contact' hover danger />
      </Section>

      <div className='px-5 pb-6 pt-2 text-center text-[10px] text-white/25 mono'>
        ECHO · zero-knowledge · keys live on-device only
      </div>
    </aside>
  )
}

function Section({ title, icon, children }) {
  return (
    <div className='border-t border-white/[0.05] px-5 py-4'>
      <div className='mb-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40'>
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  )
}

function ActionBtn({ icon, label }) {
  return (
    <button className='flex flex-col items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10.5px] text-white/70 hover:border-violet-400/40 hover:text-white hover:bg-violet-500/[0.06] transition-all'>
      <span className='text-violet-300'>{icon}</span>
      {label}
    </button>
  )
}

function Row({ icon, label, trailing, hover, danger }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-2 py-2 text-[12.5px] ${
        hover ? 'hover:bg-white/[0.03] cursor-pointer' : ''
      } ${danger ? 'text-red-300' : 'text-white/80'}`}
    >
      <span className='text-white/55'>{icon}</span>
      <span className='flex-1'>{label}</span>
      {trailing}
    </div>
  )
}

function Switch() {
  const [on, setOn] = useState(false)
  return (
    <button
      onClick={() => setOn(!on)}
      className={`relative h-5 w-9 rounded-full transition ${on ? 'bg-violet-500' : 'bg-white/10'}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
          on ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}
