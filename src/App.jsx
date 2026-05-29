import { Suspense, lazy, useEffect, useRef } from 'react'
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useParams,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import PropTypes from 'prop-types'
import { useTauri } from '@/hooks/useTauri'
import { tokenStorage } from '@services/api'
import './App.css'
import ErrorBoundary from './components/common/ErrorBoundary'
import ScrollToTop from './components/common/ScrollToTop'
import Spinner from './components/common/Spinner'
import PrivateRoute from './components/auth/PrivateRoute' // NOT lazy — used as synchronous route wrapper

// ─── App / protected pages (lazy) ──────────────────────────────────────────────
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'))
const Chat = lazy(() => import('./components/Dashboard/Chat/Chat'))
const UserProfile = lazy(() => import('./components/Dashboard/UserProfileModal'))
const Pricing = lazy(() => import('./features/landing/Pricing'))
const VideoCall = lazy(() => import('./components/VideoCall/VideoCall'))

// ─── New public pages (lazy, feature-based architecture) ─────────────────────
const LandingPage = lazy(() => import('@/pages/public/LandingPage'))
const LoginPage = lazy(() => import('@/pages/public/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/public/RegisterPage'))
const FeaturesPage = lazy(() => import('@/pages/public/FeaturesPage'))
const SecurityPage = lazy(() => import('@/pages/public/SecurityPage'))
const DownloadPage = lazy(() => import('@/pages/public/DownloadPage'))
const DocsPage = lazy(() => import('@/pages/public/DocsPage'))
const CommunityPage = lazy(() => import('@/pages/public/CommunityPage'))
const HelpPage = lazy(() => import('@/pages/public/HelpPage'))
const AboutPage = lazy(() => import('@/pages/public/AboutPage'))
const BlogPage = lazy(() => import('@/pages/public/BlogPage'))
const ContactPage = lazy(() => import('@/pages/public/ContactPage'))
const PrivacyPage = lazy(() => import('@/pages/public/PrivacyPage'))
const TermsPage = lazy(() => import('@/pages/public/TermsPage'))
const CookiesPage = lazy(() => import('@/pages/public/CookiesPage'))
const GdprPage = lazy(() => import('@/pages/public/GdprPage'))
const LicensesPage = lazy(() => import('@/pages/public/LicensesPage'))
const DeviceSyncPage = lazy(() => import('@/pages/DeviceSyncPage'))

// ─── Tauri gate: redirect to /device-sync when running inside Tauri ──────────
function TauriGate() {
  const { isTauri } = useTauri()
  if (tokenStorage.getAccess()) return <Navigate to='/dashboard' replace />
  if (isTauri) return <Navigate to='/device-sync' replace />
  return <LandingPage />
}

function GuestOnlyRoute({ children }) {
  if (tokenStorage.getAccess()) return <Navigate to='/dashboard' replace />
  return children
}

GuestOnlyRoute.propTypes = {
  children: PropTypes.node.isRequired,
}

const GUEST_ENTRY_PATHS = new Set(['/', '/login', '/register', '/device-sync'])

