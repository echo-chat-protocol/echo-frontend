/**
 * Centralized socket service — singleton pattern.
 *
 * Import this file whenever you need socket functionality.
 * Never instantiate `io()` directly in components.
 */
import { io } from 'socket.io-client'
import { resolveApiBase } from '@/utils/network/apiBase'
import { refreshAccessToken, tokenStorage } from './api'

// If VITE_SOCKET_URL is set (e.g., Render public URL), use it.
// Otherwise, connect to same-origin so Vite dev proxy (host:5173) forwards /socket.io → backend.
const RAW_SOCKET_URL = import.meta.env.VITE_SOCKET_URL
const RESOLVED_SOCKET_URL = RAW_SOCKET_URL ? resolveApiBase(RAW_SOCKET_URL) : resolveApiBase()

let socket = null
let socketRefreshInFlight = false

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
      // Allow polling fallback in dev/proxy or constrained networks
      transports: ['websocket', 'polling'],
      path: '/socket.io',
    })

    socket.on('connect_error', async (err) => {
      console.error('[Socket] Connection error:', err.message)
      if (socketRefreshInFlight || !/unauthorized|token/i.test(String(err?.message ?? ''))) return

      socketRefreshInFlight = true
      try {
        const token = await refreshAccessToken()
        socket.auth = token ? { token } : {}
        socket.connect()
      } catch {
        // API layer clears invalid refresh state; leave auth flow to the app shell.
      } finally {
        socketRefreshInFlight = false
      }
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
  const token = tokenStorage.getAccess() || localStorage.getItem('token')
  const s = getSocket()
  const prevToken = s?.auth?.token || null
  // Always set latest auth payload
  s.auth = token ? { token } : {}

  // If not connected, connect now
  if (!s.connected) {
    s.connect()
    return
  }

  // If already connected but auth token changed (or was missing), re-auth by reconnecting
  const changed = String(prevToken || '') !== String(token || '')
  const hadNoAuth = !prevToken && !!token
  if (changed || hadNoAuth) {
    try {
      s.disconnect()
    } catch {
      /* ignore */
    }
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
