/**
 * Pure helpers for the direct-message read-receipt mechanic (Phase 1).
 *
 * Kept side-effect free so the receipt decisions can be unit-tested without
 * mounting <Chat>/<Dashboard> or wiring a socket. The components import these
 * and supply the actual emit / state-update side effects.
 *
 * @module components/Dashboard/Chat/utils/chat/readReceipts
 */

/**
 * Is `msg` an inbound message authored by the conversation peer (as opposed to
 * one of our own outgoing/fanout copies)?
 *
 * @param {{userId?: string|number}} msg
 * @param {string|number} peerId - The conversation partner's user id.
 * @returns {boolean}
 */
export const isInboundFromPeer = (msg, peerId) =>
  Boolean(msg) && String(msg.userId) === String(peerId)

/**
 * Should this device emit a `messageSeen` when the conversation is opened?
 * True iff the loaded history contains at least one inbound message from the
 * peer that has not yet been marked seen. This closes the Phase 1 gap where
 * receipts only fired for *live* incoming messages and never for unread
 * history already sitting in local storage.
 *
 * @param {Array<{userId?: string|number, seenStatus?: boolean}>} messages
 * @param {string|number} peerId
 * @returns {boolean}
 */
export const hasUnreadInbound = (messages, peerId) =>
  Array.isArray(messages) && messages.some((m) => isInboundFromPeer(m, peerId) && !m.seenStatus)

/**
 * Does a `messageSeenUpdate` payload represent *our own* read action (read on
 * this or a sibling device), as opposed to a peer reading our messages?
 * Used by the dashboard to clear this device's unread badge after the thread
 * was read elsewhere.
 *
 * @param {{userId?: string|number}} payload - messageSeenUpdate payload.
 * @param {string|number} myUserId - The signed-in user's id.
 * @returns {boolean}
 */
export const isOwnReadReceipt = (payload, myUserId) =>
  Boolean(payload) && String(payload.userId) === String(myUserId)

/**
 * The five receipt states an outgoing message can be in, in increasing order of
 * progress. `sending`/`failed` are transient local-only states driven by the
 * send ack; `sent`/`delivered`/`read` are server truths derived from message
 * fields (`deliveredAt`, `seenAt`/`seenStatus`).
 * @readonly
 */
export const RECEIPT_STATE = Object.freeze({
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
})

/**
 * Derive the receipt state of one of OUR outgoing messages for rendering.
 *
 * Precedence: a local `failed`/`sending` flag wins (no server truth yet), then
 * read (implies delivered), then delivered, else sent. A message that has made
 * it into the rendered thread has, by construction, been accepted by the server
 * (the bubble is inserted only after a successful ack), so `sent` is the floor.
 *
 * @param {{
 *   sendState?: 'sending'|'sent'|'failed',
 *   seenStatus?: boolean,
 *   seenAt?: string|Date|null,
 *   deliveredAt?: string|Date|null,
 * }} [msg]
 * @returns {'sending'|'sent'|'delivered'|'read'|'failed'}
 */
export const receiptState = (msg) => {
  if (!msg) return RECEIPT_STATE.SENT
  if (msg.sendState === RECEIPT_STATE.FAILED) return RECEIPT_STATE.FAILED
  if (msg.sendState === RECEIPT_STATE.SENDING) return RECEIPT_STATE.SENDING
  if (msg.seenStatus || msg.seenAt) return RECEIPT_STATE.READ
  if (msg.deliveredAt) return RECEIPT_STATE.DELIVERED
  return RECEIPT_STATE.SENT
}

// Progress ordering for the three server-truth states a conversation PREVIEW
// can show. Higher = further along; used to keep the preview monotonic.
const PREVIEW_RANK = { sent: 0, delivered: 1, read: 2 }

/**
 * The receipt state to show on a conversation preview for its last message, or
 * `null` when no check should be shown (the last message was inbound, so it
 * isn't ours to get a receipt on).
 *
 * @param {{userId?: string|number}} message - The conversation's last message.
 * @param {string|number} myUserId - The signed-in user's id.
 * @returns {'sent'|'delivered'|'read'|null}
 */
export const previewReceiptState = (message, myUserId) => {
  if (!message || message.userId == null) return null
  if (String(message.userId) !== String(myUserId)) return null
  const state = receiptState(message)
  // Previews only ever show server-truth states; collapse transient local
  // sending/failed onto the 'sent' floor.
  return PREVIEW_RANK[state] == null ? RECEIPT_STATE.SENT : state
}

/**
 * Monotonically advance a preview receipt state: returns `incoming` only when it
 * is strictly further along than `current`, otherwise keeps `current`. Prevents
 * a late `delivered` event from clobbering an existing `read`.
 *
 * @param {'sent'|'delivered'|'read'|null|undefined} current
 * @param {'sent'|'delivered'|'read'} incoming
 * @returns {'sent'|'delivered'|'read'|null}
 */
export const advancePreviewReceipt = (current, incoming) => {
  const c = PREVIEW_RANK[current] ?? -1
  const i = PREVIEW_RANK[incoming] ?? -1
  return i > c ? incoming : current
}
