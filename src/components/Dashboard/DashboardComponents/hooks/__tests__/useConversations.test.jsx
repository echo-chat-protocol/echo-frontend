// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { useConversations } from '../useConversations'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('useConversations hook', () => {
  afterEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('reloads conversations instead of carrying state across account changes', async () => {
    localStorage.setItem(
      'recentConversations-U1',
      JSON.stringify([{ id: 'A', username: 'old-user-chat' }])
    )
    localStorage.setItem(
      'recentConversations-U2',
      JSON.stringify([{ id: 'B', username: 'new-user-chat' }])
    )

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    let api = null
    const Harness = ({ userId }) => {
      const hook = useConversations(userId)
      useEffect(() => {
        api = hook
      }, [hook])
      return null
    }

    await act(async () => {
      root.render(<Harness userId='U1' />)
      await flush()
    })

    expect(api.recentConversations).toEqual([{ id: 'A', username: 'old-user-chat' }])

    await act(async () => {
      root.render(<Harness userId='U2' />)
      await flush()
    })

    expect(api.recentConversations).toEqual([{ id: 'B', username: 'new-user-chat' }])
    expect(JSON.parse(localStorage.getItem('recentConversations-U2'))).toEqual([
      { id: 'B', username: 'new-user-chat' },
    ])
  })

  it('tracks outgoing-vs-inbound direction and live receipt progression', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    let api = null
    const Harness = ({ userId }) => {
      const hook = useConversations(userId)
      useEffect(() => {
        api = hook
      }, [hook])
      return null
    }

    await act(async () => {
      root.render(<Harness userId='ME' />)
      await flush()
    })

    // Outgoing last message → receipt shown, starts at 'sent'.
    await act(async () => {
      api.updateRecentConversations({ id: 'P1', username: 'peer1' }, { text: 'hi', userId: 'ME' })
      await flush()
    })
    let conv = api.recentConversations.find((c) => c.id === 'P1')
    expect(conv.lastMessageFromMe).toBe(true)
    expect(conv.lastMessageState).toBe('sent')

    // Live delivered then read advance the preview.
    await act(async () => {
      api.setConversationReceipt('P1', 'delivered')
      await flush()
    })
    expect(api.recentConversations.find((c) => c.id === 'P1').lastMessageState).toBe('delivered')

    await act(async () => {
      api.setConversationReceipt('P1', 'read')
      await flush()
    })
    expect(api.recentConversations.find((c) => c.id === 'P1').lastMessageState).toBe('read')

    // A late 'delivered' must not regress an existing 'read'.
    await act(async () => {
      api.setConversationReceipt('P1', 'delivered')
      await flush()
    })
    expect(api.recentConversations.find((c) => c.id === 'P1').lastMessageState).toBe('read')

    // Inbound last message → no receipt shown.
    await act(async () => {
      api.updateRecentConversations({ id: 'P2', username: 'peer2' }, { text: 'yo', userId: 'P2' })
      await flush()
    })
    conv = api.recentConversations.find((c) => c.id === 'P2')
    expect(conv.lastMessageFromMe).toBe(false)
    expect(conv.lastMessageState).toBe(null)

    // setConversationReceipt is a no-op on a conversation whose last msg is inbound.
    await act(async () => {
      api.setConversationReceipt('P2', 'read')
      await flush()
    })
    expect(api.recentConversations.find((c) => c.id === 'P2').lastMessageState).toBe(null)
  })
})
