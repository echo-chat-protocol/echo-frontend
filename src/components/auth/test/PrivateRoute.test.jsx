import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrivateRoute from '../PrivateRoute'

describe('PrivateRoute', () => {
  it('renders children when token exists', () => {
    localStorage.setItem('token', 'test')

    render(
      <PrivateRoute>
        <div>OK</div>
      </PrivateRoute>
    )

    expect(screen.getByText('OK')).toBeInTheDocument()

    localStorage.removeItem('token')
  })
})
