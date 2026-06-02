import { useState, useEffect } from 'react'
import { X, Phone, Video, ImageIcon, Copy } from 'lucide-react'
import { getSocket } from '../../../socket'
import { formatProfileImage } from '../DashboardComponents/utils/helpers'
import ImageLightbox from '../Chat/MessageDisplay/ImageLightbox'
import eld from '../../../utils/storage/EncryptedLocalDatabase'

/**
 * UserInfoPanel — contact info side panel.
 * Fetches the contact's live profile (incl. their description) from the server
 * and lists all media exchanged in the conversation from the local store.
 *
 * Props:
 *  - contact: { id, username, profileImage } (the active chat object from Dashboard)
 *  - onClose: () => void
 */
export default function UserInfoPanel({ contact, onClose }) {
  const [profile, setProfile] = useState(null)
  const [media, setMedia] = useState([])
  const [activeMedia, setActiveMedia] = useState(null)
  const [copied, setCopied] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

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

  // Load every media message exchanged with this contact from the local store,
  // newest first. Refreshes whenever a new message is persisted for this peer.
  useEffect(() => {
    if (!contact?.id) return
    let cancelled = false

    const load = async () => {
      try {
        if (!eld.isUnlocked?.()) return
        const msgs = await eld.getMessages(String(contact.id))
        if (cancelled) return
        const withMedia = (msgs || [])
          .filter((m) => m?.image)
          .sort(
            (a, b) =>
              new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0)
          )
        setMedia(withMedia)
      } catch {
        /* local store unavailable — leave media empty */
      }
    }

    setMedia([])
    load()

    const onUpdate = (e) => {
      const target = e?.detail?.targetUserId
      if (target == null || String(target) === String(contact.id)) load()
    }
    window.addEventListener('localStorageUpdated', onUpdate)

    return () => {
      cancelled = true
      window.removeEventListener('localStorageUpdated', onUpdate)
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
  // The user's profile description (saved as `bio`, persisted server-side as
  // `aboutme`). Falls back through the aliases before the empty placeholder.
  const about = profile?.bio || profile?.aboutme || profile?.about || 'No bio yet.'
  const userId = String(profile?.id || contact?.id || '')

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

  return (
    <>
      {/* Backdrop — overlays the chat instead of squishing it. */}
      <button
        type='button'
        aria-label='Close contact info'
        onClick={onClose}
        className='fixed inset-0 z-40 bg-black/50 backdrop-blur-sm'
      />

      <aside
        data-testid='user-info-panel'
        className='echo-floating fixed inset-y-0 right-0 z-50 h-full w-full max-w-[390px] overflow-y-auto animate-slide-in-right border-l border-white/[0.05] rounded-none'
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
              <button
                type='button'
                onClick={() => setLightboxOpen(true)}
                title='View photo'
                aria-label='View photo'
                className='block h-24 w-24 cursor-zoom-in rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60'
              >
                <img
                  src={avatar}
                  alt={profileName}
                  className='h-24 w-24 rounded-full object-cover ring-1 ring-white/10 transition hover:ring-violet-400/40'
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=8e79f2&color=fff`
                  }}
                />
              </button>
            ) : (
              <div className='grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-violet-700/70 ring-1 ring-white/10 text-white text-3xl font-bold'>
                {profileName[0]}
              </div>
            )}
          </div>
          <h2 className='relative mt-4 text-[18px] font-semibold tracking-[-0.02em]'>
            {profileName}
          </h2>
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
          </div>
        </div>

        {/* About */}
        <Section title='About'>
          <p className='text-[12.5px] leading-relaxed text-white/65'>{about}</p>
        </Section>

        {/* Media — every photo/GIF exchanged in this conversation. */}
        <Section title='Media' icon={<ImageIcon size={11} />}>
          {media.length === 0 ? (
            <p className='text-[12px] text-white/40'>No media shared yet.</p>
          ) : (
            <div className='grid grid-cols-3 gap-1.5'>
              {media.map((m) => (
                <button
                  key={m._id || m.image}
                  type='button'
                  onClick={() => setActiveMedia(m.image)}
                  title='View media'
                  className='group relative aspect-square overflow-hidden rounded-lg border border-white/[0.06] bg-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60'
                >
                  <img
                    src={m.image}
                    alt=''
                    loading='lazy'
                    className='h-full w-full cursor-zoom-in object-cover transition group-hover:scale-105 group-hover:opacity-90'
                  />
                </button>
              ))}
            </div>
          )}
        </Section>

        <div className='px-5 pb-6 pt-2 text-center text-[10px] text-white/25 mono'>
          ECHO · zero-knowledge · keys live on-device only
        </div>

        {lightboxOpen && avatar && (
          <ImageLightbox src={avatar} alt={profileName} onClose={() => setLightboxOpen(false)} />
        )}

        {activeMedia && (
          <ImageLightbox src={activeMedia} alt='' onClose={() => setActiveMedia(null)} />
        )}
      </aside>
    </>
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
