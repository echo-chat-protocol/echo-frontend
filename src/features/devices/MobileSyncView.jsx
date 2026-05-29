import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  ShieldX,
  RotateCcw,
  Loader2,
  Key,
  Shuffle,
  Hash,
  Lock,
} from 'lucide-react'
import {
  getOrCreateDeviceIK,
  parseQRPayload,
  decryptQRPayloadDebug,
  decodeKeyInput,
  derivePairingDhDebug,
  parseSyncPayload,
  decryptSyncPayloadDebug,
  decryptHistoryPackageChunks,
  hexBytes,
  encodeKeyBase64,
  isValidPairingCode,
} from './qrCrypto'
import QRScanner from './QRScanner'
import { deviceService } from './deviceService'
import { importHistoryPackage } from './historyPackage'
import { generateAndUploadDeviceKeyBundle } from './deviceKeyBundle'
import { getDeviceMetadata, resetDeviceId } from './deviceMetadata'
import ParticlesBackground from '@/components/animations/ParticlesBackground'
import { PageLoader } from '@/components/common/Spinner'

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

function ScannerCryptoTrace({ debug, failed = false }) {
  if (!debug) return null

  if (debug.mode === 'pairing-key-transfer') {
    return (
      <div className='w-full max-w-sm rounded-2xl border border-white/10 bg-black/70 p-4'>
        <p className='text-[10px] font-semibold uppercase tracking-widest text-[#a855f7] mb-3'>
          ■ SCANNER KEY TRANSFER
        </p>

        <Section icon={Key} title='Own private key' color='#a855f7'>
          <Row label='IK priv (hex)' value={hexBytes(debug.ikPriv, 32)} />
        </Section>

        <Section icon={Key} title='Own public key' color='#4ade80'>
          <Row label='sent to desktop pairing session' value={hexBytes(debug.ikPub, 32)} />
        </Section>

        <Section icon={Shuffle} title='Received ephemeral public key' color='#22d3ee'>
          <Row label='ek pub from scanned QR' value={hexBytes(debug.receivedEpk, 32)} />
        </Section>

        {debug.dhShared && (
          <Section icon={Shuffle} title={`X25519 DH  —  ${debug.dhOp}`} color='#22d3ee'>
            <Row
              label='input 1'
              value='scanner_IK_priv  (scanner identity private key)'
              mono={false}
            />
            <Row label='input 2' value={`ek_pub   ${hexBytes(debug.receivedEpk, 32)}`} />
            <Row label='shared secret (output)' value={hexBytes(debug.dhShared, 32)} />
          </Section>
        )}

        <Section icon={Key} title='Pairing Session' color='#22d3ee'>
          <Row label='session id' value={debug.sessionId} mono={false} />
        </Section>
      </div>
    )
  }

  if (debug.mode === 'sync') {
    return (
      <div className='w-full max-w-sm rounded-2xl border border-white/10 bg-black/70 p-4'>
        <p className='text-[10px] font-semibold uppercase tracking-widest text-[#a855f7] mb-3'>
          ■ SCANNER SYNC TRACE
        </p>

        <Section icon={Key} title='Own private key' color='#a855f7'>
          <Row
            label='not used by sync QR'
            value='sync payloads carry a one-time AES key inside the scanned QR'
            mono={false}
          />
        </Section>

        <Section icon={Key} title='Own public key' color='#a855f7'>
          <Row
            label='not used by sync QR'
            value='sync payloads do not use X25519 identity keys'
            mono={false}
          />
        </Section>

        <Section icon={Key} title='Received key' color='#22d3ee'>
          <Row label='AES key from QR payload `k`' value={hexBytes(debug.key, 32)} />
        </Section>

        <Section
          icon={Key}
          title={`Sync payload  —  ${debug.version || 'echo-sync-v1'}`}
          color='#a855f7'
        >
          <Row label='mode' value='one-way QR secret channel' mono={false} />
          <Row label='key  →  from QR payload `k`' value={hexBytes(debug.key, 32)} />
        </Section>

        <Section icon={Lock} title='AES-256-GCM decrypt' color={failed ? '#f87171' : '#4ade80'}>
          <Row label='key' value={hexBytes(debug.key, 32)} />
          <Row label='nonce  →  from QR payload `n`' value={hexBytes(debug.nonce, 12)} />
          <Row
            label='ciphertext (hex, first 24B)'
            value={(debug.ct || '').slice(0, 48) + ((debug.ct || '').length > 48 ? '…' : '')}
          />
          {failed && (
            <Row label='error' value={debug.error || 'authentication failed'} mono={false} />
          )}
        </Section>

        <p className={`text-[9px] mt-1 ${failed ? 'text-red-300' : 'text-[#4a4a5a]'}`}>
          {failed
            ? 'AES-GCM rejected the sync payload. Generate a fresh desktop QR and scan it again.'
            : 'Scanner used the QR-embedded key and authenticated the sync credentials.'}
        </p>
      </div>
    )
  }

  return (
    <div className='w-full max-w-sm rounded-2xl border border-white/10 bg-black/70 p-4'>
      <p className='text-[10px] font-semibold uppercase tracking-widest text-[#a855f7] mb-3'>
        ■ SCANNER CRYPTO TRACE
      </p>

      <Section icon={Key} title='Own private key' color='#a855f7'>
        <Row label='IK priv (hex)' value={hexBytes(debug.ikPriv, 32)} />
      </Section>

      <Section icon={Key} title='Own public key' color='#a855f7'>
        <Row label='IK pub (hex)' value={hexBytes(debug.ikPub, 32)} />
      </Section>

      <Section icon={Key} title='Received key' color='#22d3ee'>
        <Row label='epk pub from QR payload `epk`' value={hexBytes(debug.ekPub, 32)} />
      </Section>

      <Section icon={Key} title='Received device IK public key' color='#4ade80'>
        <Row label='sender IK pub from QR `senderIkPub`' value={hexBytes(debug.senderIkPub, 32)} />
      </Section>

      <Section icon={Key} title='QR target IK public key' color='#f59e0b'>
        <Row
          label='recipient IK pub from QR `recipientIkPub`'
          value={hexBytes(debug.recipientIkPub, 32)}
        />
      </Section>

      <Section icon={Key} title='Identity Key' color='#a855f7'>
        <Row label='source' value={debug.ikSource || '(unknown)'} mono={false} />
        <Row label='IK pub (hex)' value={hexBytes(debug.ikPub)} />
      </Section>

      <Section icon={Shuffle} title='Ephemeral Key  →  from QR payload `epk`' color='#22d3ee'>
        <Row label='epk pub (hex)' value={hexBytes(debug.ekPub)} />
      </Section>

      <Section
        icon={Shuffle}
        title={`X25519 DH  —  ${debug.dhOp || 'DH(IK_priv, epk)'}`}
        color='#22d3ee'
      >
        <Row
          label='input 1'
          value='IK_priv  (scanner identity private key, never leaves device)'
          mono={false}
        />
        <Row label='input 2' value={`epk      ${hexBytes(debug.ekPub)}`} />
        <Row label='shared secret (output)' value={hexBytes(debug.dhShared)} />
      </Section>

      <Section
        icon={Hash}
        title={`HKDF-SHA256  —  info = "${debug.hkdfInfo || 'echo-qr-v1'}"`}
        color='#f59e0b'
      >
        <Row label='IKM (DH output)' value={hexBytes(debug.dhShared)} />
        <Row label='salt  →  from QR payload `s`' value={hexBytes(debug.salt)} />
        <Row label='derived sym key (output)' value={hexBytes(debug.symKey)} />
      </Section>

      <Section icon={Lock} title='AES-256-GCM decrypt' color={failed ? '#f87171' : '#4ade80'}>
        <Row label='key' value={hexBytes(debug.symKey)} />
        <Row label='nonce  →  from QR payload `n`' value={hexBytes(debug.nonce, 12)} />
        <Row
          label='ciphertext (hex, first 24B)'
          value={(debug.ct || '').slice(0, 48) + ((debug.ct || '').length > 48 ? '…' : '')}
        />
        {failed && (
          <Row label='error' value={debug.error || 'authentication failed'} mono={false} />
        )}
      </Section>

      <p className={`text-[9px] mt-1 ${failed ? 'text-red-300' : 'text-[#4a4a5a]'}`}>
        {failed
          ? 'Scanner derived a key, but AES-GCM rejected the ciphertext. The generator and scanner identity keys probably differ.'
          : 'Scanner computed DH(IK_priv, epk), derived the same key, and authenticated the ciphertext.'}
      </p>
    </div>
  )
}

