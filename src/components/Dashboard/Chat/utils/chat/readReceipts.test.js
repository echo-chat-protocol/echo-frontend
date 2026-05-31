import { describe, it, expect } from 'vitest'
import {
  isInboundFromPeer,
  hasUnreadInbound,
  isOwnReadReceipt,
  receiptState,
  previewReceiptState,
  advancePreviewReceipt,
  RECEIPT_STATE,
} from './readReceipts'

describe('isInboundFromPeer', () => {
  it('is true when the author is the peer', () => {
    expect(isInboundFromPeer({ userId: 'U2' }, 'U2')).toBe(true)
  })

  it('is false for our own outgoing messages', () => {
    expect(isInboundFromPeer({ userId: 'U1' }, 'U2')).toBe(false)
  })

  it('coerces mixed id types', () => {
    expect(isInboundFromPeer({ userId: 42 }, '42')).toBe(true)
  })

  it('is false for nullish messages', () => {
    expect(isInboundFromPeer(null, 'U2')).toBe(false)
  })
})

describe('hasUnreadInbound', () => {
  const peer = 'U2'

  it('returns true when an inbound message is unseen', () => {
    const msgs = [
      { userId: 'U1', seenStatus: true },
      { userId: 'U2', seenStatus: false },
    ]
    expect(hasUnreadInbound(msgs, peer)).toBe(true)
  })

  it('returns false when every inbound message is already seen', () => {
    const msgs = [
      { userId: 'U2', seenStatus: true },
      { userId: 'U1', seenStatus: false }, // our own unseen outgoing must not count
    ]
    expect(hasUnreadInbound(msgs, peer)).toBe(false)
  })

  it('ignores our own unseen outgoing messages', () => {
    const msgs = [{ userId: 'U1', seenStatus: false }]
    expect(hasUnreadInbound(msgs, peer)).toBe(false)
  })

  it('returns false for empty or non-array input', () => {
    expect(hasUnreadInbound([], peer)).toBe(false)
    expect(hasUnreadInbound(undefined, peer)).toBe(false)
    expect(hasUnreadInbound(null, peer)).toBe(false)
  })
})

describe('isOwnReadReceipt', () => {
  it('is true when the receipt was produced by my own (or sibling) device', () => {
    expect(isOwnReadReceipt({ userId: 'U1', targetUserId: 'U2' }, 'U1')).toBe(true)
  })

  it('is false when a peer read my messages', () => {
    expect(isOwnReadReceipt({ userId: 'U2', targetUserId: 'U1' }, 'U1')).toBe(false)
  })

  it('is false for a missing payload', () => {
    expect(isOwnReadReceipt(undefined, 'U1')).toBe(false)
  })
})

describe('receiptState', () => {
  it('defaults to sent for a bare delivered-less, unseen message', () => {
    expect(receiptState({})).toBe(RECEIPT_STATE.SENT)
    expect(receiptState(undefined)).toBe(RECEIPT_STATE.SENT)
  })

  it('reports delivered when deliveredAt is set but not yet seen', () => {
    expect(receiptState({ deliveredAt: '2026-05-31T00:00:00Z' })).toBe(RECEIPT_STATE.DELIVERED)
  })

  it('reports read when seen, regardless of deliveredAt', () => {
    expect(receiptState({ seenStatus: true })).toBe(RECEIPT_STATE.READ)
    expect(
      receiptState({ deliveredAt: '2026-05-31T00:00:00Z', seenAt: '2026-05-31T00:01:00Z' })
    ).toBe(RECEIPT_STATE.READ)
  })

  it('read takes precedence over delivered (monotonic progression)', () => {
    expect(receiptState({ deliveredAt: 'x', seenStatus: true })).toBe(RECEIPT_STATE.READ)
  })

  it('local failed/sending flags win over server truth', () => {
    expect(receiptState({ sendState: 'failed', seenStatus: true })).toBe(RECEIPT_STATE.FAILED)
    expect(receiptState({ sendState: 'sending', deliveredAt: 'x' })).toBe(RECEIPT_STATE.SENDING)
  })
})

describe('previewReceiptState', () => {
  const me = 'U1'

  it('is null for an inbound last message (no check on received messages)', () => {
    expect(previewReceiptState({ userId: 'U2', seenStatus: true }, me)).toBe(null)
  })

  it('is null when there is no message or no author', () => {
    expect(previewReceiptState(null, me)).toBe(null)
    expect(previewReceiptState({ text: 'hi' }, me)).toBe(null)
  })

  it('reflects the outgoing message state', () => {
    expect(previewReceiptState({ userId: 'U1' }, me)).toBe(RECEIPT_STATE.SENT)
    expect(previewReceiptState({ userId: 'U1', deliveredAt: 'x' }, me)).toBe(
      RECEIPT_STATE.DELIVERED
    )
    expect(previewReceiptState({ userId: 'U1', seenStatus: true }, me)).toBe(RECEIPT_STATE.READ)
  })

  it('collapses transient sending/failed onto the sent floor for previews', () => {
    expect(previewReceiptState({ userId: 'U1', sendState: 'sending' }, me)).toBe(RECEIPT_STATE.SENT)
    expect(previewReceiptState({ userId: 'U1', sendState: 'failed' }, me)).toBe(RECEIPT_STATE.SENT)
  })
})

describe('advancePreviewReceipt', () => {
  it('moves forward sent → delivered → read', () => {
    expect(advancePreviewReceipt('sent', 'delivered')).toBe('delivered')
    expect(advancePreviewReceipt('delivered', 'read')).toBe('read')
    expect(advancePreviewReceipt(null, 'sent')).toBe('sent')
  })

  it('never regresses to an earlier state', () => {
    expect(advancePreviewReceipt('read', 'delivered')).toBe('read')
    expect(advancePreviewReceipt('read', 'sent')).toBe('read')
    expect(advancePreviewReceipt('delivered', 'delivered')).toBe('delivered')
  })
})
