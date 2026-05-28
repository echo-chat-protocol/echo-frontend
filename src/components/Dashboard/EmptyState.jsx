import { Download, Lock } from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'

/**
 * Used in the chat empty state.
 */
function EchoLaptop() {
  return (
    <svg
      viewBox='0 0 240 180'
      className='h-[150px] w-auto drop-shadow-[0_18px_30px_rgba(var(--echo-accent-rgb),0.35)]'
      xmlns='http://www.w3.org/2000/svg'
      aria-hidden='true'
    >
      <defs>
        <linearGradient id='echo-screen' x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor='#0b0b12' />
          <stop offset='100%' stopColor='#000000' />
        </linearGradient>
        <linearGradient id='echo-accent-grad' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stopColor='#a855f7' />
          <stop offset='100%' stopColor='#8b5cf6' />
        </linearGradient>
        <radialGradient id='echo-glow' cx='50%' cy='50%' r='50%'>
          <stop offset='0%' stopColor='var(--echo-accent)' stopOpacity='0.55' />
          <stop offset='100%' stopColor='var(--echo-accent)' stopOpacity='0' />
        </radialGradient>
      </defs>

      <ellipse cx='120' cy='158' rx='80' ry='8' fill='url(#echo-glow)' />

      <g className='echo-laptop-lid' style={{ transformOrigin: '120px 138px' }}>
        <rect
          x='48'
          y='22'
          width='144'
          height='100'
          rx='9'
          fill='#15151c'
          stroke='rgba(255,255,255,0.08)'
          strokeWidth='1'
        />
        <rect x='54' y='28' width='132' height='88' rx='5' fill='url(#echo-screen)' />

        <circle cx='120' cy='72' r='36' fill='url(#echo-glow)' opacity='0.45' />

        <g opacity='0.7'>
          <circle cx='70' cy='42' r='0.6' fill='#fff' />
          <circle cx='170' cy='50' r='0.5' fill='var(--echo-accent-soft)' />
          <circle cx='82' cy='100' r='0.5' fill='#fff' opacity='0.6' />
          <circle cx='160' cy='98' r='0.6' fill='var(--echo-accent-soft)' opacity='0.5' />
          <circle cx='120' cy='38' r='0.5' fill='#fff' opacity='0.5' />
        </g>

        <image
          href='/echo-logo.svg'
          x='103'
          y='42'
          width='34'
          height='34'
          preserveAspectRatio='xMidYMid meet'
          className='echo-laptop-logo'
        />

        <g className='echo-laptop-bubble-rx'>
          <rect
            x='64'
            y='84'
            width='40'
            height='11'
            rx='4'
            fill='rgba(255,255,255,0.06)'
            stroke='rgba(255,255,255,0.08)'
            strokeWidth='0.5'
          />
          <circle cx='70' cy='89.5' r='0.9' fill='rgba(255,255,255,0.55)' />
          <circle cx='74' cy='89.5' r='0.9' fill='rgba(255,255,255,0.55)' />
          <circle cx='78' cy='89.5' r='0.9' fill='rgba(255,255,255,0.55)' />
        </g>

        <g className='echo-laptop-bubble-tx'>
          <rect x='136' y='100' width='44' height='11' rx='4' fill='url(#echo-accent-grad)' />
          <rect x='138' y='103' width='22' height='1.2' rx='0.6' fill='rgba(255,255,255,0.78)' />
          <rect x='138' y='106' width='14' height='1.2' rx='0.6' fill='rgba(255,255,255,0.62)' />
        </g>

        <rect x='116' y='24' width='8' height='1.6' rx='0.8' fill='rgba(255,255,255,0.10)' />
      </g>

      <g>
        <path
          d='M32 124 H208 L218 138 H22 Z'
          fill='#0e0e14'
          stroke='rgba(255,255,255,0.08)'
          strokeWidth='1'
        />
        <rect x='108' y='124' width='24' height='2' rx='1' fill='rgba(255,255,255,0.10)' />
      </g>
    </svg>
  )
}

export default function EmptyState() {
  const { t } = useI18n()

  const tr = (k, fb) => {
    const v = t(k)
    return v === k ? fb : v
  }

  return (
    <div className='relative grid flex-1 place-items-center px-6 py-10'>
      <div className='relative flex w-full max-w-[760px] flex-col items-center'>
        <div
          data-testid='empty-state-download-card'
          className='relative w-full max-w-[420px] overflow-hidden rounded-[28px] border border-white/[0.06] px-8 pb-8 pt-10 text-center'
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0))',
          }}
        >
          <span
            aria-hidden
            className='pointer-events-none absolute -top-20 left-1/2 h-[260px] w-[260px] -translate-x-1/2 rounded-full'
            style={{
              background:
                'radial-gradient(closest-side, rgba(var(--echo-accent-rgb), 0.18), transparent 70%)',
              filter: 'blur(8px)',
            }}
          />

          <div className='relative flex justify-center'>
            <EchoLaptop />
          </div>

          <h2 className='echo-display mt-8 text-[22px]'>
            {tr('empty.download.title', 'Descargar ')}
            <span className='text-[#a855f7]'>ECHO</span>
            {tr('empty.download.titleSuffix', ' para Windows')}
          </h2>
          <p className='mt-3 px-2 text-[12.5px] leading-relaxed text-white/45'>
            {tr(
              'empty.download.subtitle',
              'Llamadas voz y video sin metadatos, sincronización air-gapped y modo enclave para máxima privacidad.'
            )}
          </p>

          <button
            data-testid='empty-state-download-btn'
            className='echo-cta mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[13px] font-medium'
            type='button'
          >
            <Download size={15} />
            {tr('empty.download.btn', 'Descargar')}
          </button>
        </div>

        <div className='mt-8 flex items-center gap-2 mono text-[10px] tracking-[0.18em] text-white/30 uppercase'>
          <Lock size={10} /> end-to-end · zero-knowledge · on-device only
        </div>
      </div>
    </div>
  )
}
