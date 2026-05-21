/**
 * Centralized socket service — singleton pattern.
 *
 * Import this file whenever you need socket functionality.
 * Never instantiate `io()` directly in components.
 */
import { io } from 'socket.io-client'
import { resolveApiBase } from '@/utils/network/apiBase'

// If VITE_SOCKET_URL is set (e.g., Render public URL), use it.
// Otherwise, connect to same-origin so Vite dev proxy (host:5173) forwards /socket.io → backend.
const RAW_SOCKET_URL = import.meta.env.VITE_SOCKET_URL
const RESOLVED_SOCKET_URL = RAW_SOCKET_URL ? resolveApiBase(RAW_SOCKET_URL) : resolveApiBase()

let socket = null

/**
 * Returns the singleton socket instance (creates it if not yet created).
 * Does NOT auto-connect — call connectSocket() explicitly.
 *
 * @returns {import('socket.io-client').Socket}
 */
export function getSocket() {
  if (!socket) {
    socket = io(RESOLVED_SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket'],
      path: '/socket.io',
    })

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message)
    })

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        console.warn('[Socket] Server forced disconnect. Will not auto-reconnect.')
      }
    })
  }
  return socket
}

/**
 * Connects the socket using the token stored in localStorage.
 * Safe to call multiple times — won't reconnect if already connected.
 */
export function connectSocket() {
  const token = localStorage.getItem('echo_access_token')
  const s = getSocket()
  s.auth = token ? { token } : {}
  if (!s.connected) {
    s.connect()
  }
}

/**
 * Disconnects and destroys the socket instance.
 * Call this on logout to fully clean up.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export default getSocket
