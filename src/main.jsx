import './i18n/config.js'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@assets/styles/theme.css'
import '@assets/styles/index.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import { AuthProvider } from '@store/AuthContext'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
)
