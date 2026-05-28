/**
 * Centralized API client.
 *
 * BASE_URL already includes /api/v1 (set via VITE_API_URL).
 * All HTTP calls go through here — never use raw fetch() in components.
 * The access token is automatically injected on every request.
 *
 * Token storage keys:
 *   - 'echo_access_token'   → short-lived JWT (Bearer)
 *   - 'echo_refresh_token'  → long-lived refresh token
 *
 * Usage:
 *   import api from '@services/api';
 *   const data = await api.get('/users/online');
 *   await api.post('/auth/login', { username, password });
 */

import { resolveApiBase } from '@/utils/network/apiBase'

// If VITE_API_URL is provided, trust it as the full base (may already include /api/v1).
// Otherwise use the app origin (Vite dev server on LAN) and proxy to backend at /api/v1.
const BASE_URL = (() => {
  const explicit = import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim()
  if (explicit) return explicit.replace(/\/$/, '')
  return `${resolveApiBase()}/api/v1`
})()

// ─── Custom error ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  /**
   * @param {string}  message
   * @param {number}  status   HTTP status code
   * @param {any}     [body]   Parsed response body (if available)
   */
  constructor(message, status, body = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

// ─── Token helpers ─────────────────────────────────────────────────────────────

const TOKEN_KEY = 'echo_access_token'
const REFRESH_KEY = 'echo_refresh_token'

// Falsy values (undefined/null/'') would otherwise be coerced to literal
// "undefined"/"null" strings by localStorage.setItem and then sent as
// `Authorization: Bearer undefined`, triggering downstream 401s.
const isUsableToken = (v) =>
  typeof v === 'string' && v.length > 0 && v !== 'undefined' && v !== 'null'

const readToken = (key) => {
  const v = localStorage.getItem(key)
  return isUsableToken(v) ? v : null
}

export const tokenStorage = {
  getAccess: () => readToken(TOKEN_KEY) || readToken('token'),
  getRefresh: () => readToken(REFRESH_KEY),
  setAccess: (t) => {
    if (isUsableToken(t)) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  },
  setRefresh: (t) => {
    if (isUsableToken(t)) localStorage.setItem(REFRESH_KEY, t)
    else localStorage.removeItem(REFRESH_KEY)
  },
  setTokenPair: (a, r) => {
    tokenStorage.setAccess(a)
    tokenStorage.setRefresh(r)
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// ─── Core request ─────────────────────────────────────────────────────────────

let _isRefreshing = false
let _refreshQueue = [] // pending requests while refreshing
let _refreshPromise = null

function flushQueue(newToken, error) {
  _refreshQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(newToken)))
  _refreshQueue = []
}

export async function refreshAccessToken() {
  if (_refreshPromise) return _refreshPromise
  _refreshPromise = doRefresh().finally(() => {
    _refreshPromise = null
  })
  return _refreshPromise
}

async function doRefresh() {
  const refreshToken = tokenStorage.getRefresh()
  if (!refreshToken) throw new ApiError('No refresh token', 401)

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Backend expects camelCase `refreshToken`. Accepts only that.
    body: JSON.stringify({ refreshToken }),
  })

  if (!res.ok) {
    tokenStorage.clear()
    throw new ApiError('Session expired', 401)
  }

  // Accept both legacy snake_case and current camelCase field names.
  const body = await res.json()
  const access = body.access_token || body.token
  const refresh = body.refresh_token || body.refreshToken
  if (!access) throw new ApiError('Malformed refresh response', 500, body)
  tokenStorage.setTokenPair(access, refresh ?? refreshToken)
  return access
}

/**
 * Low-level request. Handles 401 → token refresh → retry automatically.
 *
 * @param {string} endpoint   Path relative to BASE_URL, e.g. "/auth/login"
 * @param {RequestInit} [options]
 * @param {boolean} [_retry]  Internal flag — do not pass manually
 * @returns {Promise<any>}
 */
async function request(endpoint, options = {}, _retry = false) {
  const token = tokenStorage.getAccess()

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  // ── 401: attempt silent token refresh (once) ──────────────────────────────
  if (res.status === 401 && !_retry) {
    if (_isRefreshing) {
      // Queue concurrent requests until refresh completes
      return new Promise((resolve, reject) => {
        _refreshQueue.push({ resolve, reject })
      }).then((newToken) =>
        request(
          endpoint,
          {
            ...options,
            headers: { ...options.headers, Authorization: `Bearer ${newToken}` },
          },
          true
        )
      )
    }

    _isRefreshing = true
    try {
      const newToken = await doRefresh()
      flushQueue(newToken, null)
      return request(endpoint, options, true)
    } catch (err) {
      flushQueue(null, err)
      throw err
    } finally {
      _isRefreshing = false
    }
  }

  // ── Error responses ───────────────────────────────────────────────────────
  if (!res.ok) {
    let message = res.statusText
    let body = null
    try {
      body = await res.json()
      message = body?.message || body?.error || body?.detail || message
    } catch {
      /* ignore JSON parse errors */
    }
    throw new ApiError(message, res.status, body)
  }

  // ── 204 No Content ────────────────────────────────────────────────────────
  if (res.status === 204) return null

  return res.json()
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Typed HTTP verbs. All paths are relative to /api/v1.
 *
 * @example
 * import api from '@services/api'
 * const user = await api.get('/users/123')
 * await api.post('/auth/login', { username: 'alice', password: 'secret' })
 */
const api = {
  /** @param {string} url */
  get: (url, options = {}) => request(url, { method: 'GET', ...options }),

  /** @param {string} url @param {object} data */
  post: (url, data, options = {}) =>
    request(url, { method: 'POST', body: JSON.stringify(data), ...options }),

  /** @param {string} url @param {object} data */
  put: (url, data, options = {}) =>
    request(url, { method: 'PUT', body: JSON.stringify(data), ...options }),

  /** @param {string} url @param {object} data */
  patch: (url, data, options = {}) =>
    request(url, { method: 'PATCH', body: JSON.stringify(data), ...options }),

  /** @param {string} url */
  delete: (url, options = {}) => request(url, { method: 'DELETE', ...options }),
}

export default api
// Named export for backwards compatibility
export { api }
