import { describe, it, expect } from 'vitest'
import {
  upsertTypist,
  removeTypist,
  activeTypists,
  formatTypingText,
  TYPING_TTL_MS,
} from './typing'

describe('upsertTypist', () => {
  it('adds a typist with an expiry in the future', () => {
    const m = upsertTypist({}, { userId: 'U2', username: 'Bob' }, 1000)
    expect(m.U2).toEqual({ username: 'Bob', expiresAt: 1000 + TYPING_TTL_MS })
  })

  it('refreshes the deadline on a repeat ping', () => {
    let m = upsertTypist({}, { userId: 'U2', username: 'Bob' }, 1000)
    m = upsertTypist(m, { userId: 'U2', username: 'Bob' }, 5000)
    expect(m.U2.expiresAt).toBe(5000 + TYPING_TTL_MS)
  })

  it('defaults a missing username and ignores a missing id', () => {
    expect(upsertTypist({}, { userId: 'U3' }, 0).U3.username).toBe('Member')
    expect(upsertTypist({}, {}, 0)).toEqual({})
  })

  it('does not mutate the input map', () => {
    const orig = {}
    upsertTypist(orig, { userId: 'U2', username: 'Bob' }, 0)
    expect(orig).toEqual({})
  })
})

describe('removeTypist', () => {
  it('removes a present typist', () => {
    const m = upsertTypist({}, { userId: 'U2', username: 'Bob' }, 0)
    expect(removeTypist(m, 'U2')).toEqual({})
  })

  it('returns the same reference when absent (no needless re-render)', () => {
    const m = upsertTypist({}, { userId: 'U2', username: 'Bob' }, 0)
    expect(removeTypist(m, 'NOPE')).toBe(m)
  })
})

describe('activeTypists', () => {
  it('filters out expired entries', () => {
    let m = upsertTypist({}, { userId: 'A', username: 'Alice' }, 0, 1000) // expires at 1000
    m = upsertTypist(m, { userId: 'B', username: 'Bob' }, 0, 9000) // expires at 9000
    const active = activeTypists(m, 2000)
    expect(active).toEqual([{ userId: 'B', username: 'Bob' }])
  })

  it('preserves insertion order', () => {
    let m = upsertTypist({}, { userId: 'A', username: 'Alice' }, 0)
    m = upsertTypist(m, { userId: 'B', username: 'Bob' }, 0)
    expect(activeTypists(m, 0).map((t) => t.username)).toEqual(['Alice', 'Bob'])
  })
})

describe('formatTypingText', () => {
  it('returns null when nobody is typing', () => {
    expect(formatTypingText([], { isGroup: true })).toBe(null)
    expect(formatTypingText(undefined, { isGroup: false })).toBe(null)
  })

  it('DM ignores names and says just "typing…"', () => {
    expect(formatTypingText(['Bob'], { isGroup: false })).toBe('typing…')
    expect(formatTypingText(['Bob'])).toBe('typing…')
  })

  it('group: one name', () => {
    expect(formatTypingText(['Alice'], { isGroup: true })).toBe('Alice is typing…')
  })

  it('group: two names use "and"', () => {
    expect(formatTypingText(['Alice', 'Bob'], { isGroup: true })).toBe('Alice and Bob are typing…')
  })

  it('group: three names use comma + and', () => {
    expect(formatTypingText(['Alice', 'Bob', 'Carol'], { isGroup: true })).toBe(
      'Alice, Bob and Carol are typing…'
    )
  })

  it('group: more than three collapses to a count', () => {
    expect(formatTypingText(['A', 'B', 'C', 'D'], { isGroup: true })).toBe('4 people typing…')
    expect(formatTypingText(['A', 'B', 'C', 'D', 'E'], { isGroup: true })).toBe('5 people typing…')
  })

  it('drops falsy names before counting', () => {
    expect(formatTypingText(['Alice', '', null], { isGroup: true })).toBe('Alice is typing…')
  })
})
