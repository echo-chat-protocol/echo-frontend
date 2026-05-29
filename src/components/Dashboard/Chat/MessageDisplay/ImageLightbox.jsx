import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react'

const MIN_SCALE = 1
const MAX_SCALE = 5
const STEP = 0.5

// Full-screen, zoomable/pannable image viewer. Portaled to <body> so it is
// unaffected by any `backdrop-filter`/`transform` ancestor (which would
// otherwise re-anchor a `position: fixed` overlay to a nested container).
export default function ImageLightbox({ src, alt = 'Image', onClose }) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef(null)
  const imgRef = useRef(null)

  const reset = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

  const zoomBy = useCallback((delta) => {
    setScale((prev) => {
      const next = clampScale(prev + delta)
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 })
      return next
    })
  }, [])

  // Esc to close; +/- to zoom.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') zoomBy(STEP)
      else if (e.key === '-') zoomBy(-STEP)
      else if (e.key === '0') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, zoomBy, reset])

  // Wheel to zoom (prevent the page behind from scrolling).
  const onWheel = (e) => {
    e.preventDefault()
    zoomBy(e.deltaY < 0 ? STEP : -STEP)
  }

  // Click image: toggle between fit and 2.5×.
  const onImageClick = (e) => {
    e.stopPropagation()
    setScale((prev) => {
      const next = prev > 1 ? 1 : 2.5
      if (next === 1) setOffset({ x: 0, y: 0 })
      return next
    })
  }

  // Pointer drag to pan when zoomed in.
  const onPointerDown = (e) => {
    if (scale <= 1) return
    e.stopPropagation()
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y }
    imgRef.current?.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!dragRef.current) return
    setOffset({
      x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.baseY + (e.clientY - dragRef.current.startY),
    })
  }
  const onPointerUp = (e) => {
    dragRef.current = null
    imgRef.current?.releasePointerCapture?.(e.pointerId)
  }

  const handleDownload = (e) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = src
    a.download = ''
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className='fixed inset-0 z-[90] flex flex-col bg-black/90 backdrop-blur-sm'
      onClick={onClose}
      onWheel={onWheel}
    >
      {/* Toolbar */}
      <div
        className='flex shrink-0 items-center justify-end gap-1 px-3 py-2'
        onClick={(e) => e.stopPropagation()}
      >
        <ToolButton
          title='Zoom out (-)'
          onClick={() => zoomBy(-STEP)}
          disabled={scale <= MIN_SCALE}
        >
          <ZoomOut size={16} />
        </ToolButton>
        <span className='w-12 text-center text-[11px] font-mono text-white/60'>
          {Math.round(scale * 100)}%
        </span>
        <ToolButton title='Zoom in (+)' onClick={() => zoomBy(STEP)} disabled={scale >= MAX_SCALE}>
          <ZoomIn size={16} />
        </ToolButton>
        <ToolButton
          title='Reset (0)'
          onClick={reset}
          disabled={scale === 1 && offset.x === 0 && offset.y === 0}
        >
          <RotateCcw size={15} />
        </ToolButton>
        <ToolButton title='Download' onClick={handleDownload}>
          <Download size={15} />
        </ToolButton>
        <ToolButton title='Close (Esc)' onClick={onClose}>
          <X size={17} />
        </ToolButton>
      </div>

      {/* Stage */}
      <div className='grid min-h-0 flex-1 place-items-center overflow-hidden p-4'>
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          onClick={onImageClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            cursor: scale > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'zoom-in',
            transition: dragRef.current ? 'none' : 'transform 0.15s ease-out',
            touchAction: 'none',
            // Constrain to the viewport (not the grid track, which auto-sizes to
            // the image and would let large images overflow → look pre-zoomed).
            maxWidth: 'calc(100vw - 2rem)',
            maxHeight: 'calc(100vh - 7rem)',
          }}
          className='select-none object-contain'
        />
      </div>

      <div
        className='shrink-0 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1 text-center text-[10.5px] text-white/35'
        onClick={(e) => e.stopPropagation()}
      >
        Scroll or +/- to zoom · click image to toggle · drag to pan · Esc to close
      </div>
    </div>,
    document.body
  )
}

ImageLightbox.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string,
  onClose: PropTypes.func.isRequired,
}

function ToolButton({ children, title, onClick, disabled }) {
  return (
    <button
      type='button'
      title={title}
      onClick={onClick}
      disabled={disabled}
      className='grid h-9 w-9 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent'
    >
      {children}
    </button>
  )
}
ToolButton.propTypes = {
  children: PropTypes.node,
  title: PropTypes.string,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
}
