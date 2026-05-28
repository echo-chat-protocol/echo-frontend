import { Navigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import EldUnlockGate from './EldUnlockGate'
import { tokenStorage } from '@services/api'

// Redirects to /login if no access token is found
const PrivateRoute = ({ children }) => {
  const token = tokenStorage.getAccess()
  if (!token) return <Navigate to='/login' replace />
  return <EldUnlockGate token={token}>{children}</EldUnlockGate>
}

PrivateRoute.propTypes = {
  children: PropTypes.node.isRequired,
}

export default PrivateRoute
