import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Camera, Plus, Search, X, ArrowLeft, Users } from 'lucide-react'
import { getSocket } from '../../../../socket'
import { formatProfileImage } from '../utils/helpers'
import { userColorName } from '../utils/userColor'
import { searchUsersByUsername } from '@/utils/userSearch'

import {
  loadGroupState,
  saveGroupState,
  buildAddCommit,
  buildRemoveCommit,
} from '../../Chat/utils/crypto/groupCryptoProvider'
import {
  memberInitKeysFromTree,
  mergeMemberInitKeys,
} from '../../Chat/utils/crypto/groupCrypto/treeState.js'

import { compressImage } from '../../Chat/utils/imageUtils'

const MAX_GROUP_PROFILE_IMAGE_BYTES = 140 * 1024
const SOCKET_ACK_TIMEOUT_MS = 12000

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Failed to read image'))
    }
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(blob)
  })

const GroupHeader = ({
  groupId,
  groupName,
  groupDescription,
  groupProfilePicture,
  userId,
  onBack,
}) => {
  const socket = useMemo(() => getSocket(), [])
  const [members, setMembers] = useState([])
  const [role, setRole] = useState(null)
  // Single "Group info" panel (picture, description, add member, member list),
  // opened by clicking the group top bar.
  const [infoOpen, setInfoOpen] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [processingProfileImage, setProcessingProfileImage] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [profilePictureDraft, setProfilePictureDraft] = useState('')
  const [profileError, setProfileError] = useState('')

  const [groupMeta, setGroupMeta] = useState({
    name: groupName || 'Group',
    description: groupDescription || '',
    profilePicture: groupProfilePicture || '',
    mlsEnabled: false,
    epoch: 0,
    cipherSuite: null,
  })
  // Optimistic removal state to prevent flicker while server confirms
  const [pendingRemovals, setPendingRemovals] = useState(new Set())

  useEffect(() => {
    setGroupMeta((prev) => ({
      ...prev,
      name: groupName || prev.name || 'Group',
      description: groupDescription ?? prev.description ?? '',
      profilePicture: groupProfilePicture ?? prev.profilePicture ?? '',
    }))
  }, [groupDescription, groupName, groupProfilePicture])

  const refresh = useCallback(() => {
    if (!groupId) return
    socket.emit('openGroup', { groupId }, (res) => {
      if (!res?.success) return
      setMembers(
        Array.isArray(res.members)
          ? res.members.filter((member) => member?.status !== 'removed')
          : []
      )
      setRole(res?.membership?.role ?? null)

      setGroupMeta({
        name: res?.group?.name || groupName || 'Group',
        description: res?.group?.description ?? '',
        profilePicture: res?.group?.profilePicture ?? '',
        mlsEnabled: Boolean(res?.group?.mlsEnabled),
        epoch: Number.isInteger(res?.group?.epoch) ? res.group.epoch : 0,
        cipherSuite: res?.group?.cipherSuite ?? null,
      })
    })
  }, [groupId, groupName, socket])

  const openGroupDetails = () =>
    new Promise((resolve, reject) => {
      if (!groupId) {
        reject(new Error('Missing groupId'))
        return
      }

      socket.emit('openGroup', { groupId }, (res) => {
        if (!res?.success) {
          reject(new Error(res?.error || 'Failed to open group'))
          return
        }

        resolve(res)
      })
    })

  const emitWithAck = (eventName, payload, fallbackError) =>
    new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`${fallbackError} (request timed out)`))
      }, SOCKET_ACK_TIMEOUT_MS)

      socket.emit(eventName, payload, (ack) => {
        clearTimeout(timeoutId)
        if (!ack?.success) {
          reject(new Error(ack?.error || fallbackError))
          return
        }
        resolve(ack)
      })
    })

  const toRoster = (groupMembers) =>
    (Array.isArray(groupMembers) ? groupMembers : [])
      .filter((member) => member?.status !== 'removed')
      .map((m) => ({
        userId: String(m.userId),
        username: m.username ?? '',
        leafIndex: m.leafIndex,
      }))
      .filter((m) => m.userId && Number.isInteger(m.leafIndex))
      .sort((a, b) => a.leafIndex - b.leafIndex)

  useEffect(() => {
    refresh()
    setInfoOpen(false)
    setPendingRemovals(new Set())
  }, [groupId, refresh])

  useEffect(() => {
    const handleRefreshableChanged = (evt) => {
      const changedGroupId = String(evt?.groupId ?? evt?.group?.groupId ?? '')
      if (changedGroupId !== String(groupId)) return
      refresh()
    }

    const handleMemberRemoved = (evt) => {
      const changedGroupId = String(evt?.groupId ?? '')
      if (changedGroupId !== String(groupId)) return
      const removedMemberId = String(evt?.memberId ?? '')
      if (!removedMemberId) return

      setMembers((prev) => prev.filter((member) => String(member.userId) !== removedMemberId))
      setPendingRemovals((prev) => {
        if (!prev.has(removedMemberId)) return prev
        const next = new Set(prev)
        next.delete(removedMemberId)
        return next
      })
      if (removedMemberId === String(userId)) {
        setRole(null)
        setInfoOpen(false)
      }
    }

    socket.on('groupMemberAdded', handleRefreshableChanged)
    socket.on('groupMemberRemoved', handleMemberRemoved)
    socket.on('groupUpdated', handleRefreshableChanged)
    socket.on('groupCommit', handleRefreshableChanged)
    return () => {
      socket.off('groupMemberAdded', handleRefreshableChanged)
      socket.off('groupMemberRemoved', handleMemberRemoved)
      socket.off('groupUpdated', handleRefreshableChanged)
      socket.off('groupCommit', handleRefreshableChanged)
    }
  }, [groupId, refresh, socket, userId])

  // Open the Group info panel: load latest data and seed the editable drafts.
  const openInfo = () => {
    refresh()
    setDescriptionDraft(groupMeta.description || '')
    setProfilePictureDraft(groupMeta.profilePicture || '')
    setProfileError('')
    setSearchTerm('')
    setSearchResult(null)
    setInfoOpen(true)
  }

  // Keep membership fresh while the panel is open.
  useEffect(() => {
    if (!infoOpen) return
    refresh()
  }, [infoOpen, refresh])

  const visibleMembers = members
    .filter((member) => member?.status !== 'removed')
    .filter((member) => !pendingRemovals.has(String(member.userId)))
  const memberCount = visibleMembers.length
  const subtitle = role === 'admin' ? `Admin · ${memberCount} members` : `${memberCount} members`
  const displayName = groupMeta.name || groupName || 'Group'
  const displayDescription = groupMeta.description?.trim() || ''
  const avatarSrc = formatProfileImage(groupMeta.profilePicture, displayName)
  const canAdd = role === 'admin'
  const canEditProfile = Boolean(role)

  // openProfileModal removed as unused — profile panel can be toggled by future UI controls

  const handleProfilePictureChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setProfileError('Please choose an image file.')
      event.target.value = ''
      return
    }

    try {
      setProcessingProfileImage(true)
      setProfileError('')
      const compressedBlob = await compressImage(file, 256, 0.6)
      if (compressedBlob.size > MAX_GROUP_PROFILE_IMAGE_BYTES) {
        throw new Error('Group image is too large. Choose a smaller image.')
      }

      const compressedDataUrl = await blobToDataUrl(compressedBlob)
      setProfilePictureDraft(compressedDataUrl)
    } catch (err) {
      setProfileError(err?.message || 'Failed to prepare group image.')
    } finally {
      setProcessingProfileImage(false)
    }

    // Allow selecting the same file again later.
    event.target.value = ''
  }

  const handleSaveProfile = async () => {
    if (!groupId || !canEditProfile || processingProfileImage) return
    setSavingProfile(true)
    setProfileError('')

    try {
      const ack = await emitWithAck(
        'updateGroupProfile',
        {
          groupId,
          description: descriptionDraft,
          profilePicture: profilePictureDraft,
        },
        'Failed to update group profile'
      )

      if (ack?.group) {
        setGroupMeta((prev) => ({
          ...prev,
          name: ack.group.name || prev.name,
          description: ack.group.description ?? '',
          profilePicture: ack.group.profilePicture ?? '',
        }))
      }

      refresh()
      // Keep the panel open (it also hosts members/add) — the server broadcast
      // refreshes the avatar/description and posts the "changed picture" row.
    } catch (err) {
      console.error('[GroupHeader] Failed to update group profile:', err)
      setProfileError(err?.message || 'Failed to update group profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSearch = async () => {
    const term = searchTerm.trim()
    if (!term) return
    setLoading(true)
    setSearchResult(null)

    try {
      const found = await searchUsersByUsername(term)
      const basic = found[0]
      if (!basic?.id) {
        setLoading(false)
        return
      }
      socket.emit('getUserInfo', { userId: basic.id }, (infoRes) => {
        const profilePicture = infoRes?.success ? infoRes?.user?.profilePicture : null
        const profileImage = formatProfileImage(profilePicture, basic.username)
        setSearchResult({ ...basic, profileImage })
        setLoading(false)
      })
    } catch {
      setLoading(false)
    }
  }

  const handleAdd = async (memberId) => {
    if (!canAdd || !memberId) return
    setLoading(true)

    try {
      await emitWithAck('addGroupMember', { groupId, memberId }, 'Failed to add group member')
      setSearchTerm('')
      setSearchResult(null)

      if (!groupMeta.mlsEnabled) {
        refresh()
        return
      }

      // Load fresh roster and local state
      const groupRes = await openGroupDetails()
      const roster = toRoster(groupRes.members)
      const addedMember = roster.find((m) => String(m.userId) === String(memberId))
      if (!addedMember) throw new Error('Added member missing from refreshed group roster')

      const localState = await loadGroupState(groupId)
      if (!localState) throw new Error('Missing local MLS state for commit generation')

      // Only accept full signed KeyPackages with BOTH initKeyB64 and
      // leafSigningPubKeyB64.  A bare-initKey package would be added as a
      // no-sig leaf, which (a) shows up in the debug panel as "no-sig",
      // (b) cannot author or verify commits, and (c) desyncs treeHash across
      // devices once any other member generates real signing material.  The
      // peer's mobile re-publishes a full KP on every Dashboard mount — wait
      // for it.
      const isFullKeyPackage = (pkg) =>
        Boolean(pkg?.keyPackage?.initKeyB64 && pkg?.keyPackage?.leafSigningPubKeyB64)

      const fetchDeviceKeyPackages = (member) =>
        new Promise((resolve) => {
          socket.emit('fetchAllKeyPackages', { userId: member.userId }, (allRes) => {
            if (allRes?.success && Array.isArray(allRes.packages) && allRes.packages.length > 0) {
              const filtered = allRes.packages.filter(isFullKeyPackage)
              if (filtered.length === 0) {
                console.warn(
                  `[GroupHeader] No full KeyPackage for ${member.userId} — peer device hasn't re-published its signed KP yet`
                )
              }
              resolve(
                filtered.map((pkg) => ({
                  userId: member.userId,
                  clientId: pkg.clientId ?? null,
                  initKeyB64: pkg.keyPackage.initKeyB64,
                  keyPackage: pkg.keyPackage,
                }))
              )
              return
            }

            socket.emit('fetchKeyPackage', { userId: member.userId }, (res) => {
              if (res?.success && isFullKeyPackage(res)) {
                resolve([
                  {
                    userId: member.userId,
                    clientId: res.clientId ?? null,
                    initKeyB64: res.keyPackage.initKeyB64,
                    keyPackage: res.keyPackage,
                  },
                ])
              } else {
                console.warn(`[GroupHeader] No full KeyPackage for member ${member.userId}`)
                resolve([])
              }
            })
          })
        })

      const seenPackageSigningKeys = new Set()
      const devicePackages = (await fetchDeviceKeyPackages(addedMember)).filter((pkg) => {
        const signingPubKeyB64 = pkg?.keyPackage?.leafSigningPubKeyB64 ?? null
        if (!signingPubKeyB64) return false
        if (seenPackageSigningKeys.has(signingPubKeyB64)) return false
        seenPackageSigningKeys.add(signingPubKeyB64)
        return true
      })
      if (devicePackages.length === 0) {
        throw new Error(`No KeyPackage for member ${addedMember.userId}`)
      }

      const maxLeafIndex = (localState.roster ?? []).reduce(
        (max, member) =>
          Number.isInteger(member?.leafIndex) && member.leafIndex > max ? member.leafIndex : max,
        -1
      )
      let nextLeafIndex = maxLeafIndex + 1
      let workingState = localState

      for (const devicePackage of devicePackages) {
        const targetLeafIndex = nextLeafIndex
        nextLeafIndex += 1
        const newMemberLeaf = { ...addedMember, leafIndex: targetLeafIndex }
        const memberInitKeys = [{ ...devicePackage, leafIndex: targetLeafIndex }]
        const {
          commit,
          welcome,
          welcomes: addWelcomes,
          nextState,
        } = await buildAddCommit({
          state: workingState,
          newMember: newMemberLeaf,
          memberInitKeys,
        })

        await emitWithAck('sendGroupCommit', { groupId, commit }, 'Failed to send group commit')
        // Persist the inviter's epoch advancement immediately after the
        // commit is accepted so the input is not stuck in "MLS not ready".
        try {
          const persistedState = await saveGroupState(groupId, nextState)
          // Nudge GroupChat (if mounted) to reload MLS state from disk.
          try {
            window.dispatchEvent(
              new CustomEvent('groupStateSynced', { detail: { groupId: String(groupId) } })
            )
          } catch {
            /* ignore */
          }
          // Keep local working copy in sync even if the final save below were skipped.
          workingState = persistedState
        } catch {
          // Fall through — the final save below will persist if this one fails.
          workingState = nextState
        }
        const welcomes =
          Array.isArray(addWelcomes) && addWelcomes.length > 0 ? addWelcomes : [welcome]
        for (const welcomeMessage of welcomes.filter(Boolean)) {
          await emitWithAck(
            'sendGroupWelcome',
            { groupId, recipientUserId: welcomeMessage.recipientUserId, welcome: welcomeMessage },
            'Failed to send group welcome'
          )
        }
        // workingState already set above; keep as-is
      }

      await saveGroupState(groupId, workingState)
      refresh()
    } catch (err) {
      console.error('[GroupHeader] Failed to add member:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (memberId) => {
    if (!memberId) return
    setLoading(true)
    const memberIdStr = String(memberId)
    // Optimistically mark as removed to avoid flicker until server confirms
    setPendingRemovals((prev) => {
      const next = new Set(prev)
      next.add(memberIdStr)
      return next
    })

    try {
      if (!groupMeta.mlsEnabled) {
        await emitWithAck(
          'removeGroupMember',
          { groupId, memberId: memberIdStr },
          'Failed to remove group member'
        )
        // Verify quickly and clear optimistic flag if server has applied it
        try {
          const res = await openGroupDetails()
          const roster = toRoster(res.members)
          const stillPresent = roster.some((m) => String(m.userId) === memberIdStr)
          if (!stillPresent) {
            setPendingRemovals((prev) => {
              const next = new Set(prev)
              next.delete(memberIdStr)
              return next
            })
          }
        } catch {
          /* ignore — event will clear */
        }
        refresh()
        return
      }

      let localState = await loadGroupState(groupId)
      if (!localState) {
        throw new Error('Missing local MLS state for remove commit generation')
      }

      // Refresh roster from server to align local MLS state and avoid stale membership
      const groupRes = await openGroupDetails()
      const roster = toRoster(groupRes.members)

      // If target is not present in refreshed roster, nothing to remove
      const targetPresent = roster.some((m) => String(m.userId) === memberIdStr)
      if (!targetPresent) {
        refresh()
        return
      }

      const localRoster = Array.isArray(localState.roster) ? localState.roster : []
      const targetLeaves = localRoster
        .filter((m) => String(m.userId) === memberIdStr)
        .sort((a, b) => {
          if (a.leafIndex === localState.selfLeafIndex) return 1
          if (b.leafIndex === localState.selfLeafIndex) return -1
          return a.leafIndex - b.leafIndex
        })
      if (targetLeaves.length === 0) {
        throw new Error(`Target userId ${memberIdStr} not found in local MLS roster`)
      }

      const remainingLeaves = localRoster.filter((m) => String(m.userId) !== memberIdStr)
      const isSelfRemoval = memberIdStr === String(userId)

      const isFullKeyPackage = (pkg) =>
        Boolean(pkg?.keyPackage?.initKeyB64 && pkg?.keyPackage?.leafSigningPubKeyB64)

      const fetchAllDeviceKeyPackages = (member) =>
        new Promise((resolve) => {
          socket.emit('fetchAllKeyPackages', { userId: member.userId }, (allRes) => {
            if (allRes?.success && Array.isArray(allRes.packages)) {
              resolve(allRes.packages.filter(isFullKeyPackage))
              return
            }
            resolve([])
          })
        })

      const resolveRemoveMemberInitKeys = async (state, members) => {
        const fromTree = memberInitKeysFromTree(members, state.tree?.nodes ?? [])
        const coveredLeaves = new Set(fromTree.map((entry) => entry.leafIndex))
        const missingLeaves = members.filter(
          (member) => Number.isInteger(member?.leafIndex) && !coveredLeaves.has(member.leafIndex)
        )

        const fetched = []
        for (const member of missingLeaves) {
          const packages = await fetchAllDeviceKeyPackages(member)
          const signingPubKeyB64 =
            state.tree?.leafData?.[String(member.leafIndex)]?.leafSigningPubKeyB64 ??
            member.leafSigningPubKeyB64 ??
            null
          const matched =
            (signingPubKeyB64
              ? packages.find((pkg) => pkg?.keyPackage?.leafSigningPubKeyB64 === signingPubKeyB64)
              : null) ?? packages[0]
          if (!matched?.keyPackage?.initKeyB64) {
            console.warn(
              `[GroupHeader] Missing init key for leaf ${member.leafIndex} (${member.userId}) while building remove commit`
            )
            continue
          }
          fetched.push({
            userId: member.userId,
            leafIndex: member.leafIndex,
            clientId: matched.clientId ?? null,
            initKeyB64: matched.keyPackage.initKeyB64,
            keyPackage: matched.keyPackage,
          })
        }

        return mergeMemberInitKeys(fetched, fromTree)
      }

      const removeMemberInitKeys = await resolveRemoveMemberInitKeys(localState, remainingLeaves)

      // If this is the last member leaving the group, there is no next epoch to
      // distribute. Remove the membership directly instead of forcing an MLS commit.
      if (remainingLeaves.length === 0 && isSelfRemoval) {
        await emitWithAck(
          'removeGroupMember',
          { groupId, memberId: memberIdStr },
          'Failed to remove group member'
        )
        return
      }

      // Broadcast MLS remove commits before removeGroupMember so peers receive
      // groupCommit (advanced epoch) before groupMemberRemoved. If membership
      // is marked removed first, handleMembershipChanged syncs a server roster
      // that already excludes the target while local epoch secrets still reflect
      // the old tree — remaining members can lose applicationSecretB64.
      for (const targetLeaf of targetLeaves) {
        const { commit, nextState } = await buildRemoveCommit({
          state: localState,
          targetUserId: memberIdStr,
          targetLeafIndex: targetLeaf.leafIndex,
          memberInitKeys: removeMemberInitKeys,
        })
        await emitWithAck('sendGroupCommit', { groupId, commit }, 'Failed to send group commit')
        // Persist + nudge GroupChat immediately so its ref advances before
        // the server's commit broadcast races with our state. Without this,
        // GroupChat's handleGroupCommit ends up re-applying our own commit
        // against the stale pre-remove state and the sender's rotated leaf
        // priv key — producing null applicationSecretB64 and stranding the
        // remover with "MLS state not ready". Mirrors the add flow.
        try {
          const persistedState = await saveGroupState(groupId, nextState)
          try {
            window.dispatchEvent(
              new CustomEvent('groupStateSynced', { detail: { groupId: String(groupId) } })
            )
          } catch {
            /* ignore */
          }
          localState = persistedState
        } catch {
          localState = nextState
        }
      }

      await emitWithAck(
        'removeGroupMember',
        { groupId, memberId: memberIdStr },
        'Failed to remove group member'
      )

      await saveGroupState(groupId, localState)
      // Final nudge so GroupChat reloads its React state from the saved
      // post-remove epoch. Without this, a mounted GroupChat could keep
      // displaying its pre-remove crypto state until the user refreshes.
      try {
        window.dispatchEvent(
          new CustomEvent('groupStateSynced', { detail: { groupId: String(groupId) } })
        )
      } catch {
        /* ignore */
      }
      refresh()
    } catch (err) {
      console.error('[GroupHeader] Failed to remove member:', err)
      // Revert optimistic removal on failure
      setPendingRemovals((prev) => {
        const next = new Set(prev)
        next.delete(memberIdStr)
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className='p-3 md:p-4 flex justify-between items-center transition-all border-b bg-black border-gray-800'
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      <div className='flex items-center gap-2 md:gap-4 min-w-0'>
        {onBack && (
          <button
            className='md:hidden grid h-9 w-9 place-items-center rounded-full border border-transparent text-white/65 transition-all hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-white'
            aria-label='Back'
            onClick={onBack}
          >
            <ArrowLeft className='w-4 h-4' />
          </button>
        )}
        {/* Clicking the group identity opens the Group info panel. */}
        <button
          type='button'
          onClick={openInfo}
          title='Group info'
          className='-mx-1 flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 text-left transition hover:bg-white/[0.04] md:gap-4'
        >
          <img
            src={avatarSrc}
            alt={displayName}
            className='w-12 h-12 rounded-full border-2 border-black object-cover bg-gray-700'
            onError={(e) => {
              e.target.src = formatProfileImage('', displayName)
            }}
          />

          <div className='min-w-0'>
            <h3 className='font-semibold text-white truncate'>{displayName}</h3>
            <p className='text-sm text-gray-300 truncate'>{displayDescription || subtitle}</p>
            {displayDescription && <p className='text-xs text-gray-500 truncate'>{subtitle}</p>}
          </div>
        </button>
      </div>

      <div className='flex gap-2 md:gap-4 relative items-center'>
        <button
          onClick={openInfo}
          aria-label='Group info'
          title='Group info'
          className='grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] text-white/70 transition-all hover:border-violet-400/40 hover:bg-white/[0.05] hover:text-white'
        >
          <Users className='w-5 h-5' />
        </button>
      </div>

      {infoOpen && (
        <>
          {/* Backdrop */}
          <button
            type='button'
            aria-label='Close group info'
            onClick={() => setInfoOpen(false)}
            className='fixed inset-0 z-40 bg-black/50 backdrop-blur-sm'
          />

          {/* Slide-in panel — matches the 1:1 contact info panel style. */}
          <aside className='echo-floating fixed inset-y-0 right-0 z-50 flex w-full max-w-[390px] flex-col overflow-y-auto border-l border-white/[0.05] animate-slide-in-right'>
            {/* Sticky header */}
            <div className='sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.05] bg-black/40 px-5 py-3 backdrop-blur'>
              <h3 className='text-[13px] font-semibold tracking-[-0.01em] text-white'>
                Group info
              </h3>
              <button
                onClick={() => setInfoOpen(false)}
                className='grid h-8 w-8 place-items-center rounded-lg text-white/45 hover:bg-white/[0.04] hover:text-white'
              >
                <X size={15} />
              </button>
            </div>

            {/* Hero */}
            <div className='relative px-5 pb-6 pt-8 text-center'>
              <div className='echo-aurora' />
              <div className='relative mx-auto h-24 w-24'>
                <img
                  src={formatProfileImage(profilePictureDraft, displayName)}
                  alt={displayName}
                  className='h-24 w-24 rounded-full object-cover ring-1 ring-white/10'
                  onError={(e) => {
                    e.target.src = formatProfileImage('', displayName)
                  }}
                />
                {canEditProfile && (
                  <label
                    title='Change photo'
                    className='absolute -bottom-1 -right-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-white/10 bg-violet-600 text-white shadow-lg transition hover:bg-violet-500'
                  >
                    <Camera size={14} />
                    <input
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={handleProfilePictureChange}
                      disabled={savingProfile}
                    />
                  </label>
                )}
              </div>
              <h2 className='relative mt-4 text-[18px] font-semibold tracking-[-0.02em] text-white'>
                {displayName}
              </h2>
              <p className='relative mt-0.5 text-[12px] text-white/45'>
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
                {role === 'admin' ? ' · Admin' : ''}
              </p>
              {canEditProfile && profilePictureDraft && (
                <button
                  type='button'
                  onClick={() => {
                    setProfilePictureDraft('')
                    setProfileError('')
                  }}
                  disabled={savingProfile}
                  className='relative mt-2 text-[11px] text-white/45 transition hover:text-white disabled:opacity-50'
                >
                  Remove photo
                </button>
              )}
            </div>

            {/* Description */}
            <Section title='Description'>
              <textarea
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                maxLength={280}
                rows={3}
                className='echo-input w-full resize-none rounded-2xl px-4 py-3 text-[13px] leading-6 echo-focus-ring disabled:cursor-not-allowed disabled:opacity-60'
                placeholder={canEditProfile ? 'Add a description for this group' : 'No description'}
                disabled={!canEditProfile || savingProfile}
              />
              {canEditProfile && (
                <>
                  <div className='mt-1 text-right text-[10px] text-white/35'>
                    {descriptionDraft.length}/280
                  </div>
                  {profileError && (
                    <div className='mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-200'>
                      {profileError}
                    </div>
                  )}
                  {processingProfileImage && (
                    <div className='mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-white/65'>
                      Processing image…
                    </div>
                  )}
                  <button
                    type='button'
                    className='echo-cta mt-3 w-full rounded-full py-2.5 text-[12px] font-medium disabled:opacity-50 disabled:saturate-50'
                    onClick={handleSaveProfile}
                    disabled={savingProfile || processingProfileImage}
                  >
                    {savingProfile ? 'Saving…' : 'Save changes'}
                  </button>
                </>
              )}
            </Section>

            {/* Add member (admins) */}
            {canAdd && (
              <Section title='Add member'>
                <div className='relative'>
                  <input
                    type='text'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder='Search username...'
                    className='echo-input w-full rounded-2xl px-4 py-3 pr-11 text-[13px] echo-focus-ring'
                  />
                  <button
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white disabled:opacity-50'
                    onClick={handleSearch}
                    disabled={loading}
                  >
                    <Search className='h-4 w-4' />
                  </button>
                </div>

                {searchResult && (
                  <div className='mt-2 flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5'>
                    <div className='flex min-w-0 items-center gap-3'>
                      <img
                        src={searchResult.profileImage}
                        alt={searchResult.username}
                        className='h-9 w-9 rounded-full object-cover ring-1 ring-white/10'
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${searchResult.username}&background=8e79f2&color=fff`
                        }}
                      />
                      <div className='truncate text-[13px] text-white/90'>
                        {searchResult.username}
                      </div>
                    </div>
                    {(() => {
                      const userIdStr = String(searchResult.id)
                      const isAlreadyMember = members.some((m) => String(m.userId) === userIdStr)
                      const isRemoving = pendingRemovals.has(userIdStr)
                      const disabled = loading || isAlreadyMember || isRemoving
                      const label = isRemoving ? 'Removing…' : isAlreadyMember ? 'In group' : 'Add'
                      return (
                        <button
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                            disabled
                              ? 'cursor-not-allowed bg-white/[0.04] text-white/40'
                              : 'echo-cta'
                          }`}
                          disabled={disabled}
                          onClick={() => handleAdd(searchResult.id)}
                        >
                          <Plus className='h-3.5 w-3.5' />
                          {label}
                        </button>
                      )
                    })()}
                  </div>
                )}
              </Section>
            )}

            {/* Members */}
            <Section title={`Members · ${memberCount}`}>
              <div className='grid gap-2'>
                {visibleMembers.map((m) => {
                  const isSelf = String(m.userId) === String(userId)
                  const canKick = role === 'admin' && !isSelf && m.role !== 'admin'
                  const canLeave = isSelf
                  const removing = pendingRemovals.has(String(m.userId))
                  return (
                    <div
                      key={m.userId}
                      className='flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5'
                    >
                      <div className='flex min-w-0 items-center gap-3'>
                        <img
                          src={
                            m.profilePicture
                              ? formatProfileImage(m.profilePicture, m.username || m.userId)
                              : `https://ui-avatars.com/api/?name=${m.username || m.userId}&background=8e79f2&color=fff`
                          }
                          alt={m.username || m.userId}
                          className='h-9 w-9 rounded-full object-cover ring-1 ring-white/10'
                        />
                        <div className='min-w-0 truncate text-[13px]'>
                          <span style={{ color: userColorName(m.userId) }}>
                            {m.username || m.userId}
                          </span>
                          {m.role === 'admin' && (
                            <span className='ml-1 text-[10px] text-violet-300/80'>admin</span>
                          )}
                          {isSelf && <span className='ml-1 text-[10px] text-white/40'>you</span>}
                        </div>
                      </div>
                      {(canKick || canLeave) && (
                        <button
                          className='shrink-0 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50'
                          disabled={loading || removing}
                          onClick={() => handleRemove(m.userId)}
                        >
                          {removing ? 'Removing…' : isSelf ? 'Leave' : 'Remove'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </Section>
          </aside>
        </>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className='border-t border-white/[0.05] px-5 py-4'>
      <div className='mb-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40'>
        {title}
      </div>
      {children}
    </div>
  )
}

Section.propTypes = {
  title: PropTypes.node,
  children: PropTypes.node,
}

GroupHeader.propTypes = {
  groupId: PropTypes.string,
  groupName: PropTypes.string,
  groupDescription: PropTypes.string,
  groupProfilePicture: PropTypes.string,
  userId: PropTypes.string.isRequired,
}

export default GroupHeader
