/**
 * Users service — /api/v1/users/*
 *
 * Endpoints:
 *   POST   /users/search          → Search for a user by exact username
 *   GET    /users/online          → List currently online user IDs
 *   PUT    /users/profile/update  → Update authenticated user's profile & account
 *   PUT    /users/profile/banner  → Update authenticated user's profile banner
 *   DELETE /users/account/delete  → Delete authenticated user account
 *   GET    /users/{userId}        → Fetch user profile by ID
 */
import api from './api'

const UsersService = {
  /**
   * Search for a user by exact username.
   *
   * @param {{ username: string }} data
   * @returns {Promise<{ user: object }>}
   */
  search: (data) => api.post('/users/search', data),

  /**
   * List currently online user IDs.
   *
   * @returns {Promise<{ online_users: string[] }>}
   */
  getOnline: () => api.get('/users/online'),

  /**
   * Update authenticated user's profile and account fields.
   *
   * @param {{ display_name?: string, bio?: string, avatar_url?: string, email?: string }} data
   * @returns {Promise<{ user: object }>}
   */
  updateProfile: (data) => api.put('/users/profile/update', data),

  /**
   * Update authenticated user's profile banner image.
   *
   * @param {{ banner_url: string }} data
   * @returns {Promise<{ user: object }>}
   */
  updateBanner: (data) => api.put('/users/profile/banner', data),

  /**
   * Permanently delete the authenticated user's account.
   *
   * @returns {Promise<null>}
   */
  deleteAccount: () => api.delete('/users/account/delete'),

  /**
   * Fetch any user's public profile by their ID.
   *
   * @param {string} userId
   * @returns {Promise<{ user: object }>}
   */
  getById: (userId) => api.get(`/users/${userId}`),
}

export default UsersService
