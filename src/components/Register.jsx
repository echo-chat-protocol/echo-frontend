import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Buffer } from 'buffer'
import { User, Lock, ArrowRight } from 'lucide-react'
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
    <div className='relative h-screen w-screen overflow-hidden bg-primary-1000'>
      {/* Wallpaper Background */}
      <div className='absolute inset-0 z-0'>
        <img
          alt='Echo wallpaper'
          className='h-full w-full object-cover'
          src='/wallpapers/Echowallpaper.png'
        />
        <div className='absolute inset-0 bg-black/40' />
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, message: '' })}
      />

      {/* Content */}
      <div className='relative z-10 flex h-screen w-screen items-center justify-center px-5'>
        <div className='form-container w-full max-w-md rounded-2xl border border-white/20 bg-black/35 p-7 shadow-[0_0_45px_rgba(170,190,255,0.18)] backdrop-blur-xl'>
          {/* Logo */}
          <div className='mb-6 flex justify-center'>
            <img alt='ECHO brand logo' className='h-12 w-auto' src='/echo-logo-text.png' />
          </div>

          {/* Title */}
          <h1 className='mb-8 text-center text-3xl font-semibold tracking-wide text-white'>
            Create Account
          </h1>

          {/* Error Message */}
          {error && (
            <div className='mb-4 rounded-lg border border-rose-700/50 bg-rose-950/50 p-4'>
              <p className='text-sm text-rose-300'>{error}</p>
            </div>
          )}

          {/* Registration Form */}
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
            className='mb-6 space-y-4'
          >
            {/* Username */}
            <div className='flex flex-col gap-1.5'>
              <div className='input-glass rounded-lg flex items-center px-4 py-2'>
                <User className='text-outline mr-2 w-5 h-5' />
                <input
                  className='bg-transparent border-none w-full text-on-background focus:ring-0 font-body-md placeholder-white/80 p-0 outline-none'
                  id='username'
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder='Enter your username'
                  type='text'
                  value={username}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className='flex flex-col gap-1.5'>
              <div className='input-glass rounded-lg flex items-center px-4 py-2'>
                <Lock className='text-outline mr-2 w-5 h-5' />
                <input
                  className='bg-transparent border-none w-full text-on-background focus:ring-0 font-body-md placeholder-white/80 p-0 outline-none'
                  id='password'
                  onChange={(e) => {
                    const value = e.target.value
                    setPassword(value)
                    setPasswordStrength(getPasswordStrength(value))
                  }}
                  placeholder='Create a password'
                  type='password'
                  value={password}
                  required
                />
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className='mt-2'>
                  <div className='mb-1 flex items-center space-x-2'>
                    <div className='h-1 flex-1 rounded-full overflow-hidden bg-white/20'>
                      <div
                        className={`h-full transition-all duration-300 ${
                          passwordStrength === 0
                            ? 'w-0'
                            : passwordStrength <= 2
                              ? 'w-1/3 bg-rose-400'
                              : passwordStrength === 3
                                ? 'w-2/3 bg-amber-300'
                                : 'w-full bg-emerald-400'
                        }`}
                      />
                    </div>
                    <span className='text-xs font-medium text-white/70'>
                      {passwordStrength <= 2 ? 'Weak' : ''}
                      {passwordStrength === 3 ? 'Moderate' : ''}
                      {passwordStrength >= 4 ? 'Strong' : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className='flex flex-col gap-1.5'>
              <div className='input-glass rounded-lg flex items-center px-4 py-2'>
                <Lock className='text-outline mr-2 w-5 h-5' />
                <input
                  className='bg-transparent border-none w-full text-on-background focus:ring-0 font-body-md placeholder-white/80 p-0 outline-none'
                  id='confirmPassword'
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder='Confirm your password'
                  type='password'
                  value={confirmPassword}
                  required
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className='mt-1 text-xs text-rose-300'>Passwords do not match</p>
              )}
            </div>

            {/* Terms Checkbox */}
            <div className='mt-4 flex items-start space-x-3'>
              <input
                className='mt-0.5 h-4 w-4 rounded accent-primary-600 cursor-pointer border border-white/40 bg-white/5'
                id='terms'
                type='checkbox'
              />
              <label
                className='cursor-pointer text-xs text-white/70 leading-relaxed'
                htmlFor='terms'
              >
                I agree to the{' '}
                <a
                  href='/legal/terms-of-service'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-white/90 hover:text-white underline decoration-white/30 hover:decoration-white/70 transition-all'
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href='/legal/privacy-policy'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-white/90 hover:text-white underline decoration-white/30 hover:decoration-white/70 transition-all'
                >
                  Privacy Policy
                </a>
              </label>
            </div>

            {/* Submit Button */}
            <button
              className='mt-6 w-full flex items-center justify-center space-x-2 rounded-full bg-white px-4 py-3 text-base font-semibold text-black transition-colors duration-200 hover:bg-white/85 active:scale-[0.99]'
              type='submit'
            >
              <span>Create Account</span>
              <ArrowRight className='h-5 w-5' />
            </button>
          </form>
          {/* Sign In Link */}
          <p className='text-center text-sm text-white/80'>
            Already have an account?{' '}
            <a
              href='/login'
              className='font-medium text-white underline decoration-white/40 underline-offset-4 transition-colors hover:text-primary-400'
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
