import { MessageCircle, User, Users, LogOut, PaintbrushVertical } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WALLPAPER_PREVIEWS } from '../utils/wallpaper.jsx'

// Custom hook para detectar clics fuera del elemento
const useClickOutside = (ref, callback) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        callback()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [ref, callback])
}

const getConsistentColor = (username) => {
  const colors = ['FF5733', '33FF57', '3357FF', 'F033FF', 'FF33F0']
  const index = username.length % colors.length
  return colors[index]
}

const WallpaperThumbnail = ({ wp, isActive, onClick }) => {
  const videoRef = useRef(null)

  const handleMouseEnter = () => {
    if (videoRef.current && wp.type === 'video') {
      videoRef.current.currentTime = 0
      videoRef.current.play()
    }
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      className={`group relative overflow-hidden rounded-md aspect-square ${
        isActive ? 'ring-2 ring-[#8e79f2]' : ''
      }`}
      title={wp.name}
    >
      {wp.type === 'video' ? (
        <div className='w-full h-full relative'>
          <video
            ref={videoRef}
            loop
            muted
            playsInline
            poster={wp.posterUrl}
            className='w-full h-full object-cover absolute inset-0'
          >
            <source src={wp.videoUrl} type='video/mp4' />
          </video>
          <div className='absolute inset-0 bg-black/20 flex items-center justify-center'>
            <span className='text-xl'>{wp.icon}</span>
          </div>
        </div>
      ) : wp.type === 'image' ? (
        <div
          className='w-full h-full bg-cover bg-center transition-all duration-300 group-hover:scale-110'
          style={{ backgroundImage: `url(${wp.imageUrl})` }}
        >
          <div className='absolute inset-0 bg-black/20 flex items-center justify-center'>
            <span className='text-xl'>{wp.icon}</span>
          </div>
        </div>
      ) : (
        <div
          className={`w-full h-full ${wp.className} transition-all duration-300 group-hover:scale-110`}
        >
          <div className='absolute inset-0 bg-black/20 flex items-center justify-center'>
            <span className='text-xl'>{wp.icon}</span>
          </div>
        </div>
      )}

      <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity'>
        <span className='text-xs text-white truncate block'>{wp.name}</span>
      </div>
    </button>
  )
}

const Sidebar = ({
  activeView,
  handleViewChange,
  handleProfileClick,
  handleLogout,
  profileImage,
  username,
  unreadMessages,
  onWallpaperChange,
  currentWallpaper,
}) => {
  const { t } = useTranslation()
  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const wallpaperMenuRef = useRef(null);
  const profileMenuRef = useRef(null);
  const totalUnread = Object.values(unreadMessages).reduce((a, b) => a + b, 0);

  useClickOutside(wallpaperMenuRef, () => {
    setShowWallpaperMenu(false)
  })

  useClickOutside(profileMenuRef, () => {
    setShowProfileMenu(false);
  });

  return (
    <div className='w-16 h-full bg-[#303030] flex flex-col items-center py-4 space-y-6 border-r border-gray-800 relative'>
      {/* Navegación principal */}
      <nav className='flex flex-col items-center space-y-6 flex-grow'>
        {/* Botón de chats */}
        <button
          data-testid="nav-chats"
          className={`relative p-3 rounded-xl transition-colors duration-200 ${
            activeView === 'chats'
              ? 'bg-[#8e79f2] text-white'
              : 'text-gray-400 hover:bg-[#c7b9ff] hover:text-[#4a3a8a]'
          }`}
          onClick={() => handleViewChange('chats')}
        >
          <MessageCircle className='w-5 h-5' />
          {totalUnread > 0 && (
            <span className='absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center'>
              {totalUnread}
            </span>
          )}
        </button>

        {/* Botón de amigos */}
        <button
          data-testid="nav-friends"
          className={`p-3 rounded-xl transition-colors duration-200 ${
            activeView === 'friends'
              ? 'bg-[#8e79f2] text-white'
              : 'text-gray-400 hover:bg-[#c7b9ff] hover:text-[#4a3a8a]'
          }`}
          onClick={() => handleViewChange('friends')}
        >
          <Users className='w-5 h-5' />
        </button>

        {/* Botón de wallpapers */}
        <div className='relative' ref={wallpaperMenuRef}>
          <button
            className={`p-3 rounded-xl transition-colors duration-200 ${
              showWallpaperMenu
                ? 'bg-[#8e79f2] text-white'
                : 'text-gray-400 hover:bg-[#c7b9ff] hover:text-[#4a3a8a]'
            }`}
            onClick={() => setShowWallpaperMenu(!showWallpaperMenu)}
          >
            <PaintbrushVertical className='w-5 h-5' />
          </button>

          {showWallpaperMenu && (
            <div className='absolute left-full top-0 ml-2 w-48 bg-[#404040] rounded-lg shadow-xl z-50 overflow-hidden border border-gray-600'>
              <div className='p-2 border-b border-gray-600'>
                <h3 className='text-xs font-semibold text-gray-300'>
                  {t('sidebar.wallpapers.title')}
                </h3>
              </div>
              <div className='grid grid-cols-2 gap-2 p-2'>
                {Object.entries(WALLPAPER_PREVIEWS).map(([id, wp]) => (
                  <WallpaperThumbnail
                    key={id}
                    wp={wp}
                    isActive={currentWallpaper === id}
                    onClick={() => {
                      onWallpaperChange(id)
                      setShowWallpaperMenu(false)
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Sección inferior - Profile with dropdown menu */}
      <div className="relative" ref={profileMenuRef}>
        {/* Avatar de usuario */}
        <div
          className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-black cursor-pointer hover:border-[#8e79f2] transition-colors"
          onClick={() => setShowProfileMenu(!showProfileMenu)}
        >
          <img
            src={
              profileImage ||
              `https://ui-avatars.com/api/?name=${username}&background=${getConsistentColor(username)}&color=fff`
            }
            alt='User Avatar'
            className='w-full h-full object-cover'
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${username}&background=${getConsistentColor(username)}&color=fff`
            }}
          />
        </div>

        {/* Profile dropdown menu */}
        {showProfileMenu && (
          <div className="absolute left-full bottom-0 ml-2 w-40 bg-[#404040] rounded-lg shadow-xl z-50 overflow-hidden border border-gray-600">
            <div className="p-2 border-b border-gray-600">
              <p className="text-xs font-semibold text-white truncate">{username}</p>
            </div>
            <div className="py-1">
              <button
                className="w-full px-3 py-2 text-sm text-gray-300 hover:bg-[#8e79f2] hover:text-white flex items-center gap-2 transition-colors"
                onClick={() => {
                  handleProfileClick();
                  setShowProfileMenu(false);
                }}
              >
                <User className="w-4 h-4" />
                Profile
              </button>
              <button
                className="w-full px-3 py-2 text-sm text-gray-300 hover:bg-red-600 hover:text-white flex items-center gap-2 transition-colors"
                onClick={() => {
                  handleLogout();
                  setShowProfileMenu(false);
                }}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Sidebar
