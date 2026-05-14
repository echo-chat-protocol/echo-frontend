import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Register from '../Register'

describe('Register', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
