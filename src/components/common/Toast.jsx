import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'
import '@assets/styles/Toast.css';

function Toast({ message, type = 'success', onClose }) {
  if (!message) return null

  let icon, title
  switch (type) {
    case 'success':
      icon = <CheckCircle className='user-profile-toast-icon' color='#1a7f37' />
      title = 'Success'
      break
    case 'warning':
      icon = <AlertTriangle className='user-profile-toast-icon' color='#b68400' />
      title = 'Warning'
      break
    case 'error':
      icon = <XCircle className='user-profile-toast-icon' color='#c00' />
      title = 'Error'
      break
    case 'info':
    default:
      icon = <Info className='user-profile-toast-icon' color='#2563eb' />
      title = 'Info'
  }

  return (
    <div
      className={`user-profile-toast user-profile-toast-${type}`}
      role='alert'
      aria-live='assertive'
    >
      {icon}
      <div className='user-profile-toast-content'>
        <span className='user-profile-toast-title'>{title}</span>
        <span>{message}</span>
      </div>
      <button
        className='user-profile-toast-close'
        onClick={onClose}
        aria-label='Close notification'
      >
        ×
      </button>
    </div>
  )
}

export default Toast
