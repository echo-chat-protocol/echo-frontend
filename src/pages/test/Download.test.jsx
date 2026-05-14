import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DownloadPage from '../Download'

describe('Download (page)', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <DownloadPage />
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
