import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuthLayout from '../AuthLayout'

describe('AuthLayout', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <AuthLayout title='Title' subtitle='Subtitle'>
          <div>Child</div>
        </AuthLayout>
      </MemoryRouter>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
