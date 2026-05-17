import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Monitor, Laptop, MapPin, RefreshCw, Wifi } from 'lucide-react'
import QRGenerator from './QRGenerator'
import { deviceService } from './deviceService'

function formatDate(value) {
  if (!value) return 'Never seen'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return 'Unknown'
  }
}

export default function DesktopSyncView({ onBack }) {
  const [devices, setDevices] = useState([])
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [deviceError, setDeviceError] = useState('')
  const currentDeviceId = localStorage.getItem('echo-device-id')

  const loadDevices = useCallback(async () => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      setDevices([])
      setLoadingDevices(false)
      return
    }

    setLoadingDevices(true)
    setDeviceError('')
    try {
      const result = await deviceService.listDevices(userId)
      setDevices(Array.isArray(result?.devices) ? result.devices : [])
    } catch (error) {
      setDeviceError(error.message || 'Failed to load devices')
    } finally {
      setLoadingDevices(false)
    }
  }, [])

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  useEffect(() => {
    const timer = window.setInterval(loadDevices, 5000)
    return () => window.clearInterval(timer)
  }, [loadDevices])

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
            <button
              type='button'
              onClick={loadDevices}
              className='mb-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#b9b9c4] hover:border-[#a855f7]/50 hover:text-white'
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingDevices ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {deviceError && (
              <p className='mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200'>
                {deviceError}
              </p>
            )}
            {!loadingDevices && devices.length === 0 ? (
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
                {devices.map((d) => (
                  <li
                    key={d.deviceId}
                    className='flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/5'
                  >
                    <Monitor className='h-5 w-5 text-[#a855f7] shrink-0' />
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <p className='truncate text-sm font-medium'>
                          {d.deviceName || 'Unknown device'}
                        </p>
                        {d.deviceId === currentDeviceId && (
                          <span className='rounded-full bg-[#a855f7]/15 px-2 py-0.5 text-[10px] text-[#c084fc]'>
                            This device
                          </span>
                        )}
                        {d.isPrimary && (
                          <span className='rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300'>
                            Primary
                          </span>
                        )}
                      </div>
                      <p className='text-xs text-[#6f6f7e]'>
                        {d.platform || 'Unknown platform'} · Last seen {formatDate(d.lastSeen)}
                      </p>
                      <p className='mt-1 flex items-center gap-1 text-[11px] text-[#7a7a8a]'>
                        <Wifi className='h-3 w-3' />
                        {d.ipAddress || 'No IP recorded'}
                      </p>
                      <p className='mt-1 flex items-center gap-1 text-[11px] text-[#7a7a8a]'>
                        <MapPin className='h-3 w-3' />
                        {d.ipLocation || d.timezone || 'No location hint'}
                      </p>
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
            <QRGenerator onDeviceLinked={loadDevices} />
          </div>
        </div>
      </div>
    </div>
  )
}
