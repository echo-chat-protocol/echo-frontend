import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { jwtDecode } from 'jwt-decode'
import PropTypes from 'prop-types'
import { tokenStorage } from '@services/api'

/**
 * Global auth context.
 *
 * Token storage is delegated to `tokenStorage` (from api.js) so that
 * the HTTP client and the UI always share the same keys.
 *
 * Usage:
 *   import { useAuth } from '@store/AuthContext';
 *   const { user, login, logout, isAuthenticated } = useAuth();
 */

const AuthContext = createContext(null)

function getUserFromToken(token) {
  if (!token) return null
  try {
    return jwtDecode(token)
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => tokenStorage.getAccess())
  const [user, setUser] = useState(() => getUserFromToken(tokenStorage.getAccess()))

  /**
   * Call after successful login/register.
   *
   * @param {string}  accessToken
   * @param {string}  refreshToken
   * @param {string}  [userId]     - if provided, stored in localStorage as 'userId'
   * @param {object}  [extra]      - extra fields to merge into decoded user object
   */
  const login = useCallback((accessToken, refreshToken, userId = null, extra = null) => {
    tokenStorage.setTokenPair(accessToken, refreshToken)
    const decoded = getUserFromToken(accessToken)
    const resolvedUserId = userId || decoded?.id || decoded?.userId || decoded?.sub || ''
    if (resolvedUserId) localStorage.setItem('userId', resolvedUserId)
    setToken(accessToken)
    setUser(
      extra
        ? { ...decoded, userId: resolvedUserId, ...extra }
        : { ...decoded, userId: resolvedUserId }
    )
  }, [])

  /**
   * Clears all auth state and localStorage.
   */
  const logout = useCallback(() => {
    tokenStorage.clear()
    localStorage.removeItem('userId')
    setToken(null)
    setUser(null)
  }, [])

  const isAuthenticated = !!token

  const value = useMemo(
    () => ({ token, user, login, logout, isAuthenticated }),
    [token, user, login, logout, isAuthenticated]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

/**
 * Hook to access the auth context.
 * Must be used inside <AuthProvider>.
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
