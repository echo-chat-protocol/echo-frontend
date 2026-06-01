import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  ShieldCheck,
  ShieldX,
  StopCircle,
} from 'lucide-react'
import { getOrCreateDeviceIK, decryptQRPayloadDebug, parseQRPayload, hexBytes } from './qrCrypto'

const stopStream = (stream) => stream?.getTracks().forEach((track) => track.stop())

const isLoopbackHost = (host) =>
  host === 'localhost' || host === '127.0.0.1' || host === '::1' || /\.localhost$/i.test(host)

// iOS (every browser there is WebKit) silently rejects camera access that is
// not triggered by a user gesture, so auto-starting the scanner on mount fails
// with no useful error. Detect iOS so we can require a tap instead. Note iPadOS
// 13+ reports a "Macintosh" UA — disambiguate it via touch-point support.
const isIOS = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iP(hone|ad|od)/.test(ua)) return true
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
}

const cameraRequestAttempts = [
  {
    label: 'environment camera at preferred resolution',
    constraints: {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
  },
  {
    label: 'environment camera',
    constraints: { video: { facingMode: { ideal: 'environment' } } },
  },
  {
    label: 'any available camera',
    constraints: { video: true },
  },
]

const getCameraErrorMessage = (error) => {
  if (!error) return 'Camera error.'
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
    return 'Camera permission denied.'
  }
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return 'No camera found.'
  }
  if (error.name === 'NotReadableError' || error.name === 'AbortError') {
    return 'Camera is already in use by another app or browser tab.'
  }
  if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
    return 'This camera does not support the requested mode.'
  }
  return `Camera error: ${error.message || error.name || 'Unknown error'}`
}