function AuthenticatedBackGuard() {
  const location = useLocation()
  const navigate = useNavigate()
  const armedDashboardGuardRef = useRef(false)

  useEffect(() => {
    const token = tokenStorage.getAccess()
    if (!token) return

    if (GUEST_ENTRY_PATHS.has(location.pathname)) {
      navigate('/dashboard', { replace: true })
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    const token = tokenStorage.getAccess()
    if (!token || location.pathname !== '/dashboard') {
      armedDashboardGuardRef.current = false
      return
    }

    const isTauriMobile =
      typeof window !== 'undefined' &&
      Boolean(window.__TAURI_INTERNALS__) &&
      /android|iphone|ipad|ipod/i.test(navigator.userAgent)

    if (!isTauriMobile || armedDashboardGuardRef.current) return

    const href = `${location.pathname}${location.search}${location.hash}`
    window.history.replaceState(
      { ...(window.history.state || {}), echoDashboardBase: true },
      '',
      href
    )
    window.history.pushState({ echoDashboardGuard: true }, '', href)
    armedDashboardGuardRef.current = true
  }, [location.hash, location.pathname, location.search])

  useEffect(() => {
    const handlePopState = () => {
      const token = tokenStorage.getAccess()
      if (!token) return

      window.setTimeout(() => {
        const path = window.location.pathname

        if (GUEST_ENTRY_PATHS.has(path)) {
          navigate('/dashboard', { replace: true })
          return
        }

        if (path === '/dashboard' && armedDashboardGuardRef.current) {
          const href = `${window.location.pathname}${window.location.search}${window.location.hash}`
          window.history.pushState({ echoDashboardGuard: true }, '', href)
        }
      }, 0)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [navigate])

  return null
}

// ─── Profile route wrapper ───────────────────────────────────────────────────
function UserProfileRoute() {
  const { userId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const user = location.state?.user || { id: userId }

  if (!user) return <Navigate to='/login' replace />

  return <UserProfile user={user} open onClose={() => navigate(-1)} />
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthenticatedBackGuard />
        <ScrollToTop />
        <Suspense fallback={<Spinner />}>
          <Routes>
            {/* ── New landing / public (feature-based) ─────────────────── */}
            <Route path='/' element={<TauriGate />} />
            <Route
              path='/device-sync'
              element={
                <GuestOnlyRoute>
                  <DeviceSyncPage />
                </GuestOnlyRoute>
              }
            />
            <Route
              path='/login'
              element={
                <GuestOnlyRoute>
                  <LoginPage />
                </GuestOnlyRoute>
              }
            />
            <Route
              path='/register'
              element={
                <GuestOnlyRoute>
                  <RegisterPage />
                </GuestOnlyRoute>
              }
            />

            {/* Auth aliases → new pages */}
            <Route path='/auth/login' element={<Navigate to='/login' replace />} />
            <Route path='/auth/register' element={<Navigate to='/register' replace />} />

            {/* Product */}
            <Route path='/features' element={<FeaturesPage />} />
            <Route path='/security' element={<SecurityPage />} />
            <Route path='/download' element={<DownloadPage />} />
            <Route path='/roadmap' element={<Navigate to='/' replace />} />

            {/* Resources */}
            <Route path='/docs' element={<DocsPage />} />
            <Route path='/community' element={<CommunityPage />} />
            <Route path='/help' element={<HelpPage />} />
            <Route path='/status' element={<Navigate to='/' replace />} />

            {/* Company */}
            <Route path='/about' element={<AboutPage />} />
            <Route path='/careers' element={<Navigate to='/' replace />} />
            <Route path='/blog' element={<BlogPage />} />
            <Route path='/contact' element={<ContactPage />} />

            {/* Legal (new short URLs) */}
            <Route path='/privacy' element={<PrivacyPage />} />
            <Route path='/terms' element={<TermsPage />} />
            <Route path='/cookies' element={<CookiesPage />} />
            <Route path='/gdpr' element={<GdprPage />} />
            <Route path='/licenses' element={<LicensesPage />} />

            {/* ── Legacy paths kept alive with redirects / old components ── */}
            <Route path='/documentation' element={<Navigate to='/docs' replace />} />
            <Route path='/documentation/guides' element={<Navigate to='/docs' replace />} />
            <Route path='/documentation/protocols' element={<Navigate to='/docs' replace />} />
            <Route path='/pricing' element={<Pricing />} />

            {/* Legacy event/tool paths → new public pages */}
            <Route path='/community/events/*' element={<Navigate to='/community' replace />} />
            <Route path='/community/leaderboard' element={<Navigate to='/community' replace />} />
            <Route path='/demo' element={<Navigate to='/' replace />} />
            <Route path='/api-playground' element={<Navigate to='/docs' replace />} />
            <Route path='/contact-us' element={<Navigate to='/contact' replace />} />
            <Route path='/about-us' element={<Navigate to='/about' replace />} />
            <Route path='/community-legacy' element={<Navigate to='/community' replace />} />

            {/* Legacy legal long paths → new short paths */}
            <Route path='/legal/privacy-policy' element={<Navigate to='/privacy' replace />} />
            <Route path='/legal/terms-of-service' element={<Navigate to='/terms' replace />} />
            <Route path='/legal/cookie-policy' element={<Navigate to='/cookies' replace />} />
            <Route path='/legal/gdpr' element={<Navigate to='/gdpr' replace />} />
            <Route path='/legal/licenses' element={<Navigate to='/licenses' replace />} />

            {/* ── Protected routes ─────────────────────────────────────── */}
            <Route
              path='/dashboard'
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path='/chat'
              element={
                <PrivateRoute>
                  <Chat />
                </PrivateRoute>
              }
            />
            <Route
              path='/video-call/:odebukiUserId'
              element={
                <PrivateRoute>
                  <VideoCall />
                </PrivateRoute>
              }
            />
            <Route path='/profile/:userId' element={<UserProfileRoute />} />

            {/* 404 fallback */}
            <Route path='*' element={<Navigate to='/' replace />} />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  )
}

export default App
