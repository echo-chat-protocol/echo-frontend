import { describe, expect, it } from 'vitest'
import { analyzeMlsState } from '../debugMlsDump'

describe('analyzeMlsState', () => {
  it('flags roster/tree leaf index drift', () => {
    const analysis = analyzeMlsState({
      groupId: 'g1',
      epoch: 2,
      selfLeafIndex: 0,
      roster: [{ userId: 'alice', leafIndex: 0 }],
      tree: {
        leafData: {
          0: { userId: 'alice' },
          1: { userId: 'bob' },
        },
      },
      applicationSecretB64: 'secret',
      initSecretB64: 'init',
    })

    expect(analysis.leavesInTreeNotRoster).toEqual([1])
    expect(analysis.usersOnlyInTree).toEqual(['bob'])
    expect(analysis.hasApplicationSecret).toBe(true)
  })

  it('returns present:false for null state', () => {
    expect(analyzeMlsState(null)).toEqual({ present: false })
  })
})
