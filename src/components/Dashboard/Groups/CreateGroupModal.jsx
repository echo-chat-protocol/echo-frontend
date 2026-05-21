import { useCallback, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { X, Plus, Search } from 'lucide-react'
import { getSocket } from '../../../socket'
import { formatProfileImage } from '../DashboardComponents/utils/helpers'
import { getIdentityKeys } from '../Chat/utils/chat/keyManagement'

import {
  createNewGroupState,
  buildInitialWelcomes,
  saveGroupState,
} from '../Chat/utils/crypto/groupCryptoProvider'
import { forwardGroupStateToPairedDevices } from '../../../utils/deviceForward'

const CreateGroupModal = ({ open, onClose, onCreated, userId }) => {
  const [name, setName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)
  const socketRef = useRef(null)

  const socket = useMemo(() => {
    if (!socketRef.current) socketRef.current = getSocket()
    return socketRef.current
  }, [])

  const isSelected = (id) => selected.some((u) => String(u.id) === String(id))

  const addSelected = (user) => {
    if (!user?.id) return
    if (String(user.id) === String(userId)) return
    setSelected((prev) => (isSelected(user.id) ? prev : [...prev, user]))
  }

  const removeSelected = (id) => {
    setSelected((prev) => prev.filter((u) => String(u.id) !== String(id)))
  }

  const handleSearch = useCallback(() => {
    const term = searchTerm.trim()
    if (!term) return
    setLoading(true)

    socket.emit('searchUser', { searchTerm: term }, (response) => {
      if (!response?.success || !response?.user) {
        setLoading(false)
        return
      }

      const basicUser = response.user
      socket.emit('getUserInfo', { userId: basicUser.id }, (profileResponse) => {
        const profilePicture = profileResponse?.success
          ? profileResponse?.user?.profilePicture
          : null
        const formattedProfileImage = formatProfileImage(profilePicture, basicUser.username)
        const u = { ...basicUser, profileImage: formattedProfileImage }

        setResults((prev) => {
          const exists = prev.some((x) => String(x.id) === String(u.id))
          if (exists) return prev
          return [...prev, u]
        })
        setLoading(false)
      })
    })
  }, [searchTerm, socket])

  const handleCreate = async () => {
    const groupName = name.trim()
    if (!groupName) return
    const memberIds = selected.map((u) => u.id).filter(Boolean)
    if (memberIds.length === 0) return
    const mlsEnabled = true
    const cipherSuite = 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256'
    const emitWithAck = (event, payload) =>
      new Promise((resolve, reject) => {
        socket.emit(event, payload, (ack) => {
          if (ack?.success) {
            resolve(ack)
            return
          }
          reject(new Error(ack?.error || `Failed to ${event}`))
        })
      })

    setLoading(true)

    // Fetch ALL KeyPackages for each invited member (one per device/clientId).
    // Each package becomes a separate MLS leaf so every device can decrypt independently.
    const fetchAllPackages = (targetUserId) =>
      new Promise((resolve) => {
        socket.emit('fetchAllKeyPackages', { userId: targetUserId }, (res) => {
          if (res?.success && Array.isArray(res.packages) && res.packages.length > 0) {
            resolve(res.packages.filter((p) => p.initKeyB64))
          } else {
            // Fall back to the single-package endpoint for backward compat.
            socket.emit('fetchKeyPackage', { userId: targetUserId }, (r) => {
              resolve(
                r?.success && r.initKeyB64 ? [{ clientId: null, initKeyB64: r.initKeyB64 }] : []
              )
            })
          }
        })
      })

    const memberPackageResults = await Promise.all(
      selected.map(async (u) => ({ user: u, packages: await fetchAllPackages(u.id) }))
    )

    // Build flat list: { userId, username, clientId, initKeyB64 }
    const allMemberPackages = memberPackageResults.flatMap(({ user, packages }) =>
      packages.map((pkg) => ({
        userId: String(user.id),
        username: user.username,
        clientId: pkg.clientId ?? null,
        initKeyB64: pkg.initKeyB64,
      }))
    )

    // Block creation if any invited user has no KeyPackage at all.
    const missing = selected.filter(
      (u) => !allMemberPackages.some((p) => String(p.userId) === String(u.id))
    )
    if (missing.length > 0) {
      console.error(
        `[CreateGroupModal] Cannot create MLS group: missing KeyPackage for: ${missing.map((u) => u.username).join(', ')}`
      )
      setLoading(false)
      return
    }

    socket.emit(
      'createGroup',
      { name: groupName, memberIds, mlsEnabled, cipherSuite },
      async (ack) => {
        setLoading(false)
        if (!ack?.success) return

        // Use server-assigned leafIndex values from ack.members.
        const serverMembers = Array.isArray(ack.members) ? ack.members : []

        // Build one roster entry per package (primary + each device).
        // Server assigns leafIndices for primary members; device leaves get sequential indices after.
        const serverLeafMap = new Map(serverMembers.map((m) => [String(m.userId), m.leafIndex]))
        let nextLeafIndex =
          serverMembers.length > 0
            ? Math.max(...serverMembers.map((m) => m.leafIndex ?? 0)) + 1
            : selected.length + 1

        // Creator's MLS key: use device-specific key if available, else identity key.
        const identityKeys = mlsEnabled ? await getIdentityKeys() : null
        const creatorInitPubKeyB64 =
          localStorage.getItem('echo-device-mls-pub') || identityKeys?.publicKeyX25519 || null
        const creatorInitPrivKeyB64 =
          localStorage.getItem('echo-device-mls-priv') || identityKeys?.privateKeyX25519 || null
        const creatorDeviceId = localStorage.getItem('echo-device-id') || null

        if (mlsEnabled && (!creatorInitPubKeyB64 || !creatorInitPrivKeyB64)) {
          console.error('[CreateGroupModal] Missing local MLS identity keys for group creator')
          setLoading(false)
          return
        }

        // Build the full roster: one entry per (user, device) pair.
        const roster = []
        const memberInitKeysWithLeaf = []

        // Creator's primary leaf (server-assigned index).
        const creatorServerLeaf =
          serverLeafMap.get(String(userId)) ?? (serverMembers.length === 0 ? 0 : null)
        const creatorLeafIndex = creatorServerLeaf ?? 0
        roster.push({
          userId: String(userId),
          username: 'me',
          leafIndex: creatorLeafIndex,
          clientId: creatorDeviceId,
        })
        memberInitKeysWithLeaf.push({
          userId: String(userId),
          leafIndex: creatorLeafIndex,
          clientId: creatorDeviceId,
          initKeyB64: creatorInitPubKeyB64,
        })

        // Invited members: one leaf per package.
        for (const { userId: memberId, username, clientId, initKeyB64 } of allMemberPackages) {
          const serverLeaf = serverLeafMap.get(String(memberId))
          let leafIndex
          if (
            serverLeaf != null &&
            !roster.some((r) => String(r.userId) === String(memberId) && r.leafIndex === serverLeaf)
          ) {
            // First package for this user gets the server-assigned leaf.
            leafIndex = serverLeaf
          } else {
            // Additional packages (extra devices) get sequentially assigned leaves.
            leafIndex = nextLeafIndex++
          }
          roster.push({ userId: String(memberId), username, leafIndex, clientId: clientId ?? null })
          memberInitKeysWithLeaf.push({
            userId: String(memberId),
            leafIndex,
            clientId: clientId ?? null,
            initKeyB64,
          })
        }

        // Fill in fallback roster if server returned nothing.
        if (serverMembers.length === 0 && roster.length === 1) {
          selected.forEach((u, i) => {
            roster.push({
              userId: String(u.id),
              username: u.username,
              leafIndex: i + 1,
              clientId: null,
            })
            memberInitKeysWithLeaf.push({
              userId: String(u.id),
              leafIndex: i + 1,
              clientId: null,
              initKeyB64: '',
            })
          })
        }

        try {
          const creatorState = await createNewGroupState({
            groupId: ack.group.groupId,
            creatorUserId: userId,
            roster,
            cipherSuite: ack.group?.cipherSuite ?? cipherSuite ?? undefined,
            memberInitKeys: memberInitKeysWithLeaf,
            selfInitPrivKeyB64: creatorInitPrivKeyB64,
          })

          if (mlsEnabled && creatorState?.groupKeyB64) {
            const welcomes = await buildInitialWelcomes({
              creatorState,
              roster,
              memberInitKeys: memberInitKeysWithLeaf,
            })

            for (const welcome of welcomes) {
              await emitWithAck('sendGroupWelcome', {
                groupId: ack.group.groupId,
                recipientUserId: welcome.recipientUserId,
                welcome,
              })
            }

            const savedCreatorState = await saveGroupState(ack.group.groupId, {
              ...creatorState,
              secrets: {
                ...creatorState.secrets,
                initSecretB64:
                  creatorState.initSecretB64 ?? creatorState.secrets?.initSecretB64 ?? null,
                epochInitSecretB64: null,
                epochCommitSecretB64: null,
              },
            })
            forwardGroupStateToPairedDevices(userId, ack.group.groupId, savedCreatorState).catch(
              () => {}
            )
          }
        } catch (err) {
          console.error('[CreateGroupModal] Failed to initialize MLS state:', err)
        }

        onCreated?.(ack.group)
        setName('')
        setSearchTerm('')
        setResults([])
        setSelected([])
        onClose?.()
      }
    )
  }

  if (!open) return null

  return (
    <div className='fixed inset-0 bg-black/70 flex items-center justify-center z-50'>
      <div className='bg-gray-900 rounded-lg p-4 max-w-xl w-full mx-4 border border-gray-700'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold text-white'>Create a group</h3>
          <button onClick={onClose} className='text-gray-400 hover:text-white'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='space-y-3'>
          <input
            type='text'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Group name'
            className='w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8e79f2]'
          />

          <div className='flex gap-2'>
            <div className='relative w-full'>
              <input
                type='text'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder='Search username to add...'
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

          {selected.length > 0 && (
            <div className='bg-gray-800/60 border border-gray-700 rounded-lg p-3'>
              <div className='text-sm text-gray-300 mb-2'>Members</div>
              <div className='flex flex-wrap gap-2'>
                {selected.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => removeSelected(u.id)}
                    className='px-2 py-1 bg-gray-700 text-white rounded-full text-xs hover:bg-gray-600'
                    title='Remove'
                  >
                    {u.username} <span className='text-gray-300'>×</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className='grid grid-cols-1 gap-2 max-h-56 overflow-y-auto'>
            {results.map((u) => (
              <div
                key={u.id}
                className='flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700'
              >
                <div className='flex items-center gap-3 min-w-0'>
                  <img
                    src={u.profileImage}
                    alt={u.username}
                    className='w-9 h-9 rounded-full object-cover border-2 border-black'
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${u.username}&background=8e79f2&color=fff`
                    }}
                  />
                  <div className='truncate text-white'>{u.username}</div>
                </div>
                <button
                  className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                    isSelected(u.id)
                      ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                      : 'bg-indigo-700 text-white hover:bg-[#8e79f2]'
                  }`}
                  disabled={isSelected(u.id) || loading || String(u.id) === String(userId)}
                  onClick={() => addSelected(u)}
                >
                  <Plus className='w-4 h-4' />
                  Add
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || !name.trim() || selected.length === 0}
            className={`w-full p-3 rounded-lg font-semibold ${
              loading || !name.trim() || selected.length === 0
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-700 text-white hover:bg-[#8e79f2]'
            }`}
          >
            {loading ? 'Creating...' : 'Create group'}
          </button>
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
