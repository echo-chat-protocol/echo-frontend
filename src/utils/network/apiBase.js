const DEFAULT_API_BASE = 'http://127.0.0.1:3001'
const DEFAULT_API_PORT = '3001'
const FRONTEND_DEV_PORTS = new Set(['5173', '5174', '5175'])

function isLoopbackHost(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    // Tauri v2 uses tauri.localhost as its WebView origin — treat as loopback
    // so we never accidentally replace 127.0.0.1 with tauri.localhost
    hostname === 'tauri.localhost' ||
    hostname.endsWith('.localhost')
  )
}

export function resolveApiBase(rawBase = import.meta.env.VITE_SOCKET_URL || DEFAULT_API_BASE) {
  const base = (rawBase || DEFAULT_API_BASE).replace(/\/$/, '')

  try {
    const apiUrl = new URL(base)
    const appHost = typeof window !== 'undefined' ? window.location.hostname : ''

    // Only substitute the hostname when the app is genuinely on a non-loopback
    // LAN/WAN host (e.g. Android on a real device with a LAN IP).
    if (isLoopbackHost(apiUrl.hostname) && appHost && !isLoopbackHost(appHost)) {
      apiUrl.hostname = appHost
    }

    if (FRONTEND_DEV_PORTS.has(apiUrl.port)) {
      apiUrl.port = DEFAULT_API_PORT
    }

    return apiUrl.toString().replace(/\/$/, '')
  } catch {
    return base
  }
}
