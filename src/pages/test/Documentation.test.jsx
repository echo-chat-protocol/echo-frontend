import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Documentation from '../Documentation'

describe('Documentation (page)', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/documentation']}>
        <Documentation />
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