export default function MobileSyncView({ onBack, onSynced, embedded = false }) {
  const [ik, setIk] = useState(null)
  const [ikLoading, setIkLoading] = useState(true)
  const [phase, setPhase] = useState('scan') // scan | decrypting | message | synced | error
  const [message, setMessage] = useState(null)
  const [synced, setSynced] = useState(null)
  const [debug, setDebug] = useState(null)
  const [error, setError] = useState(null)
  const [pairingCodeInput, setPairingCodeInput] = useState('')
  const [pendingPairing, setPendingPairing] = useState(null)

  const parsePairingPayload = (raw) => {
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

  useEffect(() => {
    getOrCreateDeviceIK()
      .then(setIk)
      .catch((e) => {
        setError(e.message || 'Failed to load this device identity key.')
        setPhase('error')
      })
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

    throw new Error('Timed out waiting for encrypted history from the desktop.')
  }

  const finishDhPairingSync = async (state, pairingCode) => {
    if (!isValidPairingCode(pairingCode)) {
      throw new Error('Enter the 8 digit code shown on the main device.')
    }

    const {
      pairingPayload,
      dh,
      scannerDeviceMetadata: initialMetadata,
      deviceId: initialDeviceId,
    } = state
    let scannerDeviceMetadata = initialMetadata
    let deviceId = initialDeviceId

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
    const importedUserId = historyPackage.auth?.userId || historyPackage.user?.userId || null
    const currentUserId = localStorage.getItem('userId')

    if (importedUserId && (!currentUserId || String(importedUserId) !== String(currentUserId))) {
      resetDeviceId()
      scannerDeviceMetadata = getDeviceMetadata()
      deviceId = scannerDeviceMetadata.deviceId
    }

    const completeResult = await deviceService.completeSyncTarget({
      sessionId: pairingPayload.sessionId,
      targetAccessToken: pairingPayload.targetAccessToken,
      serverUrl: pairingPayload.serverUrl,
      targetDevice: {
        ...scannerDeviceMetadata,
      },
    })
    const deviceJwt = completeResult?.auth || null
    const resolvedDeviceId = completeResult?.session?.targetDevice?.deviceId
    if (resolvedDeviceId && resolvedDeviceId !== deviceId) {
      localStorage.setItem('echo-device-id', resolvedDeviceId)
      scannerDeviceMetadata = getDeviceMetadata()
      deviceId = resolvedDeviceId
    }

    const importResult = await importHistoryPackage(historyPackage, { unlockSecret, deviceJwt })

    try {
      await generateAndUploadDeviceKeyBundle(deviceId)
    } catch {
      // Non-fatal: device will not receive fan-out until its bundle is uploaded.
    }

    setSynced({
      username: historyPackage.user?.username,
      history: importResult,
    })
    setPendingPairing(null)
    setPairingCodeInput('')
    setPhase('synced')
  }

  const submitPairingCode = async (event) => {
    event.preventDefault()
    if (!pendingPairing) return
    const normalizedCode = pairingCodeInput.replace(/\D/g, '')
    if (!isValidPairingCode(normalizedCode)) {
      setError('Enter the 8 digit code shown on the main device.')
      return
    }

    setPhase('decrypting')
    setError(null)
    try {
      await finishDhPairingSync(pendingPairing, normalizedCode)
    } catch (e) {
      setError(
        e.message === 'Failed to fetch'
          ? 'Failed to reach the desktop pairing server. Make sure the QR contains a LAN-reachable server URL, not localhost/127.0.0.1.'
          : e.message || 'Failed to sync encrypted history from desktop.'
      )
      setPhase('error')
    }
  }

  const handleRawScan = async (raw) => {
    const input = typeof raw === 'string' ? raw.trim() : ''
    if (!input) {
      setError('Enter or paste QR text first.')
      setPhase('error')
      return
    }

    setPhase('decrypting')
    setError(null)
    setDebug(null)

    const pairingPayload = parsePairingPayload(input)
    if (pairingPayload) {
      try {
        if (!ik) throw new Error('Identity key is not ready yet. Try scanning again.')
        const receivedEpk = pairingPayload.ekPub ? decodeKeyInput(pairingPayload.ekPub) : null
        const dh = receivedEpk
          ? await derivePairingDhDebug(ik.priv, receivedEpk, 'DH(scanner_IK_priv, ek_pub)')
          : null
        const keyB64 = encodeKeyBase64(ik.pub)
        const deviceId = resetDeviceId()
        let scannerDeviceMetadata = {
          ...getDeviceMetadata(),
          deviceId,
        }

        if (pairingPayload.type === 'echo_dh_pairing') {
          await deviceService.submitDhIdentityToServer(pairingPayload.serverUrl, {
            sessionId: pairingPayload.sessionId,
            targetAccessToken: pairingPayload.targetAccessToken,
            sourceIdentityPubKey: keyB64,
            sourceDevice: { role: 'scanner-device', ...scannerDeviceMetadata },
          })
        } else {
          const submit = pairingPayload.serverUrl
            ? deviceService.submitRequestToServer
            : (_serverUrl, body) => deviceService.submitRequest(body)

          await submit(pairingPayload.serverUrl, {
            sessionId: pairingPayload.sessionId,
            newDeviceId: deviceId,
            newDeviceName: scannerDeviceMetadata.deviceName,
            newDevicePublicIdentityKeyX25519: keyB64,
            newDevicePublicIdentityKeyEd25519: keyB64,
            newDeviceSignedPreKey: keyB64,
            newDeviceSignedPreKeySignature: keyB64,
            platform: scannerDeviceMetadata.platform,
            userAgent: scannerDeviceMetadata.userAgent,
            locale: scannerDeviceMetadata.locale,
            timezone: scannerDeviceMetadata.timezone,
            challengeResponse: pairingPayload.challenge || '',
          })
        }

        setDebug({
          mode: 'pairing-key-transfer',
          ikPriv: ik.priv,
          ikPub: ik.pub,
          receivedEpk,
          dhShared: dh?.dhShared || null,
          dhOp: dh?.dhOp || null,
          sessionId: pairingPayload.sessionId,
        })
        if (!dh?.dhShared) {
          setMessage('Scanner IK public key sent to desktop. Shared secret computed locally.')
          setPhase('message')
          return
        }

        setPendingPairing({
          pairingPayload,
          dh,
          scannerDeviceMetadata,
          deviceId,
        })
        setPairingCodeInput('')
        setPhase('code')
      } catch (e) {
        setError(
          e.message === 'Failed to fetch'
            ? 'Failed to reach the desktop pairing server. Make sure the QR contains a LAN-reachable server URL, not localhost/127.0.0.1.'
            : e.message || 'Failed to sync encrypted history from desktop.'
        )
        setPhase('error')
      }
      return
    }

    // QR: echo-qr-v1 message
    const msgPayload = parseQRPayload(input)
    if (msgPayload) {
      try {
        if (!ik) throw new Error('Identity key is not ready yet. Try scanning again.')
        const { text, debug: trace } = await decryptQRPayloadDebug(msgPayload, ik)
        setMessage(text)
        setDebug(trace)
        setPhase('message')
      } catch (e) {
        setDebug(e.debug || null)
        setError(e.message || 'Decryption failed. This QR was encrypted for a different device.')
        setPhase('error')
      }
      return
    }

    // QR: echo-sync-v1 device sync
    const syncPayload = parseSyncPayload(input)
    if (syncPayload) {
      try {
        const { credentials, debug: trace } = await decryptSyncPayloadDebug(syncPayload)
        const previousUserId = localStorage.getItem('userId')
        if (
          credentials.userId &&
          (!previousUserId || String(credentials.userId) !== String(previousUserId))
        ) {
          resetDeviceId()
        }

        localStorage.setItem('echo_sync_account', JSON.stringify(credentials))
        if (credentials.token) {
          localStorage.setItem('echo_access_token', credentials.token)
          localStorage.setItem('token', credentials.token)
        }
        if (credentials.userId) localStorage.setItem('userId', credentials.userId)
        if (credentials.username) localStorage.setItem('username', credentials.username)

        const currentDeviceId = getDeviceMetadata().deviceId

        try {
          await generateAndUploadDeviceKeyBundle(currentDeviceId)
        } catch {
          // Non-fatal
        }

        setSynced(credentials)
        setDebug(trace)
        setPhase('synced')
      } catch (e) {
        setDebug(e.debug || null)
        setError(
          e.message || 'Failed to decrypt credentials. Try generating a new QR on the desktop.'
        )
        setPhase('error')
      }
      return
    }

    // QR: plain text
    setMessage(input)
    setPhase('message')
  }

  const reset = () => {
    setPhase('scan')
    setError(null)
    setMessage(null)
    setSynced(null)
    setDebug(null)
    setPendingPairing(null)
    setPairingCodeInput('')
  }

  const content = (
    <div
      className={
        embedded ? 'flex w-full flex-col' : 'relative z-10 flex min-h-screen flex-col px-5 py-6'
      }
    >
      {!embedded && phase !== 'decrypting' && (
        <button
          onClick={onBack}
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
        {/* Scanning */}
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
              {embedded && (
                <p className='mt-1 text-sm text-gray-400'>Scan the QR from your primary device.</p>
              )}
            </div>
            {ik && (
              <div className='hidden w-full max-w-sm rounded-2xl border border-white/10 bg-black/70 p-4'>
                <p className='text-[10px] font-semibold uppercase tracking-widest text-[#a855f7] mb-3'>
                  ■ SCANNING DEVICE IK
                </p>
                <Section icon={Key} title='Own private key' color='#a855f7'>
                  <Row label='IK priv (hex)' value={hexBytes(ik.priv, 32)} />
                </Section>
                <Section icon={Key} title='Own public key' color='#4ade80'>
                  <Row label='paste this into desktop generator' value={hexBytes(ik.pub, 32)} />
                </Section>
              </div>
            )}
            {ikLoading ? (
              <div className='flex min-h-80 w-full max-w-sm flex-col items-center justify-center gap-4 rounded-xl border border-gray-800 bg-black/20'>
                <Loader2 className='h-8 w-8 animate-spin text-[#a855f7]' />
                <p className='text-sm text-white/45'>Preparing scanner...</p>
              </div>
            ) : (
              <QRScanner onScanRaw={handleRawScan} />
            )}
          </>
        )}

        {/* Decrypting */}
        {phase === 'decrypting' && <PageLoader label='Decrypting…' />}

        {/* Pairing code */}
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
                onChange={(event) =>
                  setPairingCodeInput(event.target.value.replace(/\D/g, '').slice(0, 8))
                }
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

        {/* Decrypted message */}
        {phase === 'message' && (
          <>
            <div className='rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4'>
              <CheckCircle2 className='h-10 w-10 text-emerald-300' />
            </div>
            <div className='text-center'>
              <h3 className='text-xl font-semibold mb-1'>Decrypted</h3>
              <p className='text-xs text-white/35 flex items-center justify-center gap-1'>
                <ShieldCheck className='h-3 w-3 text-[#a855f7]' />
                Verified
              </p>
            </div>
            <div className='w-full max-w-xs rounded-lg border border-gray-800 bg-white/10 px-6 py-5 text-center'>
              <p className='text-2xl font-mono text-white break-all leading-relaxed'>{message}</p>
            </div>
            <div className='hidden'>
              <ScannerCryptoTrace debug={debug} />
            </div>
            <button onClick={reset} className='btn-primary flex items-center gap-2'>
              <RotateCcw className='h-4 w-4' />
              Scan again
            </button>
          </>
        )}

        {/* Device synced */}
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
            <div className='hidden'>
              <ScannerCryptoTrace debug={debug} />
            </div>
            <button
              onClick={() => (onSynced ? onSynced(synced) : onBack())}
              className='btn-primary'
            >
              Continue
            </button>
          </>
        )}

        {/* Error */}
        {phase === 'error' && (
          <>
            <div className='rounded-lg border border-red-400/20 bg-red-400/10 p-4'>
              <ShieldX className='h-10 w-10 text-red-400' />
            </div>
            <div className='text-center max-w-xs'>
              <h3 className='text-lg font-semibold mb-1'>Failed</h3>
              <p className='text-sm text-white/45'>{error}</p>
            </div>
            <div className='hidden'>
              <ScannerCryptoTrace debug={debug} failed />
            </div>
            <button onClick={reset} className='btn-primary flex items-center gap-2'>
              <RotateCcw className='h-4 w-4' />
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
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(255,255,255,0.12),transparent_34%),linear-gradient(180deg,#09090a_0%,#000_62%)]' />
      <div className='absolute inset-0 opacity-20'>
        <ParticlesBackground />
      </div>
      <div className='noise-overlay' />
      {content}
    </div>
  )
}
