import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Key, Loader2, RefreshCw, Shuffle } from 'lucide-react'
import {
  decodeKeyInput,
  derivePairingDhDebug,
  encodeKeyBase64,
  generatePairingEphemeralDebug,
  generatePairingCode,
  getOrCreateDeviceIK,
  hexBytes,
  encryptHistoryPackageChunks,
} from './qrCrypto'
import { deviceService } from './deviceService'
import { resolvePairingServerUrl } from '@/utils/network/apiBase'
import { buildHistoryPackage } from './historyPackage'

function Row({ label, value, mono = true }) {
  return (
    <div className='flex flex-col gap-0.5 py-1.5 border-b border-white/5 last:border-0'>
      <span className='text-[9px] uppercase tracking-widest text-[#6f6f7e]'>{label}</span>
      <span className={`text-[10px] break-all leading-relaxed ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function Section({ icon: Icon, title, color, children }) {
  return (
    <div className='rounded-xl border mb-2 overflow-hidden' style={{ borderColor: `${color}30` }}>
      <div className='flex items-center gap-1.5 px-3 py-1.5' style={{ background: `${color}18` }}>
        <Icon className='h-3 w-3' style={{ color }} />
        <span className='text-[9px] font-semibold uppercase tracking-widest' style={{ color }}>
          {title}
        </span>
      </div>
      <div className='px-3 pb-1 text-white'>{children}</div>
    </div>
  )
}

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, seconds)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export default function QRGenerator({ onDeviceLinked = null }) {
  const autoCreateAttemptedRef = useRef(false)
  const autoResettingRef = useRef(false)
  const [ik, setIk] = useState(null)
  const [session, setSession] = useState(null)
  const [ephemeral, setEphemeral] = useState(null)
  const [setupQr, setSetupQr] = useState(null)
  const [scannerPubKey, setScannerPubKey] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [dhDebug, setDhDebug] = useState(null)
  const [historySummary, setHistorySummary] = useState(null)
  const [transferStatus, setTransferStatus] = useState('idle')
  const [secondsUntilReset, setSecondsUntilReset] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const serverUrl = resolvePairingServerUrl()

  const createSetupQr = useCallback(async () => {
    setBusy(true)
    setError(null)
    setSetupQr(null)
    setSession(null)
    setEphemeral(null)
    setScannerPubKey('')
    setPairingCode('')
    setDhDebug(null)
    setHistorySummary(null)
    setTransferStatus('idle')
    setSecondsUntilReset(null)
    try {
      const eph = await generatePairingEphemeralDebug()
      const created = await deviceService.createDhSession({
        targetEphemeralPubKey: encodeKeyBase64(eph.ekPub),
        origin: window.location.origin,
        version: 'echo-history-package-v1',
        targetDevice: { role: 'main-device' },
      })
      if (!created?.sessionId || !created?.targetAccessToken) {
        throw new Error(
          'Server did not return a usable DH session. Restart the backend and try again.'
        )
      }
      setEphemeral(eph)
      setSession(created)
    } catch (e) {
      setError(`${e.message || 'Failed to create QR'} Server: ${serverUrl}`)
    } finally {
      setBusy(false)
    }
  }, [serverUrl])

  useEffect(() => {
    getOrCreateDeviceIK()
      .then(setIk)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (autoCreateAttemptedRef.current || busy || session || setupQr || pairingCode) return
    autoCreateAttemptedRef.current = true
    createSetupQr()
  }, [busy, createSetupQr, pairingCode, session, setupQr])

  const setupPayload = useMemo(() => {
    if (!session?.sessionId || !session?.targetAccessToken || !ephemeral?.ekPub) return null
    return JSON.stringify({
      type: 'echo_dh_pairing',
      sessionId: session.sessionId,
      targetAccessToken: session.targetAccessToken,
      serverUrl,
      ekPub: encodeKeyBase64(ephemeral.ekPub),
    })
  }, [ephemeral?.ekPub, serverUrl, session])

  useEffect(() => {
    if (!setupPayload) {
      setSetupQr(null)
      return
    }

    let cancelled = false
    QRCode.toDataURL(setupPayload, {
      width: 260,
      margin: 1,
      color: { dark: '#050507', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setSetupQr(url)
      })
      .catch((e) => {
        if (!cancelled) setError('QR generation failed: ' + e.message)
      })

    return () => {
      cancelled = true
    }
  }, [setupPayload])

  useEffect(() => {
    if (!session?.expiresAt || !setupQr || pairingCode || dhDebug) {
      setSecondsUntilReset(null)
      return undefined
    }

    const expiresAt = new Date(session.expiresAt).getTime()
    if (!Number.isFinite(expiresAt)) {
      setSecondsUntilReset(null)
      return undefined
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      setSecondsUntilReset(remaining)
      if (remaining === 0 && !busy && !autoResettingRef.current) {
        autoResettingRef.current = true
        createSetupQr().finally(() => {
          autoResettingRef.current = false
        })
      }
    }

    updateCountdown()
    const timer = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(timer)
  }, [busy, createSetupQr, dhDebug, pairingCode, session?.expiresAt, setupQr])

  useEffect(() => {
    if (!session?.sessionId || !session?.targetAccessToken || !ephemeral?.ekPriv || dhDebug) return

    const timer = setInterval(async () => {
      try {
        const result = await deviceService.getDhSession({
          sessionId: session.sessionId,
          targetAccessToken: session.targetAccessToken,
        })
        const received = result.session?.sourceEphemeralPubKey
        if (!received) return

        const scannerPub = decodeKeyInput(received)
        const debug = await derivePairingDhDebug(
          ephemeral.ekPriv,
          scannerPub,
          'DH(ek_priv, scanner_IK_pub)'
        )
        setScannerPubKey(received)
        setPairingCode(generatePairingCode())
        setDhDebug({ ...debug, scannerPub })
        clearInterval(timer)
      } catch (e) {
        if (e?.code === 'sync_session_expired') {
          if (!autoResettingRef.current) {
            autoResettingRef.current = true
            createSetupQr().finally(() => {
              autoResettingRef.current = false
            })
          }
          return
        }
        setError(e.message || 'Failed to poll DH session')
      }
    }, 1500)

    return () => clearInterval(timer)
  }, [createSetupQr, dhDebug, ephemeral?.ekPriv, session?.sessionId, session?.targetAccessToken])

  useEffect(() => {
    if (!dhDebug?.dhShared || !pairingCode || !session?.sessionId || !session?.targetAccessToken)
      return
    let cancelled = false

    const transferHistory = async () => {
      setTransferStatus('compiling')
      setError(null)
      try {
        const historyPackage = await buildHistoryPackage()
        const { chunks } = await encryptHistoryPackageChunks(
          historyPackage,
          dhDebug.dhShared,
          session.sessionId,
          pairingCode
        )

        if (cancelled) return
        setHistorySummary({
          chats: historyPackage.chats.length,
          groups: historyPackage.groups.length,
          messages: historyPackage.messages.length,
          chunks: chunks.length,
        })
        setTransferStatus('uploading')

        for (const chunk of chunks) {
          if (cancelled) return
          await deviceService.transferDhChunk({
            sessionId: session.sessionId,
            targetAccessToken: session.targetAccessToken,
            chunk,
          })
        }

        if (!cancelled) setTransferStatus('ready')
      } catch (e) {
        if (!cancelled) {
          setTransferStatus('error')
          setError(e.message || 'Failed to compile and upload chat history.')
        }
      }
    }

    transferHistory()

    return () => {
      cancelled = true
    }
  }, [dhDebug?.dhShared, pairingCode, session?.sessionId, session?.targetAccessToken])

  useEffect(() => {
    if (transferStatus !== 'ready' || !session?.sessionId || !session?.targetAccessToken) return

    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const result = await deviceService.getDhSession({
          sessionId: session.sessionId,
          targetAccessToken: session.targetAccessToken,
        })
        if (result.session?.status !== 'completed') return

        if (!cancelled) {
          onDeviceLinked?.()
          clearInterval(timer)
        }
      } catch (error) {
        if (error?.code === 'sync_session_completed' || /already completed/i.test(error?.message)) {
          if (!cancelled) {
            onDeviceLinked?.()
            clearInterval(timer)
          }
          return
        }
        if (
          error?.code === 'sync_session_expired' ||
          error?.code === 'sync_session_not_found' ||
          error?.code === 'sync_session_inactive'
        ) {
          // Session is gone — device may still have been created; refresh the list.
          if (!cancelled) {
            onDeviceLinked?.()
            clearInterval(timer)
          }
          return
        }
        // Keep polling; the phone may still be completing the target side.
      }
    }, 1500)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [onDeviceLinked, session?.sessionId, session?.targetAccessToken, transferStatus])

  const reset = () => {
    createSetupQr()
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='hidden rounded-xl border border-white/10 bg-black/60 p-3'>
        <p className='text-[10px] font-semibold uppercase tracking-widest text-[#a855f7] mb-2'>
          ■ MAIN DEVICE DH SETUP
        </p>
        <p className='text-xs text-[#6f6f7e]'>
          The QR gives the scanner <span className='font-mono text-[#b9b9c4]'>ek_pub</span>. After
          scan, this device derives the shared secret, encrypts a full local chat history package,
          and uploads it for the phone to import.
        </p>
      </div>

      {pairingCode ? (
        <div className='flex flex-col items-center gap-3'>
          <div className='w-full rounded-[28px] border border-emerald-300/20 bg-emerald-300/[0.08] px-5 py-7 text-center shadow-[0_24px_80px_-48px_rgba(16,185,129,0.85)]'>
            <p className='text-[11px] font-medium text-emerald-200/80'>Pairing code</p>
            <p className='mt-3 font-mono text-5xl font-semibold tracking-[0.22em] text-white tabular-nums'>
              {pairingCode}
            </p>
          </div>
          {transferStatus !== 'idle' && (
            <div className='w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3'>
              <p className='text-sm text-white/90'>
                {transferStatus === 'compiling' && 'Preparing history'}
                {transferStatus === 'uploading' && 'Sending encrypted history'}
                {transferStatus === 'ready' && 'Ready on phone'}
                {transferStatus === 'error' && 'Transfer failed'}
              </p>
              {historySummary && (
                <p className='mt-1 text-[11px] text-white/35'>
                  {historySummary.messages} messages · {historySummary.chats} chats ·{' '}
                  {historySummary.groups} groups · {historySummary.chunks} chunks
                </p>
              )}
            </div>
          )}
          <p className='hidden text-[10px] font-mono text-[#4a4a5a] break-all text-center'>
            server: {serverUrl}
          </p>
        </div>
      ) : setupQr ? (
        <div className='flex flex-col items-center gap-3'>
          <div className='rounded-[32px] border border-white/10 bg-white p-4 shadow-[0_28px_90px_-48px_rgba(255,255,255,0.75)]'>
            <img src={setupQr} alt='Ephemeral key pairing QR' className='h-64 w-64 max-w-full' />
          </div>
          <p className='text-xs text-white/45 text-center'>Scan with the mobile app</p>
          {secondsUntilReset !== null && (
            <div className='w-full rounded-lg border border-gray-800 bg-white/10 px-3 py-2 text-center'>
              <p className='text-[11px] uppercase tracking-widest text-white/35'>QR resets in</p>
              <p className='mt-1 font-mono text-lg text-white tabular-nums'>
                {formatCountdown(secondsUntilReset)}
              </p>
            </div>
          )}
          {transferStatus !== 'idle' && (
            <div className='w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3'>
              <p className='text-sm text-white/90'>
                {transferStatus === 'compiling' && 'Preparing history'}
                {transferStatus === 'uploading' && 'Sending encrypted history'}
                {transferStatus === 'ready' && 'Ready on phone'}
                {transferStatus === 'error' && 'Transfer failed'}
              </p>
              {historySummary && (
                <p className='mt-1 text-[11px] text-white/35'>
                  {historySummary.messages} messages · {historySummary.chats} chats ·{' '}
                  {historySummary.groups} groups · {historySummary.chunks} chunks
                </p>
              )}
            </div>
          )}
          <p className='hidden text-[10px] font-mono text-[#4a4a5a] break-all text-center'>
            server: {serverUrl}
          </p>
        </div>
      ) : (
        <div className='flex flex-col gap-3'>
          <div className='flex min-h-64 items-center justify-center rounded-[32px] border border-dashed border-white/15 bg-white/[0.03] p-6'>
            <Loader2 className='h-8 w-8 animate-spin text-white/35' />
          </div>
          <p className='text-center text-xs text-white/40'>
            {busy ? 'Creating QR...' : 'Preparing QR...'}
          </p>
        </div>
      )}

      {ephemeral && (
        <div className='hidden rounded-2xl border border-white/10 bg-black/70 p-4'>
          <p className='text-[10px] font-semibold uppercase tracking-widest text-[#a855f7] mb-3'>
            ■ MAIN DEVICE TRACE
          </p>
          <Section icon={Key} title='Own identity key' color='#a855f7'>
            <Row label='IK source' value={ik?.source || '(loading)'} mono={false} />
            <Row label='IK pub (hex)' value={hexBytes(ik?.pub, 32)} />
          </Section>
          <Section icon={Shuffle} title='Ephemeral key in scanned QR' color='#22d3ee'>
            <Row label='ek priv (kept on main device)' value={hexBytes(ephemeral.ekPriv, 32)} />
            <Row label='ek pub (sent in QR)' value={hexBytes(ephemeral.ekPub, 32)} />
          </Section>
          <Section icon={Key} title='Received scanner IK public key' color='#4ade80'>
            <Row
              label='scanner IK pub from server'
              value={
                scannerPubKey ? hexBytes(decodeKeyInput(scannerPubKey), 32) : '(waiting for scan)'
              }
            />
          </Section>
          {historySummary && (
            <Section icon={Key} title='Encrypted history package' color='#f59e0b'>
              <Row
                label='contents'
                value={`${historySummary.messages} messages, ${historySummary.chats} chats, ${historySummary.groups} groups`}
                mono={false}
              />
              <Row label='chunks' value={String(historySummary.chunks)} mono={false} />
              <Row label='status' value={transferStatus} mono={false} />
            </Section>
          )}
          {dhDebug && (
            <Section icon={Shuffle} title={`X25519 DH  —  ${dhDebug.dhOp}`} color='#22d3ee'>
              <Row
                label='input 1'
                value='ek_priv  (main device ephemeral private key)'
                mono={false}
              />
              <Row label='input 2' value={`scanner_IK_pub   ${hexBytes(dhDebug.scannerPub, 32)}`} />
              <Row label='shared secret (output)' value={hexBytes(dhDebug.dhShared, 32)} />
            </Section>
          )}
        </div>
      )}

      {error && (
        <div className='rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200'>
          <p className='font-semibold text-red-300'>QR failed</p>
          <p className='mt-1 break-words'>{error}</p>
        </div>
      )}
      {error && !setupQr && !dhDebug && (
        <button
          onClick={createSetupQr}
          disabled={busy}
          className='btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
        >
          {busy && <Loader2 className='h-4 w-4 animate-spin' />}
          Try again
        </button>
      )}
      {(setupQr || dhDebug) && (
        <button
          onClick={reset}
          className='flex items-center justify-center gap-2 text-sm text-[#a855f7] hover:text-[#c084fc] transition-colors'
        >
          <RefreshCw className='h-4 w-4' />
          Reset
        </button>
      )}
    </div>
  )
}