export default function QRScanner({ onScanRaw } = {}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const rafRef = useRef(null)
  const h5Ref = useRef(null)
  const scanCountRef = useRef(0)
  const logEndRef = useRef(null)
  const autoStartAttemptedRef = useRef(false)

  const [ik, setIk] = useState(null)
  const [started, setStarted] = useState(false)
  const [result, setResult] = useState(null) // { text, source, debug }
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])

  const log = useCallback((msg, color = null) => {
    const ts = new Date().toISOString().slice(11, 23)
    setLogs((prev) => [...prev.slice(-120), { ts, msg, color }])
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    log('Component mounted')
    log(
      `BarcodeDetector: ${'BarcodeDetector' in window ? 'AVAILABLE ✓' : 'NOT AVAILABLE ✗'}`,
      'BarcodeDetector' in window ? '#4ade80' : '#f87171'
    )
    log(`Html5Qrcode: ${typeof Html5Qrcode}`)

    getOrCreateDeviceIK()
      .then((k) => {
        setIk(k)
        log(`IK loaded — source: ${k.source}`, '#a855f7')
        log(`IK pub:  ${hexBytes(k.pub)}`, '#a855f7')
      })
      .catch((e) => {
        log(`IK load FAILED: ${e.message}`, '#f87171')
        setError(e.message)
      })

    return () => {
      cancelAnimationFrame(rafRef.current)
      stopStream(streamRef.current)
      h5Ref.current?.stop().catch(() => {})
    }
  }, [log])

  // ── Shared scan handler ───────────────────────────────────────────────────

  const handleScan = useCallback(
    async (raw) => {
      log(`─── QR DETECTED (${raw.length} chars) ───────────────`, '#22d3ee')
      log(`Raw: ${raw.slice(0, 80)}${raw.length > 80 ? '…' : ''}`)

      if (onScanRaw) {
        log('onScanRaw mode — forwarding raw to parent')
        await onScanRaw(raw)
        return
      }

      const payload = parseQRPayload(raw)
      log(
        `parseQRPayload: ${payload ? 'valid echo-qr-v1 ✓' : 'not an ECHO message QR'}`,
        payload ? '#4ade80' : '#f59e0b'
      )

      if (payload) {
        if (!ik) {
          log('ERROR: IK not ready', '#f87171')
          return
        }

        log('─── SCANNER CRYPTO TRACE ───────────────────────────', '#22d3ee')
        log(`IK source:  ${ik.source}`, '#a855f7')
        log(`IK pub:     ${hexBytes(ik.pub)}`, '#a855f7')
        log(
          `epk (QR):   ${hexBytes(Array.from(atob(payload.epk)).map((c) => c.charCodeAt(0)))}`,
          '#a855f7'
        )
        log(
          `salt (QR):  ${hexBytes(Array.from(atob(payload.s)).map((c) => c.charCodeAt(0)))}`,
          '#f59e0b'
        )
        log(
          `nonce (QR): ${hexBytes(
            Array.from(atob(payload.n)).map((c) => c.charCodeAt(0)),
            12
          )}`,
          '#f59e0b'
        )
        log(`ct (first 24B hex): ${payload.ct.slice(0, 48)}…`)
        log('Computing DH(IK_priv, epk)…', '#22d3ee')

        try {
          const { text, debug } = await decryptQRPayloadDebug(payload, ik)

          log(`DH shared:  ${hexBytes(debug.dhShared)}`, '#22d3ee')
          log(`sym key:    ${hexBytes(debug.symKey)}`, '#f59e0b')
          log('AES-256-GCM decrypt… ✓', '#4ade80')
          log(`Plaintext:  "${text}"`, '#4ade80')

          setResult({ text, source: 'encrypted', debug })
        } catch (e) {
          const d = e.debug || {}
          if (d.dhShared) log(`DH shared:  ${hexBytes(d.dhShared)}`, '#f87171')
          if (d.symKey) log(`sym key:    ${hexBytes(d.symKey)}`, '#f87171')
          log('AES-256-GCM decrypt… ✗ FAILED', '#f87171')
          log(`Error: ${e.message}`, '#f87171')
          log('IK mismatch? Generator and scanner IK pub must match for DH to work.', '#f59e0b')
          setResult({ text: null, source: 'failed', debug: d })
        }
      } else {
        log('Plain (unencrypted) QR — displaying as-is', '#f59e0b')
        setResult({ text: raw, source: 'plain', debug: null })
      }
    },
    [ik, onScanRaw, log]
  )

  // ── Canvas + BarcodeDetector scan loop ────────────────────────────────────

  const tick = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    scanCountRef.current++
    const n = scanCountRef.current

    if (n % 30 === 1) {
      log(`Frame #${n} — ${canvas.width}×${canvas.height} — readyState: ${video.readyState}`)
    }

    if (detectorRef.current) {
      try {
        const codes = await detectorRef.current.detect(canvas)
        if (n % 30 === 1) log(`BarcodeDetector: ${codes.length} code(s) in frame`)
        if (codes.length > 0) {
          log(`QR detected — format: ${codes[0].format}`, '#4ade80')
          cancelAnimationFrame(rafRef.current)
          stopStream(streamRef.current)
          streamRef.current = null
          setStarted(false)
          handleScan(codes[0].rawValue)
          return
        }
      } catch (e) {
        if (n % 30 === 1) log(`BarcodeDetector.detect error: ${e.message}`, '#f87171')
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [handleScan, log])

  // ── Start scanner ─────────────────────────────────────────────────────────

  const startScanner = useCallback(async () => {
    setError(null)
    setResult(null)
    setStarted(false)
    scanCountRef.current = 0
    cancelAnimationFrame(rafRef.current)
    stopStream(streamRef.current)
    streamRef.current = null
    h5Ref.current?.stop().catch(() => {})
    h5Ref.current = null
    log('─── START SCANNER ────────────────────────────────────', '#22d3ee')

    // Browsers block camera access on http for non-localhost origins. Detect and guide.
    try {
      const proto = window.location?.protocol || ''
      const host = window.location?.hostname || ''
      const isHttp = proto === 'http:'
      const isLoopback = isLoopbackHost(host)
      if (isHttp && !isLoopback) {
        const tip =
          'Camera requires a secure origin. Open this page at http://localhost (or use HTTPS) to scan.'
        log(tip, '#f59e0b')
        setError(tip)
        return
      }
    } catch {}

    if ('BarcodeDetector' in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats()
        log(`BarcodeDetector formats: ${formats.join(', ')}`, '#4ade80')
        if (formats.includes('qr_code')) {
          detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] })
        } else {
          log('BarcodeDetector does not support QR codes — using html5-qrcode fallback', '#f59e0b')
          detectorRef.current = null
        }
      } catch (e) {
        log(`BarcodeDetector init failed: ${e.message} — falling back to html5-qrcode`, '#f59e0b')
        detectorRef.current = null
      }
    } else {
      log('BarcodeDetector not available — using html5-qrcode fallback', '#f59e0b')
      detectorRef.current = null
    }

    if (detectorRef.current) {
      log('Path: BarcodeDetector + RAF scan loop')
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera is not available in this browser.')
        return
      }

      let stream = null
      let lastCameraError = null
      for (const attempt of cameraRequestAttempts) {
        try {
          log(`Requesting camera (${attempt.label})…`)
          stream = await navigator.mediaDevices.getUserMedia(attempt.constraints)
          break
        } catch (e) {
          lastCameraError = e
          log(`getUserMedia attempt failed: ${e.name} — ${e.message}`, '#f59e0b')
        }
      }

      if (!stream) {
        log(
          `getUserMedia FAILED: ${lastCameraError?.name || 'Error'} — ${
            lastCameraError?.message || 'No stream returned'
          }`,
          '#f87171'
        )
        setError(getCameraErrorMessage(lastCameraError))
        return
      }

      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      log(`Camera acquired: "${track?.label || 'unlabeled camera'}"`, '#4ade80')
      const s = track?.getSettings?.() || {}
      if (s.width || s.height) log(`Resolution: ${s.width || '?'}×${s.height || '?'}`)

      setStarted(true)

      const video = videoRef.current
      if (!video) {
        stopStream(streamRef.current)
        streamRef.current = null
        setStarted(false)
        setError('Camera preview is not available.')
        return
      }
      video.style.display = 'block'

      try {
        await new Promise((resolve, reject) => {
          const finish = () => {
            video.onloadedmetadata = null
            video.onerror = null
            log(`Video metadata: ${video.videoWidth}×${video.videoHeight}`)
            resolve()
          }
          video.onloadedmetadata = finish
          video.onerror = reject
          video.srcObject = streamRef.current
          if (video.readyState >= 1 || video.videoWidth || video.videoHeight) finish()
        })
      } catch (e) {
        log(`Video metadata FAILED: ${e?.message || 'Unable to load preview'}`, '#f87171')
        stopStream(streamRef.current)
        streamRef.current = null
        setStarted(false)
        setError('Camera opened, but the live preview could not be loaded.')
        return
      }

      try {
        await video.play()
      } catch (e) {
        log(`Video play FAILED: ${e.name} — ${e.message}`, '#f87171')
        stopStream(streamRef.current)
        streamRef.current = null
        setStarted(false)
        setError(
          'Camera opened, but this browser blocked the live preview. Try again from Safari or Chrome.'
        )
        return
      }

      log(`Video playing — readyState: ${video.readyState}`)
      rafRef.current = requestAnimationFrame(tick)
      log('RAF scan loop started — scanning every frame…', '#4ade80')
    } else {
      log('Path: html5-qrcode fallback')
      setStarted(true)

      try {
        const container = document.getElementById('qr-h5-container')
        if (container) {
          container.style.display = 'block'
          container.style.minHeight = '320px'
        }
        log(`h5 container: found=${!!container}, width=${container?.offsetWidth}px`)

        const scanner = new Html5Qrcode('qr-h5-container')
        h5Ref.current = scanner

        const onDecoded = (raw) => {
          log(`html5-qrcode decoded (${raw.length} chars)`, '#4ade80')
          scanner.stop().catch(() => {})
          h5Ref.current = null
          setStarted(false)
          handleScan(raw)
        }
        const onScanTick = () => {
          scanCountRef.current++
        }

        // iOS Safari is fussy about facingMode constraint shapes — try the
        // object form, then the legacy string form before falling back.
        const html5StartAttempts = [
          { label: 'environment camera', cameraConfig: { facingMode: { ideal: 'environment' } } },
          { label: 'legacy environment camera', cameraConfig: { facingMode: 'environment' } },
        ]
        let startedHtml5 = false
        let lastHtml5Error = null

        for (const attempt of html5StartAttempts) {
          try {
            log(`Starting html5-qrcode (${attempt.label})…`)
            await scanner.start(attempt.cameraConfig, { fps: 10 }, onDecoded, onScanTick)
            startedHtml5 = true
            break
          } catch (e) {
            lastHtml5Error = e
            log(`html5-qrcode attempt failed: ${e.name} — ${e.message}`, '#f59e0b')
          }
        }

        // Final fallback: enumerate cameras and start by explicit deviceId. This
        // works on iOS when facingMode constraints don't resolve. getCameras()
        // itself needs camera permission, which the attempts above prompt for
        // (and which iOS only grants inside a user gesture — hence tap-to-start).
        if (!startedHtml5) {
          try {
            log('Enumerating cameras for deviceId fallback…')
            const cameras = await Html5Qrcode.getCameras()
            log(`Cameras found: ${cameras?.length || 0}`)
            if (cameras && cameras.length) {
              const back =
                cameras.find((c) => /back|rear|environment/i.test(c.label || '')) ||
                cameras[cameras.length - 1]
              log(`Starting html5-qrcode (deviceId "${back.label || back.id}")…`)
              await scanner.start(back.id, { fps: 10 }, onDecoded, onScanTick)
              startedHtml5 = true
            }
          } catch (e) {
            lastHtml5Error = e
            log(`html5-qrcode deviceId fallback failed: ${e.name} — ${e.message}`, '#f59e0b')
          }
        }

        if (!startedHtml5) throw lastHtml5Error || new Error('No camera stream returned')

        // Remove the file-picker UI that html5-qrcode injects
        setTimeout(() => {
          const c = document.getElementById('qr-h5-container')
          if (c) {
            c.querySelectorAll('input[type="file"]').forEach((el) => {
              el.closest('div[style]')?.remove() || (el.style.display = 'none')
            })
            c.querySelectorAll('select').forEach((el) => {
              el.closest('div[style]')?.remove() || (el.style.display = 'none')
            })
            // Remove "Scan an image file" button/section
            c.querySelectorAll('[id$="--scan-type-change"]').forEach(
              (el) => (el.style.display = 'none')
            )
          }
        }, 300)

        log('html5-qrcode live feed active', '#4ade80')
      } catch (e) {
        log(`html5-qrcode start FAILED: ${e?.name || 'Error'} — ${e?.message}`, '#f87171')
        const proto = window.location?.protocol || ''
        const host = window.location?.hostname || ''
        const isHttp = proto === 'http:'
        const isLoopback = isLoopbackHost(host)
        const insecureTip = isHttp && !isLoopback ? ' — Camera requires https or localhost.' : ''
        setError('Could not start scanner: ' + (e?.message || 'Camera unavailable') + insecureTip)
        setStarted(false)
        h5Ref.current?.clear?.()
        h5Ref.current = null
        stopStream(streamRef.current)
        streamRef.current = null
      }
    }
  }, [handleScan, log, tick])

  useEffect(() => {
    if (started || result || error || autoStartAttemptedRef.current) return
    if (!onScanRaw && !ik) return
    // iOS WebKit rejects getUserMedia / camera start that isn't initiated by a
    // user gesture, so auto-starting here would just fail. Require a tap (the
    // idle frame below is the start button) instead.
    if (isIOS()) return

    autoStartAttemptedRef.current = true
    startScanner()
  }, [error, ik, onScanRaw, result, startScanner, started])

  const stopScanner = () => {
    log('Scanner stopped by user')
    cancelAnimationFrame(rafRef.current)
    stopStream(streamRef.current)
    streamRef.current = null
    h5Ref.current?.stop().catch(() => {})
    h5Ref.current = null
    setStarted(false)
  }

  const reset = () => {
    setResult(null)
    setError(null)
    autoStartAttemptedRef.current = false
  }

  const resetAll = () => {
    setResult(null)
    setError(null)
    setLogs([])
  }

  // ── Debug panel (always rendered) ─────────────────────────────────────────

  const DebugPanel = () => (
    <div className='sr-only w-full rounded-xl border border-white/10 bg-black/80 overflow-hidden'>
      <div className='flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-white/5'>
        <span className='text-[9px] font-semibold uppercase tracking-widest text-[#a855f7]'>
          ■ SCANNER DEBUG LOG
        </span>
        <button
          onClick={resetAll}
          className='text-[9px] text-[#4a4a5a] hover:text-white transition-colors'
        >
          clear
        </button>
      </div>
      <div
        className='p-2 text-[10px] font-mono leading-relaxed overflow-y-auto'
        style={{ maxHeight: 280 }}
      >
        {logs.length === 0 && (
          <span className='text-[#4a4a5a]'>Debug output will appear here…</span>
        )}
        {logs.map((l, i) => (
          <div key={i} style={{ color: l.color || '#6ee7b7' }}>
            <span className='text-[#3a3a4a] select-none'>[{l.ts}] </span>
            {l.msg}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  )

  // ── Crypto debug detail (shown in result views) ────────────────────────────

  const CryptoDetail = ({ debug, failed }) => {
    if (!debug) return null
    return (
      <div className='w-full rounded-xl border border-white/10 bg-black/80 p-3 text-[10px] font-mono space-y-2'>
        <p
          className='text-[9px] font-semibold uppercase tracking-widest mb-2'
          style={{ color: failed ? '#f87171' : '#4ade80' }}
        >
          ■ SCANNER CRYPTO DETAIL
        </p>
        <div>
          <span className='text-[#a855f7]'>IK source: </span>
          <span className='text-white'>{debug.ikSource}</span>
        </div>
        <div>
          <span className='text-[#a855f7]'>IK pub: </span>
          <span className='text-white break-all'>{hexBytes(debug.ikPub)}</span>
        </div>
        <div>
          <span className='text-[#22d3ee]'>epk (QR): </span>
          <span className='text-white break-all'>{hexBytes(debug.ekPub)}</span>
        </div>
        <div>
          <span className='text-[#22d3ee]'>DH op: </span>
          <span className='text-white'>{debug.dhOp}</span>
        </div>
        <div>
          <span className='text-[#22d3ee]'>DH shared: </span>
          <span className='text-white break-all'>{hexBytes(debug.dhShared)}</span>
        </div>
        <div>
          <span className='text-[#f59e0b]'>sym key: </span>
          <span className='text-white break-all'>{hexBytes(debug.symKey)}</span>
        </div>
        <div>
          <span className='text-[#f59e0b]'>nonce: </span>
          <span className='text-white break-all'>{hexBytes(debug.nonce, 12)}</span>
        </div>
        {failed && (
          <p className='text-[#f87171] mt-1 leading-snug'>
            ⚠ DH shared secret differs from generator — IK mismatch. Both sides must use the same
            X25519 key pair.
          </p>
        )}
      </div>
    )
  }

  // ── Result: failed ────────────────────────────────────────────────────────

  if (result?.source === 'failed')
    return (
      <div className='flex flex-col items-center gap-4 py-4 w-full max-w-sm mx-auto'>
        <div className='rounded-[24px] border border-red-400/20 bg-red-400/10 p-4'>
          <ShieldX className='h-10 w-10 text-red-400' />
        </div>
        <div className='text-center'>
          <h3 className='text-lg font-semibold mb-1'>Scan failed</h3>
          <p className='text-sm text-white/45'>Try a fresh QR</p>
        </div>
        <CryptoDetail debug={result.debug} failed />
        <DebugPanel />
        <button onClick={reset} className='btn-primary flex items-center gap-2'>
          <RotateCcw className='h-4 w-4' /> Try again
        </button>
      </div>
    )

  // ── Result: success ───────────────────────────────────────────────────────

  if (result?.text !== null && result?.text !== undefined)
    return (
      <div className='flex flex-col items-center gap-4 py-4 w-full max-w-sm mx-auto'>
        <div className='rounded-[24px] border border-emerald-300/20 bg-emerald-300/10 p-4'>
          <CheckCircle2 className='h-10 w-10 text-emerald-300' />
        </div>
        <div className='text-center'>
          <h3 className='text-xl font-semibold mb-1'>
            {result.source === 'encrypted' ? 'Decrypted' : 'QR received'}
          </h3>
          {result.source === 'encrypted' && (
            <p className='text-xs text-[#6f6f7e] flex items-center justify-center gap-1'>
              <ShieldCheck className='h-3 w-3 text-[#a855f7]' />
              Verified
            </p>
          )}
        </div>
        <div className='w-full rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 text-center'>
          <p className='text-2xl font-mono text-white break-all leading-relaxed'>{result.text}</p>
        </div>
        {result.source === 'encrypted' && <CryptoDetail debug={result.debug} failed={false} />}
        <DebugPanel />
        <button onClick={reset} className='btn-primary flex items-center gap-2'>
          <RotateCcw className='h-4 w-4' /> Scan again
        </button>
      </div>
    )

  // ── Camera view ───────────────────────────────────────────────────────────

  return (
    <div className='flex flex-col items-center gap-3 w-full max-w-sm mx-auto'>
      <div className='relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-[#070708] shadow-[0_32px_120px_-70px_rgba(255,255,255,0.75)]'>
        <video
          ref={videoRef}
          className='w-full bg-black'
          style={{ display: started && detectorRef.current ? 'block' : 'none', minHeight: 320 }}
          playsInline
          muted
        />

        <canvas ref={canvasRef} className='hidden' />

        <div
          id='qr-h5-container'
          className='w-full overflow-hidden'
          style={{
            minHeight: started && !detectorRef.current ? 320 : 0,
            display: started && !detectorRef.current ? 'block' : 'none',
          }}
        />

        {!started && (
          // A real button so the tap counts as the user gesture iOS WebKit
          // requires before it will start the camera. Doubles as the retry
          // control after a camera error.
          <button
            type='button'
            onClick={startScanner}
            className='flex min-h-80 w-full flex-col items-center justify-center gap-5 p-8'
          >
            <div className='relative h-48 w-48 rounded-[28px] border border-white/12 bg-white/[0.03]'>
              <span className='absolute left-4 top-4 h-9 w-9 rounded-tl-2xl border-l-2 border-t-2 border-white/70' />
              <span className='absolute right-4 top-4 h-9 w-9 rounded-tr-2xl border-r-2 border-t-2 border-white/70' />
              <span className='absolute bottom-4 left-4 h-9 w-9 rounded-bl-2xl border-b-2 border-l-2 border-white/70' />
              <span className='absolute bottom-4 right-4 h-9 w-9 rounded-br-2xl border-b-2 border-r-2 border-white/70' />
              <span className='absolute left-7 right-7 top-1/2 h-px bg-emerald-300/80 shadow-[0_0_24px_rgba(110,231,183,0.75)]' />
            </div>
            <span className='text-sm font-medium text-white/65'>
              {error ? 'Tap to try again' : 'Tap to start camera'}
            </span>
          </button>
        )}
      </div>

      {started && (
        <button
          onClick={stopScanner}
          className='flex items-center gap-2 text-xs text-[#a0a0a0] hover:text-white transition-colors'
        >
          <StopCircle className='h-4 w-4' /> Stop
        </button>
      )}

      {error && (
        <div className='flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 w-full'>
          <AlertCircle className='h-4 w-4 shrink-0 mt-0.5' />
          {error}
        </div>
      )}

      <DebugPanel />
    </div>
  )
}
