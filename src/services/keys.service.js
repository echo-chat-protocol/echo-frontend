/**
 * Keys service — /api/v1/keys/*  (Signal Protocol key material)
 *
 * Endpoints (all require auth):
 *   POST /keys/signed-prekey     → Get signed pre-key for a user
 *   POST /keys/identity/x25519   → Get X25519 identity public key for a user
 *   POST /keys/identity/ed25519  → Get Ed25519 identity public key for a user
 *   POST /keys/bundle            → Get a complete pre-key bundle for a user
 *   POST /keys/opk/upload        → Upload one-time pre-keys for the authenticated user
 *   GET  /keys/opk/status        → Get OPK pool status for the authenticated user
 */
import api from './api'

const KeysService = {
  /**
   * Get a signed pre-key for a given user.
   *
   * @param {{ user_id: string }} data
   * @returns {Promise<{ signed_prekey: object }>}
   */
  getSignedPrekey: (data) => api.post('/keys/signed-prekey', data),

  /**
   * Get the X25519 (DH) identity public key for a given user.
   *
   * @param {{ user_id: string }} data
   * @returns {Promise<{ x25519_public_key: string }>}
   */
  getIdentityX25519: (data) => api.post('/keys/identity/x25519', data),

  /**
   * Get the Ed25519 (signing) identity public key for a given user.
   *
   * @param {{ user_id: string }} data
   * @returns {Promise<{ ed25519_public_key: string }>}
   */
  getIdentityEd25519: (data) => api.post('/keys/identity/ed25519', data),

  /**
   * Get the full pre-key bundle for a user (for X3DH session initiation).
   *
   * @param {{ user_id: string }} data
   * @returns {Promise<{ bundle: object }>}
   */
  getBundle: (data) => api.post('/keys/bundle', data),

  /**
   * Upload one-time pre-keys (OPKs) for the authenticated user.
   *
   * @param {{ one_time_prekeys: Array<{ key_id: number, public_key: string }> }} data
   * @returns {Promise<any>}
   */
  uploadOPKs: (data) => api.post('/keys/opk/upload', data),

  /**
   * Get the current OPK pool status (how many OPKs remain on the server).
   *
   * @returns {Promise<{ count: number, low: boolean }>}
   */
  getOPKStatus: () => api.get('/keys/opk/status'),
}

export default KeysService
