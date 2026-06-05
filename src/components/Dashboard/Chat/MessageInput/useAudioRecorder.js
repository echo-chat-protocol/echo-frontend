import { useCallback, useRef, useState } from 'react'

// Pick the best MediaRecorder mime the browser supports. Opus-in-WebM is the
// widely-supported default; Safari only does mp4/aac.
function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const audioEl =
    typeof document !== 'undefined' && document.createElement
      ? document.createElement('audio')
      : null
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/mpeg',
  ]
  let firstRecordable = ''
  for (const c of candidates) {
    try {
      if (!MediaRecorder.isTypeSupported(c)) continue
      if (!firstRecordable) firstRecordable = c
      if (!audioEl?.canPlayType || audioEl.canPlayType(c)) return c
    } catch {
      /* ignore */
    }
  }
  return firstRecordable
}

function encodeWavBlob(chunks, totalSamples, sampleRate) {
  if (!chunks.length || totalSamples <= 0 || !sampleRate) return null

  const bytesPerSample = 2
  const numChannels = 1
  const dataSize = totalSamples * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Voice-note recorder. Wraps getUserMedia + MediaRecorder and exposes a small
 * imperative API. The produced Blob is handed to the caller, which encrypts it
 * with the same media pipeline used for video.
 *
 * @returns {{
 *   recording: boolean,
 *   seconds: number,
 *   error: string,
 *   isSupported: boolean,
 *   start: () => Promise<boolean>,
 *   stop: () => Promise<{ blob: Blob, mime: string, durationMs: number } | null>,
 *   cancel: () => void,
 * }}
 */
export function useAudioRecorder() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const startedAtRef = useRef(0)
  const cancelledRef = useRef(false)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const processorNodeRef = useRef(null)
  const sinkNodeRef = useRef(null)
  const meterTimerRef = useRef(null)
  const meterStartedRef = useRef(false)
  const maxRmsRef = useRef(0)
  const pcmChunksRef = useRef([])
  const pcmLengthRef = useRef(0)
  const pcmSampleRateRef = useRef(0)

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'

  const cleanupMeter = useCallback(() => {
    if (meterTimerRef.current) {
      clearInterval(meterTimerRef.current)
      meterTimerRef.current = null
    }
    try {
      processorNodeRef.current?.disconnect?.()
    } catch {
      /* ignore */
    }
    try {
      sinkNodeRef.current?.disconnect?.()
    } catch {
      /* ignore */
    }
    try {
      sourceNodeRef.current?.disconnect?.()
    } catch {
      /* ignore */
    }
    processorNodeRef.current = null
    sinkNodeRef.current = null
    sourceNodeRef.current = null
    analyserRef.current = null
    const ctx = audioContextRef.current
    audioContextRef.current = null
    if (ctx && ctx.state !== 'closed') {
      ctx.close?.().catch?.(() => {})
    }
    meterStartedRef.current = false
  }, [])

  const startMeter = useCallback(
    async (stream) => {
      maxRmsRef.current = 0
      meterStartedRef.current = false
      pcmChunksRef.current = []
      pcmLengthRef.current = 0
      pcmSampleRateRef.current = 0

      const AudioContextCtor =
        typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
      if (!AudioContextCtor) return

      try {
        const ctx = new AudioContextCtor()
        audioContextRef.current = ctx
        if (ctx.state === 'suspended') await ctx.resume().catch(() => {})

        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        const source = ctx.createMediaStreamSource(stream)
        const processor = ctx.createScriptProcessor(4096, 1, 1)
        const sink = ctx.createGain()
        sink.gain.value = 0
        source.connect(analyser)
        source.connect(processor)
        processor.connect(sink)
        sink.connect(ctx.destination)

        analyserRef.current = analyser
        sourceNodeRef.current = source
        processorNodeRef.current = processor
        sinkNodeRef.current = sink
        meterStartedRef.current = true
        pcmSampleRateRef.current = ctx.sampleRate

        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0)
          const copy = new Float32Array(input.length)
          copy.set(input)
          pcmChunksRef.current.push(copy)
          pcmLengthRef.current += copy.length
        }

        const samples = new Uint8Array(analyser.fftSize)
        meterTimerRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(samples)
          let sum = 0
          for (let i = 0; i < samples.length; i += 1) {
            const centered = (samples[i] - 128) / 128
            sum += centered * centered
          }
          const rms = Math.sqrt(sum / samples.length)
          if (rms > maxRmsRef.current) maxRmsRef.current = rms
        }, 100)
      } catch {
        cleanupMeter()
      }
    },
    [cleanupMeter]
  )

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    recorderRef.current = null
    chunksRef.current = []
    pcmChunksRef.current = []
    pcmLengthRef.current = 0
    pcmSampleRateRef.current = 0
    cleanupMeter()
  }, [cleanupMeter])

  const start = useCallback(async () => {
    if (recording) return true
    setError('')
    if (!isSupported) {
      setError('Recording is not supported on this device.')
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream
      const audioTracks = stream.getAudioTracks?.() || []
      if (audioTracks.length === 0) {
        throw new Error('No microphone audio track was returned.')
      }
      await startMeter(stream)
      const mimeType = pickMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      chunksRef.current = []
      cancelledRef.current = false
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start()
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      setSeconds(0)
      setRecording(true)
      timerRef.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
      }, 250)
      return true
    } catch (err) {
      cleanup()
      setRecording(false)
      setError(
        err?.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : err?.message || 'Could not start recording.'
      )
      return false
    }
  }, [recording, isSupported, cleanup, startMeter])

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        cleanup()
        setRecording(false)
        resolve(null)
        return
      }
      const durationMs = Date.now() - startedAtRef.current
      recorder.onstop = () => {
        const wasCancelled = cancelledRef.current
        const meterWasActive = meterStartedRef.current
        const peakRms = maxRmsRef.current
        const wavBlob = encodeWavBlob(
          pcmChunksRef.current,
          pcmLengthRef.current,
          pcmSampleRateRef.current
        )
        const blob = wavBlob
        cleanup()
        setRecording(false)
        setSeconds(0)
        if (wasCancelled) resolve(null)
        else if (!blob || blob.size === 0) {
          setError('No audio was captured.')
          resolve(null)
        } else if (meterWasActive && peakRms < 0.002) {
          setError('No microphone audio was detected. Check your input device.')
          resolve(null)
        } else {
          resolve({ blob, mime: 'audio/wav', durationMs })
        }
      }
      try {
        recorder.stop()
      } catch {
        cleanup()
        setRecording(false)
        resolve(null)
      }
    })
  }, [cleanup])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        /* ignore */
      }
    }
    cleanup()
    setRecording(false)
    setSeconds(0)
  }, [cleanup])

  return { recording, seconds, error, isSupported, start, stop, cancel }
}
