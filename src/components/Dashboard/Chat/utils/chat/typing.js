/**
 * Pure helpers for the "typing…" indicator (DM + group).
 *
 * The receive side keeps a small per-conversation map of active typists keyed
 * by account user id, each with an `expiresAt`. A safety TTL means a dropped
 * `stopTyping`/`groupStopTyping` can never strand the indicator "on" forever —
 * each fresh typing ping refreshes the deadline.
 *
 * @module components/Dashboard/Chat/utils/chat/typing
 */

// How long a single typing ping keeps a user "typing" without a refresh. The
// sender re-emits well within this window (it stops after ~1.5s idle), so this
// is purely a backstop against a missed stop event.
export const TYPING_TTL_MS = 6000

/**
 * Record/refresh a typist in the map. Returns a new map (never mutates).
 *
 * @param {Record<string, {username: string, expiresAt: number}>} typists
 * @param {{userId: string|number, username?: string}} typist
 * @param {number} [now] - epoch ms (injectable for tests)
 * @param {number} [ttl] - lifetime in ms
 */
export const upsertTypist = (
  typists,
  { userId, username } = {},
  now = Date.now(),
  ttl = TYPING_TTL_MS
) => {
  const key = String(userId ?? '')
  if (!key) return typists
  return { ...typists, [key]: { username: username || 'Member', expiresAt: now + ttl } }
}

/**
 * Remove a typist (on stopTyping). Returns the same reference when nothing
 * changes so callers can skip a re-render.
 *
 * @param {Record<string, {username: string, expiresAt: number}>} typists
 * @param {string|number} userId
 */
export const removeTypist = (typists, userId) => {
  const key = String(userId ?? '')
  if (!key || !(key in typists)) return typists
  const next = { ...typists }
  delete next[key]
  return next
}

/**
 * The still-active typists (expiry in the future), in insertion order.
 *
 * @param {Record<string, {username: string, expiresAt: number}>} typists
 * @param {number} [now]
 * @returns {Array<{userId: string, username: string}>}
 */
export const activeTypists = (typists, now = Date.now()) =>
  Object.entries(typists || {})
    .filter(([, v]) => v && v.expiresAt > now)
    .map(([userId, v]) => ({ userId, username: v.username }))

/**
 * Build the indicator label.
 *  - DM: always "typing…" when anyone is typing, regardless of names.
 *  - Group: "Alice is typing…", "Alice and Bob are typing…",
 *    "Alice, Bob and Carol are typing…", then "4 people typing…" for >3.
 * Returns `null` when no one is typing (caller renders nothing).
 *
 * @param {Array<string>} names - usernames of active typists.
 * @param {{isGroup?: boolean}} [opts]
 * @returns {string|null}
 */
export const formatTypingText = (names, { isGroup = false } = {}) => {
  const list = (names || []).filter(Boolean)
  if (list.length === 0) return null
  if (!isGroup) return 'typing…'
  if (list.length === 1) return `${list[0]} is typing…`
  if (list.length === 2) return `${list[0]} and ${list[1]} are typing…`
  if (list.length === 3) return `${list[0]}, ${list[1]} and ${list[2]} are typing…`
  return `${list.length} people typing…`
}
