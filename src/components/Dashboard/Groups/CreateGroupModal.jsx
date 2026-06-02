import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { X, Camera, Search, UsersRound, Check, Lock } from 'lucide-react'
import { getSocket } from '../../../socket'
import { formatProfileImage } from '../DashboardComponents/utils/helpers'
import { searchUsersByUsername } from '@/utils/userSearch'
import { getIdentityKeys } from '../Chat/utils/chat/keyManagement'
import { compressImage } from '../Chat/utils/imageUtils'
import {
  createNewGroupState,
  buildInitialWelcomes,
  saveGroupState,
} from '../Chat/utils/crypto/groupCryptoProvider'

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(blob)
  })

/**
 * Premium CreateGroupModal — keeps full MLS crypto creation logic,
 * uses the new glassmorphism design.
 */
const CreateGroupModal = ({ open, onClose, onCreated, userId }) => {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [profilePicture, setProfilePicture] = useState('')
  const fileInputRef = useRef(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [selectedUsers, setSelectedUsers] = useState([]) // keep full user objects
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)
  const creatingRef = useRef(false)

  const socketRef = useRef(null)
  const socket = useMemo(() => {
    if (!socketRef.current) socketRef.current = getSocket()
    return socketRef.current
  }, [])

  useEffect(() => {
    if (open && debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [open])

  const handlePickImage = () => fileInputRef.current?.click()

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    try {
      // Match the group-info panel: small square (256px) so the data URL stays
      // well under the server's per-group picture cap.
      const compressed = await compressImage(file, 256, 0.6)
      setProfilePicture(await blobToDataUrl(compressed))
      setError('')
    } catch {
      setError('Failed to load that image. Try another one.')
    }
  }

  const isSelected = (id) => selected.has(String(id))

  const toggle = (user) => {
    const id = String(user.id)
    if (String(id) === String(userId)) return
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
      setSelectedUsers((prev) => prev.filter((u) => String(u.id) !== id))
    } else {
      next.add(id)
      setSelectedUsers((prev) => (prev.some((u) => String(u.id) === id) ? prev : [...prev, user]))
    }
    setSelected(next)
  }

  const handleSearch = useCallback(
    async (term) => {
      if (!open) return
      const t = (term ?? searchTerm).trim()
      if (!t) {
        setResults([])
        return
      }
      setSearching(true)
      try {
        const found = await searchUsersByUsername(t)
        const enriched = await Promise.all(
          found.map(
            (basicUser) =>
              new Promise((resolve) => {
                socket?.emit('getUserInfo', { userId: basicUser.id }, (profileResponse) => {
                  const profilePicture = profileResponse?.success
                    ? profileResponse?.user?.profilePicture
                    : null
                  const formattedProfileImage = formatProfileImage(
                    profilePicture,
                    basicUser.username
                  )
                  resolve({ ...basicUser, profileImage: formattedProfileImage })
                })
              })
          )
        )
        setResults(enriched)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    },
    [searchTerm, open, socket]
  )

  const handleSearchTermChange = (val) => {
    setSearchTerm(val)
    if (!val.trim()) {
      setResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(val), 400)
  }

  const handleCreate = async () => {
    if (creatingRef.current) return
    const groupName = name.trim()
    if (!groupName || selectedUsers.length === 0) return
    creatingRef.current = true
    setError('')

    const memberIds = selectedUsers.map((u) => u.id).filter(Boolean)
    const mlsEnabled = true
    const cipherSuite = 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256'
    const description = desc.trim()

    const emitWithAck = (event, payload) =>
      new Promise((resolve, reject) => {
        socket.emit(event, payload, (ack) => {
          if (ack?.success) resolve(ack)
          else reject(new Error(ack?.error || `Failed to ${event}`))
        })
      })

    setLoading(true)

    const fetchDeviceKeyPackages = (targetUserId) =>
      new Promise((resolve) => {
        socket.emit('fetchAllKeyPackages', { userId: targetUserId }, (allRes) => {
          if (allRes?.success && Array.isArray(allRes.packages) && allRes.packages.length > 0) {
            resolve(
              allRes.packages
                .filter((pkg) => pkg?.initKeyB64 || pkg?.keyPackage?.initKeyB64)
                .map((pkg) => ({
                  userId: String(targetUserId),
                  clientId: pkg.clientId ?? null,
                  initKeyB64: pkg.initKeyB64 ?? pkg.keyPackage?.initKeyB64 ?? null,
                  keyPackage: pkg.keyPackage ?? null,
                }))
            )
            return
          }

          socket.emit('fetchKeyPackage', { userId: targetUserId }, (res) => {
            if (res?.success && (res.initKeyB64 || res.keyPackage?.initKeyB64)) {
              resolve([
                {
                  userId: String(targetUserId),
                  clientId: res.clientId ?? null,
                  initKeyB64: res.initKeyB64 ?? res.keyPackage?.initKeyB64 ?? null,
                  keyPackage: res.keyPackage ?? null,
                },
              ])
              return
            }

            console.warn(`[CreateGroupModal] No KeyPackage for user ${targetUserId}`)
            resolve([])
          })
        })
      })

    // Fetch KeyPackages for every invited member device.
    const memberInitKeys = (
      await Promise.all(selectedUsers.map((u) => fetchDeviceKeyPackages(u.id)))
    ).flat()

    const missing = selectedUsers.filter(
      (u) => !memberInitKeys.some((mk) => String(mk.userId) === String(u.id))
    )
    if (missing.length > 0) {
      setError(
        `Cannot create group: ${missing.map((u) => u.username).join(', ')} has not set up their encryption keys yet. Ask them to open the app first.`
      )
      setLoading(false)
      creatingRef.current = false
      return
    }

    socket.emit(
      'createGroup',
      {
        name: groupName,
        desc: description || undefined,
        description: description || undefined,
        profilePicture: profilePicture || undefined,
        memberIds,
        mlsEnabled,
        cipherSuite,
      },
      async (ack) => {
        setLoading(false)
        creatingRef.current = false
        if (!ack?.success) return

        const serverMembers = Array.isArray(ack.members) ? ack.members : []
        const roster =
          serverMembers.length > 0
            ? serverMembers.map((m) => ({
                userId: String(m.userId),
                username:
                  selectedUsers.find((u) => String(u.id) === String(m.userId))?.username ??
                  'Member',
                leafIndex: Number.isInteger(m.leafIndex) ? m.leafIndex : 0,
              }))
            : [
                { userId: String(userId), username: 'me', leafIndex: 0 },
                ...selectedUsers.map((u, i) => ({
                  userId: String(u.id),
                  username: u.username,
                  leafIndex: i + 1,
                })),
              ]

        try {
          const identityKeys = mlsEnabled ? await getIdentityKeys() : null
          const creatorInitPubKeyB64 =
            localStorage.getItem('echo-device-mls-pub') || identityKeys?.publicKeyX25519 || null
          const creatorInitPrivKeyB64 =
            localStorage.getItem('echo-device-mls-priv') || identityKeys?.privateKeyX25519 || null

          if (mlsEnabled && (!creatorInitPubKeyB64 || !creatorInitPrivKeyB64)) {
            throw new Error('Missing local MLS identity keys for group creator')
          }

          const currentDeviceId = localStorage.getItem('echo-device-id') || null
          const creatorDeviceKeys = mlsEnabled ? await fetchDeviceKeyPackages(userId) : []
          const expandedRoster = [...roster]
          const memberInitKeysWithLeaf = []
          let nextLeafIndex =
            expandedRoster.reduce(
              (max, member) =>
                Number.isInteger(member.leafIndex) && member.leafIndex > max
                  ? member.leafIndex
                  : max,
              -1
            ) + 1

          if (mlsEnabled) {
            for (const member of roster) {
              if (String(member.userId) === String(userId)) {
                memberInitKeysWithLeaf.push({
                  userId: String(userId),
                  leafIndex: member.leafIndex,
                  clientId: currentDeviceId,
                  initKeyB64: creatorInitPubKeyB64,
                  excludeFromWelcome: true,
                })

                const siblingEntries = creatorDeviceKeys.filter(
                  (entry) =>
                    entry.initKeyB64 &&
                    entry.initKeyB64 !== creatorInitPubKeyB64 &&
                    (currentDeviceId === null || entry.clientId !== currentDeviceId)
                )
                for (const entry of siblingEntries) {
                  const leafIndex = nextLeafIndex
                  nextLeafIndex += 1
                  expandedRoster.push({ ...member, leafIndex })
                  memberInitKeysWithLeaf.push({ ...entry, leafIndex })
                }
                continue
              }

              const deviceEntries = memberInitKeys.filter(
                (entry) => String(entry.userId) === String(member.userId)
              )
              deviceEntries.forEach((entry, index) => {
                const leafIndex = index === 0 ? member.leafIndex : nextLeafIndex
                if (index > 0) {
                  nextLeafIndex += 1
                  expandedRoster.push({ ...member, leafIndex })
                }
                memberInitKeysWithLeaf.push({ ...entry, leafIndex })
              })
            }
          }

          const creatorState = await createNewGroupState({
            groupId: ack.group.groupId,
            creatorUserId: userId,
            roster: expandedRoster,
            cipherSuite: ack.group?.cipherSuite ?? cipherSuite ?? undefined,
            memberInitKeys: memberInitKeysWithLeaf,
            selfInitPrivKeyB64: creatorInitPrivKeyB64,
          })

          if (mlsEnabled && creatorState?.groupKeyB64) {
            const welcomes = await buildInitialWelcomes({
              creatorState,
              roster: expandedRoster,
              memberInitKeys: memberInitKeysWithLeaf,
            })
            // Welcomes go to distinct recipients and are independent, so fan
            // them out in parallel instead of awaiting each round-trip serially
            // (creation latency was O(members × devices) round-trips).
            await Promise.all(
              welcomes.map((welcome) =>
                emitWithAck('sendGroupWelcome', {
                  groupId: ack.group.groupId,
                  recipientUserId: welcome.recipientUserId,
                  welcome,
                })
              )
            )
            await saveGroupState(ack.group.groupId, {
              ...creatorState,
              secrets: {
                ...creatorState.secrets,
                initSecretB64:
                  creatorState.initSecretB64 ?? creatorState.secrets?.initSecretB64 ?? null,
                epochInitSecretB64: null,
                epochCommitSecretB64: null,
              },
            })
          }
        } catch (err) {
          console.error('[CreateGroupModal] Failed to initialize MLS state:', err)
          setError(`Group created but encryption setup failed: ${err.message}`)
        }

        // createGroup now persists the picture/description atomically (they're
        // in ack.group and the groupAdded broadcast), so no follow-up round-trip
        // is needed. Pass them through to seed the active chat immediately.
        onCreated?.({ ...ack.group, profilePicture, description })
        setName('')
        setDesc('')
        setProfilePicture('')
        setSearchTerm('')
        setResults([])
        setSelected(new Set())
        setSelectedUsers([])
        setError('')
        onClose?.()
      }
    )
  }

  if (!open) return null

  return (
    <div
      data-testid='create-group-modal'
      className='fixed inset-0 z-50 grid place-items-center p-4 animate-fade-in'
      onClick={onClose}
    >
      <div className='absolute inset-0 bg-black/70 backdrop-blur-sm' />
      <div
        onClick={(e) => e.stopPropagation()}
        className='relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0e] animate-fade-up'
      >
        {/* Header */}
        <div className='flex items-center justify-between border-b border-white/[0.06] px-6 py-4'>
          <div className='flex items-center gap-2.5'>
            <div className='grid h-8 w-8 place-items-center rounded-lg bg-violet-500/15 ring-1 ring-violet-400/30'>
              <UsersRound size={15} className='text-violet-300' />
            </div>
            <h2 className='text-[15px] font-semibold tracking-[-0.02em]'>New group</h2>
          </div>
          <button
            onClick={onClose}
            className='grid h-8 w-8 place-items-center rounded-lg text-white/55 hover:bg-white/[0.04] hover:text-white'
          >
            <X size={15} />
          </button>
        </div>

        <div className='p-6'>
          {/* Group name + avatar row */}
          <div className='flex items-start gap-4'>
            <button
              type='button'
              onClick={handlePickImage}
              aria-label='Set group picture'
              className='relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] text-white/45 hover:border-violet-400/40 hover:text-violet-200 transition'
            >
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt='Group'
                  className='absolute inset-0 h-full w-full object-cover'
                />
              ) : (
                <Camera size={18} />
              )}
              <span className='absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-lg echo-violet-gradient echo-violet-glow text-white text-[10px] font-bold'>
                +
              </span>
            </button>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              onChange={handleImageChange}
              className='hidden'
            />
            <div className='flex-1 space-y-3'>
              <input
                data-testid='group-name-input'
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Group name'
                className='echo-input w-full rounded-xl px-3.5 py-2.5 text-[13.5px] echo-focus-ring'
              />
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder='Description (optional)'
                className='echo-input w-full rounded-xl px-3.5 py-2 text-[12.5px] echo-focus-ring'
              />
            </div>
          </div>

          {/* Add members */}
          <div className='mt-5'>
            <div className='mb-2 flex items-center justify-between'>
              <span className='text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45'>
                Invite members
              </span>
              <span className='text-[11px] text-violet-300 mono'>{selected.size} selected</span>
            </div>
            <div className='flex gap-2'>
              <div className='relative flex-1'>
                <Search
                  size={14}
                  className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35'
                />
                {searching && (
                  <span className='absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/35 animate-pulse'>
                    …
                  </span>
                )}
                <input
                  value={searchTerm}
                  onChange={(e) => handleSearchTermChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder='Search by username…'
                  className='echo-input w-full rounded-xl py-2 pl-9 pr-3 text-[13px] echo-focus-ring'
                />
              </div>
              <button
                onClick={() => handleSearch()}
                disabled={searching || !searchTerm.trim()}
                className='echo-cta rounded-xl px-4 py-2 text-[12px] font-medium disabled:opacity-40'
              >
                {searching ? '…' : 'Search'}
              </button>
            </div>

            {/* Selected members tray — persists across searches so you can add
                several people one search at a time and still see/remove them. */}
            {selectedUsers.length > 0 && (
              <div className='mt-3 flex flex-wrap gap-1.5'>
                {selectedUsers.map((u) => (
                  <span
                    key={u.id}
                    className='inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/[0.08] py-1 pl-1.5 pr-2 text-[12px]'
                  >
                    {u.profileImage ? (
                      <img
                        src={u.profileImage}
                        alt={u.username}
                        className='h-5 w-5 rounded-full object-cover'
                      />
                    ) : (
                      <span className='grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-violet-700/70 text-[10px] font-semibold text-white'>
                        {u.username?.[0]}
                      </span>
                    )}
                    <span className='max-w-[120px] truncate'>{u.username}</span>
                    <button
                      type='button'
                      onClick={() => toggle(u)}
                      aria-label={`Remove ${u.username}`}
                      className='grid h-4 w-4 place-items-center rounded-full text-white/55 hover:bg-white/10 hover:text-white'
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Results */}
            <div className='mt-3 max-h-[260px] overflow-y-auto pr-1'>
              {results.map((c) => {
                const checked = isSelected(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(c)}
                    disabled={String(c.id) === String(userId)}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                      checked
                        ? 'border-violet-400/40 bg-violet-500/[0.06]'
                        : 'border-transparent hover:border-white/[0.06] hover:bg-white/[0.02]'
                    } disabled:opacity-40`}
                  >
                    {c.profileImage ? (
                      <img
                        src={c.profileImage}
                        alt={c.username}
                        className='h-9 w-9 rounded-full object-cover ring-1 ring-white/10'
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${c.username}&background=8e79f2&color=fff`
                        }}
                      />
                    ) : (
                      <div className='grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-violet-700/70 text-white text-sm font-semibold'>
                        {c.username?.[0]}
                      </div>
                    )}
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-[13px] font-medium'>{c.username}</div>
                    </div>
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-md border transition ${
                        checked
                          ? 'border-violet-400 bg-violet-500'
                          : 'border-white/15 bg-transparent group-hover:border-white/40'
                      }`}
                    >
                      {checked && <Check size={12} className='text-white' strokeWidth={3} />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className='mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[12px] text-red-300'>
              {error}
            </div>
          )}

          {/* Footer */}
          <div className='mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4'>
            <span className='inline-flex items-center gap-1.5 text-[11px] text-emerald-300/80 mono'>
              <Lock size={11} /> end-to-end encrypted by default
            </span>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={onClose}
                className='rounded-full border border-white/[0.08] bg-white/[0.02] px-5 py-2.5 text-[12.5px] text-white/65 hover:bg-white/[0.04] hover:text-white'
              >
                Cancel
              </button>
              <button
                type='button'
                disabled={!name.trim() || selected.size === 0 || loading}
                onClick={handleCreate}
                data-testid='group-create-btn'
                className='echo-cta rounded-full px-6 py-2.5 text-[12.5px] font-medium disabled:opacity-40 disabled:saturate-50'
              >
                {loading ? 'Creating…' : 'Create group'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

CreateGroupModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func,
  userId: PropTypes.string,
}

export default CreateGroupModal
