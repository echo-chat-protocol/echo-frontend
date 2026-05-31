// @vitest-environment jsdom

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

vi.mock('@/hooks/useTauri', () => ({
  useTauri: () => ({ isTauri: false, isMobile: false }),
}))

vi.mock('@/pages/public/LoginPage', () => ({
  default: () => <div data-testid='login-page'>Login</div>,
}))

vi.mock('@/pages/public/LandingPage', () => ({
  default: () => <div data-testid='landing-page'>Landing</div>,
}))

vi.mock('@/pages/DeviceSyncPage', () => ({
  default: () => <div data-testid='device-sync-page'>Device sync</div>,
}))

vi.mock('./components/Dashboard/Dashboard', () => ({
  default: () => <div data-testid='dashboard-page'>Dashboard</div>,
}))

vi.mock('./components/Dashboard/Chat/Chat', () => ({
  default: () => <div data-testid='chat-page'>Chat</div>,
}))

vi.mock('./components/Dashboard/UserProfileModal', () => ({
  default: () => <div data-testid='profile-modal'>Profile</div>,
}))

vi.mock('./components/VideoCall/VideoCall', () => ({
  default: () => <div data-testid='video-call-page'>Video call</div>,
}))

vi.mock('./features/landing/Pricing', () => ({
  default: () => <div data-testid='pricing-page'>Pricing</div>,
}))

vi.mock('@/pages/public/FeaturesPage', () => ({
  default: () => <div>Features</div>,
}))

vi.mock('@/pages/public/SecurityPage', () => ({
  default: () => <div>Security</div>,
}))

vi.mock('@/pages/public/DownloadPage', () => ({
  default: () => <div>Download</div>,
}))

vi.mock('@/pages/public/DocsPage', () => ({
  default: () => <div>Docs</div>,
}))

vi.mock('@/pages/public/CommunityPage', () => ({
  default: () => <div>Community</div>,
}))

vi.mock('@/pages/public/HelpPage', () => ({
  default: () => <div>Help</div>,
}))

vi.mock('@/pages/public/AboutPage', () => ({
  default: () => <div>About</div>,
}))

vi.mock('@/pages/public/BlogPage', () => ({
  default: () => <div>Blog</div>,
}))

vi.mock('@/pages/public/ContactPage', () => ({
  default: () => <div>Contact</div>,
}))

vi.mock('@/pages/public/PrivacyPage', () => ({
  default: () => <div>Privacy</div>,
}))

vi.mock('@/pages/public/TermsPage', () => ({
  default: () => <div>Terms</div>,
}))

vi.mock('@/pages/public/CookiesPage', () => ({
  default: () => <div>Cookies</div>,
}))

vi.mock('@/pages/public/GdprPage', () => ({
  default: () => <div>GDPR</div>,
}))

vi.mock('@/pages/public/LicensesPage', () => ({
  default: () => <div>Licenses</div>,
}))

import App from './App'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

async function renderAt(path) {
  window.history.pushState({}, '', path)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(<App />)
    await flush()
    await flush()
  })

  return { container, root }
}

describe('App route protection', () => {
  let mounted = null

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.scrollTo = vi.fn()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    if (mounted) {
      act(() => mounted.root.unmount())
      mounted.container.remove()
      mounted = null
    }
    localStorage.clear()
    sessionStorage.clear()
  })

  it.each(['/dashboard', '/chat', '/video-call/u-1', '/profile/u-1'])(
    'redirects signed-out users from %s to login',
    async (path) => {
      mounted = await renderAt(path)

      expect(window.location.pathname).toBe('/login')
      expect(mounted.container.textContent).toContain('Login')
      expect(mounted.container.textContent).not.toContain('Profile')
      expect(mounted.container.textContent).not.toContain('Dashboard')
      expect(mounted.container.textContent).not.toContain('Chat')
      expect(mounted.container.textContent).not.toContain('Video call')
    }
  )
})
