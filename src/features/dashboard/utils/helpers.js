import { jwtDecode } from 'jwt-decode'

export const getConsistentColor = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }

  let color = ''
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff
    color += ('00' + value.toString(16)).substr(-2)
  }

  return color
}

export const getUserData = (token) => {
  if (!token) return { username: '', userId: '', profileImage: '' }

  const decodedToken = jwtDecode(token)
  const username = decodedToken.username
  const userId = decodedToken.id

  // Try to get profile from cache first
  const cachedProfile = getCachedUserProfile(userId)
  let profileImage = ''

  if (cachedProfile && cachedProfile.profilePicture) {
    profileImage = formatProfileImage(cachedProfile.profilePicture, username)
  } else {
    profileImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=${getConsistentColor(username)}&color=fff`
  }

  return { username, userId, profileImage }
}

export const getCachedUserProfile = (userId) => {
  try {
    const cached = localStorage.getItem(`profile-${userId}`)
    return cached ? JSON.parse(cached) : null
  } catch (error) {
    console.error('Error parsing cached profile:', error)
    return null
  }
}

export const formatProfileImage = (profilePicture, username) => {
  if (!profilePicture) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=${getConsistentColor(username)}&color=fff`
  }

  if (profilePicture.startsWith('/uploads/')) {
    return `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${profilePicture}`
  }

  return profilePicture
}

export const fetchUserProfileFromSocket = (socket, userId) => {
  return new Promise((resolve, reject) => {
    socket.emit('getUserInfo', { userId }, (response) => {
      if (response && response.success && response.user) {
        const profileData = {
          username: response.user.username || '',
          aboutme: response.user.aboutme || '',
          profilePicture: response.user.profilePicture || '',
        }

        // Cache the profile data
        localStorage.setItem(`profile-${userId}`, JSON.stringify(profileData))

        // Emit custom event to notify components about profile update
        window.dispatchEvent(
          new CustomEvent('profileUpdated', {
            detail: { userId, profileData },
          })
        )

        resolve(profileData)
      } else {
        reject(new Error(response?.error || 'Failed to fetch user profile'))
      }
    })
  })
}
