import { useState, useEffect } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import ParticlesBackground from '@/components/animations/ParticlesBackground'

export default function Hero() {
  const { t } = useTranslation()
  return (
    <section
      id='top'
      data-testid='hero-section'
      className='relative pt-36 pb-24 sm:pt-44 sm:pb-32 overflow-hidden section-fade'
    >
      {/* Backdrops */}
      <div className='aurora-bg' />
      <div className='grid-overlay' />
      <div className='absolute inset-0'>
        <ParticlesBackground />
      </div>
      <div className='noise-overlay' />

      <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        {/* Headline */}
        <h1
          data-testid='hero-headline'
          className='anim-fade-up mt-6 text-center font-semibold tracking-tight leading-[0.95] text-[44px] sm:text-6xl lg:text-7xl'
          style={{ animationDelay: '120ms' }}
        >
          {t('hero.title_1')} <br className='hidden sm:block' />
          <span className='text-white'>{t('hero.title_2')}</span>
        </h1>

        <p
          data-testid='hero-subhead'
          className='anim-fade-up mx-auto mt-6 max-w-2xl text-center text-base sm:text-lg text-[#b9b9c4] leading-relaxed'
          style={{ animationDelay: '240ms' }}
        >
          <Trans i18nKey='hero.subtitle' components={{ 1: <span className='text-white' /> }} />
        </p>

        {/* CTAs */}
        <div
          className='anim-fade-up mt-9 flex items-center justify-center gap-3'
          style={{ animationDelay: '360ms' }}
        >
          <a data-testid='hero-cta-primary' href='#playground' className='btn-primary mx-auto'>
            {t('hero.start')}
          </a>
        </div>

        {/* Social proof ticker — white text, high visibility */}
        <div
          className='anim-fade-up mt-10 ticker-mask overflow-hidden'
          style={{ animationDelay: '480ms' }}
        >
          <div className='anim-ticker flex gap-14 whitespace-nowrap text-sm font-medium text-white/80'>
            {Array.from({ length: 2 }).flatMap((_, dup) =>
              [
                'Trail of Bits',
                'Cure53',
                'NCC Group',
                'EFF · 5★',
                'Privacy Foundation',
                'OpenSSF',
                'Zero-Knowledge.dev',
                'Mozilla MOSS',
              ].map((b) => (
                <span key={`${dup}-${b}`}>
                  {b} <span className='mx-2 text-[#a855f7]'>·</span>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Floating mock app preview */}
      <div className='relative mx-auto mt-16 max-w-5xl px-4 sm:px-6 lg:px-8'>
        <HeroAppPreview />
      </div>
    </section>
  )
}

/* ─── Conversations data ─────────────────────────────────────── */
const CONVERSATIONS = [
  {
    contact: { name: 'Aïsha · @whisper', fp: 'ed25519:4F9A1C…E2 · verified ✓' },
    history: [
      { from: 'them', text: 'The drop is ready. Sending the keyshare now.' },
      { from: 'me', text: 'Got it. AES-256-GCM nonce ready.' },
      { from: 'them', text: ' Keyshare encrypted with your pub: ed25519:7HK…' },
    ],
    newMsg: 'Sealed and stored. Rotating ephemeral RAM. ',
    sidebar: [
      { name: '🛡 Crypto Council', last: 'Key rotation scheduled', active: false },
      { name: 'Aïsha', last: 'ok ', active: true },
      { name: 'Ops • Red Team', last: 'Missed video call', active: false },
    ],
  },
  {
    contact: { name: 'Ops • Red Team', fp: 'ed25519:A1B23C…D4 · verified ✓' },
    history: [
      { from: 'me', text: 'Is the relay still active?' },
      { from: 'them', text: 'Yeah, sub-40ms. All traffic sealed.' },
      { from: 'me', text: 'Perfect. Initiating video call.' },
    ],
    newMsg: 'Video call ended · 12:42',
    sidebar: [
      { name: '🛡 Crypto Council', last: 'Key rotation scheduled', active: false },
      { name: 'Aïsha', last: 'ok ', active: false },
      { name: 'Ops • Red Team', last: 'Video call ended', active: true },
    ],
  },
  {
    contact: { name: '🛡 Crypto Council', fp: 'Multi-party · 5 members · sealed' },
    history: [
      { from: 'them', text: 'Key rotation scheduled for 22:00 UTC.' },
      { from: 'me', text: 'Confirmed. Hardware key ready.' },
      { from: 'them', text: 'Threshold: 3-of-5. Standby for signal.' },
    ],
    newMsg: 'All 3 keys rotated. Channel secured. ',
    sidebar: [
      { name: '🛡 Crypto Council', last: 'All 3 keys rotated', active: true },
      { name: 'Aïsha', last: 'ok ', active: false },
      { name: 'Ops • Red Team', last: 'Video call ended', active: false },
    ],
  },
]

/* ─── Main preview shell ─────────────────────────────────────── */
function HeroAppPreview() {
  const [convIdx, setConvIdx] = useState(0)
  const [phase, setPhase] = useState('idle') // idle | typing | sent
  const [typed, setTyped] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [visible, setVisible] = useState(true)

  const conv = CONVERSATIONS[convIdx]

  /* Reset on conversation change */
  useEffect(() => {
    setPhase('idle')
    setTyped('')
    setShowNew(false)
    setVisible(true)
    const t = setTimeout(() => setPhase('typing'), 1400)
    return () => clearTimeout(t)
  }, [convIdx])

  /* Typewriter */
  useEffect(() => {
    if (phase !== 'typing') return
    const target = conv.newMsg
    if (typed.length >= target.length) {
      const t = setTimeout(() => {
        setShowNew(true)
        setTyped('')
        setPhase('sent')
      }, 500)
      return () => clearTimeout(t)
    }
    const delay = 38 + Math.random() * 28
    const t = setTimeout(() => setTyped(target.slice(0, typed.length + 1)), delay)
    return () => clearTimeout(t)
  }, [phase, typed, conv.newMsg])

  /* Auto-advance */
  useEffect(() => {
    if (phase !== 'sent') return
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(() => setConvIdx((i) => (i + 1) % CONVERSATIONS.length), 420)
    }, 2200)
    return () => clearTimeout(t)
  }, [phase])

  return (
    <div
      data-testid='hero-app-preview'
      className='relative anim-fade-up'
      style={{ animationDelay: '600ms' }}
    >
      {/* Outer glow */}
      <div className='absolute -inset-6 rounded-[28px] bg-gradient-to-br from-[#a855f7]/30 via-[#a855f7]/15 to-transparent blur-2xl' />

      <div className='relative cyber-border rounded-[22px] glass-strong overflow-hidden'>
        {/* Window chrome */}
        <div className='flex items-center justify-between border-b border-white/8 px-4 py-3 bg-white/[0.02]'>
          <div className='flex items-center gap-2'>
            <span className='h-2.5 w-2.5 rounded-full bg-[#ff5f57]' />
            <span className='h-2.5 w-2.5 rounded-full bg-[#febc2e]' />
            <span className='h-2.5 w-2.5 rounded-full bg-[#28c840]' />
          </div>
          <span className='font-mono text-xs text-white/90'>echo://chat/zero-knowledge</span>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-[240px_1fr]'>
          {/* Sidebar */}
          <aside className='hidden lg:block border-r border-white/5 p-3 bg-white/[0.01]'>
            <div className='rounded-xl bg-white/[0.04] p-3'>
              <div className='text-[10px] uppercase tracking-wider text-[#a8a8b8] mb-2'>Pinned</div>
              {conv.sidebar.map((r) => (
                <div
                  key={r.name}
                  className={`mt-1.5 flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors ${
                    r.active
                      ? 'bg-gradient-to-r from-[#a855f7]/25 to-[#a855f7]/5'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div>
                    <div className={`text-[13px] ${r.active ? 'text-white' : 'text-[#e9e9ef]'}`}>
                      {r.name}
                    </div>
                    <div className='text-[11px] text-[#a8a8b8] truncate max-w-[150px]'>
                      {r.last}
                    </div>
                  </div>
                  {r.active && (
                    <span className='h-1.5 w-1.5 rounded-full bg-[#a855f7] flex-shrink-0' />
                  )}
                </div>
              ))}
            </div>
          </aside>

          {/* Chat area */}
          <div
            className='p-5 sm:p-7'
            style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.42s ease' }}
          >
            {/* Contact header */}
            <div className='flex items-center gap-3 pb-4 border-b border-white/5'>
              <div className='h-9 w-9 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a855f7] flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-[0_0_16px_rgba(168,85,247,0.4)]'>
                {conv.contact.name.match(/[A-Za-z🛡]/)?.[0] ?? 'E'}
              </div>
              <div>
                <div className='text-sm font-semibold text-white'>{conv.contact.name}</div>
                <div className='font-mono text-[11px] text-[#a8a8b8]'>{conv.contact.fp}</div>
              </div>
            </div>

            {/* Messages - Fixed height so window doesn't resize, messages push up */}
            <div className='mt-4 h-[210px] flex flex-col justify-end overflow-hidden relative'>
              {/* Top fade mask so messages disappear smoothly as they slide up */}
              <div className='pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#110e1b] to-transparent z-10' />

              <div className='flex flex-col space-y-3 pb-1'>
                {conv.history.map((m, i) => (
                  <Bubble key={`${convIdx}-${i}`} from={m.from} text={m.text} />
                ))}
                {showNew && <Bubble from='me' text={conv.newMsg} glow fresh />}
              </div>
            </div>

            {/* Input bar */}
            <div className='mt-5 flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5'>
              <span className='text-[#a855f7] text-sm'></span>
              <div className='flex-1 text-sm min-h-[20px]'>
                {phase === 'typing' ? (
                  <span className='text-white/90'>
                    {typed}
                    <span className='inline-block w-[2px] h-[13px] bg-[#a855f7] ml-[1px] align-middle animate-pulse rounded-full' />
                  </span>
                ) : (
                  <span className='text-[#a8a8b8]'>
                    {phase !== 'sent' && 'Type a message — encrypted before it leaves your device'}
                  </span>
                )}
              </div>
              <button
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition-all duration-300 ${
                  phase === 'typing'
                    ? 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7] shadow-[0_0_18px_rgba(168,85,247,0.55)] scale-105'
                    : 'bg-white/10'
                }`}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Bubble({ from, text, glow, fresh }) {
  const me = from === 'me'
  return (
    <div className={`flex ${me ? 'justify-end' : 'justify-start'} ${fresh ? 'anim-fade-up' : ''}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          me
            ? 'bg-gradient-to-br from-[#a855f7] to-[#8b5cf6] text-white shadow-[0_4px_20px_rgba(168,85,247,0.25)]'
            : 'bg-white/[0.09] border border-white/15 text-white'
        } ${glow ? 'shadow-[0_0_24px_rgba(168,85,247,0.45)]' : ''}`}
      >
        {text}
      </div>
    </div>
  )
}
