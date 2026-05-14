import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Pricing from '../Pricing'

describe('Pricing (page)', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
