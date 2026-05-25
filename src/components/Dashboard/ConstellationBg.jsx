import { useMemo } from 'react'

/**
 * Subtle animated constellation background — same vibe as the landing page.
 * Renders a starfield + faint connecting lines on top of a violet radial glow.
 */
export default function ConstellationBg({ density = 60, className = '' }) {
  const stars = useMemo(() => {
    const arr = []
    for (let i = 0; i < density; i++) {
      arr.push({
        cx: Math.random() * 100,
        cy: Math.random() * 100,
        r: Math.random() * 1.2 + 0.4,
        o: Math.random() * 0.55 + 0.15,
        delay: Math.random() * 6,
      })
    }
    return arr
  }, [density])

  // Build a few thin connecting lines between nearby stars
  const lines = useMemo(() => {
    const out = []
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const dx = stars[i].cx - stars[j].cx
        const dy = stars[i].cy - stars[j].cy
        const d = Math.hypot(dx, dy)
        if (d < 8 && out.length < 28) {
          out.push({ a: stars[i], b: stars[j], o: Math.max(0, 0.18 - d * 0.018) })
        }
      }
    }
    return out
  }, [stars])

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Violet radial halo */}
      <div
        className='absolute left-1/2 top-1/2 h-[1100px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full'
        style={{
          background:
            'radial-gradient(closest-side, rgba(168,85,247,0.18), rgba(124,58,237,0.06) 45%, transparent 70%)',
        }}
      />
      <div
        className='absolute -left-32 top-32 h-[520px] w-[520px] rounded-full'
        style={{
          background: 'radial-gradient(closest-side, rgba(124,58,237,0.10), transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className='absolute right-0 -bottom-32 h-[600px] w-[600px] rounded-full'
        style={{
          background: 'radial-gradient(closest-side, rgba(168,85,247,0.10), transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* SVG starfield */}
      <svg
        className='absolute inset-0 h-full w-full'
        viewBox='0 0 100 100'
        preserveAspectRatio='none'
      >
        {lines.map((l, i) => (
          <line
            key={`l-${i}`}
            x1={l.a.cx}
            y1={l.a.cy}
            x2={l.b.cx}
            y2={l.b.cy}
            stroke={`rgba(168, 85, 247, ${l.o})`}
            strokeWidth='0.07'
            vectorEffect='non-scaling-stroke'
          />
        ))}
        {stars.map((s, i) => (
          <circle
            key={`s-${i}`}
            cx={s.cx}
            cy={s.cy}
            r={s.r * 0.18}
            fill={i % 5 === 0 ? 'rgba(192,132,252,0.85)' : 'rgba(255,255,255,0.6)'}
            opacity={s.o}
          >
            <animate
              attributeName='opacity'
              values={`${s.o};${s.o * 0.35};${s.o}`}
              dur={`${4 + (i % 5)}s`}
              begin={`${s.delay}s`}
              repeatCount='indefinite'
            />
          </circle>
        ))}
      </svg>
    </div>
  )
}
