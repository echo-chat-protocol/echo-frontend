import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Leaderboard from '../Leaderboard'

describe('Leaderboard (page)', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
