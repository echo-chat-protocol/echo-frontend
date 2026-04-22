import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Buffer } from 'buffer'
import Navbar from '../components/HomepageComponents/Navbar'
import ParticlesBackground from '../components/HomepageComponents/ParticlesBackground'
import WaveBackground from '../components/HomepageComponents/WaveBackground'
import Toast from './common/Toast'
import './styles/SignIn.css'

import eld from '../utils/storage/EncryptedLocalDatabase'

import init, {
  generate_ed25519_private_key,
  generate_public_prekey,
  generate_private_prekey,
  derive_x25519_from_ed25519_private,
  convert_x25519_to_xeddsa,
  compute_determenistic_nonce,
  compute_nonce_point,
  derive_ed25519_keypair_from_x25519,
  compute_challenge_hash,
  compute_signature_scaler,
  compute_signature,
  verify_signature,
} from '@mascaro101/echo-protocol'
import { generateOneTimePreKeys } from './Dashboard/Chat/utils/crypto/opk'
import { connectWithoutAuth } from '../socket'

const Register = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [aboutme] = useState('')
  const [profilePicture] = useState('')
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [passwordStrength, setPasswordStrength] = useState(0)

  const validateUsername = (username) => {
    const validChars = /^[a-zA-Z0-9_]+$/
    const letterMatch = username.match(/[a-zA-Z]/g) || []
    return username.length >= 3 && validChars.test(username) && letterMatch.length >= 2
  }

  const getPasswordStrength = (password) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  const isPasswordValid = (password) => {
    return getPasswordStrength(password) >= 5
  }

  const [toast, setToast] = useState({ message: '', type: 'success' })

  const handleRegister = async (e) => {
    e.preventDefault()

    try {
      if (!username || !password) {
        console.error('Username and password cannot be empty')
        setError('Username and password cannot be empty')
        return
      }

      // Initialize the WASM module
      await init()
      await init()

      // Generate the identity pair
      const randomBytes_IK = crypto.getRandomValues(new Uint8Array(32))
      const randomBytes_SPK = crypto.getRandomValues(new Uint8Array(32))

      const privateKey = generate_ed25519_private_key(randomBytes_IK)

      const privatePreKey = generate_private_prekey(randomBytes_SPK)
      const publicPreKey = generate_public_prekey(privatePreKey)

      const x25519_key_pair = derive_x25519_from_ed25519_private(privateKey)
      const { x25519_private_key, x25519_public_key } = x25519_key_pair

      // XEdDSA expects an X25519 private key (not the Ed25519 seed).
      const xeddsaKey = convert_x25519_to_xeddsa(x25519_private_key)
      const edPrivScaler = xeddsaKey.slice(0, 32)
      const prefix = xeddsaKey.slice(32, 64)
      const deterministicNonce = compute_determenistic_nonce(prefix, publicPreKey)
      const noncePoint = compute_nonce_point(deterministicNonce)
      const publicEdKey = derive_ed25519_keypair_from_x25519(x25519_private_key)
      const challenge_hash = compute_challenge_hash(noncePoint, publicEdKey, publicPreKey)
      const signature_scaler = compute_signature_scaler(
        deterministicNonce,
        challenge_hash,
        edPrivScaler
      )
      const signature = compute_signature(noncePoint, signature_scaler)

      const valid = verify_signature(signature, publicPreKey, publicEdKey)
      if (!valid) {
        throw new Error('Failed to verify the generated signed pre-key')
      }

      // Generate one-time prekey batch
      const { privateKeys: opkPrivateKeys, publicBundle: opkPublicBundle } =
        await generateOneTimePreKeys(100)

      // Emit the registration event
      const publicKeyStringX25519 = Buffer.from(x25519_public_key).toString('base64')
      // Publish the Ed25519 verification key that corresponds to our X25519 identity key (used by XEdDSA verify).
      const publicKeyStringED25519 = Buffer.from(publicEdKey).toString('base64')
      const publicPreKeyString = Buffer.from(publicPreKey).toString('base64')
      const signatureString = Buffer.from(signature).toString('base64')

      const arrayBufferToBase64 = (buffer) => {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      }

      const privatePreKeyBase64 = arrayBufferToBase64(privatePreKey)
      const ed25519PrivateKeyBase64 = arrayBufferToBase64(privateKey)
      const x25519PrivateKeyBase64 = arrayBufferToBase64(x25519_private_key)
      const x25519PublicKeyBase64 = arrayBufferToBase64(x25519_public_key)

      const keyBundle = {
        publicIdentityKeyX25519: publicKeyStringX25519,
        publicIdentityKeyEd25519: publicKeyStringED25519,
        publicSignedPreKey: [publicPreKeyString, signatureString],
        oneTimePreKeys: opkPublicBundle,
      }

      const socket = connectWithoutAuth()
      socket.emit(
        'register',
        { username, password, keyBundle, aboutme, profilePicture },
        async (response) => {
          if (response.success) {
            try {
              // Create encrypted database for this user
              await eld.createUser(response.userId, password)

              // Store all keys encrypted
              await eld.storeIdentityKeys({
                privateKeyEd25519: ed25519PrivateKeyBase64,
                privateKeyX25519: x25519PrivateKeyBase64,
                publicKeyX25519: x25519PublicKeyBase64,
                publicKeyEd25519: publicKeyStringED25519,
                privatePreKey: privatePreKeyBase64,
              })

              await eld.storeOPKs(opkPrivateKeys)

              // Lock database (user will unlock on login)
              eld.lock()

              setToast({ message: 'Registration successful!', type: 'success' })
              setTimeout(() => navigate('/login'), 1200)
            } catch (err) {
              console.error('[ELD] Failed to create encrypted storage:', err)
              setToast({ message: 'Registration failed: ' + err.message, type: 'error' })
            }
          } else {
            setToast({ message: response.error || 'Registration failed', type: 'error' })
          }
        }
      )
    } catch (error) {
      console.error('Registration error:', error)
      setError('Registration failed. Please try again.')
      setToast({ message: 'Registration failed. Please try again.', type: 'error' })
    }
  }

  return (
    <div className='relative min-h-screen overflow-hidden bg-primary-1000'>
      <Navbar />
      <ParticlesBackground />
      <WaveBackground />

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, message: '' })}
      />

      <div className='absolute inset-0 flex items-center justify-center p-4'>
        <div className='form-container w-full max-w-md bg-[var(--color-background)]/50 backdrop-blur-md rounded-xl p-6 border border-[var(--color-primary)]/30 shadow-xl relative z-10'>
          <h2 className='text-2xl font-bold text-center mb-6 text-white'>Register</h2>

          <form
            onSubmit={(e) => {
              e.preventDefault()

              if (!validateUsername(username)) {
                setError(
                  'Invalid username. Use only letters, numbers, underscores, and at least 2 letters.'
                )
                return
              }

              if (!isPasswordValid(password)) {
                setError('Password does not meet complexity requirements.')
                return
              }

              if (password !== confirmPassword) {
                setError('Passwords do not match.')
                return
              }

              setError('')
              handleRegister(e)
            }}
            className='space-y-4'
          >
            <div>
              <label htmlFor='username' className='block text-sm font-medium text-white mb-2'>
                Username
              </label>
              <input
                type='text'
                id='username'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className='w-full px-4 py-3 bg-[var(--color-background)]/20 border border-[var(--color-primary)]/30 rounded-lg text-black placeholder-black/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all'
                placeholder='Enter username'
                required
              />
            </div>
            <div>
              <label htmlFor='password' className='block text-sm font-medium text-white mb-2'>
                Password
              </label>
              <div className='relative'>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id='password'
                  value={password}
                  onChange={(e) => {
                    const value = e.target.value
                    setPassword(value)
                    setPasswordStrength(getPasswordStrength(value))
                  }}
                  className='w-full px-4 py-3 bg-[var(--color-background)]/20 border border-[var(--color-primary)]/30 rounded-lg text-black placeholder-black/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all pr-10'
                  placeholder='Enter password'
                  required
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='absolute top-1/2 right-3 transform -translate-y-1/2 text-black/60 hover:text-[#514b96]'
                  aria-label='Toggle password visibility'
                >
                  {showPassword ? (
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='h-5 w-5'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M3 3l18 18'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M10.477 10.477a3 3 0 104.046 4.046'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 5c4.477 0 8.268 2.943 9.542 7-1.18 3.753-4.614 6.518-8.665 6.902'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6.343 6.343A9.957 9.957 0 003 12c1.274 4.057 5.065 7 9.542 7'
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='h-5 w-5'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                      />
                    </svg>
                  )}
                </button>
              </div>

              {password && (
                <>
                  <div className='mt-2 h-2 w-1/2 rounded bg-gray-300'>
                    <div
                      className={`h-2 rounded transition-all duration-300 ${
                        passwordStrength === 0
                          ? 'w-0'
                          : passwordStrength <= 2
                            ? 'w-1/3 bg-red-500'
                            : passwordStrength === 3
                              ? 'w-2/3 bg-yellow-400'
                              : 'w-full bg-green-500'
                      }`}
                    />
                  </div>

                  <p className='mt-1 text-xs text-white'>
                    {passwordStrength <= 2 ? 'Weak password' : ''}
                    {passwordStrength === 3 ? 'Moderate password' : ''}
                    {passwordStrength >= 4 ? 'Strong password' : ''}
                  </p>
                </>
              )}
            </div>

            <div>
              <label
                htmlFor='confirmPassword'
                className='block text-sm font-medium text-white mb-2'
              >
                Confirm Password
              </label>
              <div className='relative'>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id='confirmPassword'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className='w-full px-4 py-3 bg-[var(--color-background)]/20 border border-[var(--color-primary)]/30 rounded-lg text-black placeholder-black/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all pr-10'
                  placeholder='Repeat password'
                  required
                />
                <button
                  type='button'
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className='absolute top-1/2 right-3 transform -translate-y-1/2 text-black/60 hover:text-[#514b96]'
                  aria-label='Toggle confirm password visibility'
                >
                  {showConfirmPassword ? (
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='h-5 w-5'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M3 3l18 18'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M10.477 10.477a3 3 0 104.046 4.046'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 5c4.477 0 8.268 2.943 9.542 7-1.18 3.753-4.614 6.518-8.665 6.902'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6.343 6.343A9.957 9.957 0 003 12c1.274 4.057 5.065 7 9.542 7'
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='h-5 w-5'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                      />
                    </svg>
                  )}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className='text-xs text-red-300 mt-1'>Passwords do not match</p>
              )}
            </div>

            {error && <p className='text-sm text-red-300'>{error}</p>}
            <button
              type='submit'
              className='w-full mt-6 px-4 py-3 bg-gradient-to-r from-[#514b96] to-[#8e79f2] text-white font-medium rounded-lg hover:opacity-90 transition-all active:scale-[0.98] shadow-md'
            >
              Create Account
            </button>
            <p className='text-center text-sm text-white mt-4'>
              Already have an account?{' '}
              <a href='/login' className='text-white hover:text-[#514b96]'>
                Sign in
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Register
