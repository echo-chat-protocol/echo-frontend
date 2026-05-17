import { useState } from 'react'

export function useTauri() {
  const [isTauri] = useState(() => typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__)

  const [isMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    const ua = navigator.userAgent.toLowerCase()
    return /android|iphone|ipad|ipod/.test(ua) || window.innerWidth < 768
  })

  return { isTauri, isMobile }
}
