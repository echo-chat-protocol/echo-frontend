import PropTypes from 'prop-types'
import { format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'

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

          <div
            className={`flex ${message.userId === currentUserId ? 'justify-end' : 'justify-start'}`}
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
                {message.userId !== currentUserId && (
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
                        message.seenStatus ? 'text-green-400' : 'text-gray-400'
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
                {message.text && <p>{message.text}</p>}
              </div>
            </div>
          </div>
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
