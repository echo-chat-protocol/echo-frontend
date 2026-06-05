import { BASE_URL, tokenStorage, ApiError, refreshAccessToken } from './api'

async function authedFetch(path, options, retry = false) {
  const token = tokenStorage.getAccess()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401 && !retry) {
    try {
      await refreshAccessToken()
    } catch {
      throw new ApiError('Session expired', 401)
    }
    return authedFetch(path, options, true)
  }

  if (!res.ok) {
    let body = null
    let message = res.statusText
    try {
      body = await res.json()
      message = body?.message || body?.error || message
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, res.status, body)
  }
  return res
}

const MediaService = {
  /**
   * Upload an encrypted blob, returns its server id.
   * @param {Uint8Array} ciphertextBytes
   * @returns {Promise<{ mediaId: string }>}
   */
  async upload(ciphertextBytes) {
    const body =
      ciphertextBytes instanceof Uint8Array ? ciphertextBytes : new Uint8Array(ciphertextBytes)
    const res = await authedFetch('/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body,
    })
    const json = await res.json()
    if (!json?.mediaId) throw new ApiError('Malformed media upload response', 500, json)
    return { mediaId: json.mediaId }
  },

  /**
   * Download an encrypted blob by id.
   * @param {string} mediaId
   * @returns {Promise<Uint8Array>}
   */
  async download(mediaId) {
    const res = await authedFetch(`/media/${encodeURIComponent(mediaId)}`, { method: 'GET' })
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  },
}

export default MediaService
export { MediaService }
