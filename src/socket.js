import { io } from 'socket.io-client'

let socket = null
let currentToken = null

export function getSocket() {
  const token = localStorage.getItem('token')
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:3001', {
      withCredentials: true,
      auth: token ? { token } : {},
      transports: ['websocket'],
    })
    currentToken = token
  } else if (token && !currentToken) {
    socket.auth = { token }
    currentToken = token
    if (socket.connected) {
      socket.disconnect()
      socket.connect()
    }
  }
  if (!socket.connected) {
    socket.connect()
  }
  return socket
}

export function connectWithoutAuth() {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:3001', {
      withCredentials: true,
      auth: {},
      transports: ['websocket'],
    })
  } else {
    socket.auth = {}
    // Disconnect unconditionally — catches both connected and mid-connect states
    // so the next connect() starts from a clean socket state.
    socket.disconnect()
  }
  currentToken = null
  socket.connect()
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
    currentToken = null
  }
}

export default getSocket
