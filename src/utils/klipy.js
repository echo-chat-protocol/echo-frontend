// KLIPY media API client — GIFs and Stickers (https://docs.klipy.com).
//
// Endpoints (media is 'gifs' or 'stickers'):
//   GET https://api.klipy.com/api/v1/{API_KEY}/{media}/trending
//   GET https://api.klipy.com/api/v1/{API_KEY}/{media}/search?q=…
// Envelope: { result: true, data: { data: [ …items ], has_next, current_page, per_page } }
// Each item carries a `file` map keyed by size (hd|md|sm|xs) → format
// (gif|webp|png) → { url, width, height }. Stickers favour transparent webp/png.
// Items with `type: 'ad'` are sponsored slots and are filtered out here.

const KEY_PLACEHOLDERS = new Set(['', 'your_klipy_api_key_here', 'your_kliply_api_key_here'])

const BASE_URL = 'https://api.klipy.com/api/v1'

// Read the API key from the Vite env. Accepts the KLIPLY misspelling too, since
// the .env template and an earlier draft used both spellings.
export const getKlipyApiKey = () => {
  const key = String(
    import.meta.env.VITE_KLIPY_API_KEY || import.meta.env.VITE_KLIPLY_API_KEY || ''
  ).trim()
  return KEY_PLACEHOLDERS.has(key) ? '' : key
}

export const hasKlipyApiKey = () => Boolean(getKlipyApiKey())

// KLIPY uses customer_id for ad attribution / de-duplication. A stable random id
// per browser is enough — it carries no PII.
const getCustomerId = () => {
  try {
    let id = localStorage.getItem('echo-klipy-customer-id')
    if (!id) {
      id = crypto.randomUUID?.() ?? `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('echo-klipy-customer-id', id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}

// Pull the first usable URL out of a size→format map. gif/webp/png all render in
// a plain <img> (webp/png cover transparent stickers); mp4 would need <video>.
const pickFromFile = (file, sizeOrder) => {
  if (!file || typeof file !== 'object') return null
  for (const size of sizeOrder) {
    for (const format of ['gif', 'webp', 'png']) {
      const node = file?.[size]?.[format]
      if (node && typeof node.url === 'string' && node.url) {
        return {
          url: node.url,
          width: Number.isFinite(node.width) ? node.width : null,
          height: Number.isFinite(node.height) ? node.height : null,
        }
      }
    }
  }
  return null
}

// Normalize one API item into the shape the picker/message layer uses.
const normalizeItem = (item) => {
  if (!item || item.type === 'ad') return null
  const file = item.file ?? item.files ?? null
  // Small first for the grid preview, large first for the sent/full version.
  const preview = pickFromFile(file, ['sm', 'xs', 'md', 'hd'])
  const full = pickFromFile(file, ['hd', 'md', 'sm', 'xs']) ?? preview
  const fallbackUrl =
    typeof item?.url === 'string'
      ? item.url
      : typeof item?.gif?.url === 'string'
        ? item.gif.url
        : null

  const fullUrl = full?.url ?? fallbackUrl
  if (!fullUrl) return null
  const previewSource = preview ?? full

  return {
    id: String(item.id ?? item.slug ?? fullUrl),
    title: typeof item.title === 'string' && item.title ? item.title : 'GIF',
    fullUrl,
    previewUrl: previewSource?.url ?? fullUrl,
    width: previewSource?.width ?? null,
    height: previewSource?.height ?? null,
  }
}

const MEDIA_TYPES = new Set(['gifs', 'stickers'])

const request = async (media, path, params, signal) => {
  const apiKey = getKlipyApiKey()
  if (!apiKey) {
    const err = new Error('KLIPY API key not configured (set VITE_KLIPY_API_KEY)')
    err.code = 'NO_API_KEY'
    throw err
  }
  const mediaSegment = MEDIA_TYPES.has(media) ? media : 'gifs'

  const search = new URLSearchParams({
    per_page: '24',
    customer_id: getCustomerId(),
    ...params,
  })

  const res = await fetch(
    `${BASE_URL}/${encodeURIComponent(apiKey)}/${mediaSegment}/${path}?${search}`,
    { signal, headers: { Accept: 'application/json' } }
  )
  if (!res.ok) throw new Error(`KLIPY ${mediaSegment}/${path} request failed: ${res.status}`)

  const json = await res.json()
  const list = Array.isArray(json?.data?.data) ? json.data.data : []
  return {
    items: list.map(normalizeItem).filter(Boolean),
    hasNext: Boolean(json?.data?.has_next),
    page: Number.isFinite(json?.data?.current_page) ? json.data.current_page : 1,
  }
}

// Generic entry point used by the picker; `media` is 'gifs' or 'stickers'.
export const fetchKlipyMedia = (media, { query = '', page = 1, signal } = {}) => {
  const trimmed = String(query ?? '').trim()
  return trimmed
    ? request(media, 'search', { q: trimmed, page: String(page) }, signal)
    : request(media, 'trending', { page: String(page) }, signal)
}

export const trendingGifs = ({ page = 1, signal } = {}) =>
  request('gifs', 'trending', { page: String(page) }, signal)

export const searchGifs = (query, { page = 1, signal } = {}) =>
  request('gifs', 'search', { q: String(query ?? '').trim(), page: String(page) }, signal)

export const trendingStickers = ({ page = 1, signal } = {}) =>
  request('stickers', 'trending', { page: String(page) }, signal)

export const searchStickers = (query, { page = 1, signal } = {}) =>
  request('stickers', 'search', { q: String(query ?? '').trim(), page: String(page) }, signal)
