import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import StatusPage from '../Status'

describe('Status (page)', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <StatusPage />
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
