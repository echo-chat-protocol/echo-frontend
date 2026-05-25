import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import CallEventMessage from './CallEventMessage'

const extractTenorPostId = (text) => {
  if (!text) return null

  // Match data-postid from embed code
  const embedMatch = text.match(/data-postid="(\d+)"/)
  if (embedMatch) return embedMatch[1]

  // Match direct tenor.com/view links
  const linkMatch = text.match(/tenor\.com\/view\/[^"'\s]+-(\d+)/)
  if (linkMatch) return linkMatch[1]

  return null
}

// Component for Tenor GIF
const TenorGif = ({ postId }) => {
  const [gifUrl, setGifUrl] = useState(null)

  useEffect(() => {
    const API_KEY = import.meta.env.VITE_TENOR_API_KEY
    fetch(`https://tenor.googleapis.com/v2/posts?ids=${postId}&key=${API_KEY}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.results?.[0]?.media_formats?.gif?.url) {
          setGifUrl(data.results[0].media_formats.gif.url)
        }
      })
      .catch(console.error)
  }, [postId])

  if (!gifUrl) return <p>Loading GIF...</p>

  return (
    <img
      src={gifUrl}
      alt='Tenor GIF'
      className='max-w-full rounded-lg cursor-pointer'
      onClick={() => window.open(`https://tenor.com/view/-${postId}`, '_blank')}
    />
  )
}

// Render message content with Tenor GIF support
const renderMessageContent = (text) => {
  if (!text) return null

  const postId = extractTenorPostId(text)

  if (postId) {
    return <TenorGif postId={postId} />
  }

  return <p>{text}</p>
}
const DisplayText = ({ messages = [], currentUserId }) => {
  const shouldShowDate = (index) => {
    if (index === 0) return true
    const currentDate = new Date(messages[index].createdAt)
    const prevDate = new Date(messages[index - 1].createdAt)
    return !isSameDay(currentDate, prevDate)
  }

  return (
    <div className='flex-1 overflow-y-auto p-4 space-y-4'>
      {messages.map((message, index) => (
        <div key={message._id} className='space-y-2'>
          {shouldShowDate(index) && (
            <div className='flex justify-center my-4'>
              <span className='bg-gray-700 text-gray-300 text-sm px-3 py-1 rounded-full'>
                {format(new Date(message.createdAt), 'PPPP', { locale: es })}
              </span>
            </div>
          )}

          {/* Render call event messages */}
          {message.messageType === 'call_event' ? (
            <CallEventMessage callData={message.callData} currentUserId={currentUserId} />
          ) : message.messageType === 'system' ? (
            <div className='flex justify-center'>
              <div className='rounded-full bg-gray-800 px-4 py-2 text-sm text-gray-300'>
                {message.text}
              </div>
            </div>
          ) : (
            /* Render regular messages */
            <div
              className={`flex ${
                message.userId === currentUserId ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl rounded-lg p-3 ${
                  message.userId === currentUserId
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-gray-700 text-white rounded-bl-none'
                }`}
                style={{ wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}
              >
                <div className='flex items-baseline justify-between space-x-2'>
                  {message.userId !== currentUserId && message.username && (
                    <strong className='text-sm font-semibold text-indigo-300'>
                      {message.username}
                    </strong>
                  )}
                  <div className='flex items-center'>
                    <span className='text-sm text-gray-300'>
                      {format(new Date(message.createdAt), 'HH:mm')}
                    </span>
                    {message.userId === currentUserId && (
                      <svg
                        className={`ml-2 h-4 w-4 ${
                          message.seenStatus ? 'text-sky-400' : 'text-gray-400'
                        }`}
                        viewBox='0 0 122.88 74.46'
                        fill='currentColor'
                        xmlns='http://www.w3.org/2000/svg'
                      >
                        <path
                          fillRule='evenodd'
                          d='M1.87,47.2a6.33,6.33,0,1,1,8.92-9c8.88,8.85,17.53,17.66,26.53,26.45l-3.76,4.45-.35.37a6.33,6.33,0,0,1-8.95,0L1.87,47.2ZM30,43.55a6.33,6.33,0,1,1,8.82-9.07l25,24.38L111.64,2.29c5.37-6.35,15,1.84,9.66,8.18L69.07,72.22l-.3.33a6.33,6.33,0,0,1-8.95.12L30,43.55Zm28.76-4.21-.31.33-9.07-8.85L71.67,4.42c5.37-6.35,15,1.83,9.67,8.18L58.74,39.34Z'
                        />
                      </svg>
                    )}
                  </div>
                </div>
                <div className='mt-1 text-sm'>
                  {message.image && (
                    <img
                      src={message.image}
                      alt='Shared image'
                      className='max-w-full rounded-lg mb-2 cursor-pointer'
                      onClick={() => window.open(message.image, '_blank')}
                    />
                  )}
                  {message.text && renderMessageContent(message.text)}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

DisplayText.propTypes = {
  messages: PropTypes.array.isRequired,
  currentUserId: PropTypes.string.isRequired,
}

export default DisplayText
