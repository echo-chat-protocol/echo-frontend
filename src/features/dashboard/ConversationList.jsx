import ConversationItem from './ConversationItem'

const ConversationList = ({
  conversations,
  activeChat,
  handleChatSelect,
  setIsHovered,
  ref,
  userId,
}) => {
  return (
    <div ref={ref} className='h-full overflow-y-auto'>
      <ul className='divide-y divide-gray-700'>
        {conversations.length > 0 ? (
          conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={activeChat?.id === conversation.id}
              onSelect={handleChatSelect}
              setIsHovered={setIsHovered}
              activeChat={activeChat}
              userId={userId}
              unreadCount={conversation.unreadCount || 0}
            />
          ))
        ) : (
          <div className='flex flex-col items-center justify-center h-full p-8 text-center'>
            <MessageCircle className='w-12 h-12 text-gray-500 mb-4' />
            <p className='text-gray-400'>No conversations found</p>
          </div>
        )}
      </ul>
    </div>
  )
}

export default ConversationList
