import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'

import '../Dashboard.css'

const UserInfo = ({ username, userId }) => {
  const navigate = useNavigate()

  const handleProfileRedirect = () => {
    navigate(`/profile/${userId}`, { state: { username, userId } })
  }

  return (
    <div className='user-info-container'>
      <h3>Logged in as:</h3>
      <p>{username}</p>
      <p>{userId}</p>
      <button onClick={handleProfileRedirect}>Go to Profile</button>
    </div>
  )
}

UserInfo.propTypes = {
  username: PropTypes.string.isRequired,
  userId: PropTypes.string.isRequired,
}

export default UserInfo
