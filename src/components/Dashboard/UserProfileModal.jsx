import { useEffect, useRef, useState, useMemo } from 'react'
import {
  X,
  Camera,
  Fingerprint,
  ShieldCheck,
  LogOut,
  BadgeCheck,
  MonitorSmartphone,
  MessageCircleMore,
  CircleUserRound,
} from 'lucide-react'
import { getSocket } from '../../socket'
import { tokenStorage } from '@services/api'
import UsersService from '@/services/users.service'
import { compressImage } from '../Dashboard/Chat/utils/imageUtils'
import { formatProfileImage, getUserData } from './DashboardComponents/utils/helpers'

export default function UserProfileModal({ user = {}, open, onClose = () => {} }) {
  const socket = useMemo(() => getSocket(), [])
  const fileInputRef = useRef(null)
  const currentUserId = getUserData(tokenStorage.getAccess()).userId
  const profileUserId = String(user.id || currentUserId || '')
  const isOwnProfile = !profileUserId || String(profileUserId) === String(currentUserId)
  const settingsKey = profileUserId
    ? `profile-settings-${profileUserId}`
    : 'profile-settings-default'

  const [name, setName] = useState(user.display_name || user.name || user.username || '')
  const [about, setAbout] = useState(user.bio || user.aboutme || user.about || '')
  const [avatarUrl, setAvatarUrl] = useState(
    user.avatar_url || user.profilePicture || user.avatar || ''
  )
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const displayName =
    name.trim() || user.display_name || user.name || user.username || 'Your profile'
  const handle = user.handle || user.username || 'echo-user'
  const echoId = profileUserId || user.id || 'unknown'
  const fingerprintGroups = useMemo(
    () => user.fingerprint?.split(' ').filter(Boolean) || Array(8).fill('????'),
    [user.fingerprint]
  )
  const avatarLabel = (displayName || 'P')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setName(user.display_name || user.name || user.username || '')
    setAbout(user.bio || user.aboutme || user.about || '')
    setAvatarUrl(user.avatar_url || user.profilePicture || user.avatar || '')
  }, [
    open,
    user.display_name,
    user.name,
    user.username,
    user.bio,
    user.aboutme,
    user.about,
    user.avatar_url,
    user.profilePicture,
    user.avatar,
  ])

  useEffect(() => {
    if (!open) return
  }, [open, settingsKey])

  useEffect(() => {
    if (!open || !profileUserId) return undefined

    let cancelled = false
    setLoading(true)
    setError('')

    socket.emit('getUserInfo', { userId: profileUserId }, (res) => {
      if (cancelled) return

      if (res?.success && res?.user) {
        const profile = res.user
        setName(profile.display_name || profile.username || profile.name || '')
        setAbout(profile.bio || profile.aboutme || profile.about || '')
        setAvatarUrl(profile.avatar_url || profile.profilePicture || profile.avatar || '')

        const cachedProfile = {
          username: profile.username || user.username || '',
          display_name: profile.display_name || profile.username || profile.name || '',
          bio: profile.bio || profile.aboutme || profile.about || '',
          aboutme: profile.bio || profile.aboutme || profile.about || '',
          profilePicture: profile.avatar_url || profile.profilePicture || profile.avatar || '',
          avatar_url: profile.avatar_url || profile.profilePicture || profile.avatar || '',
        }
        localStorage.setItem(`profile-${profileUserId}`, JSON.stringify(cachedProfile))
      } else if (!user.id) {
        setError(res?.error || 'Could not load profile data.')
      }

      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, profileUserId, socket, user.id, user.username])

  const handleAvatarClick = () => {
    if (!isOwnProfile) return
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for the avatar.')
      event.target.value = ''
      return
    }

    try {
      setError('')
      const compressedBlob = await compressImage(file, 512, 0.78)
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatarUrl(reader.result)
        }
      }
      reader.readAsDataURL(compressedBlob)
    } catch (err) {
      setError(err?.message || 'Could not prepare the avatar image.')
    } finally {
      event.target.value = ''
    }
  }

  const persistProfileCache = (profile) => {
    if (!profileUserId) return

    const cachedProfile = {
      username: profile.username || user.username || '',
      display_name: profile.display_name || profile.username || profile.name || name.trim() || '',
      bio: profile.bio || profile.aboutme || about || '',
      aboutme: profile.bio || profile.aboutme || about || '',
      profilePicture: profile.avatar_url || profile.profilePicture || avatarUrl || '',
      avatar_url: profile.avatar_url || profile.profilePicture || avatarUrl || '',
    }

    localStorage.setItem(`profile-${profileUserId}`, JSON.stringify(cachedProfile))
    window.dispatchEvent(
      new CustomEvent('profileUpdated', {
        detail: { userId: profileUserId, profileData: cachedProfile },
      })
    )
  }

  const handleSave = async () => {
    if (!isOwnProfile || saving) return

    const payload = {
      display_name: name.trim(),
      bio: about.trim(),
    }

    if (avatarUrl) {
      payload.avatar_url = avatarUrl
    }

    try {
      setSaving(true)
      setError('')

      const response = await UsersService.updateProfile(payload)
      const updatedProfile = response?.user || response || {}

      const resolvedProfile = {
        username: updatedProfile.username || user.username || handle,
        display_name:
          updatedProfile.display_name || payload.display_name || updatedProfile.username || handle,
        bio: updatedProfile.bio || payload.bio || '',
        aboutme: updatedProfile.bio || payload.bio || '',
        profilePicture:
          updatedProfile.profilePicture ||
          updatedProfile.avatar_url ||
          payload.avatar_url ||
          avatarUrl ||
          '',
        avatar_url:
          updatedProfile.avatar_url ||
          updatedProfile.profilePicture ||
          payload.avatar_url ||
          avatarUrl ||
          '',
      }

      setName(resolvedProfile.display_name)
      setAbout(resolvedProfile.bio)
      setAvatarUrl(resolvedProfile.avatar_url)
      persistProfileCache(resolvedProfile)

      onClose()
    } catch (err) {
      setError(err?.message || 'Failed to save profile changes.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  return (
    <div
      data-testid='profile-modal'
      className='fixed inset-0 z-50 grid place-items-center p-4 animate-fade-in overflow-y-auto echo-scrollbar-hide'
      onClick={onClose}
    >
      <div className='absolute inset-0 bg-black/80 backdrop-blur-md' />
      <div
        onClick={(e) => e.stopPropagation()}
        className='relative w-full max-w-[1040px] max-h-[calc(100vh-2rem)] overflow-y-auto echo-scrollbar-hide rounded-[28px] border border-white/[0.08] bg-[#07070b] shadow-[0_35px_120px_-28px_rgba(0,0,0,0.85)] animate-fade-up'
      >
        <div className='grid lg:grid-cols-[1.08fr_0.92fr]'>
          <div className='relative overflow-hidden border-b border-white/[0.06] lg:border-b-0 lg:border-r'>
            <div className='absolute inset-0'>
              <div className='echo-aurora opacity-100' />
              <div className='absolute inset-0 echo-stars opacity-55' />
              <div className='absolute -left-24 top-8 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl' />
              <div className='absolute -right-12 top-20 h-44 w-44 rounded-full bg-fuchsia-500/10 blur-3xl' />
            </div>

            <div className='relative flex h-full flex-col px-6 pb-6 pt-5 sm:px-8'>
              <div className='mb-6 flex items-start justify-between gap-4'>
                <div>
                  <h2 className='text-[28px] font-semibold tracking-[-0.04em] sm:text-[34px]'>
                    Your public identity
                  </h2>
                  <p className='mt-2 max-w-lg text-[13px] leading-6 text-white/55'>
                    Present yourself clearly, keep your cryptographic identity visible, and manage
                    the essentials without noise.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className='grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-black/35 text-white/70 transition hover:border-white/15 hover:bg-black/55 hover:text-white'
                  aria-label='Close profile modal'
                >
                  <X size={16} />
                </button>
              </div>

              <div className='mb-6 grid gap-3 sm:grid-cols-3'>
                <InfoCard
                  icon={<CircleUserRound size={15} />}
                  label='Profile name'
                  value={displayName}
                />
                <InfoCard
                  icon={<MonitorSmartphone size={15} />}
                  label='Devices linked'
                  value={user.devices?.length ? String(user.devices.length) : '1'}
                />
                <InfoCard
                  icon={<MessageCircleMore size={15} />}
                  label='Status'
                  value={user.status || 'Available'}
                />
              </div>

              <div className='rounded-[24px] border border-white/[0.08] bg-black/30 p-5 backdrop-blur-xl shadow-[0_22px_60px_-28px_rgba(168,85,247,0.45)]'>
                <div className='flex flex-wrap items-start gap-4'>
                  <div className='relative'>
                    <button
                      type='button'
                      onClick={handleAvatarClick}
                      className='grid h-24 w-24 place-items-center overflow-hidden rounded-[26px] border border-white/[0.14] bg-gradient-to-br from-violet-500/30 via-fuchsia-500/10 to-cyan-400/10 shadow-[0_18px_60px_-20px_rgba(168,85,247,0.7)] transition hover:border-violet-400/40 hover:scale-[1.01]'
                      disabled={!isOwnProfile}
                    >
                      {avatarUrl || user.avatar || user.profileImage ? (
                        <img
                          src={formatProfileImage(
                            avatarUrl || user.avatar || user.profileImage,
                            displayName
                          )}
                          alt={user.name || user.username || 'Profile'}
                          className='h-full w-full object-cover'
                        />
                      ) : (
                        <span className='text-[24px] font-semibold tracking-[-0.04em] text-white/95'>
                          {avatarLabel || 'P'}
                        </span>
                      )}
                    </button>
                    <button
                      type='button'
                      onClick={handleAvatarClick}
                      className='absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-[#120f1a] text-white shadow-[0_10px_30px_-12px_rgba(168,85,247,0.8)] transition hover:border-violet-400/40 hover:text-violet-200 disabled:opacity-50'
                      disabled={!isOwnProfile}
                    >
                      <Camera size={13} />
                    </button>
                  </div>

                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <h3 className='truncate text-[22px] font-semibold tracking-[-0.03em]'>
                        {displayName}
                      </h3>
                      <span className='inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-300'>
                        <BadgeCheck size={11} /> verified
                      </span>
                    </div>
                    <p className='mt-1 text-[12px] font-medium text-white/42 mono'>#{echoId}</p>
                    <p className='mt-3 max-w-2xl text-[13px] leading-6 text-white/60'>
                      {about ||
                        'Write a short bio so people know who they are talking to. Keep it clear, concise, and human.'}
                    </p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type='file'
                  accept='image/*'
                  className='hidden'
                  onChange={handleAvatarChange}
                  disabled={!isOwnProfile}
                />

                <div className='mt-5 grid gap-3 sm:grid-cols-2'>
                  <Field label='Display name' hint='How your contacts will see you.'>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder='Enter your display name'
                      disabled={!isOwnProfile || loading || saving}
                      className='echo-input w-full rounded-2xl px-4 py-3 text-[13.5px] echo-focus-ring disabled:cursor-not-allowed disabled:opacity-60'
                    />
                  </Field>
                  <Field label='ECHO ID' hint='Unique and immutable.'>
                    <div className='echo-input flex w-full items-center rounded-2xl px-4 py-3 text-[13.5px] mono text-white/82'>
                      <span className='mr-1 text-white/35'>#</span>
                      <span className='truncate'>{echoId}</span>
                    </div>
                  </Field>
                  <div className='sm:col-span-2'>
                    <Field label='About' hint='Visible to your contacts.'>
                      <textarea
                        value={about}
                        onChange={(e) => setAbout(e.target.value)}
                        placeholder='A short, friendly bio...'
                        rows={4}
                        disabled={!isOwnProfile || loading || saving}
                        className='echo-input w-full resize-none rounded-2xl px-4 py-3 text-[13.5px] leading-6 echo-focus-ring disabled:cursor-not-allowed disabled:opacity-60'
                      />
                    </Field>
                  </div>
                </div>

                {error && (
                  <div className='mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-200'>
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className='relative overflow-hidden bg-[#060608] px-6 py-6 sm:px-7'>
            <div className='absolute inset-0'>
              <div className='absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-violet-500/10 to-transparent' />
              <div className='absolute -right-20 top-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl' />
              <div className='absolute -left-20 bottom-14 h-48 w-48 rounded-full bg-violet-500/12 blur-3xl' />
            </div>

            <div className='relative flex h-full flex-col'>
              <div className='mb-5'>
                <p className='text-[10px] uppercase tracking-[0.22em] text-white/40'>
                  Security & identity
                </p>
                <h3 className='mt-2 text-[20px] font-semibold tracking-[-0.03em]'>
                  Trust at a glance
                </h3>
                <p className='mt-2 text-[13px] leading-6 text-white/55'>
                  The key details below help people verify who you are and keep the profile honest.
                </p>
              </div>

              <div className='echo-glass-strong rounded-[24px] border border-white/[0.08] p-4'>
                <div className='mb-3 flex items-center gap-2'>
                  <Fingerprint size={14} className='text-violet-300' />
                  <span className='text-[10.5px] uppercase tracking-[0.18em] text-white/55'>
                    Cryptographic identity
                  </span>
                  <span className='ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-300 mono'>
                    <ShieldCheck size={11} /> verified
                  </span>
                </div>

                <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                  {fingerprintGroups.map((group, index) => (
                    <div
                      key={`${group}-${index}`}
                      className='rounded-xl border border-white/[0.06] bg-black/45 px-2 py-2.5 text-center text-[11px] mono tracking-[0.22em] text-violet-100/90'
                    >
                      {group}
                    </div>
                  ))}
                </div>

                <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                  <DetailRow label='Key storage' value='This device only' />
                  <DetailRow label='Algorithms' value='Argon2id · X25519 · Ed25519' />
                  <DetailRow label='Public visibility' value='Contacts only' />
                  <DetailRow label='Last verified' value='Just now' />
                </div>
              </div>

              <div className='mt-auto pt-6'>
                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <button className='inline-flex items-center justify-center gap-2 rounded-full border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[12.5px] text-red-300 transition hover:border-red-500/40 hover:bg-red-500/[0.12]'>
                    <LogOut size={14} /> Sign out
                  </button>

                  <div className='flex gap-2 sm:justify-end'>
                    <button
                      onClick={onClose}
                      className='rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[12.5px] text-white/68 transition hover:bg-white/[0.06] hover:text-white'
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!isOwnProfile || loading || saving}
                      data-testid='profile-save-btn'
                      className='echo-cta rounded-full px-6 py-2.5 text-[12.5px] font-medium disabled:cursor-not-allowed disabled:opacity-60'
                    >
                      {saving ? 'Saving...' : isOwnProfile ? 'Save changes' : 'Read only'}
                    </button>
                  </div>
                </div>
              </div>
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
      <label className='mb-1.5 flex items-center justify-between text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45'>
        {label}
        {hint && (
          <span className='text-[10px] normal-case tracking-normal text-white/30'>{hint}</span>
        )}
      </label>
      {children}
    </div>
  )
}

function InfoCard({ icon, label, value }) {
  return (
    <div className='rounded-2xl border border-white/[0.08] bg-black/28 px-4 py-3 backdrop-blur-xl'>
      <div className='mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/42'>
        <span className='text-violet-300'>{icon}</span>
        {label}
      </div>
      <p className='truncate text-[13px] font-medium text-white/88'>{value}</p>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className='rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3'>
      <p className='text-[10px] uppercase tracking-[0.18em] text-white/38'>{label}</p>
      <p className='mt-1 text-[12.5px] text-white/82'>{value}</p>
    </div>
  )
}
