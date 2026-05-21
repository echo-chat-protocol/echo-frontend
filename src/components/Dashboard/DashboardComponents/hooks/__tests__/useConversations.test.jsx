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
})
