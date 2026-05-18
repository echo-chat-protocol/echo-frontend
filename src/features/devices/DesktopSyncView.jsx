import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Monitor, Laptop, MapPin, RefreshCw, Wifi, Trash2 } from 'lucide-react'
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
  const [confirmRevokeId, setConfirmRevokeId] = useState(null)
  const [revokingId, setRevokingId] = useState(null)
  const [revokeError, setRevokeError] = useState('')
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

  const handleRevoke = async (deviceId) => {
    setRevokingId(deviceId)
    setRevokeError('')
    try {
      await deviceService.revokeDevice(deviceId)
      setConfirmRevokeId(null)
      await loadDevices()
    } catch (err) {
      setRevokeError(err.message || 'Failed to remove device')
    } finally {
      setRevokingId(null)
    }
  }

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
              <>
                {revokeError && (
                  <p className='mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200'>
                    {revokeError}
                  </p>
                )}
                <ul className='space-y-2'>
                  {devices.map((d) => {
                    const isCurrentDevice = d.deviceId === currentDeviceId
                    const isConfirming = confirmRevokeId === d.deviceId
                    const isRevoking = revokingId === d.deviceId

                    return (
                      <li
                        key={d.deviceId}
                        className='flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/5'
                      >
                        <Monitor className='h-5 w-5 text-[#a855f7] shrink-0 mt-0.5' />
                        <div className='min-w-0 flex-1'>
                          <div className='flex items-center gap-2 flex-wrap'>
                            <p className='truncate text-sm font-medium'>
                              {d.deviceName || 'Unknown device'}
                            </p>
                            {isCurrentDevice && (
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
                        {!d.isPrimary && (
                          <div className='shrink-0 flex flex-col items-end gap-1'>
                            {isConfirming ? (
                              <div className='flex items-center gap-1'>
                                <button
                                  onClick={() => handleRevoke(d.deviceId)}
                                  disabled={isRevoking}
                                  className='rounded-lg bg-red-500/20 border border-red-500/40 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/30 disabled:opacity-50'
                                  title={
                                    isCurrentDevice
                                      ? 'Unpairing this device will sign it out immediately.'
                                      : 'The remote device will be signed out immediately.'
                                  }
                                >
                                  {isRevoking
                                    ? isCurrentDevice
                                      ? 'Unpairing…'
                                      : 'Removing…'
                                    : isCurrentDevice
                                      ? 'Unpair this device'
                                      : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => setConfirmRevokeId(null)}
                                  disabled={isRevoking}
                                  className='rounded-lg border border-white/10 px-2 py-1 text-[11px] text-[#a0a0a0] hover:text-white disabled:opacity-50'
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setRevokeError('')
                                  setConfirmRevokeId(d.deviceId)
                                }}
                                className='rounded-lg border border-white/10 p-1.5 text-[#6f6f7e] hover:border-red-500/40 hover:text-red-400 transition-colors'
                                title={isCurrentDevice ? 'Unpair this device' : 'Remove device'}
                              >
                                <Trash2 className='h-3.5 w-3.5' />
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
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
