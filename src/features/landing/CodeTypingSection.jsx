import React, { useEffect, useState } from 'react'

const SCRIPT = [
  { type: 'comment', text: '// Initialise an ECHO secure channel' },
  { type: 'code', text: "import { Echo } from '@echo/sdk'" },
  { type: 'code', text: '' },
  {
    type: 'code',
    text: 'const channel = await Echo.openChannel({',
  },
  { type: 'code', text: '  identity: await Echo.keyring.local(),', indent: 1 },
  { type: 'code', text: "  cipher: 'xchacha20-poly1305',", indent: 1 },
  { type: 'code', text: "  kex: 'hybrid:kyber768+x25519',", indent: 1 },
  { type: 'code', text: "  metadata: 'sealed'", indent: 1 },
  { type: 'code', text: '})' },
  { type: 'code', text: '' },
  {
    type: 'code',
    text: "await channel.send('Welcome to ECHO ')",
  },
  { type: 'comment', text: '// → ciphertext: 7fA8…e2c · 0 plaintext bytes left the device' },
]

const FULL_TEXT = SCRIPT.map((l) => `${'  '.repeat(l.indent || 0)}${l.text}`).join('\n')

export default function CodeTypingSection() {
  const [out, setOut] = useState('')

  useEffect(() => {
    let i = 0
    const total = FULL_TEXT.length
    let raf
    const step = () => {
      i = Math.min(total, i + Math.max(1, Math.floor(Math.random() * 3)))
      setOut(FULL_TEXT.slice(0, i))
      if (i < total) {
        raf = setTimeout(step, 25 + Math.random() * 35)
      } else {
        // restart after a pause
        raf = setTimeout(() => {
          i = 0
          setOut('')
          step()
        }, 3500)
      }
    }
    step()
    return () => clearTimeout(raf)
  }, [])

  // Re-render with syntax highlighting after typing
  const lines = out.split('\n')

  return (
    <section
      id='docs'
      data-testid='code-typing-section'
      className='relative py-24 sm:py-32 section-fade overflow-hidden'
    >
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center'>
        <div className='lg:col-span-5'>
          <h2 className='mt-5 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]'>
            A 6-line SDK to make <br />
            <span className='echo-gradient-text'>anything end-to-end encrypted.</span>
          </h2>
          <p className='mt-5 text-[#b9b9c4] leading-relaxed'>
            Drop the ECHO SDK into your stack and ship hardened messaging, video, file sharing or
            telemetry. TypeScript, Rust, Swift and Kotlin — all sharing a single audited
            cryptographic core.
          </p>
          <div className='mt-7 flex flex-wrap gap-2 font-mono text-[11px]'>
            {['@echo/sdk', '@echo/web', 'echo-rs', 'echo-swift', 'echo-kotlin'].map((p) => (
              <span
                key={p}
                className='rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[#cfcfdc]'
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        <div className='lg:col-span-7'>
          <div className='echo-code-window h-[clamp(320px,42vw,460px)]'>
            <header>
              <span className='echo-code-dot bg-[#ff5f57]' />
              <span className='echo-code-dot bg-[#febc2e]' />
              <span className='echo-code-dot bg-[#28c840]' />
              <span className='ml-3 font-mono text-xs text-[#a0a0a0]'>
                ~/projects/echo · pnpm dev
              </span>
            </header>
            <pre className='font-mono text-[13px] sm:text-[14px] leading-[1.65] p-5 sm:p-6 text-[#e9e9ef] whitespace-pre overflow-auto h-full'>
              {lines.map((line, i) => (
                <div key={i}>
                  <Highlight line={line} />
                </div>
              ))}
              <span className='cursor-blink text-[#a855f7]'>▍</span>
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}

function Highlight({ line }) {
  if (line.trim().startsWith('//')) {
    return <span className='echo-syntax-comment'>{line}</span>
  }
  const KW = ['import', 'from', 'const', 'await', 'return', 'function']
  // Highlight strings
  const stringRegex = /'([^']*)'/g
  let last = 0
  let match
  const segs = []
  while ((match = stringRegex.exec(line)) !== null) {
    if (match.index > last) segs.push({ t: 'code', v: line.slice(last, match.index) })
    segs.push({ t: 'string', v: match[0] })
    last = match.index + match[0].length
  }
  if (last < line.length) segs.push({ t: 'code', v: line.slice(last) })

  return (
    <>
      {segs.map((s, idx) => {
        if (s.t === 'string')
          return (
            <span key={idx} className='echo-syntax-string'>
              {s.v}
            </span>
          )
        // word-level keyword highlight
        const tokens = s.v.split(/(\b)/)
        return (
          <React.Fragment key={idx}>
            {tokens.map((t, k) => {
              if (KW.includes(t))
                return (
                  <span key={k} className='echo-syntax-keyword'>
                    {t}
                  </span>
                )
              if (/^[A-Z]\w*/.test(t))
                return (
                  <span key={k} className='echo-syntax-fn'>
                    {t}
                  </span>
                )
              return <span key={k}>{t}</span>
            })}
          </React.Fragment>
        )
      })}
    </>
  )
}
