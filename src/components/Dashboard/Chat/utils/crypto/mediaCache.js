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

const idbAvailable = () => typeof indexedDB !== 'undefined'

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

// Resolve the decrypted Blob for a descriptor: IDB hit, else download + decrypt
// + persist. Concurrent callers for the same id share one promise.
async function ensureBlob(descriptor) {
  const id = descriptor?.mediaId
  if (!id || !descriptor?.keyB64) throw new Error('mediaCache: invalid descriptor')

  if (inflight.has(id)) return inflight.get(id)

  const work = (async () => {
    const cached = await idbGet(id)
    if (cached) return cached

    // Lazy imports so this module (and anything that prefetches) doesn't pull
    // the network/wasm chain into unrelated module graphs / unit tests.
    const [{ default: MediaService }, { decryptMediaBlob }] = await Promise.all([
      import('@/services/media.service'),
      import('./mediaCrypto'),
    ])
    const ciphertext = await MediaService.download(id)
    const bytes = await decryptMediaBlob(ciphertext, descriptor.keyB64)
    const blob = new Blob([bytes], { type: descriptor.mime || 'video/mp4' })
    await idbPut(id, blob)
    return blob
  })()

  inflight.set(id, work)
  try {
    return await work
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
  if (id && memUrls.has(id)) return memUrls.get(id)
  const blob = await ensureBlob(descriptor)
  const url = URL.createObjectURL(blob)
  if (id) memUrls.set(id, url)
  return url
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
