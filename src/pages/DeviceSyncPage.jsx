import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Monitor, Smartphone } from 'lucide-react'
import { useTauri } from '@/hooks/useTauri'
import ParticlesBackground from '@/components/animations/ParticlesBackground'
import DesktopSyncView from '@/features/devices/DesktopSyncView'
import MobileSyncView from '@/features/devices/MobileSyncView'
import { getOrCreateDeviceIK } from '@/features/devices/qrCrypto'

export default function DeviceSyncPage() {
  const navigate = useNavigate()

  // Ensure a device IK exists as soon as the app opens in Tauri
  useEffect(() => {
    getOrCreateDeviceIK().catch(() => {})
  }, [])
  const { isMobile } = useTauri()
  const [view, setView] = useState('landing') // 'landing' | 'sync'

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
      <div className='aurora-bg' />
      <div className='grid-overlay' />
      <div className='absolute inset-0 opacity-60'>
        <ParticlesBackground />
      </div>
      <div className='noise-overlay' />

      <div className='relative z-10 flex min-h-screen flex-col items-center justify-start px-6 py-10 sm:justify-center sm:py-6'>
        {/* Logo + headline */}
        <div className='mb-14 flex flex-col items-center gap-4 text-center'>
          <img src='/echo-logo.svg' alt='ECHO' className='h-16 w-16' />
          <h1 className='text-4xl sm:text-5xl font-semibold tracking-tight leading-tight'>
            Welcome to <span className='echo-gradient-text'>ECHO</span>
          </h1>
          <p className='text-[#b9b9c4] max-w-xs text-sm leading-relaxed'>
            Zero-knowledge encrypted messaging. Choose how you would like to get started.
          </p>
        </div>

        {/* Action cards */}
        <div className='flex flex-col sm:flex-row gap-4 w-full max-w-sm'>
          <button
            onClick={() => navigate('/register')}
            className='flex-1 group glass cyber-border rounded-2xl flex flex-col items-center gap-3 px-6 py-8 hover:border-[#a855f7]/40 transition-all'
          >
            <div className='rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a855f7] p-3'>
              <UserPlus className='h-6 w-6 text-white' />
            </div>
            <div className='text-center'>
              <p className='font-semibold'>Create Account</p>
              <p className='text-xs text-[#a0a0a0] mt-0.5'>New to ECHO</p>
            </div>
          </button>

          <button
            onClick={() => setView('sync')}
            className='flex-1 group glass cyber-border rounded-2xl flex flex-col items-center gap-3 px-6 py-8 hover:border-[#a855f7]/40 transition-all'
          >
            <div className='rounded-xl border border-white/10 bg-white/5 p-3 group-hover:bg-[#a855f7]/10 transition-colors'>
              {isMobile ? (
                <Smartphone className='h-6 w-6 text-[#a855f7]' />
              ) : (
                <Monitor className='h-6 w-6 text-[#a855f7]' />
              )}
            </div>
            <div className='text-center'>
              <p className='font-semibold'>Sync Device</p>
              <p className='text-xs text-[#a0a0a0] mt-0.5'>
                {isMobile ? 'Scan from desktop' : 'Already have ECHO'}
              </p>
            </div>
          </button>
        </div>

        <p className='mt-10 text-xs text-[#4a4a5a]'>
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className='text-[#a855f7] hover:text-[#c084fc] transition-colors'
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
