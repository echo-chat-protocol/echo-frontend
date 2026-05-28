import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const searchMock = vi.fn()
const emitMock = vi.fn()
let socketStub = null

vi.mock('@services', () => ({
  UsersService: { search: (...args) => searchMock(...args) },
}))

vi.mock('../socket', () => ({
  getSocket: () => socketStub,
}))

async function loadUtil() {
  const mod = await import('./userSearch.js')
  return mod.searchUsersByUsername
}

describe('searchUsersByUsername', () => {
  beforeEach(() => {
    searchMock.mockReset()
    emitMock.mockReset()
    socketStub = { emit: emitMock, connected: true }
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('returns HTTP matches when the REST search succeeds', async () => {
    searchMock.mockResolvedValue({ users: [{ id: 'u1', username: 'alice' }] })
    const searchUsersByUsername = await loadUtil()

    const res = await searchUsersByUsername('ali')

    expect(res).toEqual([{ id: 'u1', username: 'alice' }])
    expect(emitMock).not.toHaveBeenCalled()
  })

  it('falls back to the socket when REST throws', async () => {
    searchMock.mockRejectedValue(new Error('network down'))
    emitMock.mockImplementation((event, payload, cb) => {
      cb({ success: true, user: { id: 'u2', username: 'bob' } })
    })
    const searchUsersByUsername = await loadUtil()

    const res = await searchUsersByUsername('bo')

    expect(emitMock).toHaveBeenCalledWith('searchUser', { searchTerm: 'bo' }, expect.any(Function))
    expect(res).toEqual([{ id: 'u2', username: 'bob' }])
  })

  it('still emits the socket fallback when the socket is not flagged connected', async () => {
    // Regression: the old `if (!socket.connected) return []` guard silently
    // returned zero results whenever REST fell back before `connected` flipped
    // true (common on Tauri/mobile), making user search appear broken.
    searchMock.mockResolvedValue({ users: [] })
    socketStub = { emit: emitMock, connected: false }
    emitMock.mockImplementation((event, payload, cb) => {
      cb({ success: true, user: { id: 'u3', username: 'carol' } })
    })
    const searchUsersByUsername = await loadUtil()

    const res = await searchUsersByUsername('ca')

    expect(emitMock).toHaveBeenCalledWith('searchUser', { searchTerm: 'ca' }, expect.any(Function))
    expect(res).toEqual([{ id: 'u3', username: 'carol' }])
  })

  it('resolves to an empty list (without hanging) when the socket never acks', async () => {
    vi.useFakeTimers()
    try {
      searchMock.mockRejectedValue(new Error('network down'))
      emitMock.mockImplementation(() => {}) // never calls the ack
      const searchUsersByUsername = await loadUtil()

      const pending = searchUsersByUsername('zz')
      await vi.advanceTimersByTimeAsync(6000)
      const res = await pending

      expect(res).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })
})
