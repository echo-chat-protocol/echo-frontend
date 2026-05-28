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
  // If explicitly forced, prefer a remote/public origin so mobile devices
  // and Tauri dev builds don't depend on a local Vite server being reachable.
  // Priority: VITE_SOCKET_URL > VITE_DEV_PROXY_TARGET > VITE_PAIRING_SERVER_URL
  const forceRemote = String(import.meta.env.VITE_FORCE_REMOTE_SOCKET || '')
    .toLowerCase()
    .trim()
  const shouldForceRemote = forceRemote === 'true' || forceRemote === '1' || forceRemote === 'yes'

  let forcedRemoteBase = (() => {
    if (!shouldForceRemote) return null
    const explicitSocket =
      import.meta.env.VITE_SOCKET_URL && String(import.meta.env.VITE_SOCKET_URL).trim()
    if (explicitSocket) return explicitSocket
    const devProxy =
      import.meta.env.VITE_DEV_PROXY_TARGET && String(import.meta.env.VITE_DEV_PROXY_TARGET).trim()
    if (devProxy) return devProxy
    const pairing =
      import.meta.env.VITE_PAIRING_SERVER_URL &&
      String(import.meta.env.VITE_PAIRING_SERVER_URL).trim()
    if (pairing) return pairing
    return null
  })()

  // Never force-remote when the app is running on a browser HTTP(S) loopback
  // dev origin (e.g., Vite on http://localhost:5173). This keeps QR/dev flows
  // working via the proxy and avoids browser CORS. Allow forced-remote for
  // Tauri dev (tauri://localhost or http(s)://tauri.localhost), which is
  // already whitelisted server-side.
  const appHost = typeof window !== 'undefined' ? window.location.hostname : ''
  const appProtocol = typeof window !== 'undefined' ? window.location.protocol : ''
  const isHttp = appProtocol === 'http:' || appProtocol === 'https:'
  const isTauri =
    typeof window !== 'undefined' &&
    (typeof window.__TAURI__ !== 'undefined' || typeof window.__TAURI_IPC__ !== 'undefined')
  const isDevLoopbackOrigin =
    typeof window !== 'undefined' &&
    (appHost === 'localhost' ||
      appHost === '127.0.0.1' ||
      appHost === '::1' ||
      appHost === 'tauri.localhost' ||
      (typeof appHost === 'string' && appHost.endsWith('.localhost')))
  if (isDevLoopbackOrigin && isHttp && !isTauri) forcedRemoteBase = null

  const effectiveForced = forcedRemoteBase
  const base = (effectiveForced || rawBase || DEFAULT_API_BASE).replace(/\/$/, '')

  try {
    const apiUrl = new URL(base)
    const appHostLocal = typeof window !== 'undefined' ? window.location.hostname : ''

    // In development:
    // - If the API base is loopback but the app is being accessed from a LAN IP
    //   (phone), route via the Vite dev server origin so the proxy forwards.
    // - If the app itself is loaded on localhost but we have a detected LAN
    //   origin (__DEV_LAN_ORIGIN__), prefer that so QR payloads and API calls
    //   are reachable from phones on the same Wi‑Fi.
    if (!effectiveForced && isLoopbackHost(apiUrl.hostname)) {
      const appPort = typeof window !== 'undefined' ? window.location.port : ''
      const proto = typeof window !== 'undefined' ? window.location.protocol : 'http:'
      if (appHostLocal && !isLoopbackHost(appHostLocal)) {
        return `${proto}//${appHostLocal}${appPort ? `:${appPort}` : ''}`
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

  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    isLoopbackHost(window.location.hostname) &&
    typeof __DEV_LAN_ORIGIN__ === 'string' &&
    __DEV_LAN_ORIGIN__
  ) {
    return __DEV_LAN_ORIGIN__.replace(/\/$/, '')
  }

  if (configured) return configured.replace(/\/$/, '')

  if (typeof window !== 'undefined' && window.location?.origin) {
    if (isLoopbackHost(window.location.hostname) && typeof __DEV_LAN_ORIGIN__ === 'string') {
      return __DEV_LAN_ORIGIN__.replace(/\/$/, '')
    }
    return window.location.origin.replace(/\/$/, '')
  }

  return resolveApiBase()
}
