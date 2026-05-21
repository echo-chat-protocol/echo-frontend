import { io } from 'socket.io-client'
import { resolveApiBase } from '@/utils/network/apiBase'

const TOKEN_KEY = 'echo_access_token'

let socket = null
let currentToken = null

export function getSocket() {
  const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('token')
  if (!socket) {
    const raw = import.meta.env.VITE_SOCKET_URL
    const url = raw ? resolveApiBase(raw) : resolveApiBase() // prefer LAN origin even if app is on localhost
    socket = io(url, {
      withCredentials: true,
      auth: token ? { token } : {},
      transports: ['websocket'],
      path: '/socket.io',
    })
    currentToken = token
  } else if (token !== currentToken) {
    socket.auth = token ? { token } : {}
    currentToken = token
    socket.disconnect()
    socket.connect()
  }
  if (!socket.connected) {
    socket.connect()
  }
  return socket
}

export function connectWithoutAuth() {
  if (!socket) {
    const raw = import.meta.env.VITE_SOCKET_URL
    const url = raw ? resolveApiBase(raw) : resolveApiBase()
    socket = io(url, {
      withCredentials: true,
      auth: {},
      transports: ['websocket'],
      path: '/socket.io',
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
