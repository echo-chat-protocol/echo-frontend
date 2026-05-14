import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HelpPage from '../Help'

describe('Help (page)', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <HelpPage />
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
