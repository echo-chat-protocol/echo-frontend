// Minimal pull-to-refresh for mobile: drag down from top to trigger a reload.
// No dependency; attaches global touch listeners and injects a tiny overlay.

let _enabled = false

export function initPullToRefresh({ threshold = 70, maxPull = 140 } = {}) {
  if (_enabled) return () => {}
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}

  // Only enable on touch-capable small screens
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const isSmall = window.matchMedia && window.matchMedia('(max-width: 768px)').matches
  if (!isTouch || !isSmall) return () => {}

  _enabled = true

  let startY = 0
  let pulling = false
  let pulled = 0
  let overlay = null

  const ensureOverlay = () => {
    if (overlay) return overlay
    overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.right = '0'
    overlay.style.height = '0px'
    overlay.style.display = 'flex'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.style.color = 'white'
    overlay.style.background =
      'linear-gradient(to bottom, rgba(99,102,241,0.9), rgba(99,102,241,0.4))'
    overlay.style.fontSize = '12px'
    overlay.style.zIndex = '9999'
    overlay.style.transition = 'height 150ms ease-out'
    overlay.textContent = 'Pull to refresh…'
    document.body.appendChild(overlay)
    return overlay
  }

  const onStart = (e) => {
    if (window.scrollY > 0) return
    const touch = e.touches && e.touches[0]
    if (!touch) return
    startY = touch.clientY
    pulling = true
    pulled = 0
  }

  const onMove = (e) => {
    if (!pulling) return
    if (window.scrollY > 0) {
      pulling = false
      setHeight(0)
      return
    }
    const touch = e.touches && e.touches[0]
    if (!touch) return
    const dy = Math.max(0, touch.clientY - startY)
    if (dy <= 0) return
    pulled = Math.min(maxPull, dy)
    const el = ensureOverlay()
    setHeight(pulled)
    el.textContent = pulled > threshold ? 'Release to refresh' : 'Pull to refresh…'
  }

  const onEnd = () => {
    if (!pulling) return
    pulling = false
    const shouldRefresh = pulled > threshold
    setHeight(0)
    pulled = 0
    if (shouldRefresh) {
      try {
        window.location.reload()
      } catch {
        // no-op
      }
    }
  }

  const setHeight = (h) => {
    if (!overlay) return
    overlay.style.height = `${h}px`
  }

  window.addEventListener('touchstart', onStart, { passive: true })
  window.addEventListener('touchmove', onMove, { passive: true })
  window.addEventListener('touchend', onEnd, { passive: true })

  return () => {
    window.removeEventListener('touchstart', onStart)
    window.removeEventListener('touchmove', onMove)
    window.removeEventListener('touchend', onEnd)
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay)
    overlay = null
    _enabled = false
  }
}
