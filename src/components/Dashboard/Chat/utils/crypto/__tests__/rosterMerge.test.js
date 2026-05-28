import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  mergeAccountRosterIntoMlsRoster,
  resolveDeviceAwareSelfLeafIndex,
} from '../groupCrypto/rosterMerge'

describe('rosterMerge', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => 'device-pub-key'),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps all local device leaves for users still on the account roster', () => {
    const merged = mergeAccountRosterIntoMlsRoster({
      localRoster: [
        { userId: 'bob', username: 'Bob', leafIndex: 1 },
        { userId: 'bob', username: 'Bob phone', leafIndex: 3 },
      ],
      accountRoster: [{ userId: 'bob', username: 'Bob', leafIndex: 1 }],
    })

    expect(merged.map((m) => m.leafIndex).sort()).toEqual([1, 3])
  })

  it('drops local leaves when the account roster no longer includes that user', () => {
    const merged = mergeAccountRosterIntoMlsRoster({
      localRoster: [
        { userId: 'bob', username: 'Bob', leafIndex: 1 },
        { userId: 'carol', username: 'Carol', leafIndex: 2 },
      ],
      accountRoster: [{ userId: 'bob', username: 'Bob', leafIndex: 1 }],
    })

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ userId: 'bob', username: 'Bob', leafIndex: 1 })
  })

  it('resolves self leaf by device MLS public key when multiple leaves share a userId', () => {
    const leafIndex = resolveDeviceAwareSelfLeafIndex({
      selfUserId: 'alice',
      currentSelfLeafIndex: null,
      roster: [
        { userId: 'alice', username: 'Alice desktop', leafIndex: 0 },
        { userId: 'alice', username: 'Alice phone', leafIndex: 2 },
      ],
      treeNodes: [
        { publicKeyB64: 'other-key', privateKeyB64: null },
        null,
        null,
        null,
        { publicKeyB64: 'device-pub-key', privateKeyB64: 'priv' },
      ],
    })

    expect(leafIndex).toBe(2)
  })

  it('returns null instead of guessing the first leaf for this userId', () => {
    const leafIndex = resolveDeviceAwareSelfLeafIndex({
      selfUserId: 'alice',
      currentSelfLeafIndex: null,
      roster: [
        { userId: 'alice', username: 'Alice desktop', leafIndex: 0 },
        { userId: 'alice', username: 'Alice phone', leafIndex: 2 },
      ],
      treeNodes: [
        { publicKeyB64: 'desktop-key', privateKeyB64: null },
        null,
        null,
        null,
        { publicKeyB64: 'other-device-key', privateKeyB64: null },
      ],
    })

    expect(leafIndex).toBeNull()
  })
})
