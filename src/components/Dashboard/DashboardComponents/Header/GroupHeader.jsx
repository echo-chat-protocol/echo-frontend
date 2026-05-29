import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Camera, Plus, Search, X, ArrowLeft } from 'lucide-react'
import { getSocket } from '../../../../socket'
import { formatProfileImage } from '../utils/helpers'
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
  const [membersOpen, setMembersOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

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
    setMembersOpen(false)
    setProfileOpen(false)
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
        setMembersOpen(false)
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

  // Ensure latest membership is shown whenever the Members modal opens
  useEffect(() => {
    if (!membersOpen) return
    refresh()
  }, [membersOpen, refresh])

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
      setProfileOpen(false)
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
        setMembersOpen(false)
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
      setMembersOpen(false)
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
      </div>

      <div className='flex gap-2 md:gap-4 relative items-center' />

      {profileOpen && (
        <div className='fixed inset-0 bg-black/70 flex items-center justify-center z-50'>
          <div className='bg-gray-900 rounded-lg p-4 max-w-lg w-full mx-4 border border-gray-700'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-white'>Group profile</h3>
              <button
                onClick={() => setProfileOpen(false)}
                className='text-gray-400 hover:text-white'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            <div className='space-y-4'>
              <div className='flex items-center gap-4'>
                <img
                  src={formatProfileImage(profilePictureDraft, displayName)}
                  alt={displayName}
                  className='w-20 h-20 rounded-full border-2 border-black object-cover bg-gray-700'
                  onError={(e) => {
                    e.target.src = formatProfileImage('', displayName)
                  }}
                />
                <div className='flex flex-col gap-2'>
                  <label className='inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-gray-800 text-white hover:bg-gray-700 cursor-pointer'>
                    <Camera className='w-4 h-4' />
                    Change photo
                    <input
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={handleProfilePictureChange}
                      disabled={!canEditProfile || savingProfile}
                    />
                  </label>
                  <button
                    type='button'
                    className='text-left text-sm text-gray-400 hover:text-white disabled:opacity-50'
                    onClick={() => {
                      setProfilePictureDraft('')
                      setProfileError('')
                    }}
                    disabled={!canEditProfile || savingProfile}
                  >
                    Remove photo
                  </button>
                </div>
              </div>

              <div className='space-y-2'>
                <label className='block text-sm text-gray-300'>Description</label>
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  maxLength={280}
                  rows={4}
                  className='w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8e79f2]'
                  placeholder='Add a description for this group'
                  disabled={!canEditProfile || savingProfile}
                />
                <div className='text-xs text-gray-500 text-right'>
                  {descriptionDraft.length}/280
                </div>
              </div>

              {profileError && (
                <div className='rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200'>
                  {profileError}
                </div>
              )}

              {processingProfileImage && (
                <div className='rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-200'>
                  Processing image...
                </div>
              )}

              <div className='flex justify-end gap-2'>
                <button
                  type='button'
                  className='px-4 py-2 rounded-lg text-sm bg-gray-800 text-white hover:bg-gray-700'
                  onClick={() => setProfileOpen(false)}
                  disabled={savingProfile}
                >
                  Cancel
                </button>
                <button
                  type='button'
                  className='px-4 py-2 rounded-lg text-sm bg-indigo-700 text-white hover:bg-[#8e79f2] disabled:opacity-50'
                  onClick={handleSaveProfile}
                  disabled={!canEditProfile || savingProfile || processingProfileImage}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {membersOpen && (
        <div className='fixed inset-0 bg-black/70 flex items-center justify-center z-50'>
          <div className='bg-gray-900 rounded-lg p-4 max-w-xl w-full mx-4 border border-gray-700'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-white'>Members</h3>
              <button
                onClick={() => setMembersOpen(false)}
                className='text-gray-400 hover:text-white'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            {canAdd && (
              <div className='space-y-2 mb-4'>
                <div className='text-sm text-gray-300'>Add member</div>
                <div className='flex gap-2'>
                  <div className='relative w-full'>
                    <input
                      type='text'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder='Search username...'
                      className='w-full p-3 pr-10 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8e79f2]'
                    />
                    <button
                      className='absolute right-3 top-3 text-gray-400 hover:text-white'
                      onClick={handleSearch}
                      disabled={loading}
                    >
                      <Search className='h-5 w-5' />
                    </button>
                  </div>
                </div>

                {searchResult && (
                  <div className='flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700'>
                    <div className='flex items-center gap-3 min-w-0'>
                      <img
                        src={searchResult.profileImage}
                        alt={searchResult.username}
                        className='w-9 h-9 rounded-full object-cover border-2 border-black'
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${searchResult.username}&background=8e79f2&color=fff`
                        }}
                      />
                      <div className='truncate text-white'>{searchResult.username}</div>
                    </div>
                    {(() => {
                      const userIdStr = String(searchResult.id)
                      const isAlreadyMember = members.some((m) => String(m.userId) === userIdStr)
                      const isRemoving = pendingRemovals.has(userIdStr)
                      const disabled = loading || isAlreadyMember || isRemoving
                      const classes = disabled
                        ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                        : 'bg-indigo-700 text-white hover:bg-[#8e79f2]'
                      const label = isRemoving
                        ? 'Removing…'
                        : isAlreadyMember
                          ? 'Already in group'
                          : 'Add'
                      return (
                        <button
                          className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${classes}`}
                          disabled={disabled}
                          onClick={() => handleAdd(searchResult.id)}
                        >
                          <Plus className='w-4 h-4' />
                          {label}
                        </button>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className='space-y-2 max-h-80 overflow-y-auto'>
              {visibleMembers.map((m) => {
                const isSelf = String(m.userId) === String(userId)
                const canKick = role === 'admin' && !isSelf && m.role !== 'admin'
                const canLeave = isSelf
                return (
                  <div
                    key={m.userId}
                    className='flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700'
                  >
                    <div className='flex items-center gap-3 min-w-0'>
                      <img
                        src={
                          m.profilePicture
                            ? formatProfileImage(m.profilePicture, m.username || m.userId)
                            : `https://ui-avatars.com/api/?name=${m.username || m.userId}&background=8e79f2&color=fff`
                        }
                        alt={m.username || m.userId}
                        className='w-9 h-9 rounded-full object-cover border-2 border-black'
                      />
                      <div className='min-w-0'>
                        <div className='text-white truncate'>
                          {m.username || m.userId}{' '}
                          {m.role === 'admin' && (
                            <span className='text-xs text-indigo-300'>(admin)</span>
                          )}
                          {isSelf && <span className='text-xs text-gray-300'> (you)</span>}
                        </div>
                      </div>
                    </div>
                    {(canKick || canLeave) && (
                      <button
                        className={`px-3 py-2 rounded-lg text-sm ${
                          pendingRemovals.has(String(m.userId))
                            ? 'bg-red-900 text-white cursor-not-allowed'
                            : 'bg-red-700 text-white hover:bg-red-600'
                        }`}
                        disabled={loading || pendingRemovals.has(String(m.userId))}
                        onClick={() => handleRemove(m.userId)}
                      >
                        {pendingRemovals.has(String(m.userId))
                          ? 'Removing…'
                          : isSelf
                            ? 'Leave'
                            : 'Remove'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

GroupHeader.propTypes = {
  groupId: PropTypes.string,
  groupName: PropTypes.string,
  groupDescription: PropTypes.string,
  groupProfilePicture: PropTypes.string,
  userId: PropTypes.string.isRequired,
}

export default GroupHeader
