// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// __DEV_LAN_ORIGIN__ is a build-time global injected by vite.config.js. Define
// it for the test runtime so the module under test can reference it.
globalThis.__DEV_LAN_ORIGIN__ = ''

function setLocation(origin) {
  const url = new URL(origin)
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      origin: url.origin,
      hostname: url.hostname,
      protocol: url.protocol,
    },
  })
}

async function loadResolver(env) {
  vi.resetModules()
  vi.stubGlobal('__DEV_LAN_ORIGIN__', '')
  vi.stubEnv('DEV', env.DEV ?? false)
  vi.stubEnv('VITE_PAIRING_SERVER_URL', env.VITE_PAIRING_SERVER_URL ?? '')
  vi.stubEnv('VITE_PUBLIC_APP_URL', env.VITE_PUBLIC_APP_URL ?? '')
  vi.stubEnv('VITE_SOCKET_URL', env.VITE_SOCKET_URL ?? '')
  vi.stubEnv('VITE_FORCE_REMOTE_SOCKET', env.VITE_FORCE_REMOTE_SOCKET ?? '')
  const mod = await import('./apiBase.js')
  return mod.resolvePairingServerUrl
}

describe('resolvePairingServerUrl', () => {
  beforeEach(() => {
    setLocation('https://echo-frontend-three.vercel.app')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('production: uses the backend API base, NOT the frontend origin', async () => {
    // Regression: previously fell back to window.location.origin (the Vercel
    // frontend), which has no /pairing or /sync routes → "Request failed".
    const resolve = await loadResolver({
      DEV: false,
      VITE_SOCKET_URL: 'https://echo-backend.onrender.com',
    })
    expect(resolve()).toBe('https://echo-backend.onrender.com')
  })

  it('production: ignores VITE_PUBLIC_APP_URL (the frontend) for pairing', async () => {
    const resolve = await loadResolver({
      DEV: false,
      VITE_PUBLIC_APP_URL: 'https://echo-frontend-three.vercel.app',
      VITE_SOCKET_URL: 'https://echo-backend.onrender.com',
    })
    expect(resolve()).toBe('https://echo-backend.onrender.com')
  })

  it('honors an explicit VITE_PAIRING_SERVER_URL override', async () => {
    const resolve = await loadResolver({
      DEV: false,
      VITE_PAIRING_SERVER_URL: 'https://pair.example.com/',
      VITE_SOCKET_URL: 'https://echo-backend.onrender.com',
    })
    expect(resolve()).toBe('https://pair.example.com')
  })

  it('development: uses the app origin so the Vite proxy forwards /pairing & /sync', async () => {
    setLocation('http://192.168.1.50:5173')
    const resolve = await loadResolver({ DEV: true })
    expect(resolve()).toBe('http://192.168.1.50:5173')
  })
})
