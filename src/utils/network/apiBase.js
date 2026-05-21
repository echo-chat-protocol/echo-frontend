const DEFAULT_API_BASE = 'http://127.0.0.1:3001'

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

    // When accessed from a non-loopback host (phone on LAN), route through the
    // Vite dev-server proxy instead of directly to the backend port.  The proxy
    // is already open on the same host:port the phone used to load the page.
    if (isLoopbackHost(apiUrl.hostname) && appHost && !isLoopbackHost(appHost)) {
      const appPort = typeof window !== 'undefined' ? window.location.port : ''
      const appProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:'
      return `${appProtocol}//${appHost}${appPort ? `:${appPort}` : ''}`
    }

    return apiUrl.toString().replace(/\/$/, '')
  } catch {
    return base
  }
}

export function resolvePairingServerUrl() {
  const configured = import.meta.env.VITE_PAIRING_SERVER_URL || import.meta.env.VITE_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/$/, '')

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '')
  }

  return resolveApiBase()
}
