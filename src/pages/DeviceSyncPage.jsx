import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bug, Loader2, UserPlus, Monitor, QrCode } from 'lucide-react'
import { useTauri } from '@/hooks/useTauri'
import ParticlesBackground from '@/components/animations/ParticlesBackground'
import DesktopSyncView from '@/features/devices/DesktopSyncView'
import MobileSyncView from '@/features/devices/MobileSyncView'
import { getOrCreateDeviceIK } from '@/features/devices/qrCrypto'
import { createDebugUserAccount } from '@/features/auth/debugUser'
import AuthService from '@services/auth.service'
import { useAuth } from '@store/AuthContext'
import { connectSocket } from '@services/socket'
import { getDeviceMetadata } from '@/features/devices/deviceMetadata'
import eld from '@/utils/storage/EncryptedLocalDatabase'

export default function DeviceSyncPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  // Ensure a device IK exists as soon as the app opens in Tauri
  useEffect(() => {
    getOrCreateDeviceIK().catch(() => {})
  }, [])
  const { isMobile, isTauri } = useTauri()
  const [view, setView] = useState('landing') // 'landing' | 'sync'
  const [debugCreating, setDebugCreating] = useState(false)
  const [debugUser, setDebugUser] = useState(null)
  const [debugError, setDebugError] = useState('')

  const handleCreateDebugUser = async () => {
    setDebugCreating(true)
    setDebugError('')
    setDebugUser(null)

    try {
      const created = await createDebugUserAccount()
      setDebugUser(created)

      // Auto-login the freshly created debug account and go to the dashboard.
      // Use the deviceId the server assigned during creation (it may have been
      // collision-renamed), not the stale cached one — otherwise login 401s.
      const meta = getDeviceMetadata()
      const res = await AuthService.login({
        username: created.username,
        password: created.password,
        ...meta,
        deviceId: created.deviceId || meta.deviceId,
      })

      if (!res?.success) {
        setDebugError(res?.error || 'Debug user created, but sign-in failed.')
        return
      }

      const userId = res.userId || created.userId
      if (res.deviceId) localStorage.setItem('echo-device-id', res.deviceId)

      login(res.token, res.refreshToken, userId, {
        deviceId: res.deviceId,
        deviceUserId: res.deviceUserId,
      })

      try {
        if (await eld.userExists(userId)) {
          await eld.unlock(userId, created.password)
        }
      } catch (unlockErr) {
        console.error('[ELD] Unlock after debug create failed:', unlockErr)
      }

      connectSocket()

      navigate('/dashboard')
    } catch (err) {
      setDebugError(err.message || 'Failed to create debug user.')
    } finally {
      setDebugCreating(false)
    }
  }

  if (view === 'sync') {
    return isMobile ? (
      <MobileSyncView onBack={() => setView('landing')} onSynced={() => navigate('/dashboard')} />
    ) : (
      <DesktopSyncView onBack={() => setView('landing')} />
    )
  }

  return (
    <div
      className='relative min-h-screen w-full text-white overflow-y-auto overflow-x-hidden'
      style={{ background: '#000' }}
    >
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(255,255,255,0.12),transparent_35%),linear-gradient(180deg,#09090a_0%,#000_60%)]' />
      <div className='absolute inset-0 opacity-20'>
        <ParticlesBackground />
      </div>
      <div className='noise-overlay' />

      <div className='relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-8'>
        <div className='mb-9 flex flex-col items-center gap-4 text-center'>
          <img src='/echo-logo.svg' alt='ECHO' className='h-14 w-14' />
          <h1 className='text-4xl sm:text-5xl font-semibold tracking-tight leading-tight'>ECHO</h1>
        </div>

        <div className='w-full max-w-sm rounded-[34px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_40px_140px_-80px_rgba(168,85,247,0.55)] backdrop-blur-2xl'>
          <button
            onClick={() => setView('sync')}
            className='btn-primary w-full justify-start !rounded-[26px] !px-5 !py-5'
          >
            <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white'>
              {isMobile ? <QrCode className='h-6 w-6' /> : <Monitor className='h-6 w-6' />}
            </div>
            <div className='min-w-0 flex-1'>
              <p className='font-semibold'>Sync device</p>
              <p className='mt-0.5 text-xs text-white/70'>
                {isMobile ? 'Open scanner' : 'Show QR'}
              </p>
            </div>
          </button>

          <button
            onClick={handleCreateDebugUser}
            disabled={debugCreating}
            className='btn-ghost mt-2 w-full justify-start !rounded-[26px] !px-5 !py-4 disabled:cursor-not-allowed disabled:opacity-60'
          >
            <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]'>
              {debugCreating ? (
                <Loader2 className='h-5 w-5 animate-spin' />
              ) : (
                <Bug className='h-5 w-5' />
              )}
            </div>
            <div className='min-w-0 flex-1'>
              <p className='font-medium'>DEBUG</p>
              <p className='mt-0.5 text-xs text-white/35'>
                {debugCreating ? 'Creating user...' : 'Password Pass123%'}
              </p>
            </div>
          </button>

          {(debugUser || debugError) && (
            <div className='mt-3 rounded-[22px] border border-white/10 bg-black/35 px-4 py-3 text-sm'>
              {debugUser ? (
                <>
                  <p className='text-white/45'>Created debug user</p>
                  <p className='mt-1 font-mono text-white'>{debugUser.username}</p>
                  <p className='mt-1 font-mono text-white/70'>Pass123%</p>
                </>
              ) : (
                <p className='text-red-300'>{debugError}</p>
              )}
            </div>
          )}

          <button
            onClick={() => navigate('/register')}
            className='btn-ghost mt-2 w-full justify-start !rounded-[26px] !px-5 !py-4'
          >
            <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]'>
              <UserPlus className='h-5 w-5' />
            </div>
            <div className='min-w-0 flex-1'>
              <p className='font-medium'>Create account</p>
              <p className='mt-0.5 text-xs text-white/35'>New setup</p>
            </div>
          </button>
        </div>

        {!(isTauri && isMobile) && (
          <p className='mt-8 text-xs text-white/35'>
            <button
              onClick={() => navigate('/login')}
              className='text-white/55 hover:text-white transition-colors'
            >
              Sign in
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
