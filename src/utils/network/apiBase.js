/* global __DEV_LAN_ORIGIN__ */

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

    // In development:
    // - If the API base is loopback but the app is being accessed from a LAN IP
    //   (phone), route via the Vite dev server origin so the proxy forwards.
    // - If the app itself is loaded on localhost but we have a detected LAN
    //   origin (__DEV_LAN_ORIGIN__), prefer that so QR payloads and API calls
    //   are reachable from phones on the same Wi‑Fi.
    if (isLoopbackHost(apiUrl.hostname)) {
      const appPort = typeof window !== 'undefined' ? window.location.port : ''
      const appProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:'
      if (appHost && !isLoopbackHost(appHost)) {
        return `${appProtocol}//${appHost}${appPort ? `:${appPort}` : ''}`
      }
      if (typeof __DEV_LAN_ORIGIN__ === 'string' && __DEV_LAN_ORIGIN__) {
        return __DEV_LAN_ORIGIN__.replace(/\/$/, '')
      }
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
    if (isLoopbackHost(window.location.hostname) && typeof __DEV_LAN_ORIGIN__ === 'string') {
      return __DEV_LAN_ORIGIN__.replace(/\/$/, '')
    }
    return window.location.origin.replace(/\/$/, '')
  }

  return resolveApiBase()
}
