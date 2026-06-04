// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import CreateGroupModal from './CreateGroupModal'

const createNewGroupStateMock = vi.fn()
const buildInitialWelcomesMock = vi.fn()
const saveGroupStateMock = vi.fn()
const getIdentityKeysMock = vi.fn()
const formatProfileImageMock = vi.fn(() => 'profile.png')
const getSocketMock = vi.fn()

vi.mock('../../../socket', () => ({
  getSocket: (...args) => getSocketMock(...args),
}))

// Search runs through the shared `searchUsersByUsername` util (HTTP-first with a
// socket fallback). Mock it so these MLS tests exercise the group-creation flow
// deterministically instead of hitting the real network.
vi.mock('@/utils/userSearch', () => ({
  searchUsersByUsername: vi.fn().mockResolvedValue([{ id: 'bob', username: 'Bob' }]),
}))

vi.mock('../DashboardComponents/utils/helpers', () => ({
  formatProfileImage: (...args) => formatProfileImageMock(...args),
}))

vi.mock('../Chat/utils/chat/keyManagement', () => ({
  getIdentityKeys: (...args) => getIdentityKeysMock(...args),
}))

vi.mock('../Chat/utils/crypto/groupCryptoProvider', () => ({
  createNewGroupState: (...args) => createNewGroupStateMock(...args),
  buildInitialWelcomes: (...args) => buildInitialWelcomesMock(...args),
  saveGroupState: (...args) => saveGroupStateMock(...args),
}))

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('CreateGroupModal MLS initialization', () => {
  let container
  let root
  let socket

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    createNewGroupStateMock.mockReset()
    buildInitialWelcomesMock.mockReset()
    saveGroupStateMock.mockReset()
    getIdentityKeysMock.mockReset()
    formatProfileImageMock.mockClear()
    getIdentityKeysMock.mockResolvedValue({
      publicKeyX25519: 'alice-init-pub-b64',
      privateKeyX25519: 'alice-init-priv-b64',
    })

    socket = {
      emit: vi.fn((event, payload, callback) => {
        if (event === 'searchUser') {
          callback?.({ success: true, user: { id: 'bob', username: 'Bob' } })
          return
        }

        if (event === 'getUserInfo') {
          callback?.({ success: true, user: { profilePicture: null } })
          return
        }

        if (event === 'createGroup') {
          callback?.({
            success: true,
            group: {
              groupId: 'group-1',
              name: payload.name,
              mlsEnabled: payload.mlsEnabled === true,
              epoch: 0,
              cipherSuite: payload.cipherSuite ?? null,
            },
            members: [
              { userId: 'alice', leafIndex: 0 },
              { userId: 'bob', leafIndex: 1 },
            ],
          })
          return
        }

        if (event === 'fetchAllKeyPackages') {
          if (payload.userId === 'bob') {
            callback?.({
              success: true,
              packages: [{ clientId: 'bob-phone', initKeyB64: 'bob-init-key-b64' }],
            })
          } else {
            callback?.({ success: true, packages: [] })
          }
          return
        }

        if (event === 'fetchKeyPackage') {
          callback?.({ success: false, error: 'KeyPackage not found' })
          return
        }

        if (event === 'sendGroupWelcome') {
          callback?.({ success: true })
        }
      }),
      on: vi.fn(),
      off: vi.fn(),
    }

    getSocketMock.mockReturnValue(socket)
    createNewGroupStateMock.mockResolvedValue({
      groupId: 'group-1',
      groupKeyB64: 'creator-group-key-b64',
    })
    buildInitialWelcomesMock.mockResolvedValue([
      {
        groupId: 'group-1',
        epoch: 0,
        cipherSuite: 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256',
        roster: [
          { userId: 'alice', username: 'Member', leafIndex: 0 },
          { userId: 'bob', username: 'Bob', leafIndex: 1 },
        ],
        recipientUserId: 'bob',
        recipientLeafIndex: 1,
        wrappedInitSecret: {
          encryptedB64: 'init-ct',
          ephPubB64: 'init-pub',
          nonceB64: 'init-nonce',
        },
        wrappedCommitSecret: {
          encryptedB64: 'commit-ct',
          ephPubB64: 'commit-pub',
          nonceB64: 'commit-nonce',
        },
        treePublicNodes: ['alice-pub', 'root-pub', 'bob-pub'],
      },
    ])
    saveGroupStateMock.mockImplementation(async (_groupId, state) => state)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await flush()
    })
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('initializes group MLS state after successful MLS group creation', async () => {
    const onCreated = vi.fn()
    const onClose = vi.fn()

    await act(async () => {
      root.render(<CreateGroupModal open onClose={onClose} onCreated={onCreated} userId='alice' />)
      await flush()
    })

    const nameInput = container.querySelector('input[placeholder="Group name"]')
    const searchInput = container.querySelector('input[placeholder="Search by username…"]')
    await act(async () => {
      setInputValue(nameInput, 'Project Team')
      setInputValue(searchInput, 'Bob')
      await flush()
    })

    const searchAction = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Search')
    )

    await act(async () => {
      searchAction.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
    })

    const addButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Bob')
    )

    await act(async () => {
      addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
    })

    const createButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Create group')
    )

    await act(async () => {
      createButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
    })

    expect(socket.emit).toHaveBeenCalledWith(
      'createGroup',
      {
        name: 'Project Team',
        memberIds: ['bob'],
        mlsEnabled: true,
        cipherSuite: 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256',
      },
      expect.any(Function)
    )

    expect(createNewGroupStateMock).toHaveBeenCalledWith({
      groupId: 'group-1',
      creatorUserId: 'alice',
      roster: [
        { userId: 'alice', username: 'Member', leafIndex: 0 },
        { userId: 'bob', username: 'Bob', leafIndex: 1 },
      ],
      cipherSuite: 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256',
      memberInitKeys: [
        {
          userId: 'alice',
          leafIndex: 0,
          clientId: null,
          initKeyB64: 'alice-init-pub-b64',
          excludeFromWelcome: true,
        },
        {
          userId: 'bob',
          clientId: 'bob-phone',
          leafIndex: 1,
          initKeyB64: 'bob-init-key-b64',
          keyPackage: null,
        },
      ],
      selfInitPrivKeyB64: 'alice-init-priv-b64',
    })
    expect(buildInitialWelcomesMock).toHaveBeenCalledWith({
      creatorState: { groupId: 'group-1', groupKeyB64: 'creator-group-key-b64' },
      roster: [
        { userId: 'alice', username: 'Member', leafIndex: 0 },
        { userId: 'bob', username: 'Bob', leafIndex: 1 },
      ],
      memberInitKeys: [
        {
          userId: 'alice',
          leafIndex: 0,
          clientId: null,
          initKeyB64: 'alice-init-pub-b64',
          excludeFromWelcome: true,
        },
        {
          userId: 'bob',
          clientId: 'bob-phone',
          leafIndex: 1,
          initKeyB64: 'bob-init-key-b64',
          keyPackage: null,
        },
      ],
    })
    const welcomeEmitCall = socket.emit.mock.calls.find(
      ([eventName]) => eventName === 'sendGroupWelcome'
    )
    expect(welcomeEmitCall).toBeTruthy()
    expect(welcomeEmitCall[1]).toEqual({
      groupId: 'group-1',
      recipientUserId: 'bob',
      welcome: {
        groupId: 'group-1',
        epoch: 0,
        cipherSuite: 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256',
        roster: [
          { userId: 'alice', username: 'Member', leafIndex: 0 },
          { userId: 'bob', username: 'Bob', leafIndex: 1 },
        ],
        recipientUserId: 'bob',
        recipientLeafIndex: 1,
        wrappedInitSecret: {
          encryptedB64: 'init-ct',
          ephPubB64: 'init-pub',
          nonceB64: 'init-nonce',
        },
        wrappedCommitSecret: {
          encryptedB64: 'commit-ct',
          ephPubB64: 'commit-pub',
          nonceB64: 'commit-nonce',
        },
        treePublicNodes: ['alice-pub', 'root-pub', 'bob-pub'],
      },
    })
    expect(saveGroupStateMock).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({
        groupId: 'group-1',
        secrets: expect.objectContaining({
          epochInitSecretB64: null,
          epochCommitSecretB64: null,
        }),
      })
    )
    expect(onCreated).toHaveBeenCalledWith({
      groupId: 'group-1',
      name: 'Project Team',
      mlsEnabled: true,
      epoch: 0,
      cipherSuite: 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256',
      // createGroup now persists the picture/description atomically, so the
      // modal echoes the (empty) local values back through onCreated.
      profilePicture: '',
      description: '',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not zero epoch-0 seeds if sending a welcome fails', async () => {
    const onCreated = vi.fn()
    const onClose = vi.fn()

    socket.emit.mockImplementation((event, payload, callback) => {
      if (event === 'searchUser') {
        callback?.({ success: true, user: { id: 'bob', username: 'Bob' } })
        return
      }
      if (event === 'getUserInfo') {
        callback?.({ success: true, user: { profilePicture: null } })
        return
      }
      if (event === 'createGroup') {
        callback?.({
          success: true,
          group: {
            groupId: 'group-1',
            name: payload.name,
            mlsEnabled: true,
            epoch: 0,
            cipherSuite: payload.cipherSuite,
          },
          members: [
            { userId: 'alice', leafIndex: 0 },
            { userId: 'bob', leafIndex: 1 },
          ],
        })
        return
      }
      if (event === 'fetchAllKeyPackages') {
        if (payload.userId === 'bob') {
          callback?.({
            success: true,
            packages: [{ clientId: 'bob-phone', initKeyB64: 'bob-init-key-b64' }],
          })
        } else {
          callback?.({ success: true, packages: [] })
        }
        return
      }
      if (event === 'fetchKeyPackage') {
        callback?.({ success: false, error: 'KeyPackage not found' })
        return
      }
      if (event === 'sendGroupWelcome') {
        callback?.({ success: false, error: 'socket write failed' })
      }
    })

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await act(async () => {
      root.render(<CreateGroupModal open onClose={onClose} onCreated={onCreated} userId='alice' />)
      await flush()
    })

    const nameInput = container.querySelector('input[placeholder="Group name"]')
    const searchInput = container.querySelector('input[placeholder="Search by username…"]')
    await act(async () => {
      setInputValue(nameInput, 'Project Team')
      setInputValue(searchInput, 'Bob')
      await flush()
    })

    const searchAction = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Search')
    )
    await act(async () => {
      searchAction.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
    })

    const addButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Bob')
    )
    await act(async () => {
      addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
    })

    const createButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Create group')
    )
    await act(async () => {
      createButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
      await flush()
    })

    expect(saveGroupStateMock).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
