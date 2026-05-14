import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Community from '../Community'

describe('Community (page)', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Community />
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
