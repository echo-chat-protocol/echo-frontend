import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Key, Loader2, RefreshCw, Shuffle } from 'lucide-react'
import {
  decodeKeyInput,
  derivePairingDhDebug,
  encodeKeyBase64,
  generatePairingEphemeralDebug,
  getOrCreateDeviceIK,
  hexBytes,
} from './qrCrypto'
import { deviceService } from './deviceService'
import { resolveApiBase } from '@/utils/network/apiBase'

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

export default function QRGenerator() {
  const [ik, setIk] = useState(null)
  const [session, setSession] = useState(null)
  const [ephemeral, setEphemeral] = useState(null)
  const [setupQr, setSetupQr] = useState(null)
  const [scannerPubKey, setScannerPubKey] = useState('')
  const [dhDebug, setDhDebug] = useState(null)
  const [qrText, setQrText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const serverUrl = resolveApiBase()

  useEffect(() => {
    getOrCreateDeviceIK()
      .then(setIk)
      .catch((e) => setError(e.message))
  }, [])

  const setupPayload = useMemo(() => {
    if (!session?.sessionId || !session?.targetAccessToken || !ephemeral?.ekPub) return null
    return JSON.stringify({
      type: 'echo_dh_pairing',
      sessionId: session.sessionId,
      targetAccessToken: session.targetAccessToken,
      serverUrl,
      ekPub: encodeKeyBase64(ephemeral.ekPub),
      text: qrText.trim(),
    })
  }, [ephemeral?.ekPub, qrText, serverUrl, session])

  useEffect(() => {
    if (!setupPayload) {
      setSetupQr(null)
      return
    }

    let cancelled = false
    QRCode.toDataURL(setupPayload, {
      width: 220,
      margin: 2,
      color: { dark: '#2d0a6e', light: '#f5f3ff' },
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
        setDhDebug({ ...debug, scannerPub })
        clearInterval(timer)
      } catch (e) {
        setError(e.message || 'Failed to poll DH session')
      }
    }, 1500)

    return () => clearInterval(timer)
  }, [dhDebug, ephemeral?.ekPriv, session?.sessionId, session?.targetAccessToken])

  const createSetupQr = async () => {
    setBusy(true)
    setError(null)
    setSetupQr(null)
    setSession(null)
    setEphemeral(null)
    setScannerPubKey('')
    setDhDebug(null)
    try {
      const eph = await generatePairingEphemeralDebug()
      const created = await deviceService.createDhSession({
        targetEphemeralPubKey: encodeKeyBase64(eph.ekPub),
        origin: window.location.origin,
        version: 'echo-dh-debug-v1',
        targetDevice: { role: 'main-device', text: qrText.trim() },
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
  }

  const reset = () => {
    setSession(null)
    setEphemeral(null)
    setSetupQr(null)
    setScannerPubKey('')
    setDhDebug(null)
    setError(null)
    setQrText('')
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='rounded-xl border border-white/10 bg-black/60 p-3'>
        <p className='text-[10px] font-semibold uppercase tracking-widest text-[#a855f7] mb-2'>
          ■ MAIN DEVICE DH SETUP
        </p>
        <p className='text-xs text-[#6f6f7e]'>
          The QR gives the scanner <span className='font-mono text-[#b9b9c4]'>ek_pub</span>. When
          scanned, the scanner sends its
          <span className='font-mono text-[#b9b9c4]'> IK_pub</span> through the server so this
          device can compute the same shared secret.
        </p>
      </div>

      {setupQr ? (
        <div className='flex flex-col items-center gap-3'>
          <div className='rounded-2xl border border-white/10 bg-[#f5f3ff] p-4 shadow-lg shadow-purple-900/20'>
            <img src={setupQr} alt='Ephemeral key pairing QR' className='h-52 w-52' />
          </div>
          <p className='text-xs text-[#6f6f7e] text-center'>
            Scan this from the mobile device. Its IK public key will be sent back through the
            server.
          </p>
          {qrText.trim() && (
            <div className='w-full rounded-xl border border-white/10 bg-black/60 p-3'>
              <p className='text-[9px] uppercase tracking-widest text-[#6f6f7e] mb-1'>Text in QR</p>
              <p className='text-sm text-white break-words'>{qrText.trim()}</p>
            </div>
          )}
          <p className='text-[10px] font-mono text-[#4a4a5a] break-all text-center'>
            server: {serverUrl}
          </p>
        </div>
      ) : (
        <div className='flex flex-col gap-3'>
          <div className='rounded-2xl border border-white/10 bg-black/70 p-4'>
            <label className='block text-[10px] font-semibold uppercase tracking-widest text-[#a855f7] mb-2'>
              Text to include in QR
            </label>
            <textarea
              value={qrText}
              onChange={(event) => setQrText(event.target.value)}
              placeholder='Type the text the scanning device should receive'
              className='min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-[#4a4a5a] outline-none focus:border-[#a855f7]/60'
            />
          </div>
          <button
            onClick={createSetupQr}
            disabled={busy}
            className='btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
          >
            {busy && <Loader2 className='h-4 w-4 animate-spin' />}
            {busy ? 'Creating QR…' : 'Create EK Public Key QR'}
          </button>
        </div>
      )}

      {ephemeral && (
        <div className='rounded-2xl border border-white/10 bg-black/70 p-4'>
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
          {qrText.trim() && (
            <Section icon={Key} title='Text carried in QR' color='#f59e0b'>
              <Row label='text' value={qrText.trim()} mono={false} />
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
          <p className='font-semibold text-red-300'>QR creation failed</p>
          <p className='mt-1 break-words'>{error}</p>
        </div>
      )}
      {(setupQr || dhDebug) && (
        <button
          onClick={reset}
          className='flex items-center justify-center gap-2 text-sm text-[#a855f7] hover:text-[#c084fc] transition-colors'
        >
          <RefreshCw className='h-4 w-4' />
          Start over
        </button>
      )}
    </div>
  )
}
