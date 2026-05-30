import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck, ShieldX } from 'lucide-react'
import QRScanner from './QRScanner'
import {
  getOrCreateDeviceIK,
  decodeKeyInput,
  derivePairingDhDebug,
  isValidPairingCode,
  decryptHistoryPackageChunks,
  encodeKeyBase64,
} from './qrCrypto'
import { deviceService } from './deviceService'
import { getDeviceMetadata, resetDeviceId } from './deviceMetadata'
import { importHistoryPackage } from './historyPackage'
import { generateAndUploadDeviceKeyBundle } from './deviceKeyBundle'

// Parse the DH pairing payload created by QRGenerator
function parsePairingPayload(raw) {
  try {
    const payload = JSON.parse(raw)
    if (
      (payload?.type === 'echo_pairing' || payload?.type === 'echo_dh_pairing') &&
      payload.sessionId
    )
      return payload
  } catch {}
  return null
}

export default function DesktopScanner({ onBack = null, onSynced = null, embedded = false }) {
  const [ik, setIk] = useState(null)
  const [ikLoading, setIkLoading] = useState(true)
  const [phase, setPhase] = useState('scan') // scan | decrypting | code | synced | error
  const [error, setError] = useState('')
  const [pairingCodeInput, setPairingCodeInput] = useState('')
  const [pendingPairing, setPendingPairing] = useState(null)
  const [synced, setSynced] = useState(null)

  useEffect(() => {
    getOrCreateDeviceIK()
      .then(setIk)
      .catch((e) => setError(e.message || 'Failed to load this device identity key.'))
      .finally(() => setIkLoading(false))
  }, [])

  const waitForHistoryChunks = async ({ serverUrl, sessionId, targetAccessToken }) => {
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      const result = await deviceService.listDhChunksFromServer(serverUrl, {
        sessionId,
        targetAccessToken,
      })
      const chunks = result?.chunks || []
      const totalCount = result?.session?.totalChunkCount || chunks[0]?.totalCount || 0
      if (totalCount > 0 && chunks.length === totalCount) return chunks
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    throw new Error('Timed out waiting for encrypted history from the phone.')
  }

  const finishDhPairingSync = async (state, pairingCode) => {
    if (!isValidPairingCode(pairingCode))
      throw new Error('Enter the 8 digit code shown on the phone.')

    const { pairingPayload, dh } = state

    const chunks = await waitForHistoryChunks({
      serverUrl: pairingPayload.serverUrl,
      sessionId: pairingPayload.sessionId,
      targetAccessToken: pairingPayload.targetAccessToken,
    })

    const { historyPackage, key: historyKey } = await decryptHistoryPackageChunks(
      chunks,
      dh.dhShared,
      pairingPayload.sessionId,
      pairingCode
    )

    const unlockSecret = encodeKeyBase64(historyKey)

    // Ensure this desktop uses its own deviceId. If userId does not match an existing session, reset.
    const importedUserId = historyPackage.auth?.userId || historyPackage.user?.userId || null
    const currentUserId = localStorage.getItem('userId')
    let desktopMeta = getDeviceMetadata()
    let deviceId = desktopMeta.deviceId
    if (importedUserId && (!currentUserId || String(importedUserId) !== String(currentUserId))) {
      resetDeviceId()
      desktopMeta = getDeviceMetadata()
      deviceId = desktopMeta.deviceId
    }

    const completeResult = await deviceService.completeSyncTarget({
      sessionId: pairingPayload.sessionId,
      targetAccessToken: pairingPayload.targetAccessToken,
      serverUrl: pairingPayload.serverUrl,
      targetDevice: { ...desktopMeta },
    })

    const deviceJwt = completeResult?.auth || null
    const resolvedDeviceId = completeResult?.session?.targetDevice?.deviceId
    if (resolvedDeviceId && resolvedDeviceId !== deviceId) {
      localStorage.setItem('echo-device-id', resolvedDeviceId)
      desktopMeta = getDeviceMetadata()
      deviceId = resolvedDeviceId
    }

    const importResult = await importHistoryPackage(historyPackage, { unlockSecret, deviceJwt })

    try {
      await generateAndUploadDeviceKeyBundle(deviceId)
    } catch {
      // Non-fatal: device will not receive fan-out until its bundle is uploaded.
    }

    setSynced({
      username: historyPackage.user?.username || completeResult?.user?.username || null,
      history: importResult,
    })
    setPendingPairing(null)
    setPairingCodeInput('')
    setPhase('synced')
  }

  const submitPairingCode = async (event) => {
    event.preventDefault()
    if (!pendingPairing) return
    const normalized = pairingCodeInput.replace(/\D/g, '')
    if (!isValidPairingCode(normalized)) {
      setError('Enter the 8 digit code shown on the phone.')
      return
    }
    setPhase('decrypting')
    setError('')
    try {
      await finishDhPairingSync(pendingPairing, normalized)
    } catch (e) {
      setError(
        e.message === 'Failed to fetch'
          ? 'Failed to reach the pairing server. Ensure the QR contains a LAN-reachable server URL.'
          : e.message || 'Failed to sync encrypted history.'
      )
      setPhase('error')
    }
  }

  const handleRawScan = async (raw) => {
    const input = typeof raw === 'string' ? raw.trim() : ''
    if (!input) {
      setError('Scan a valid QR.')
      setPhase('error')
      return
    }

    setPhase('decrypting')
    setError('')

    const pairingPayload = parsePairingPayload(input)
    if (pairingPayload) {
      try {
        if (!ik) throw new Error('Identity key not ready yet. Try again.')
        const receivedEpk = pairingPayload.ekPub ? decodeKeyInput(pairingPayload.ekPub) : null
        const dh = receivedEpk
          ? await derivePairingDhDebug(ik.priv, receivedEpk, 'DH(scanner_IK_priv, ek_pub)')
          : null

        // This desktop will be the new device (target). Ensure a deviceId exists and metadata collected.
        const deviceId = resetDeviceId()
        const meta = { ...getDeviceMetadata(), deviceId }

        setPendingPairing({ pairingPayload, dh, desktopDeviceMetadata: meta, deviceId })
        setPairingCodeInput('')
        setPhase('code')
      } catch (e) {
        setError(
          e.message === 'Failed to fetch'
            ? 'Failed to reach the pairing server. Ensure the QR contains a LAN-reachable server URL.'
            : e.message || 'Failed to start sync.'
        )
        setPhase('error')
      }
      return
    }

    // Not a pairing payload
    setError('Unsupported QR. Open device sync on your phone and show the pairing QR.')
    setPhase('error')
  }

  const reset = () => {
    setPhase('scan')
    setError('')
    setPairingCodeInput('')
    setPendingPairing(null)
    setSynced(null)
  }

  const content = (
    <div
      className={
        embedded ? 'flex w-full flex-col' : 'relative z-10 flex min-h-screen flex-col px-5 py-6'
      }
    >
      {!embedded && phase !== 'decrypting' && (
        <button
          onClick={onBack || reset}
          className='flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 hover:text-white mb-6 transition-colors self-start'
          aria-label='Back'
        >
          <ArrowLeft className='h-4 w-4' />
        </button>
      )}

      <div
        className={
          embedded
            ? 'flex flex-col items-center justify-start gap-5'
            : `flex flex-1 flex-col items-center gap-5 py-2 ${
                phase === 'decrypting' ? 'justify-center' : 'justify-start sm:justify-center'
              }`
        }
      >
        {phase === 'scan' && (
          <>
            <div className='text-center'>
              <h2
                className={
                  embedded
                    ? 'text-lg font-medium text-white'
                    : 'text-3xl font-semibold tracking-tight'
                }
              >
                Scan
              </h2>
              <p className='mt-1 text-sm text-gray-400'>Scan the QR from your phone.</p>
            </div>
            {ikLoading ? (
              <div className='flex min-h-80 w-full max-w-sm flex-col items-center justify-center gap-4 rounded-xl border border-gray-800 bg-black/20'>
                <Loader2 className='h-8 w-8 animate-spin text-[#a855f7]' />
                <p className='text-sm text-white/45'>Preparing scanner...</p>
              </div>
            ) : (
              <QRScanner onScanRaw={handleRawScan} />
            )}
            <div className='w-full max-w-sm mt-3 rounded-xl border border-gray-800 bg-black/20 p-3'>
              <p className='text-xs text-white/45 mb-2'>No camera? Paste QR text here:</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const v = e.currentTarget.elements?.qrtext?.value || ''
                  if (v.trim()) handleRawScan(v.trim())
                }}
                className='flex gap-2'
              >
                <input
                  name='qrtext'
                  placeholder='Paste QR content'
                  className='flex-1 rounded-lg border border-gray-700 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-emerald-300/60'
                />
                <button type='submit' className='btn-primary text-sm'>
                  Parse
                </button>
              </form>
            </div>
          </>
        )}

        {phase === 'decrypting' && (
          <div className='flex min-h-80 w-full max-w-sm flex-col items-center justify-center gap-4 rounded-xl border border-gray-800 bg-black/20'>
            <Loader2 className='h-8 w-8 animate-spin text-[#a855f7]' />
            <p className='text-sm text-white/45'>Decrypting…</p>
          </div>
        )}

        {phase === 'code' && (
          <div className='w-full max-w-sm rounded-xl border border-gray-800 bg-black/20 p-6'>
            <div className='text-center'>
              <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10'>
                <ShieldCheck className='h-6 w-6 text-emerald-300' />
              </div>
              <h2 className='text-2xl font-semibold tracking-tight'>Code</h2>
            </div>
            <form onSubmit={submitPairingCode} className='mt-6 flex flex-col gap-4'>
              <input
                value={pairingCodeInput}
                onChange={(e) => setPairingCodeInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                inputMode='numeric'
                autoComplete='one-time-code'
                pattern='[0-9]{8}'
                maxLength={8}
                autoFocus
                className='w-full rounded-lg border border-gray-700 bg-white/10 px-4 py-4 text-center font-mono text-3xl tracking-[0.18em] text-white outline-none transition-colors placeholder:text-white/15 focus:border-emerald-300/60'
                placeholder='00000000'
              />
              {error && <p className='text-center text-xs text-red-300'>{error}</p>}
              <button
                type='submit'
                disabled={!isValidPairingCode(pairingCodeInput)}
                className='btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed'
              >
                Continue
              </button>
              <button
                type='button'
                onClick={reset}
                className='text-sm text-[#a855f7] hover:text-[#c084fc] transition-colors'
              >
                Scan again
              </button>
            </form>
          </div>
        )}

        {phase === 'synced' && (
          <>
            <div className='rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4'>
              <CheckCircle2 className='h-10 w-10 text-emerald-300' />
            </div>
            <div className='text-center'>
              <h2 className='text-2xl font-semibold mb-1'>Synced</h2>
              <p className='text-xs text-white/35 flex items-center justify-center gap-1'>
                <ShieldCheck className='h-3 w-3 text-[#a855f7]' />
                Ready
              </p>
            </div>
            {synced?.username && (
              <div className='rounded-lg border border-gray-800 bg-white/10 px-6 py-4 text-center'>
                <p className='text-xs text-white/35 mb-1'>Signed in</p>
                <p className='text-lg font-semibold text-white'>{synced.username}</p>
              </div>
            )}
            {synced?.history && (
              <div className='rounded-lg border border-gray-800 bg-white/10 px-6 py-4 text-center'>
                <p className='text-xs text-white/35 mb-1'>Imported</p>
                <p className='text-sm text-white'>
                  {synced.history.importedMessages} messages · {synced.history.chats} chats ·{' '}
                  {synced.history.groups} groups
                </p>
              </div>
            )}
            <button
              onClick={() => (onSynced ? onSynced(synced) : onBack ? onBack() : reset())}
              className='btn-primary'
            >
              Continue
            </button>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className='rounded-lg border border-red-400/20 bg-red-400/10 p-4'>
              <ShieldX className='h-10 w-10 text-red-400' />
            </div>
            <div className='text-center max-w-xs'>
              <h3 className='text-lg font-semibold mb-1'>Failed</h3>
              <p className='text-sm text-white/45'>{error}</p>
            </div>
            <button onClick={reset} className='btn-primary'>
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  )

  if (embedded) return content

  return (
    <div
      className='relative min-h-screen w-full text-white overflow-y-auto overflow-x-hidden'
      style={{ background: '#000' }}
    >
      {content}
    </div>
  )
}
