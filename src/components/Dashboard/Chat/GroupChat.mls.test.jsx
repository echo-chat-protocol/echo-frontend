// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import GroupChat from './GroupChat'

// ── Why this file was rewritten ────────────────────────────────────────────────
//
// GroupChat's MLS load/decrypt/replay logic was extracted into dedicated helper
// modules (`groupMlsReplay`, `groupMessageDecryption`) that each now carry their
// own unit tests, and the composer was gated behind an async "securing" state
// (it only pops up once MLS key material lands). The previous version of this
// file asserted on low-level provider calls that GroupChat no longer makes
// directly, so every test broke. This rewrite mocks the new module boundary and
// verifies GroupChat's *orchestration*: how it wires the helpers up, drives the
// socket protocol, and reflects MLS readiness/membership in the UI.

// ── Provider (low-level MLS primitives) ─────────────────────────────────────────
const loadGroupStateMock = vi.fn()
const createNewGroupStateMock = vi.fn()
const saveGroupStateMock = vi.fn()
const encryptApplicationMessageMock = vi.fn()
const decryptApplicationMessageMock = vi.fn()
const applyCommitMock = vi.fn()
const processWelcomeMock = vi.fn()

// ── Extracted helpers ───────────────────────────────────────────────────────────
const prepareGroupMlsForSendMock = vi.fn()
const fetchAllGroupMessagesMock = vi.fn()
const fetchGroupServerEpochMock = vi.fn()
const bootstrapGroupMlsOnDeviceMock = vi.fn()
const rebuildMlsStateForDecryptFailureMock = vi.fn()
const decryptIncomingGroupMessageMock = vi.fn()

// ── Persistence / misc ──────────────────────────────────────────────────────────
const getIdentityKeysMock = vi.fn()
const getSavedMessagesMock = vi.fn()
const updateSavedMessagesMock = vi.fn()
const storeSavedMessagesBatchMock = vi.fn()
const setPendingOutgoingGroupMessageMock = vi.fn()
const deletePendingOutgoingGroupMessageMock = vi.fn()
const getSocketMock = vi.fn()

vi.mock('../../../socket', () => ({
  getSocket: (...args) => getSocketMock(...args),
}))

vi.mock('./MessageDisplay/displayText', () => ({
  default: ({ messages }) => (
    <div data-testid='display-text'>{messages.map((message) => message.text).join('|')}</div>
  ),
}))

vi.mock('./MessageDisplay/TypingIndicator', () => ({ default: () => null }))

// The composer is mocked to a single button exposing disabled state so we can
// assert MLS readiness without driving the real input.
vi.mock('./MessageInput/sendText', () => ({
  default: ({ sendMessage, disabled, disabledReason }) => (
    <button
      data-testid='group-send-text'
      data-disabled={disabled ? 'true' : 'false'}
      data-disabled-reason={disabledReason ?? ''}
      disabled={disabled}
      onClick={() => sendMessage('client message')}
    >
      send
    </button>
  ),
}))

vi.mock('../DashboardComponents/utils/helpers', () => ({
  formatProfileImage: () => '',
}))

vi.mock('./utils/chat/typing', () => ({
  upsertTypist: (list) => list ?? [],
  removeTypist: (list) => list ?? [],
  activeTypists: () => [],
  formatTypingText: () => '',
  TYPING_TTL_MS: 5000,
}))

vi.mock('./utils/crypto/groupCryptoProvider', () => ({
  loadGroupState: (...a) => loadGroupStateMock(...a),
  createNewGroupState: (...a) => createNewGroupStateMock(...a),
  saveGroupState: (...a) => saveGroupStateMock(...a),
  encryptApplicationMessage: (...a) => encryptApplicationMessageMock(...a),
  decryptApplicationMessage: (...a) => decryptApplicationMessageMock(...a),
  applyCommit: (...a) => applyCommitMock(...a),
  processWelcome: (...a) => processWelcomeMock(...a),
}))

