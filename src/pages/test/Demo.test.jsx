import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Demo from '../Demo'

describe('Demo (page)', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Demo />
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
