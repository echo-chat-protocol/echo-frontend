import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  buildGroupJoinedMessageId,
  isGroupWelcomeForThisDevice,
  shouldApplyGroupWelcome,
  shouldEmitGroupJoinedSystemMessage,
} from '../groupCrypto/welcomeTargeting'

describe('welcomeTargeting', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => 'device-a'),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts welcomes addressed to this device clientId', () => {
    expect(
      isGroupWelcomeForThisDevice({ recipientClientId: 'device-a', recipientUserId: 'u1' })
    ).toBe(true)
    expect(
      isGroupWelcomeForThisDevice({ recipientClientId: 'device-b', recipientUserId: 'u1' })
    ).toBe(false)
  })

  it('skips stale welcomes when local epoch is already ahead', () => {
    const existing = { epoch: 5, applicationSecretB64: 'secret' }
    const welcome = { epoch: 3, recipientClientId: 'device-a' }
    expect(shouldApplyGroupWelcome(existing, welcome)).toBe(false)
  })

  it('allows welcomes that advance epoch after removal', () => {
    const existing = { epoch: 2, applicationSecretB64: 'secret', leftAtEpoch: 2 }
    const welcome = { epoch: 4, recipientClientId: 'device-a' }
    expect(shouldApplyGroupWelcome(existing, welcome)).toBe(true)
  })

  it('forceBaseline replays welcome at the same epoch for catch-up', () => {
    const existing = { epoch: 1, applicationSecretB64: 'secret' }
    const welcome = { epoch: 1, recipientClientId: 'device-a' }
    expect(shouldApplyGroupWelcome(existing, welcome)).toBe(false)
    expect(shouldApplyGroupWelcome(existing, welcome, { forceBaseline: true })).toBe(true)
  })

  it('emits join system message only for rejoin or first membership', () => {
    const welcome = { epoch: 4, recipientLeafIndex: 2 }
    expect(shouldEmitGroupJoinedSystemMessage({ leftAtEpoch: 3, epoch: 3 }, welcome)).toBe(true)
    expect(
      shouldEmitGroupJoinedSystemMessage({ applicationSecretB64: 'x', epoch: 4 }, welcome)
    ).toBe(false)
  })

  it('builds stable join message ids', () => {
    expect(buildGroupJoinedMessageId('g1', { epoch: 2, recipientLeafIndex: 1 })).toBe(
      'group-joined:g1:2:1'
    )
  })
})