vi.mock('./utils/chat/keyManagement', () => ({
  getIdentityKeys: (...a) => getIdentityKeysMock(...a),
  getSavedMessages: (...a) => getSavedMessagesMock(...a),
  updateSavedMessages: (...a) => updateSavedMessagesMock(...a),
  storeSavedMessagesBatch: (...a) => storeSavedMessagesBatchMock(...a),
  setPendingOutgoingGroupMessage: (...a) => setPendingOutgoingGroupMessageMock(...a),
  deletePendingOutgoingGroupMessage: (...a) => deletePendingOutgoingGroupMessageMock(...a),
}))

vi.mock('./utils/chat/groupMessageDecryption', () => ({
  decryptIncomingGroupMessage: (...a) => decryptIncomingGroupMessageMock(...a),
  decodeGroupMessagePayload: () => ({ text: '', image: null, replyTo: null }),
  encodeGroupMessagePayload: () => new TextEncoder().encode('client message'),
}))

vi.mock('../../../utils/deviceForward', () => ({
  forwardGroupMessageToPairedDevices: vi.fn().mockResolvedValue(undefined),
  forwardGroupStateToPairedDevices: vi.fn().mockResolvedValue(undefined),
  processIncomingEnvelopes: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./utils/crypto/groupCrypto/welcomeTargeting', () => ({
  isGroupWelcomeForThisDevice: () => true,
  shouldApplyGroupWelcome: () => true,
}))

vi.mock('@/features/devices/mlsDeviceKeyPackage', () => ({
  resolveProcessWelcomeOptions: () => ({}),
}))

vi.mock('./utils/crypto/groupCrypto/groupMlsReplay', () => ({
  prepareGroupMlsForSend: (...a) => prepareGroupMlsForSendMock(...a),
  fetchGroupServerEpoch: (...a) => fetchGroupServerEpochMock(...a),
  bootstrapGroupMlsOnDevice: (...a) => bootstrapGroupMlsOnDeviceMock(...a),
  rebuildMlsStateForDecryptFailure: (...a) => rebuildMlsStateForDecryptFailureMock(...a),
  resolveMyInitPrivKeyB64: (_state, fallback) => fallback ?? null,
  pickBetterState: (current, candidate) => candidate ?? current,
  fetchAllGroupMessages: (...a) => fetchAllGroupMessagesMock(...a),
}))

vi.mock('./utils/crypto/groupCrypto/rosterMerge', () => ({
  mergeAccountRosterIntoMlsRoster: ({ localRoster }) => localRoster ?? [],
}))

vi.mock('./utils/chat/replyContext', () => ({
  buildReplyContext: (m) => m,
}))

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
// The initial-open path chains several awaits (openGroup → sync → prepare →
// getSavedMessages → fetchGroupMessages → replay → batch save). Drain them.
const settle = async () => {
  for (let i = 0; i < 6; i += 1) await flush()
}

function readyState(overrides = {}) {
  return {
    groupId: 'group-1',
    epoch: 2,
    cipherSuite: 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256',
    selfUserId: 'alice',
    selfLeafIndex: 0,
    groupKeyB64: 'group-key',
    applicationSecretB64: 'app-secret',
    applicationMessageCounter: 0,
    roster: [
      { userId: 'alice', username: 'Alice', leafIndex: 0 },
      { userId: 'bob', username: 'Bob', leafIndex: 1 },
    ],
    tree: { nodes: [], root: null },
    secrets: { epochSecretsB64: null, initSecretB64: null },
    pendingCommits: [],
    ...overrides,
  }
}

function makeOpenGroupResponse(overrides = {}) {
  return {
    success: true,
    group: {
      groupId: 'group-1',
      name: 'Project Team',
      createdBy: 'alice',
      mlsEnabled: true,
      epoch: 2,
      cipherSuite: 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256',
      ...(overrides.group ?? {}),
    },
    members: [
      { userId: 'alice', username: 'Alice', leafIndex: 0, status: 'active' },
      { userId: 'bob', username: 'Bob', leafIndex: 1, status: 'active' },
      ...(overrides.members ?? []),
    ],
    membership: { role: 'admin', leafIndex: 0, status: 'active', ...(overrides.membership ?? {}) },
  }
}

