/**
 * Centralized socket service — singleton pattern.
 *
 * Import this file whenever you need socket functionality.
 * Never instantiate `io()` directly in components.
 */
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

let socket = null

/**
 * Returns the singleton socket instance (creates it if not yet created).
 * Does NOT auto-connect — call connectSocket() explicitly.
 *
 * @returns {import('socket.io-client').Socket}
 */
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket'],
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
