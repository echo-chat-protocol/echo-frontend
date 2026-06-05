/**
 * Client-side video helpers for the encrypted-video attachment flow.
 *
 * We do NOT transcode (no ffmpeg.wasm): the original bytes are encrypted and
 * uploaded as-is, capped by size. We only derive a small poster thumbnail and
 * basic metadata so the message bubble can show a preview without downloading
 * and decrypting the whole blob.
 */

// Plaintext size cap. The server caps the *ciphertext* upload at MEDIA_MAX_SIZE
// (30MB); leaving headroom for the per-chunk AEAD tags + container header keeps
// the encrypted blob safely under that.
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024 // 25 MiB

/**
 * Extract a poster frame (JPEG data URL) plus metadata from a video File.
 * Resolves with { thumbnail, durationMs, width, height } — thumbnail is null if
 * a frame couldn't be captured (e.g. codec the browser can't decode), in which
 * case the bubble falls back to a generic video placeholder.
 *
 * @param {File} file
 * @param {{ maxDim?: number, quality?: number, seekTo?: number }} [opts]
 * @returns {Promise<{ thumbnail: string|null, durationMs: number, width: number, height: number }>}
 */
export function extractVideoPoster(file, { maxDim = 480, quality = 0.7, seekTo = 0.1 } = {}) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.src = url

    let settled = false
    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      try {
        video.load()
      } catch {
        /* ignore */
      }
    }
    const finish = (result) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }

    // Hard timeout so a stuck decode can't wedge the composer.
    const timer = setTimeout(
      () => finish({ thumbnail: null, durationMs: 0, width: 0, height: 0 }),
      8000
    )

    const capture = () => {
      const width = video.videoWidth || 0
      const height = video.videoHeight || 0
      const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0
      try {
        if (!width || !height) {
          clearTimeout(timer)
          return finish({ thumbnail: null, durationMs, width, height })
        }
        const scale = Math.min(1, maxDim / Math.max(width, height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(width * scale))
        canvas.height = Math.max(1, Math.round(height * scale))
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const thumbnail = canvas.toDataURL('image/jpeg', quality)
        clearTimeout(timer)
        finish({ thumbnail, durationMs, width, height })
      } catch {
        clearTimeout(timer)
        finish({ thumbnail: null, durationMs, width, height })
      }
    }

    video.onloadeddata = () => {
      // Seek a hair past 0 so we don't grab a black leading frame.
      const target = Math.min(seekTo, (video.duration || 1) / 2)
      if (target > 0 && Number.isFinite(video.duration)) {
        video.currentTime = target
      } else {
        capture()
      }
    }
    video.onseeked = capture
    video.onerror = () => {
      clearTimeout(timer)
      finish({ thumbnail: null, durationMs: 0, width: 0, height: 0 })
    }
  })
}

/** Read a File into a Uint8Array. */
export async function fileToBytes(file) {
  const buf = await file.arrayBuffer()
  return new Uint8Array(buf)
}
