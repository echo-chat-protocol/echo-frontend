import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../Login'

describe('Login', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
