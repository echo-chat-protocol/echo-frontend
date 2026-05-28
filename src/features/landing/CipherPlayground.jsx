import { useMemo, useState } from 'react'
import { KeyRound, Lock, Unlock, RefreshCw, Copy, Check } from 'lucide-react'

/**
 * Toy cipher — DEMO ONLY (XOR + base64 with a derived stream from the key).
 * Visualises the idea of E2EE; not real cryptography.
 */
function deriveStream(key, len) {
  const base = key && key.length ? key : 'echo-default-key'
  const out = new Uint8Array(len)
  let h = 2166136261
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  for (let i = 0; i < len; i++) {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    out[i] = (h >>> 0) & 0xff
  }
  return out
}

function encryptDemo(text, key) {
  const enc = new TextEncoder().encode(text)
  const stream = deriveStream(key, enc.length)
  const cipher = enc.map((b, i) => b ^ stream[i])
  // base64
  let s = ''
  for (let i = 0; i < cipher.length; i++) s += String.fromCharCode(cipher[i])
  return btoa(s)
}

export default function CipherPlayground() {
  const [text, setText] = useState('Meet me at the safehouse, 22:00.')
  const [key, setKey] = useState('zero-knowledge')
  const [copied, setCopied] = useState(false)

  const cipher = useMemo(() => encryptDemo(text, key), [text, key])

  // bytes for visualisation
  const bytes = useMemo(() => {
    const enc = new TextEncoder().encode(text)
    const stream = deriveStream(key, enc.length)
    return Array.from(enc).map((b, i) => ({
      plain: b,
      cipher: b ^ stream[i],
    }))
  }, [text, key])

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(cipher)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* ignore */
    }
  }

  const rotate = () => {
    const rand = Math.random().toString(36).slice(2, 12)
    setKey(rand)
  }

  return (
    <section
      id='playground'
      data-testid='cipher-playground'
      className='relative py-24 sm:py-32 section-fade overflow-hidden'
    >
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='max-w-3xl'>
          <h2 className='mt-5 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]'>
            See your message <br />
            <span className='echo-gradient-text'>disappear into ciphertext.</span>
          </h2>
          <p className='mt-5 text-[#b9b9c4] leading-relaxed'>
            Type anything below. Watch every byte get XOR-ed with a derived keystream in real time.
            A toy demo of what real <span className='font-mono text-[#e9d5ff]'>AES-256-GCM</span>{' '}
            does inside ECHO — millions of times per second.
          </p>
        </div>

        <div className='mt-12 grid lg:grid-cols-2 gap-6'>
          {/* Plain side */}
          <div className='glass cyber-border rounded-2xl p-5'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2 text-sm'>
                <Unlock className='h-4 w-4 text-[#a855f7]' />
                <span className='font-medium'>Plaintext</span>
              </div>
              <span className='text-[11px] text-[#a0a0a0]'>stays on your device</span>
            </div>
            <textarea
              data-testid='cipher-plain-input'
              className='mt-4 w-full min-h-[120px] resize-none rounded-xl border border-white/10 bg-black/40 p-4 text-sm leading-relaxed text-white outline-none focus:border-[#a855f7]/50'
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Write a secret message…'
            />

            <div className='mt-4'>
              <label className='text-[11px] uppercase tracking-wider text-[#8a8a99]'>
                Symmetric key
              </label>
              <div className='mt-2 flex items-center gap-2'>
                <div className='flex-1 flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3'>
                  <KeyRound className='h-4 w-4 text-[#a855f7]' />
                  <input
                    data-testid='cipher-key-input'
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    className='w-full bg-transparent py-2.5 font-mono text-sm text-[#e9d5ff] outline-none'
                  />
                </div>
                <button
                  data-testid='cipher-rotate-key'
                  onClick={rotate}
                  className='btn-ghost !py-2 !px-3'
                  title='Rotate key'
                >
                  <RefreshCw className='h-4 w-4' />
                </button>
              </div>
            </div>
          </div>

          {/* Cipher side */}
          <div className='glass cyber-border rounded-2xl p-5'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2 text-sm'>
                <Lock className='h-4 w-4 text-[#a855f7]' />
                <span className='font-medium'>Ciphertext (base64)</span>
              </div>
              <button
                data-testid='cipher-copy'
                onClick={onCopy}
                className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] hover:border-[#a855f7]/40'
              >
                {copied ? (
                  <>
                    <Check className='h-3 w-3 text-[#a8f0c2]' /> Copied
                  </>
                ) : (
                  <>
                    <Copy className='h-3 w-3' /> Copy
                  </>
                )}
              </button>
            </div>

            <div
              data-testid='cipher-output'
              className='mt-4 min-h-[120px] rounded-xl border border-[#a855f7]/25 bg-gradient-to-br from-[#a855f7]/10 to-[#a855f7]/5 p-4 font-mono text-sm leading-relaxed text-[#c4a8ff] break-all'
            >
              {cipher || '—'}
            </div>

            <div className='mt-4'>
              <div className='text-[11px] uppercase tracking-wider text-[#8a8a99] mb-2'>
                Byte-level transform
              </div>
              <div
                data-testid='cipher-byte-grid'
                className='flex flex-wrap gap-1.5 max-h-[120px] overflow-auto pr-1'
              >
                {bytes.slice(0, 96).map((b, i) => (
                  <div key={i} className='flex flex-col items-center gap-0.5'>
                    <span className='font-mono text-[10px] text-[#8a8a99]'>
                      {b.plain.toString(16).padStart(2, '0')}
                    </span>
                    <span
                      className='font-mono text-[10px] px-1 py-0.5 rounded'
                      style={{
                        background: `rgba(168,85,247,${0.18 + (b.cipher / 255) * 0.55})`,
                        color: '#fff',
                      }}
                    >
                      {b.cipher.toString(16).padStart(2, '0')}
                    </span>
                  </div>
                ))}
                {bytes.length > 96 && (
                  <span className='text-[11px] text-[#8a8a99] self-end'>
                    …+{bytes.length - 96} bytes
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className='mt-6 text-center text-[11px] text-[#7a7a8a]'>
          Demo only. Real ECHO uses AES-256-GCM with per-message nonces and authenticated encryption
          via WASM. No XOR, no shortcuts.
        </p>
      </div>
    </section>
  )
}
