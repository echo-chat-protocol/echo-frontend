import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import GeckoIcon from './GeckoIcon'

const STORAGE_KEY = 'echo-debug-toggle-pos'
const SIZE = 44 // px (matches h-11 / w-11)
const EDGE_PADDING = 12

function loadInitialPos() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed
  } catch {
    /* ignore */
  }
  return null
}

function clampToViewport({ x, y }) {
  if (typeof window === 'undefined') return { x, y }
  const maxX = window.innerWidth - SIZE - EDGE_PADDING
  const maxY = window.innerHeight - SIZE - EDGE_PADDING
  return {
    x: Math.max(EDGE_PADDING, Math.min(maxX, x)),
    y: Math.max(EDGE_PADDING, Math.min(maxY, y)),
  }
}

function defaultPos() {
  if (typeof window === 'undefined') return { x: 16, y: 16 }
  const bottomSafe = 16
  return {
    x: window.innerWidth - SIZE - EDGE_PADDING,
    y: window.innerHeight - SIZE - EDGE_PADDING - bottomSafe,
  }
}

export default function DebugToggleButton({ active, onToggle }) {
  const [pos, setPos] = useState(() => clampToViewport(loadInitialPos() || defaultPos()))
  const draggingRef = useRef(false)
  const dragStateRef = useRef({ startX: 0, startY: 0, baseX: 0, baseY: 0, moved: false })

  // Re-clamp on window resize so the button never lands offscreen.
  useEffect(() => {
    const onResize = () => setPos((p) => clampToViewport(p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
    } catch {
      /* ignore */
    }
  }, [pos])

  const onPointerDown = (e) => {
    draggingRef.current = true
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos.x,
      baseY: pos.y,
      moved: false,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!draggingRef.current) return
    const dx = e.clientX - dragStateRef.current.startX
    const dy = e.clientY - dragStateRef.current.startY
    if (!dragStateRef.current.moved && Math.hypot(dx, dy) > 4) {
      dragStateRef.current.moved = true
    }
    if (dragStateRef.current.moved) {
      setPos(
        clampToViewport({
          x: dragStateRef.current.baseX + dx,
          y: dragStateRef.current.baseY + dy,
        })
      )
    }
  }

  const onPointerUp = (e) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    // Treat as a click only if we didn't actually drag.
    if (!dragStateRef.current.moved) {
      onToggle?.()
    }
  }

  return (
    <button
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label='Toggle Gecho console'
      title='Gecho console (drag to move · Ctrl+`)'
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${SIZE}px`,
        height: `${SIZE}px`,
        touchAction: 'none',
      }}
      className={`fixed z-[75] grid place-items-center rounded-full border border-white/10 bg-black/65 shadow-lg backdrop-blur-md transition-colors duration-150 hover:bg-black/85 ${
        active ? 'text-violet-200 ring-1 ring-violet-400/40' : 'text-violet-300'
      } cursor-grab active:cursor-grabbing`}
    >
      <GeckoIcon size={20} />
    </button>
  )
}

DebugToggleButton.propTypes = {
  active: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
}