function makeSocket() {
  return {
    emit: vi.fn((event, payload, callback) => {
      if (event === 'openGroup') {
        callback?.(makeOpenGroupResponse())
        return
      }
      if (event === 'fetchGroupMessages') {
        callback?.({ success: true, messages: [] })
        return
      }
      if (event === 'sendGroupMessage') {
        callback?.({ success: true, seq: 1, messageId: 'srv-1', createdAt: '2026-03-22T00:00:00Z' })
      }
    }),
    on: vi.fn(),
    off: vi.fn(),
  }
}

const listenerFor = (socket, name) =>
  socket.on.mock.calls.find(([eventName]) => eventName === name)?.[1]

let container
let root
let socket

const renderGroup = async (props = {}) => {
  await act(async () => {
    root.render(
      <GroupChat
        activeGroupId='group-1'
        userId='alice'
        username='Alice'
        currentWallpaper='default'
        {...props}
      />
    )
    await settle()
  })
}

describe('GroupChat MLS orchestration', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    Element.prototype.scrollIntoView = vi.fn()

    vi.clearAllMocks()

    getIdentityKeysMock.mockResolvedValue(null)
    getSavedMessagesMock.mockResolvedValue([])
    storeSavedMessagesBatchMock.mockResolvedValue(undefined)
    fetchAllGroupMessagesMock.mockResolvedValue([])
    saveGroupStateMock.mockImplementation(async (_groupId, state) => ({ ...state }))
    updateSavedMessagesMock.mockImplementation(async (_userId, _targetId, message, setMessages) => {
      if (setMessages) {
        setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]))
      }
    })
    // By default, prepare echoes whatever state it was handed (with its epoch).
    prepareGroupMlsForSendMock.mockImplementation(async ({ currentState }) => ({
      state: currentState,
      serverEpoch: currentState?.epoch,
    }))
    // The live/commit/welcome decrypt path appends a rendered row itself.
    decryptIncomingGroupMessageMock.mockImplementation(
      async ({ message, currentState, setMessages }) => {
        const formattedMessage = {
          _id: message._id ?? 'decrypted-1',
          userId: message.userId,
          username: message.username,
          text: 'live incoming',
          createdAt: message.createdAt ?? new Date().toISOString(),
        }
        if (setMessages) {
          setMessages((prev) =>
            prev.some((m) => m._id === formattedMessage._id) ? prev : [...prev, formattedMessage]
          )
        }
        return { formattedMessage, nextState: currentState }
      }
    )

    socket = makeSocket()
    getSocketMock.mockReturnValue(socket)
    localStorage.clear()
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await flush()
    })
    document.body.innerHTML = ''
  })

  it('opens an MLS group, prepares state, and pops up the composer when key material is ready', async () => {
    loadGroupStateMock.mockResolvedValue(readyState())

    await renderGroup()

    expect(loadGroupStateMock).toHaveBeenCalledWith('group-1')
    expect(prepareGroupMlsForSendMock).toHaveBeenCalled()

    const sendButton = container.querySelector('[data-testid="group-send-text"]')
    expect(sendButton).not.toBeNull()
    expect(sendButton.getAttribute('data-disabled')).toBe('false')
  })

  it('keeps the composer down (securing) for an invited member with no key material', async () => {
    // No local state yet → sync writes a placeholder with groupKeyB64=null,
    // and prepare cannot produce key material.
    loadGroupStateMock.mockResolvedValue(null)
    socket.emit.mockImplementation((event, payload, callback) => {
      if (event === 'openGroup') {
        callback?.(
          makeOpenGroupResponse({
            group: { createdBy: 'carol' },
            membership: { role: 'member', leafIndex: 1 },
          })
        )
        return
      }
      if (event === 'fetchGroupMessages') callback?.({ success: true, messages: [] })
    })

    await renderGroup({ userId: 'bob', username: 'Bob' })

    // Placeholder state was persisted with no key material…
    expect(saveGroupStateMock).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({ selfUserId: 'bob', selfLeafIndex: 1, groupKeyB64: null })
    )
    // …so the composer never pops up.
    expect(container.querySelector('[data-testid="group-send-text"]')).toBeNull()
  })

  it('encrypts and sends an MLS message, then persists the advanced state', async () => {
    loadGroupStateMock.mockResolvedValue(readyState())
    encryptApplicationMessageMock.mockResolvedValue({
      header: { groupId: 'group-1', epoch: 2, senderLeafIndex: 0 },
      headerB64: 'header-out',
      ciphertextB64: 'ciphertext-out',
      nonceB64: 'nonce-out',
      encryptedSenderDataB64: null,
      newState: readyState({ applicationMessageCounter: 1 }),
    })

    await renderGroup()

    const sendButton = container.querySelector('[data-testid="group-send-text"]')
    expect(sendButton).not.toBeNull()

    await act(async () => {
      sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await settle()
    })

    expect(encryptApplicationMessageMock).toHaveBeenCalledTimes(1)
    expect(encryptApplicationMessageMock.mock.calls[0][0].state).toEqual(
      expect.objectContaining({ groupId: 'group-1', selfLeafIndex: 0 })
    )

    expect(socket.emit).toHaveBeenCalledWith(
      'sendGroupMessage',
      expect.objectContaining({
        groupId: 'group-1',
        nonce: 'nonce-out',
        contentType: 'application',
        headerB64: 'header-out',
        ciphertextB64: 'ciphertext-out',
        epoch: 2,
        senderLeafIndex: 0,
      }),
      expect.any(Function)
    )

    expect(setPendingOutgoingGroupMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'group-1',
        headerB64: 'header-out',
        ciphertextB64: 'ciphertext-out',
        text: 'client message',
      })
    )
    expect(saveGroupStateMock).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({ applicationMessageCounter: 1 })
    )
  })

  it('decrypts a live newGroupMessage through the extracted helper and renders it', async () => {
    loadGroupStateMock.mockResolvedValue(readyState())

    await renderGroup()

    const liveListener = listenerFor(socket, 'newGroupMessage')
    expect(typeof liveListener).toBe('function')

    await act(async () => {
      await liveListener({
        groupId: 'group-1',
        _id: 'live-1',
        seq: 5,
        userId: 'bob',
        username: 'Bob',
        contentType: 'application',
        headerB64: 'header-live',
        ciphertextB64: 'cipher-live',
        createdAt: '2026-03-22T15:00:00.000Z',
      })
      await flush()
    })

    expect(decryptIncomingGroupMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ groupId: 'group-1', headerB64: 'header-live' }),
        userId: 'alice',
        currentState: expect.objectContaining({ groupId: 'group-1' }),
      })
    )
    expect(container.querySelector('[data-testid="display-text"]').textContent).toContain(
      'live incoming'
    )
  })

  it('applies a peer group commit and renders the membership system row', async () => {
    // Self is bob; the commit is authored by alice (leaf 0), so it is not an
    // own-commit short-circuit and must be applied.
    loadGroupStateMock.mockResolvedValue(readyState({ selfUserId: 'bob', selfLeafIndex: 1 }))
    socket.emit.mockImplementation((event, payload, callback) => {
      if (event === 'openGroup') {
        callback?.(makeOpenGroupResponse({ membership: { role: 'member', leafIndex: 1 } }))
        return
      }
      if (event === 'fetchGroupMessages') callback?.({ success: true, messages: [] })
    })
    applyCommitMock.mockResolvedValue(
      readyState({
        selfUserId: 'bob',
        selfLeafIndex: 1,
        epoch: 3,
        groupKeyB64: 'next-group-key',
        roster: [
          { userId: 'alice', username: 'Alice', leafIndex: 0 },
          { userId: 'bob', username: 'Bob', leafIndex: 1 },
          { userId: 'carol', username: 'Carol', leafIndex: 2 },
        ],
      })
    )

    await renderGroup({ userId: 'bob', username: 'Bob' })

    const commitListener = listenerFor(socket, 'groupCommit')
    expect(typeof commitListener).toBe('function')

    await act(async () => {
      await commitListener({
        groupId: 'group-1',
        commit: {
          groupId: 'group-1',
          epoch: 3,
          type: 'add',
          senderLeafIndex: 0,
          roster: [
            { userId: 'alice', username: 'Alice', leafIndex: 0 },
            { userId: 'bob', username: 'Bob', leafIndex: 1 },
            { userId: 'carol', username: 'Carol', leafIndex: 2 },
          ],
          nextGroupKeyB64: 'next-group-key',
          targetUserId: 'carol',
          targetLeafIndex: 2,
        },
      })
      await flush()
    })

    expect(applyCommitMock).toHaveBeenCalledWith(
      expect.objectContaining({ state: expect.objectContaining({ epoch: 2 }) })
    )
    expect(saveGroupStateMock).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({ epoch: 3, groupKeyB64: 'next-group-key' })
    )
    expect(container.querySelector('[data-testid="display-text"]').textContent).toContain(
      'Alice added Carol'
    )
  })

  it('returns the composer to securing after a commit removes the current user', async () => {
    loadGroupStateMock.mockResolvedValue(readyState({ selfUserId: 'bob', selfLeafIndex: 1 }))
    socket.emit.mockImplementation((event, payload, callback) => {
      if (event === 'openGroup') {
        callback?.(makeOpenGroupResponse({ membership: { role: 'member', leafIndex: 1 } }))
        return
      }
      if (event === 'fetchGroupMessages') callback?.({ success: true, messages: [] })
    })
    applyCommitMock.mockResolvedValue({
      ...readyState({ selfUserId: 'bob' }),
      epoch: 3,
      selfLeafIndex: null,
      groupKeyB64: null,
      applicationSecretB64: null,
      roster: [{ userId: 'alice', username: 'Alice', leafIndex: 0 }],
    })

    await renderGroup({ userId: 'bob', username: 'Bob' })
    expect(container.querySelector('[data-testid="group-send-text"]')).not.toBeNull()

    const commitListener = listenerFor(socket, 'groupCommit')
    await act(async () => {
      await commitListener({
        groupId: 'group-1',
        commit: {
          groupId: 'group-1',
          epoch: 3,
          type: 'remove',
          senderLeafIndex: 0,
          roster: [{ userId: 'alice', username: 'Alice', leafIndex: 0 }],
          nextGroupKeyB64: 'next-group-key',
          targetUserId: 'bob',
          targetLeafIndex: 1,
        },
      })
      await flush()
    })

    expect(applyCommitMock).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-testid="display-text"]').textContent).toContain(
      'Alice removed Bob from the group'
    )
    // Losing key material drops the composer back to the securing spinner.
    expect(container.querySelector('[data-testid="group-send-text"]')).toBeNull()
  })

  it('processes a live groupWelcome and pops up the composer for the invited member', async () => {
    loadGroupStateMock.mockResolvedValue(null)
    processWelcomeMock.mockResolvedValue(
      readyState({ selfUserId: 'bob', selfLeafIndex: 1, groupKeyB64: 'welcome-group-key' })
    )
    socket.emit.mockImplementation((event, payload, callback) => {
      if (event === 'openGroup') {
        callback?.(
          makeOpenGroupResponse({
            group: { createdBy: 'alice' },
            membership: { role: 'member', leafIndex: 1 },
          })
        )
        return
      }
      if (event === 'fetchGroupMessages') callback?.({ success: true, messages: [] })
    })

    await renderGroup({ userId: 'bob', username: 'Bob' })
    // Invited, no key material yet → composer down.
    expect(container.querySelector('[data-testid="group-send-text"]')).toBeNull()

    const welcomeListener = listenerFor(socket, 'groupWelcome')
    expect(typeof welcomeListener).toBe('function')

    await act(async () => {
      await welcomeListener({
        groupId: 'group-1',
        welcome: {
          groupId: 'group-1',
          epoch: 2,
          cipherSuite: 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256',
          recipientUserId: 'bob',
          recipientLeafIndex: 1,
          groupKeyB64: 'welcome-group-key',
        },
      })
      await flush()
    })

    expect(processWelcomeMock).toHaveBeenCalledWith(expect.objectContaining({ selfUserId: 'bob' }))
    expect(saveGroupStateMock).toHaveBeenLastCalledWith(
      'group-1',
      expect.objectContaining({ selfUserId: 'bob', groupKeyB64: 'welcome-group-key' })
    )
    const sendButton = container.querySelector('[data-testid="group-send-text"]')
    expect(sendButton).not.toBeNull()
    expect(sendButton.getAttribute('data-disabled')).toBe('false')
  })
})
