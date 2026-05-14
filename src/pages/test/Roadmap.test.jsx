import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RoadmapPage from '../Roadmap'

describe('Roadmap (page)', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <RoadmapPage />
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
