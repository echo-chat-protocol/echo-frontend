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

// e.g. "https://your-app.onrender.com/api/v1"  (no trailing slash)
const BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '')

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

export const tokenStorage = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setAccess: (t) => localStorage.setItem(TOKEN_KEY, t),
  setRefresh: (t) => localStorage.setItem(REFRESH_KEY, t),
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

function flushQueue(newToken, error) {
  _refreshQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(newToken)))
  _refreshQueue = []
}

async function doRefresh() {
  const refreshToken = tokenStorage.getRefresh()
  if (!refreshToken) throw new ApiError('No refresh token', 401)

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!res.ok) {
    tokenStorage.clear()
    throw new ApiError('Session expired', 401)
  }

  const { access_token, refresh_token } = await res.json()
  tokenStorage.setTokenPair(access_token, refresh_token ?? refreshToken)
  return access_token
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
