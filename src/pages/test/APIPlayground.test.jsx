import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import APIPlayground from '../APIPlayground'

describe('APIPlayground (page)', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <APIPlayground />
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
