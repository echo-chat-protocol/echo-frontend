import { useState, useEffect, useCallback, useRef } from 'react'
import { deviceService } from './deviceService'
import { resolvePairingServerUrl } from '@/utils/network/apiBase'

const SERVER_URL = resolvePairingServerUrl()

export function usePairing({ primaryDeviceId } = {}) {
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState('idle') // idle | creating | waiting | pending_approval | approving | approved | rejected | expired | error
  const [error, setError] = useState(null)
  const [approvedResult, setApprovedResult] = useState(null)
  const pollRef = useRef(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  const startSession = useCallback(async () => {
    setStatus('creating')
    setError(null)
    try {
      const result = await deviceService.createSession({
        primaryDeviceId: primaryDeviceId || 'unknown',
        serverUrl: SERVER_URL,
      })
      setSession(result)
      setStatus('waiting')
    } catch (err) {
      setError(err.message || 'Failed to create pairing session')
      setStatus('error')
    }
  }, [primaryDeviceId])

  // Poll the session status while in 'waiting' state
  useEffect(() => {
    if (!session?.sessionId || status !== 'waiting') return
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const result = await deviceService.getSession(session.sessionId)
        const s = result.session
        if (s?.status === 'awaiting_approval') {
          setSession(s)
          setStatus('pending_approval')
          stopPolling()
        } else if (s?.status === 'expired') {
          setStatus('expired')
          stopPolling()
        } else if (s?.status === 'rejected') {
          setStatus('rejected')
          stopPolling()
        }
      } catch {
        /* ignore transient errors */
      }
    }, 2000)
    return stopPolling
  }, [session?.sessionId, status, stopPolling])

  const approve = useCallback(
    async (deviceAuthorizationSignature = null) => {
      if (!session?.sessionId) return
      setStatus('approving')
      try {
        const result = await deviceService.approve({
          sessionId: session.sessionId,
          deviceAuthorizationSignature,
        })
        setApprovedResult(result)
        setStatus('approved')
      } catch (err) {
        setError(err.message || 'Approval failed')
        setStatus('error')
      }
    },
    [session?.sessionId]
  )

  const reject = useCallback(async () => {
    if (!session?.sessionId) return
    try {
      await deviceService.reject({ sessionId: session.sessionId })
    } catch {
      /* ignore */
    }
    setStatus('rejected')
    stopPolling()
  }, [session?.sessionId, stopPolling])

  const reset = useCallback(() => {
    stopPolling()
    setSession(null)
    setStatus('idle')
    setError(null)
    setApprovedResult(null)
  }, [stopPolling])

  const qrPayload = session?.sessionId
    ? JSON.stringify({
        type: 'echo_pairing',
        sessionId: session.sessionId,
        challenge: session.challenge,
        serverUrl: SERVER_URL,
      })
    : null

  return {
    session,
    status,
    error,
    approvedResult,
    qrPayload,
    startSession,
    approve,
    reject,
    reset,
  }
}
