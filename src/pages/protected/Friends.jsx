import { useState, useEffect, useCallback, useRef } from "react";
import { getSocket } from "../../../socket";
import PropTypes from "prop-types";
import { jwtDecode } from "jwt-decode";
import { formatProfileImage } from "../DashboardComponents/utils/helpers";

const Friends = ({ token, onActiveChatChange, searchTerm }) => {
  const [chatList, setSearchList] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const socketRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    // No cleanup - don't disconnect shared socket
  }, [token]);

  const handleSearch = useCallback(() => {
    const user = token ? jwtDecode(token) : ''
    if (!searchTerm || searchTerm === user.username) {
      return
    }

    const socket = getSocket()
    if (!socket?.connected) return

    socket.emit('searchUser', { searchTerm }, (response) => {
      if (response && response.user) {
        const basicUser = response.user

        socket.emit('getUserInfo', { userId: basicUser.id }, (profileResponse) => {
          let profilePicture = basicUser.profileImage

          if (profileResponse && profileResponse.success && profileResponse.user) {
            profilePicture = profileResponse.user.profilePicture
          }

          const formattedProfileImage = formatProfileImage(profilePicture, basicUser.username)

          const targetUser = {
            ...basicUser,
            profileImage: formattedProfileImage,
          }

          setSearchList((prevChatList) => {
            const userExists = prevChatList.some((user) => user.id === targetUser.id)
            return userExists ? prevChatList : [...prevChatList, targetUser]
          })
        })
      }
    })
  }, [searchTerm, token])

  useEffect(() => {
    if (searchTerm && searchTerm.trim() !== '') {
      handleSearch()
    } else {
      setSearchList([])
    }
  }, [searchTerm, handleSearch])

  return (
    <div className='h-full overflow-y-auto'>
      <ul className='divide-y divide-gray-700'>
        {chatList.map((targetUser, index) => (
          <li
            key={index}
            data-testid="friend-result"
            onClick={() =>
              onActiveChatChange({
                id: targetUser.id,
                username: targetUser.username,
                profileImage: targetUser.profileImage,
              })
            }
            className='p-3 hover:bg-[#8e79f2]/20 cursor-pointer transition-colors duration-200 group'
          >
            <div className='flex items-center space-x-3'>
              <div className='relative'>
                <img
                  src={targetUser.profileImage}
                  alt={targetUser.username}
                  className='w-10 h-10 rounded-full object-cover border-2 border-black'
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${targetUser.username}&background=8e79f2&color=fff`
                  }}
                />
              </div>
              <div>
                <p className='text-white font-medium group-hover:text-white'>
                  {targetUser.username}
                </p>
              </div>
            </div>
          </li>
        ))}

        {notifications.map((notification, index) => (
          <li
            key={index}
            onClick={() =>
              onActiveChatChange({
                id: notification.messageData.id,
                username: notification.messageData.username,
                profileImage: notification.messageData.profileImage,
              })
            }
            className='p-3 hover:bg-[#8e79f2]/30 cursor-pointer transition-colors duration-200 group'
          >
            <div className='flex items-center space-x-3'>
              <div className='relative'>
                <img
                  src={notification.messageData.profileImage}
                  alt={notification.messageData.username}
                  className='w-10 h-10 rounded-full object-cover border-2 border-black'
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${notification.messageData.username}&background=8e79f2&color=fff`
                  }}
                />
                <span className='absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center'>
                  !
                </span>
              </div>
              <div className='flex-1'>
                <p className='text-white font-medium group-hover:text-white'>
                  {notification.messageData.username}
                </p>
                <p className='text-sm text-gray-300 truncate group-hover:text-white'>
                  {notification.message}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

Friends.propTypes = {
  token: PropTypes.string.isRequired,
  onActiveChatChange: PropTypes.func.isRequired,
  searchTerm: PropTypes.string,
}

export default Friends
