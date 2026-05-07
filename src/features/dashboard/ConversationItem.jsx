import { useEffect, useState } from "react";
import { getSavedMessages } from "../../Chat/utils/chat/keyManagement";

const ConversationItem = ({
  conversation,
  isActive,
  onSelect,
  setIsHovered,
  userId,
  activeChat,
  unreadCount = 0
}) => {
  const [latestMessage, setLatestMessage] = useState('')

  const getConsistentColor = (str) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const h = hash % 360
    return `hsl(${h}, 70%, 50%)`
      .replace(/[^\d,]/g, '')
      .split(',')
      .slice(0, 2)
      .join(',')
  }

  const avatarBgColor = getConsistentColor(conversation.username)

  useEffect(() => {
    const fetchLatest = async () => {
      const targetUserId = conversation.targetUserId || conversation.id;

      try {
        const messages = await getSavedMessages(userId, targetUserId);

        if (!messages || messages.length === 0) {
          if (unreadCount > 0) {
            setLatestMessage('New message');
          } else {
            setLatestMessage('No messages yet');
          }
          return;
        }

        const lastMsg = messages[messages.length - 1];

        if (lastMsg?.messageType === 'call_event') {
          const dur = lastMsg.callData?.duration || 0;
          const status = lastMsg.callData?.status;
          if (status === 'missed') {
            setLatestMessage('Missed call');
          } else if (status === 'declined') {
            setLatestMessage('Call declined');
          } else if (dur > 0) {
            const m = Math.floor(dur / 60);
            const s = dur % 60;
            setLatestMessage(`Video call ${m > 0 ? m + ':' + String(s).padStart(2, '0') : s + 's'}`);
          } else {
            setLatestMessage('Video call');
          }
        } else {
          setLatestMessage(lastMsg?.text || (unreadCount > 0 ? 'New message' : 'No messages yet'));
        }
      } catch (err) {
        console.error("Error fetching messages from ELD:", err);
        setLatestMessage(unreadCount > 0 ? 'New message' : 'No messages yet');
      }
    }

    // Initial fetch
    fetchLatest()

    const handleStorageUpdate = () => {
      fetchLatest();
    };

    window.addEventListener('localStorageUpdated', handleStorageUpdate);

    return () => {
      window.removeEventListener('localStorageUpdated', handleStorageUpdate);
    };
  }, [conversation, userId, unreadCount]);

  return (
    <li
      className={`p-3 hover:bg-[#8e79f2]/20 cursor-pointer transition-colors ${
        isActive ? 'bg-[#8e79f2]/20' : unreadCount > 0 ? 'bg-[#8e79f2]/10' : ''
      }`}
      onClick={() => onSelect(conversation)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className='flex items-center space-x-3'>
        <div className='relative'>
          <img
            src={conversation.profileImage ||
                 `https://ui-avatars.com/api/?name=${conversation.username}&background=${avatarBgColor}&color=fff`}
            alt={conversation.username}
            className='w-10 h-10 rounded-full object-cover border-2 border-black'
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${conversation.username}&background=${avatarBgColor}&color=fff`
              e.target.onerror = null
            }}
          />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <p className={`text-white truncate ${unreadCount > 0 ? 'font-bold' : 'font-medium'}`}>
              {conversation.username}
            </p>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {conversation.lastMessageTime
                ? new Date(conversation.lastMessageTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : ''}
            </span>
          </div>
          <p className={`text-sm truncate ${unreadCount > 0 ? 'text-white font-semibold' : 'text-gray-400'}`}>
            {latestMessage.length > 30
              ? `${latestMessage.substring(0, 30)}...`
              : latestMessage}
          </p>
        </div>
      </div>
    </li>
  )
}

export default ConversationItem
