import { resolveApiBase } from '@/utils/network/apiBase'

const BASE = resolveApiBase()
const REQUEST_TIMEOUT_MS = 8000

function isLoopbackHost(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  )
}

function localBackendBase(base = BASE) {
  if (typeof window === 'undefined' || !isLoopbackHost(window.location.hostname)) return null

  try {
    const url = new URL(base)
    if (isLoopbackHost(url.hostname)) return null
    url.hostname = '127.0.0.1'
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

async function requestWithLoopbackFallback(method, path, body, base = BASE) {
  const fallbackBase = localBackendBase(base)
  if (fallbackBase && fallbackBase !== base) {
    return request(method, path, body, fallbackBase)
  }

  try {
    return await request(method, path, body, base)
  } catch (error) {
    if (!fallbackBase || fallbackBase === base) throw error
    return request(method, path, body, fallbackBase)
  }
}

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request(method, path, body, base = BASE) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: authHeaders(),
      signal: controller.signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok)
      throw Object.assign(new Error(data.message || data.error || 'Request failed'), data)
    return data
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(
        `Timed out contacting ${base}. Check that the backend is running and reachable from this device.`
      )
    }
    if (error?.message === 'Failed to fetch') {
      throw new Error(
        `Failed to reach ${base}. Check that the backend is running and that the phone can access this address.`
      )
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export const deviceService = {
  createSession: (body) => request('POST', '/pairing/session', body),
  getSession: (sessionId) => request('GET', `/pairing/session/${sessionId}`),
  submitRequest: (body) => request('POST', '/pairing/request', body),
  submitRequestToServer: (serverUrl, body) =>
    request('POST', '/pairing/request', body, resolveApiBase(serverUrl)),
  approve: (body) => request('POST', '/pairing/approve', body),
  reject: (body) => request('POST', '/pairing/reject', body),
  pollResult: (sessionId) => request('GET', `/pairing/poll/${sessionId}`),

  listDevices: (userId) => request('GET', `/users/${userId}/devices`),
  getDeviceBundles: (userId) => request('GET', `/users/${userId}/devices/bundles`),
  getDeviceIdentities: (userId) => request('GET', `/users/${userId}/devices/identities`),
  revokeDevice: (deviceId) => request('POST', `/devices/${deviceId}/revoke`, {}),
  registerDeviceKeys: (deviceId, keyBundle) =>
    request('POST', `/devices/${deviceId}/keys`, keyBundle),
  completeSyncTarget: ({ sessionId, targetAccessToken, targetDevice = {} }) =>
    request('POST', '/sync/complete-target', { sessionId, targetAccessToken, targetDevice }),

  storeEnvelopes: (body) => request('POST', '/messages/envelopes', body),
  fetchEnvelopes: (deviceId) => request('GET', `/messages/envelopes/${deviceId}`),
  ackEnvelope: (envelopeId, body) => request('POST', `/messages/envelopes/${envelopeId}/ack`, body),

  createDhSession: (body) => requestWithLoopbackFallback('POST', '/sync/create-session', body),
  submitDhIdentityToServer: (serverUrl, body) =>
    request('POST', '/sync/dh-submit', body, resolveApiBase(serverUrl)),
  getDhSession: ({ sessionId, targetAccessToken }) =>
    request(
      'GET',
      `/sync/dh-session/${sessionId}?targetAccessToken=${encodeURIComponent(targetAccessToken)}`
    ),
  transferDhChunk: ({ sessionId, targetAccessToken, chunk }) =>
    requestWithLoopbackFallback('POST', '/sync/dh-transfer-chunk', {
      sessionId,
      targetAccessToken,
      chunk,
    }),
  listDhChunksFromServer: (serverUrl, { sessionId, targetAccessToken }) =>
    request(
      'GET',
      `/sync/sessions/${sessionId}/chunks?targetAccessToken=${encodeURIComponent(targetAccessToken)}`,
      undefined,
      resolveApiBase(serverUrl)
    ),
}
