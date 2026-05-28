import { describe, expect, it, vi, beforeEach } from 'vitest'

const applyCommitMock = vi.fn()
const processWelcomeMock = vi.fn()
const saveGroupStateMock = vi.fn(async (_gid, state) => state)

vi.mock('../groupCryptoProvider', () => ({
  applyCommit: (...args) => applyCommitMock(...args),
  processWelcome: (...args) => processWelcomeMock(...args),
  saveGroupState: (...args) => saveGroupStateMock(...args),
  loadGroupState: vi.fn(),
}))

vi.mock('./welcomeTargeting', () => ({
  isGroupWelcomeForThisDevice: () => true,
  shouldApplyGroupWelcome: () => true,
}))

import { applyMlsArtifactsMultiPass } from '../groupCrypto/groupMlsReplay'

describe('applyMlsArtifactsMultiPass', () => {
  beforeEach(() => {
    applyCommitMock.mockReset()
    processWelcomeMock.mockReset()
    saveGroupStateMock.mockClear()
  })

  it('applies commits in multiple passes when a later epoch appears before an earlier one', async () => {
    const initialState = { groupId: 'g1', epoch: 2, initSecretB64: 'x', roster: [] }

    applyCommitMock
      .mockImplementationOnce(async ({ commit }) => ({
        ...initialState,
        epoch: commit.epoch,
      }))
      .mockImplementationOnce(async ({ commit }) => ({
        ...initialState,
        epoch: commit.epoch,
      }))

    const messages = [
      {
        seq: 2,
        contentType: 'commit',
        payload: JSON.stringify({ epoch: 4, type: 'add', groupId: 'g1' }),
      },
      {
        seq: 1,
        contentType: 'commit',
        payload: JSON.stringify({ epoch: 3, type: 'remove', groupId: 'g1' }),
      },
    ]

    const next = await applyMlsArtifactsMultiPass({
      groupId: 'g1',
      userId: 'alice',
      messages,
      initialState,
      myInitPrivKeyB64: 'priv',
    })

    expect(applyCommitMock).toHaveBeenCalledTimes(2)
    expect(next.epoch).toBe(4)
    expect(saveGroupStateMock).toHaveBeenCalled()
  })
})
