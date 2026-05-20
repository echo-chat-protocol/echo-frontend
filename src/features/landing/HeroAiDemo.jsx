import { useEffect, useState } from 'react'
import { Bot, Lock } from 'lucide-react'

const SAMPLES = [
  {
    you: 'Summarize my last encrypted chat with Aïsha.',
    ai: 'Aïsha confirmed the keyshare is ready. AES-256-GCM nonce was generated on-device. No plaintext leaves your phone.',
  },
  {
    you: 'Translate the last message from Ops to Spanish.',
    ai: '"Video call ended · 12:42" → "Videollamada finalizada · 12:42". Translation handled locally. Zero cloud.',
  },
  {
    you: 'Find the latest encrypted file from the Red Team.',
    ai: '1 image located in your local encrypted index. Ready to view in the sealed vault?',
  },
]

export default function HeroAiDemo() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % SAMPLES.length), 4200)
    return () => clearInterval(t)
  }, [])

  const sample = SAMPLES[idx]

  return (
    <section
      data-testid='hero-ai-demo'
      className='relative py-24 sm:py-32 section-fade overflow-hidden'
    >
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center'>
        <div className='lg:col-span-5'>
          <h2 className='mt-5 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]'>
            On-device AI that <br />
            <span className='echo-gradient-text'>never reads the cloud.</span>
          </h2>
          <p className='mt-5 text-[#b9b9c4] leading-relaxed'>
            ECHO ships with a quantized assistant that runs entirely inside the secure enclave of
            your device. Summaries, translations and search — without a single byte of plaintext
            crossing the wire.
          </p>
          <ul className='mt-6 space-y-3 text-sm text-[#cfcfdc]'>
            {[
              'Private summarisation of encrypted chats',
              'Air-gapped translation for 38 languages',
              'Local semantic search across your vault',
            ].map((t) => (
              <li key={t} className='flex items-center gap-3'>
                <span className='inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a855f7] text-[10px] text-white'>
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Demo card */}
        <div className='lg:col-span-7 relative'>
          <div className='absolute -inset-3 rounded-[24px] bg-gradient-to-br from-[#a855f7]/30 via-transparent to-[#a855f7]/30 blur-2xl' />
          <div className='relative glass cyber-border p-5 sm:p-7 rounded-[20px]'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2 text-sm'>
                <Bot className='h-4 w-4 text-[#a855f7]' />
                <span className='font-medium'>ECHO Assistant</span>
              </div>
              <span className='inline-flex items-center gap-1.5 text-[11px] text-[#a0a0a0]'>
                <Lock className='h-3 w-3' /> on-device · sealed
              </span>
            </div>

            <div className='mt-5 space-y-3'>
              <div className='flex justify-end'>
                <div className='max-w-[80%] rounded-2xl bg-gradient-to-br from-[#a855f7] to-[#8b5cf6] px-4 py-2.5 text-sm text-white'>
                  {sample.you}
                </div>
              </div>
              <div className='flex justify-start'>
                <div
                  key={idx}
                  className='anim-fade-up max-w-[85%] rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-[#e9e9ef] leading-relaxed'
                >
                  <span className='font-mono text-[11px] text-[#a855f7]'>{'> echo.local'}</span>
                  <div className='mt-1'>{sample.ai}</div>
                </div>
              </div>
            </div>

            <div className='mt-6 flex items-center gap-2'>
              {SAMPLES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i === idx
                      ? 'w-8 bg-gradient-to-r from-[#7c3aed] to-[#a855f7]'
                      : 'w-3 bg-white/15'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
