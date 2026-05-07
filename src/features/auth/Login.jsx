import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectWithoutAuth } from '@/socket'
import { jwtDecode } from 'jwt-decode'
import { User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import init from '@mascaro101/echo-protocol'
import '@assets/styles/SignIn.css'
import eld from '@lib/storage/EncryptedLocalDatabase'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()

    if (!username || !password) {
      setError('Username and password cannot be empty')
      return
    }

    await init()
    const socket = connectWithoutAuth()

    socket.once('connect', () => {
      socket.emit('login', { username, password }, async (response) => {
        if (response.success) {
          localStorage.setItem('token', response.token)

          const resolvedUserId =
            response.userId ||
            (() => {
              try {
                const decoded = jwtDecode(response.token)
                return decoded?.id || ''
              } catch {
                return ''
              }
            })()

          localStorage.setItem('userId', resolvedUserId)

          // Unlock the encrypted database
          try {
            const userExists = await eld.userExists(resolvedUserId)

            if (userExists) {
              await eld.unlock(resolvedUserId, password)
            } else {
              // First login on this device - no local keys
              // Option 1: Show warning and continue
              console.warn('[ELD] No local database - keys not available locally')
              // Option 2: Or block login and require re-registration
              // setError("No local keys found. Please register on this device.");
              // socket.disconnect();
              // return;
            }

            navigate('/dashboard')
          } catch (err) {
            console.error('[ELD] Unlock failed:', err)
            setError('Failed to unlock: ' + err.message)
            socket.disconnect()
          }
        } else {
          setError(response.error || 'Login failed')
          socket.disconnect()
        }
      })
    })
  }

  return (
    <div className='relative h-screen w-screen overflow-hidden bg-primary-1000'>
      <div className='absolute inset-0 z-0'>
        <img
          alt='Echo wallpaper'
          className='h-full w-full object-cover'
          src='/wallpapers/Echowallpaper2.png'
        />
        <div className='absolute inset-0 bg-black/40' />
      </div>

      <div className='relative z-10 flex h-screen w-screen items-center justify-center px-5'>
        <div className='form-container w-full max-w-md rounded-2xl border border-white/20 bg-black/35 p-7 shadow-[0_0_45px_rgba(170,190,255,0.18)] backdrop-blur-xl'>
          <div className='mb-6 flex justify-center'>
            <img alt='ECHO brand logo' className='h-12 w-auto' src='/echo-logo-text.png' />
          </div>

          <h1 className='mb-8 text-center text-3xl font-semibold tracking-wide text-white'>
            Welcome Back
          </h1>

          {error && (
            <div className='mb-4 rounded-lg border border-rose-700/50 bg-rose-950/50 p-4'>
              <p className='text-sm text-rose-300'>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className='mb-6 space-y-4'>
            <div className='flex flex-col gap-1.5'>
              <div className='input-glass rounded-lg flex items-center px-4 py-2'>
                <User className='text-outline mr-2 w-5 h-5' />
                <input
                  type='text'
                  id='username'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className='bg-transparent border-none w-full text-on-background focus:ring-0 font-body-md placeholder-white/80 p-0 outline-none'
                  placeholder='Enter your username'
                  required
                />
              </div>
            </div>

            <div className='flex flex-col gap-1.5'>
              <div className='input-glass relative rounded-lg flex items-center px-4 py-2'>
                <Lock className='text-outline mr-2 w-5 h-5' />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id='password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className='bg-transparent border-none w-full text-on-background focus:ring-0 font-body-md placeholder-white/80 p-0 pr-8 outline-none'
                  placeholder='Enter your password'
                  required
                />

                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-white/60 transition-colors hover:text-white'
                  aria-label='Toggle password visibility'
                >
                  {showPassword ? <EyeOff className='h-5 w-5' /> : <Eye className='h-5 w-5' />}
                </button>
              </div>
            </div>

            <button
              type='submit'
              className='mt-6 flex w-full items-center justify-center space-x-2 rounded-full bg-white px-4 py-3 text-base font-semibold text-black transition-colors duration-200 hover:bg-white/85 active:scale-[0.99]'
            >
              <span>Sign In</span>
              <ArrowRight className='h-5 w-5' />
            </button>
          </form>

          <p className='text-center text-sm text-white/80'>
            Don&#39;t have an account?{' '}
            <a
              href='/register'
              className='font-medium text-white underline decoration-white/40 underline-offset-4 transition-colors hover:text-primary-400'
            >
              Register now
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
