import { UsersService } from '@services'
import { getSocket } from '../socket'

function normalizeSearchResponse(res) {
  if (Array.isArray(res?.users)) return res.users
  if (res?.user && typeof res.user === 'object') return [res.user]
  return []
}

const SOCKET_SEARCH_TIMEOUT_MS = 6000

function searchUsersViaSocket(searchTerm) {
  const socket = getSocket()
  if (!socket || typeof socket.emit !== 'function') return Promise.resolve([])

  // Do NOT gate on `socket.connected`: socket.io buffers emits while the
  // connection is (re)establishing and fires the ack once it's up, so bailing
  // out here silently returned zero results whenever the REST search fell back
  // to the socket before `connected` had flipped true (common on Tauri/mobile,
  // where REST search frequently returns no matches). A timeout guards against
  // a socket that never connects so the caller never hangs.
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => finish([]), SOCKET_SEARCH_TIMEOUT_MS)
    socket.emit('searchUser', { searchTerm }, (res) => finish(normalizeSearchResponse(res)))
  })
}

/**
 * Search users by username via HTTP, falling back to the socket handler when
 * the REST call fails or returns no matches (common on mobile/Tauri builds).
 */
export async function searchUsersByUsername(searchTerm) {
  const trimmed = String(searchTerm ?? '').trim()
  if (!trimmed) return []

  try {
    const res = await UsersService.search({ searchTerm: trimmed })
    const fromHttp = normalizeSearchResponse(res)
    if (fromHttp.length > 0) return fromHttp
  } catch (err) {
    console.warn('[userSearch] HTTP search failed, trying socket fallback:', err)
  }

  return searchUsersViaSocket(trimmed)
}
