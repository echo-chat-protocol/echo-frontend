import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CareersPage from '../Careers'

describe('Careers (page)', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <CareersPage />
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
