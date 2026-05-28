import { UsersService } from '@services'
import { getSocket } from '../socket'

function normalizeSearchResponse(res) {
  if (Array.isArray(res?.users)) return res.users
  if (res?.user && typeof res.user === 'object') return [res.user]
  return []
}

function searchUsersViaSocket(searchTerm) {
  const socket = getSocket()
  if (!socket?.connected) return Promise.resolve([])

  return new Promise((resolve) => {
    socket.emit('searchUser', { searchTerm }, (res) => {
      resolve(normalizeSearchResponse(res))
    })
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
