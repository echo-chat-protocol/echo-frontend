import { ArrowLeft, Monitor, Laptop } from 'lucide-react'
import QRGenerator from './QRGenerator'

export default function DesktopSyncView({ onBack }) {
  const devices = JSON.parse(localStorage.getItem('echo_paired_devices') || '[]')

  return (
    <div
      className='relative min-h-screen w-full text-white overflow-y-auto overflow-x-hidden'
      style={{ background: '#000' }}
    >
      <div className='aurora-bg' />
      <div className='noise-overlay' />

      <div className='relative z-10 max-w-4xl mx-auto p-6 sm:p-10'>
        <button
          onClick={onBack}
          className='flex items-center gap-2 text-sm text-[#a0a0a0] hover:text-white mb-10 transition-colors'
        >
          <ArrowLeft className='h-4 w-4' />
          Back
        </button>

        <h2 className='text-3xl font-semibold tracking-tight mb-2'>
          Device <span className='echo-gradient-text'>Sync</span>
        </h2>
        <p className='text-[#b9b9c4] text-sm mb-8'>
          Manage linked devices and provision a mobile session via QR.
        </p>

        <div className='grid lg:grid-cols-2 gap-6'>
          {/* Synced devices */}
          <div className='glass cyber-border rounded-2xl p-6'>
            <h3 className='text-xs font-semibold text-[#a0a0a0] uppercase tracking-widest mb-5'>
              Synced Devices
            </h3>
            {devices.length === 0 ? (
              <div className='flex flex-col items-center gap-3 py-10 text-center'>
                <div className='rounded-2xl border border-white/5 bg-white/5 p-4'>
                  <Laptop className='h-10 w-10 text-[#3a3a4a]' />
                </div>
                <p className='text-[#6f6f7e] text-sm'>No devices linked yet</p>
                <p className='text-xs text-[#4a4a5a] max-w-[180px]'>
                  Generate a QR code and scan it from your mobile device to link it
                </p>
              </div>
            ) : (
              <ul className='space-y-2'>
                {devices.map((d, i) => (
                  <li
                    key={d.id || i}
                    className='flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/5'
                  >
                    <Monitor className='h-5 w-5 text-[#a855f7] shrink-0' />
                    <div>
                      <p className='text-sm font-medium'>{d.name || 'Mobile device'}</p>
                      <p className='text-xs text-[#6f6f7e]'>{d.platform || 'Unknown platform'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Encrypted sync QR generator */}
          <div className='glass cyber-border rounded-2xl p-6'>
            <h3 className='text-xs font-semibold text-[#a0a0a0] uppercase tracking-widest mb-1'>
              Sync QR Generator
            </h3>
            <p className='text-xs text-[#6f6f7e] mb-5'>
              Generate an encrypted QR. Your mobile device will decrypt it and copy this signed-in
              session.
            </p>
            <QRGenerator />
          </div>
        </div>
      </div>
    </div>
  )
}
