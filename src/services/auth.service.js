/**
 * Authentication service — /api/v1/auth/*
 *
 * Endpoints:
 *   POST /auth/register  → Create a new user account
 *   POST /auth/login     → Authenticate user, receive access + refresh tokens
 *   POST /auth/refresh   → Exchange refresh token for a new token pair
 *   POST /auth/logout    → Revoke refresh token (sign out current device)
 */
import api, { tokenStorage } from './api'

const AuthService = {
  /**
   * Register a new user account.
   *
   * @param {{ username: string, email: string, password: string }} data
   * @returns {Promise<{ user: object, access_token: string, refresh_token: string }>}
   */
  register: (data) => api.post('/auth/register', data),

  /**
   * Log in and obtain an access + refresh token pair.
   * Automatically persists both tokens to localStorage.
   *
   * @param {{ username: string, password: string }} credentials
   * @returns {Promise<{ user: object, access_token: string, refresh_token: string }>}
   */
  async login(credentials) {
    const res = await api.post('/auth/login', credentials)
    if (res?.access_token) {
      tokenStorage.setTokenPair(res.access_token, res.refresh_token)
    }
    return res
  },

  /**
   * Exchange a refresh token for a new access + refresh token pair.
   * Automatically updates localStorage.
   *
   * @param {string} refreshToken
   * @returns {Promise<{ access_token: string, refresh_token: string }>}
   */
  async refresh(refreshToken) {
    const res = await api.post('/auth/refresh', { refreshToken })
    // Support both response shapes
    const access = res?.access_token || res?.token
    const refresh = res?.refresh_token || res?.refreshToken
    if (access) {
      tokenStorage.setTokenPair(access, refresh ?? refreshToken)
    }
    return { access_token: access, refresh_token: refresh }
  },

  /**
   * Revoke the current device's refresh token (logout).
   * Clears stored tokens.
   *
   * @returns {Promise<null>}
   */
  async logout() {
    const refreshToken = tokenStorage.getRefresh()
    try {
      await api.post('/auth/logout', { refreshToken })
    } finally {
      tokenStorage.clear()
    }
  },
}

export default AuthService
