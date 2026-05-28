import { describe, expect, it } from 'vitest'
import { shouldShowCommitSystemMessage } from '../groupCrypto/commitArtifacts'

describe('commitArtifacts', () => {
  it('hides system rows for per-device leaf adds (same userId)', () => {
    const commit = {
      type: 'add',
      senderLeafIndex: 0,
      targetUserId: 'alice',
    }
    const priorState = {
      roster: [{ userId: 'alice', username: 'Alice', leafIndex: 0 }],
    }
    expect(shouldShowCommitSystemMessage({ commit, priorState })).toBe(false)
  })

  it('shows system rows when adding a different member', () => {
    const commit = {
      type: 'add',
      senderLeafIndex: 0,
      targetUserId: 'bob',
    }
    const priorState = {
      roster: [{ userId: 'alice', username: 'Alice', leafIndex: 0 }],
    }
    expect(shouldShowCommitSystemMessage({ commit, priorState })).toBe(true)
  })
})
