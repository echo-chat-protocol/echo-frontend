import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Check, Building2 } from 'lucide-react'

const PLANS = (yearly) => [
  {
    name: 'Personal',
    desc: 'For individuals who refuse to be the product.',
    price: yearly ? 0 : 0,
    suffix: 'Free, forever',
    features: [
      'Unlimited 1:1 & Group chats',
      'AES-256-GCM sealed messages',
      'On-device key generation',
      '5 GB encrypted vault',
      'Community support',
    ],
    cta: 'Download ECHO',
    highlight: false,
  },
  {
    name: 'Pro',
    desc: 'For power users, researchers and journalists.',
    price: yearly ? 6 : 8,
    suffix: yearly ? '/ month · billed yearly' : '/ month',
    features: [
      'Everything in Personal',
      '100 GB encrypted vault',
      'Federated identity & custom domain',
      'Priority relay (sub-50ms)',
      'Cross-device key sync (sealed)',
      'Email support',
    ],
    cta: 'Start 14-day trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    desc: 'Self-hosted, federated, audited. SOC 2 ready.',
    price: null,
    suffix: 'Custom pricing',
    features: [
      'Self-hosted ECHO node',
      'SCIM / SSO (OIDC)',
      'DLP & retention policies',
      'Hardware-key (YubiKey) enforcement',
      'Dedicated Trust Engineer',
      'SLA & 24/7 incident response',
    ],
    cta: 'Talk to sales',
    highlight: false,
  },
]

export default function Pricing() {
  const [yearly, setYearly] = useState(true)
  const plans = PLANS(yearly)

  return (
    <section
      id='pricing'
      data-testid='pricing-section'
      className='relative py-24 sm:py-32 section-fade overflow-hidden'
    >
      <div className='absolute inset-0'>
        <div className='aurora-bg opacity-40' />
      </div>

      <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='text-center max-w-3xl mx-auto'>
          <h2 className='mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.02]'>
            Pay for the engineering. <br />
            <span className='echo-gradient-text'>Never with your data.</span>
          </h2>
          <p className='mt-5 text-[#b9b9c4]'>
            ECHO is funded by users — not advertisers. Cancel any time, export everything, take your
            keys with you.
          </p>

          {/* Yearly / monthly */}
          <div className='mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1'>
            <button
              data-testid='pricing-toggle-monthly'
              onClick={() => setYearly(false)}
              className={`rounded-full px-4 py-1.5 text-sm transition-all ${
                !yearly ? 'bg-white text-black' : 'text-[#cfcfdc]'
              }`}
            >
              Monthly
            </button>
            <button
              data-testid='pricing-toggle-yearly'
              onClick={() => setYearly(true)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-all ${
                yearly
                  ? 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white'
                  : 'text-[#cfcfdc]'
              }`}
            >
              Yearly
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  yearly ? 'bg-white/20' : 'bg-[#a855f7]/30 text-[#e9d5ff]'
                }`}
              >
                –25%
              </span>
            </button>
          </div>
        </div>

        <div className='mt-14 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch'>
          {plans.map((p) => (
            <article
              key={p.name}
              data-testid={`pricing-card-${p.name.toLowerCase()}`}
              className={`relative rounded-[20px] p-7 flex flex-col ${
                p.highlight
                  ? 'pricing-pop bg-[#0c0c14] border border-transparent'
                  : 'glass cyber-border'
              }`}
            >
              {p.highlight && (
                <span className='absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#a855f7] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white'>
                  Most loved
                </span>
              )}
              <div className='flex items-center justify-between'>
                <h3 className='text-xl font-semibold tracking-tight'>{p.name}</h3>
                {p.name === 'Enterprise' && <Building2 className='h-5 w-5 text-[#a855f7]' />}
              </div>
              <p className='mt-2 text-sm text-[#a8a8b8] min-h-[42px]'>{p.desc}</p>

              <div className='mt-6 flex items-end gap-2'>
                {p.price === null ? (
                  <span className='text-3xl font-semibold'>Let&apos;s talk</span>
                ) : (
                  <>
                    <span className='text-5xl font-semibold tracking-tight'>${p.price}</span>
                    <span className='pb-1.5 text-sm text-[#a0a0a0]'>
                      {p.price === 0 ? p.suffix : p.suffix}
                    </span>
                  </>
                )}
              </div>
              {p.price !== null && p.price > 0 && (
                <div className='text-[11px] text-[#7a7a8a]'>
                  {yearly
                    ? `Equivalent to $${(p.price * 12).toFixed(0)} / year`
                    : 'Cancel any time'}
                </div>
              )}

              <div className='my-6 divider-glow' />

              <ul className='space-y-3 text-sm text-[#cfcfdc] flex-1'>
                {p.features.map((f) => (
                  <li key={f} className='flex items-start gap-2.5'>
                    <span className='mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a855f7]'>
                      <Check className='h-2.5 w-2.5 text-white' strokeWidth={3} />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                data-testid={`pricing-cta-${p.name.toLowerCase()}`}
                to={p.name === 'Enterprise' ? '/contact?reason=sales' : '/pricing'}
                className={`mt-7 ${p.highlight ? 'btn-primary' : 'btn-ghost'}`}
              >
                {p.name === 'Enterprise' ? 'Enterprise sales' : p.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
