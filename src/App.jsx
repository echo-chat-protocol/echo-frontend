import { Suspense, lazy, useEffect, useRef, useState } from 'react'
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
import { getSocket } from './socket'
import './App.css'
import ErrorBoundary from './components/common/ErrorBoundary'
import ScrollToTop from './components/common/ScrollToTop'
import Spinner from './components/common/Spinner'
import PrivateRoute from './components/auth/PrivateRoute' // NOT lazy — used as synchronous route wrapper

// ─── App / protected pages (lazy) ──────────────────────────────────────────────
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'))
const Chat = lazy(() => import('./components/Dashboard/Chat/Chat'))
const UserProfile = lazy(() => import('./components/Dashboard/UserProfileModal'))
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
const BlogWhatIsEcho = lazy(() => import('@/pages/public/BlogWhatIsEcho'))
const ContactPage = lazy(() => import('@/pages/public/ContactPage'))
const PrivacyPage = lazy(() => import('@/pages/public/PrivacyPage'))
const TermsPage = lazy(() => import('@/pages/public/TermsPage'))
const GdprPage = lazy(() => import('@/pages/public/GdprPage'))
const LicensesPage = lazy(() => import('@/pages/public/LicensesPage'))
const PricingPage = lazy(() => import('@/pages/public/PricingPage'))
// DeviceSyncPage is eagerly imported to avoid dynamic import issues on mobile
import DeviceSyncPage from '@/pages/DeviceSyncPage'

// ─── Tauri gate: redirect to /device-sync when running inside Tauri ──────────
function TauriGate() {
  const { isTauri } = useTauri()
  if (tokenStorage.getAccess()) return <Navigate to='/dashboard' replace />
  if (isTauri) return <Navigate to='/device-sync' replace />
  return <LandingPage />
}

function GuestOnlyRoute({ children }) {
  const location = useLocation()
  const { isTauri, isMobile } = useTauri()
  const token = tokenStorage.getAccess()
  // If already authenticated, allow /device-sync specifically (Tauri may use it post-auth)
  if (token && location.pathname !== '/device-sync') return <Navigate to='/dashboard' replace />
  // On Tauri mobile, disallow the traditional sign-in page; keep /device-sync and /register
  if (isTauri && isMobile && location.pathname === '/login')
    return <Navigate to='/device-sync' replace />
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
      // Allow /device-sync for Tauri/mobile even if authenticated to avoid loops
      const isTauriMobile =
        typeof window !== 'undefined' &&
        Boolean(window.__TAURI_INTERNALS__) &&
        /android|iphone|ipad|ipod/i.test(navigator.userAgent)
      if (location.pathname === '/device-sync' && isTauriMobile) return
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
// PrivateRoute already requires a valid session, but the `:userId` segment is
// attacker-controlled — previously any string (e.g. /profile/Hdadadad) rendered
// a blank profile shell for a user that doesn't exist. Verify the target user
// actually exists via the authenticated socket before rendering, and bounce to
// the dashboard otherwise. Fails closed if the server never answers.
function UserProfileRoute() {
  const { userId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // 'loading' | 'ok' | 'invalid'
  const [resolvedUser, setResolvedUser] = useState(null)

  useEffect(() => {
    if (!userId) {
      setStatus('invalid')
      return undefined
    }

    let settled = false
    setStatus('loading')

    const finish = (ok, user) => {
      if (settled) return
      settled = true
      if (ok) {
        setResolvedUser(user)
        setStatus('ok')
      } else {
        setStatus('invalid')
      }
    }

    getSocket().emit('getUserInfo', { userId }, (res) => {
      if (res?.success && res?.user) {
        // Server data wins; trust the authenticated lookup over the URL/state.
        finish(true, {
          ...(location.state?.user || {}),
          ...res.user,
          id: res.user.id ?? userId,
        })
      } else {
        finish(false)
      }
    })

    const timer = window.setTimeout(() => finish(false), 8000)
    return () => {
      settled = true
      window.clearTimeout(timer)
    }
  }, [userId, location.state])

  if (status === 'loading') {
    return (
      <div className='grid min-h-screen place-items-center bg-black'>
        <Spinner />
      </div>
    )
  }

  if (status === 'invalid') return <Navigate to='/dashboard' replace />

  return <UserProfile user={resolvedUser} open onClose={() => navigate(-1)} />
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

            {/* Company */}
            <Route path='/about' element={<AboutPage />} />
            <Route path='/careers' element={<Navigate to='/' replace />} />
            <Route path='/blog' element={<BlogPage />} />
            <Route path='/blog/what-is-echo' element={<BlogWhatIsEcho />} />
            <Route path='/contact' element={<ContactPage />} />

            {/* Legal (new short URLs) */}
            <Route path='/privacy' element={<PrivacyPage />} />
            <Route path='/terms' element={<TermsPage />} />
            <Route path='/gdpr' element={<GdprPage />} />
            <Route path='/licenses' element={<LicensesPage />} />

            {/* ── Legacy paths kept alive with redirects / old components ── */}
            <Route path='/documentation' element={<Navigate to='/docs' replace />} />
            <Route path='/documentation/guides' element={<Navigate to='/docs' replace />} />
            <Route path='/documentation/protocols' element={<Navigate to='/docs' replace />} />
            <Route path='/pricing' element={<Navigate to='/pricingpage' replace />} />
            <Route path='/pricingpage' element={<PricingPage />} />

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
            <Route
              path='/profile/:userId'
              element={
                <PrivateRoute>
                  <UserProfileRoute />
                </PrivateRoute>
              }
            />

            {/* 404 fallback */}
            <Route path='*' element={<Navigate to='/' replace />} />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  )
}

export default App
