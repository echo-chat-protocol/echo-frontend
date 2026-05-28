import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/index.css'
import './i18n'
import App from '@/App'

import { ThemeProvider } from '@/contexts/ThemeContext'
import { I18nProvider } from '@/contexts/I18nContext'
import { AuthProvider } from '@/store/AuthContext'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>
)
