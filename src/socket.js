// Single-source socket service wrapper that reuses the implementation in
// services/socket.js, so the entire app shares ONE Socket.IO instance.
// This eliminates subtle bugs where different modules created separate sockets
// with different auth states.

import {
  getSocket as coreGetSocket,
  connectSocket as coreConnectSocket,
  disconnectSocket as coreDisconnectSocket,
} from './services/socket'

export function getSocket() {
  // Delegates to the core service (single instance)
  return coreGetSocket()
}

export function connectSocket() {
  return coreConnectSocket()
}

export function disconnectSocket() {
  return coreDisconnectSocket()
}

// Used by the debug user flow to open a temporary unauthenticated socket
// against the same underlying instance.
export function connectWithoutAuth() {
  const s = coreGetSocket()
  s.auth = {}
  s.disconnect()
  s.connect()
  return s
}

export default getSocket
