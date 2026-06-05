/**
 * Local cache for decrypted media blobs (video attachments).
 *
 * When a video message is received we download the ciphertext once, decrypt it,
 * and persist the decrypted Blob in IndexedDB keyed by mediaId. After that,
 * opening the video is purely local — no network fetch and no re-decrypt — and
 * it survives reloads / works offline. (This mirrors how received images are
 * already kept decrypted in the local message store.)
 *
 * Layers, fastest first:
 *   1. in-memory object-URL map (this session)
 *   2. IndexedDB blob store (persistent)
 *   3. network download + AEAD decrypt (first time only)
 */

const DB_NAME = 'echo-media-cache'
const STORE = 'blobs'
const DB_VERSION = 1

const memUrls = new Map() // mediaId -> object URL (this session)
const inflight = new Map() // mediaId -> Promise<Blob> (dedupe concurrent loads)
const prefetched = new Set() // mediaIds we've already kicked off a prefetch for
const MEDIA_LOAD_TIMEOUT_MS = 15_000

const idbAvailable = () => typeof indexedDB !== 'undefined'

function rememberObjectUrl(mediaId, blob) {
  const existingUrl = memUrls.get(mediaId)
  if (existingUrl) {
    try {
      URL.revokeObjectURL(existingUrl)
    } catch {
      /* ignore */
    }
  }
  const url = URL.createObjectURL(blob)
  memUrls.set(mediaId, url)
  return url
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId = null
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(mediaId) {
  if (!idbAvailable()) return null
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(mediaId)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => db.close()
    })
  } catch {
    return null
  }
}

async function idbPut(mediaId, blob) {
  if (!idbAvailable()) return
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(blob, mediaId)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* best-effort cache; ignore quota/other failures */
  }
}

async function downloadAndDecryptBlob(descriptor) {
  const id = descriptor?.mediaId
  if (!id || !descriptor?.keyB64) throw new Error('mediaCache: invalid descriptor')

  // Lazy imports so this module (and anything that prefetches) doesn't pull
  // the network/wasm chain into unrelated module graphs / unit tests.
  const [{ default: MediaService }, { decryptMediaBlob }] = await Promise.all([
    import('@/services/media.service'),
    import('./mediaCrypto'),
  ])
  const ciphertext = await MediaService.download(id)
  const bytes = await withTimeout(
    decryptMediaBlob(ciphertext, descriptor.keyB64),
    MEDIA_LOAD_TIMEOUT_MS,
    'Timed out decrypting media.'
  )
  return new Blob([bytes], { type: descriptor.mime || 'video/mp4' })
}

// Resolve the decrypted Blob for a descriptor: IDB hit, else download + decrypt
// + persist. Concurrent callers for the same id share one promise.
async function ensureBlob(descriptor) {
  const id = descriptor?.mediaId
  if (!id || !descriptor?.keyB64) throw new Error('mediaCache: invalid descriptor')

  if (inflight.has(id)) return inflight.get(id)

  const work = (async () => {
    const cached = await idbGet(id)
    if (cached) return cached

    const blob = await downloadAndDecryptBlob(descriptor)
    idbPut(id, blob).catch(() => {})
    return blob
  })()

  const boundedWork = withTimeout(work, MEDIA_LOAD_TIMEOUT_MS, 'Timed out loading media.')
  inflight.set(id, boundedWork)
  try {
    return await boundedWork
  } finally {
    inflight.delete(id)
  }
}

/**
 * Object URL for a cached/decrypted media blob. No network or decrypt when it's
 * already local. The returned URL is reused for the session.
 * @param {object} descriptor - { mediaId, keyB64, mime, ... }
 * @returns {Promise<string>}
 */
export async function getMediaObjectUrl(descriptor) {
  const id = descriptor?.mediaId
  // Fast path: session object URL already exists
  if (id && memUrls.has(id)) return memUrls.get(id)

  // Prefer local persistent cache when available, even if the descriptor is
  // missing decrypt metadata (e.g. optimistic/self-send replay before the
  // server copy is accessible, or after a reload). If IDB has the blob, use it
  // without requiring key material.
  if (id) {
    const cached = await idbGet(id).catch(() => null)
    if (cached instanceof Blob) {
      return rememberObjectUrl(id, cached)
    }
  }

  // Fallback: download + decrypt using the descriptor's key. This path is used
  // for first-time receivers or when nothing is cached locally yet.
  const blob = await ensureBlob(descriptor)
  const url = URL.createObjectURL(blob)
  if (id) memUrls.set(id, url)
  return url
}

/**
 * Download and decrypt a fresh copy, replacing any local cache entry. Outgoing
 * voice notes use this so the sender plays the exact server copy that receivers
 * can already hear.
 * @param {object} descriptor - { mediaId, keyB64, mime, ... }
 * @returns {Promise<string>}
 */
export async function refreshMediaObjectUrl(descriptor) {
  const id = descriptor?.mediaId
  if (!id) throw new Error('mediaCache: invalid descriptor')
  const blob = await withTimeout(
    downloadAndDecryptBlob(descriptor),
    MEDIA_LOAD_TIMEOUT_MS,
    'Timed out loading media.'
  )
  idbPut(id, blob).catch(() => {})
  prefetched.add(id)
  return rememberObjectUrl(id, blob)
}

/**
 * Persist a locally produced decrypted media blob. This is used by the sender
 * after upload so their optimistic/persisted outgoing bubble can replay without
 * downloading the ciphertext they just created.
 * @param {object} descriptor - { mediaId, mime, ... }
 * @param {Blob|Uint8Array|ArrayBuffer} blobLike
 */
export async function cacheMediaBlob(descriptor, blobLike) {
  const id = descriptor?.mediaId
  if (!id || !blobLike) return
  const blob =
    blobLike instanceof Blob
      ? blobLike
      : new Blob([blobLike], { type: descriptor.mime || 'application/octet-stream' })

  rememberObjectUrl(id, blob)
  prefetched.add(id)
  idbPut(id, blob).catch(() => {})
}

/**
 * Fire-and-forget: ensure a received video is downloaded + decrypted + stored
 * locally, so opening it later is instant. Safe to call repeatedly.
 * @param {object} descriptor
 */
export function prefetchMedia(descriptor) {
  const id = descriptor?.mediaId
  if (!id || !descriptor?.keyB64) return
  if (memUrls.has(id) || prefetched.has(id)) return
  prefetched.add(id)
  ensureBlob(descriptor).catch(() => {
    prefetched.delete(id) // allow a later retry (e.g. on open)
  })
}

/** True if the blob is already available locally (IDB or this session). */
export async function isMediaCached(mediaId) {
  if (!mediaId) return false
  if (memUrls.has(mediaId)) return true
  return Boolean(await idbGet(mediaId))
}
