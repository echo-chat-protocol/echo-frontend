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

export default function DesktopSyncView({ onBack, embedded = false }) {
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

  const content = (
    <div className={embedded ? 'w-full' : 'relative z-10 max-w-5xl mx-auto p-5 sm:p-8'}>
      {!embedded && (
        <button
          onClick={onBack}
          className='mb-8 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 hover:text-white transition-colors'
          aria-label='Back'
        >
          <ArrowLeft className='h-4 w-4' />
        </button>
      )}

      <div
        className={
          embedded
            ? 'mb-6 flex items-end justify-between gap-4'
            : 'mb-7 flex items-end justify-between gap-4'
        }
      >
        <div>
          <h2
            className={
              embedded ? 'text-lg font-medium text-white' : 'text-3xl font-semibold tracking-tight'
            }
          >
            Device sync
          </h2>
          <p className={embedded ? 'mt-1 text-sm text-gray-400' : 'mt-2 text-sm text-white/40'}>
            Scan from your phone to pair another device.
          </p>
        </div>
        <button
          type='button'
          onClick={loadDevices}
          className='inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-700 bg-white/10 text-gray-400 hover:text-white transition-colors'
          aria-label='Refresh devices'
        >
          <RefreshCw className={`h-4 w-4 ${loadingDevices ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]'>
        {/* Synced devices */}
        <div className='rounded-xl border border-gray-800 bg-black/20 p-5'>
          <h3 className='mb-5 text-sm font-medium text-white/80'>Devices</h3>
          {deviceError && (
            <p className='mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200'>
              {deviceError}
            </p>
          )}
          {!loadingDevices && devices.length === 0 ? (
            <div className='flex flex-col items-center gap-3 py-10 text-center'>
              <div className='rounded-lg border border-gray-700 bg-white/10 p-4'>
                <Laptop className='h-9 w-9 text-white/25' />
              </div>
              <p className='text-white/45 text-sm'>No devices yet</p>
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
                      className='flex items-start gap-3 rounded-lg border border-gray-800 bg-white/10 p-3'
                    >
                      <Monitor className='h-5 w-5 text-white/50 shrink-0 mt-0.5' />
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <p className='truncate text-sm font-medium'>
                            {d.deviceName || 'Unknown device'}
                          </p>
                          {isCurrentDevice && (
                            <span className='rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60'>
                              Current
                            </span>
                          )}
                          {d.isPrimary && (
                            <span className='rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300'>
                              Main
                            </span>
                          )}
                        </div>
                        <p className='text-xs text-white/35'>
                          {d.platform || 'Unknown platform'} · Last seen {formatDate(d.lastSeen)}
                        </p>
                        <p className='mt-1 flex items-center gap-1 text-[11px] text-white/30'>
                          <Wifi className='h-3 w-3' />
                          {d.ipAddress || 'No IP recorded'}
                        </p>
                        <p className='mt-1 flex items-center gap-1 text-[11px] text-white/30'>
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
                                className='rounded-lg border border-gray-700 px-2 py-1 text-[11px] text-white/50 hover:text-white disabled:opacity-50'
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
                              className='rounded-lg border border-gray-700 p-1.5 text-white/35 hover:border-red-500/40 hover:text-red-400 transition-colors'
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
        <div className='rounded-xl border border-gray-800 bg-black/20 p-5'>
          <h3 className='mb-5 text-sm font-medium text-white/80'>QR</h3>
          <QRGenerator onDeviceLinked={loadDevices} />
        </div>
      </div>
    </div>
  )

  if (embedded) return content

  return (
    <div
      className='relative min-h-screen w-full text-white overflow-y-auto overflow-x-hidden'
      style={{ background: '#000' }}
    >
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(255,255,255,0.1),transparent_34%),linear-gradient(180deg,#09090a_0%,#000_62%)]' />
      <div className='noise-overlay' />
      {content}
    </div>
  )
}
