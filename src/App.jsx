import { Suspense, lazy } from 'react'
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useParams,
  Navigate,
  useLocation,
} from 'react-router-dom'
import './App.css'
import ErrorBoundary from './components/common/ErrorBoundary'
import ScrollToTop from './components/common/ScrollToTop'
import Spinner from './components/common/Spinner'
import PrivateRoute from './components/auth/PrivateRoute' // NOT lazy — used as synchronous route wrapper

// ─── Lazy-loaded pages (code splitting) ─────────────────────────────────────
const Login = lazy(() => import('./components/Login'))
const Register = lazy(() => import('./components/Register'))
const LandingPage = lazy(() => import('./components/LandingPage'))
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'))
const Chat = lazy(() => import('./components/Dashboard/Chat/Chat'))
const UserProfile = lazy(() => import('./components/Dashboard/UserProfile'))
const Documentation = lazy(() => import('./pages/Documentation'))
const Pricing = lazy(() => import('./pages/Pricing'))
const Community = lazy(() => import('./pages/Community'))
const SecuritySummit = lazy(() => import('./pages/CommunityEvents/SecuritySummit'))
const GlobalHackathon = lazy(() => import('./pages/CommunityEvents/GlobalHackathon'))
const TownHall = lazy(() => import('./pages/CommunityEvents/TownHall'))
const EchoCon = lazy(() => import('./pages/CommunityEvents/EchoCon'))
const PrivacyWorkshop = lazy(() => import('./pages/CommunityEvents/PrivacyWorkshop'))
const OpenSourceDay = lazy(() => import('./pages/CommunityEvents/OpenSourceDay'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const Demo = lazy(() => import('./pages/Demo'))
const APIPlayground = lazy(() => import('./pages/APIPlayground'))
const PrivacyPolicy = lazy(
  () => import('./components/HomepageComponents/FooterComponents/Legal/PrivacyPolicy')
)
const TermsOfService = lazy(
  () => import('./components/HomepageComponents/FooterComponents/Legal/TermsOfService')
)
const CookiePolicy = lazy(
  () => import('./components/HomepageComponents/FooterComponents/Legal/CookiePolicy')
)
const GDPR = lazy(() => import('./components/HomepageComponents/FooterComponents/Legal/GDPR'))
const ContactUs = lazy(() => import('./components/HomepageComponents/FooterComponents/ContactUs'))
const AboutUs = lazy(() => import('./components/HomepageComponents/FooterComponents/AboutUs'))
const BlogPage = lazy(() => import('./components/HomepageComponents/Blog'))
const CommunityPage = lazy(
  () => import('./components/HomepageComponents/FooterComponents/Community')
)
const DownloadPage = lazy(() => import('./pages/Download'))
const RoadmapPage = lazy(() => import('./pages/Roadmap'))
const HelpPage = lazy(() => import('./pages/Help'))
const StatusPage = lazy(() => import('./pages/Status'))
const CareersPage = lazy(() => import('./pages/Careers'))
const LicensesPage = lazy(
  () => import('./components/HomepageComponents/FooterComponents/Legal/Licenses')
)
const EchoChatWidget = lazy(() => import('./components/EchoChatWidget/EchoChatWidget'))
const VideoCall = lazy(() => import('./components/VideoCall/VideoCall'))

// ─── Profile route wrapper ───────────────────────────────────────────────────
function UserProfileRoute() {
  const { userId } = useParams()
  const location = useLocation()
  const user = location.state?.user || { id: userId }

  if (!user) return <Navigate to='/login' replace />

  return <UserProfile user={user} onChangePassword={() => alert('Change password clicked!')} />
}

function GlobalWidget() {
  const location = useLocation()
  const hiddenPrefixes = ['/dashboard', '/chat', '/video-call']
  const shouldHide = hiddenPrefixes.some((prefix) => location.pathname.startsWith(prefix))

  return shouldHide ? null : <EchoChatWidget />
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ScrollToTop />
        <Suspense fallback={<Spinner />}>
          <Routes>
            {/* Public */}
            <Route path='/' element={<LandingPage />} />
            <Route path='/login' element={<Login />} />
            <Route path='/register' element={<Register />} />

            {/* Alias routes */}
            <Route path='/auth/login' element={<Navigate to='/login' replace />} />
            <Route path='/auth/register' element={<Navigate to='/register' replace />} />

            {/* Content */}
            <Route path='/docs' element={<Documentation />} />
            <Route path='/documentation' element={<Navigate to='/docs' replace />} />
            <Route path='/documentation/guides' element={<Navigate to='/docs' replace />} />
            <Route path='/documentation/protocols' element={<Navigate to='/docs' replace />} />
            <Route path='/pricing' element={<Pricing />} />
            <Route path='/community' element={<Community />} />
            <Route path='/community/events/security-summit' element={<SecuritySummit />} />
            <Route path='/community/events/hackathon' element={<GlobalHackathon />} />
            <Route path='/community/events/town-hall' element={<TownHall />} />
            <Route path='/community/events/echocon' element={<EchoCon />} />
            <Route path='/community/events/privacy-workshop' element={<PrivacyWorkshop />} />
            <Route path='/community/events/open-source-day' element={<OpenSourceDay />} />
            <Route path='/community/leaderboard' element={<Leaderboard />} />
            <Route path='/demo' element={<Demo />} />
            <Route path='/api-playground' element={<APIPlayground />} />
            <Route path='/contact-us' element={<ContactUs />} />
            <Route path='/about-us' element={<AboutUs />} />
            <Route path='/blog' element={<BlogPage />} />

            {/* Product pages */}
            <Route path='/download' element={<DownloadPage />} />
            <Route path='/roadmap' element={<RoadmapPage />} />
            <Route path='/help' element={<HelpPage />} />
            <Route path='/status' element={<StatusPage />} />
            <Route path='/careers' element={<CareersPage />} />

            {/* Legal */}
            <Route path='/legal/privacy-policy' element={<PrivacyPolicy />} />
            <Route path='/legal/terms-of-service' element={<TermsOfService />} />
            <Route path='/legal/cookie-policy' element={<CookiePolicy />} />
            <Route path='/legal/gdpr' element={<GDPR />} />
            <Route path='/legal/licenses' element={<LicensesPage />} />

            {/* Legacy redirects */}
            <Route path='/documentation-legacy' element={<Navigate to='/docs' replace />} />
            <Route path='/community-legacy' element={<CommunityPage />} />

            {/* Protected */}
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

          {/* Global widget */}
          <GlobalWidget />
        </Suspense>
      </Router>
    </ErrorBoundary>
  )
}

export default App
