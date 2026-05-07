import { useState, useRef } from 'react'
import PropTypes from 'prop-types'
import { Send, X } from 'lucide-react'
import { compressImage } from '../utils/imageUtils'

const SendText = ({ sendMessage }) => {
  const [text, setText] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [imageText, setImageText] = useState('')
  const fileInputRef = useRef(null)

  const handleChange = (event) => {
    setText(event.target.value)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (text.trim()) {
      sendMessage(text)
      setText('')
    }
  }

  // Trigger hidden file input when image icon clicked
  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  // Read selected file and show preview modal
  const handleImageChange = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target.result)
        setShowImageModal(true)
      }
      reader.readAsDataURL(file)
    }
  }

  // Send image with optional text
  const handleImageSend = async () => {
    if (selectedImage) {
      // Compress the image
      const compressedBlob = await compressImage(selectedImage)

      // Convert to base64 for storage
      const reader = new FileReader()
      reader.onload = () => {
        const base64Image = reader.result
        sendMessage(imageText, base64Image)

        // Reset state
        setShowImageModal(false)
        setSelectedImage(null)
        setImagePreview(null)
        setImageText('')
      }
      reader.readAsDataURL(compressedBlob)
    }
  }

  const handleCloseModal = () => {
    setShowImageModal(false)
    setSelectedImage(null)
    setImagePreview(null)
    setImageText('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className='flex items-center p-3 bg-black border-t border-gray-800'
    >
      <div className='flex-1 flex items-center bg-white/10 rounded-full border border-gray-700 focus-within:ring-2 focus-within:ring-[#8e79f2]'>
        <button
          type='button'
          onClick={handleImageClick}
          className='pl-4 pr-2 py-3 text-gray-400 hover:text-white'
        >
          <i className='fa-solid fa-image text-lg'></i>
        </button>
        <input
          type='file'
          ref={fileInputRef}
          onChange={handleImageChange}
          accept='image/*'
          className='hidden'
        />
        {showImageModal && (
          <div className='fixed inset-0 bg-black/70 flex items-center justify-center z-50'>
            <div className='bg-gray-900 rounded-lg p-4 max-w-md w-full mx-4'>
              <button
                onClick={handleCloseModal}
                className='float-right text-gray-400 hover:text-white'
              >
                <X className='w-5 h-5' />
              </button>

              <img src={imagePreview} alt='Preview' className='max-h-64 mx-auto rounded-lg mb-4' />

              <input
                type='text'
                value={imageText}
                onChange={(e) => setImageText(e.target.value)}
                placeholder='Add a caption...'
                className='w-full p-3 bg-gray-800 text-white rounded-lg mb-4'
              />

              <button
                onClick={handleImageSend}
                className='w-full p-3 bg-indigo-700 text-white rounded-lg'
              >
                Send Image
              </button>
            </div>
          </div>
        )}
        <input
          type='text'
          value={text}
          onChange={handleChange}
          placeholder='Type a message...'
          className='flex-1 py-3 px-5 bg-white/10 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-[#8e79f2] placeholder-gray-400 border border-gray-700'
        />
      </div>
      <button
        type='submit'
        disabled={!text.trim()}
        className={`ml-3 p-3 rounded-full ${text.trim() ? 'bg-indigo-700 text-white hover:bg-[#8e79f2]' : 'bg-gray-700 text-gray-500 cursor-not-allowed'} transition-colors`}
      >
        <Send className='w-5 h-5' />
      </button>
    </form>
  )
}

SendText.propTypes = {
  sendMessage: PropTypes.func.isRequired,
}

export default SendText
