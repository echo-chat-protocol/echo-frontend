import { Check, Sparkles, Building2, Users, Lock, ArrowRight } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import { useState } from 'react'

/* =====================================================================
 *  Tier data — sourced from the ECHO commercial brief
 * ===================================================================== */
const buildPlans = (yearly) => [
  {
    id: 'personal',
    name: 'Personal',
    eyebrow: 'Freemium',
    desc: 'For individuals who refuse to be the product. Privacy-by-default, forever.',
    price: 0,
    currency: '€',
    suffix: 'Free, forever',
    sub: 'No card · No phone number',
    cta: 'Download ECHO',
    ctaHref: '/download',
    highlight: false,
    icon: Lock,
    features: [
      'Unlimited 1:1 & group chats',
      'Native E2EE via the Echo Protocol',
      'On-device key generation (we never see your keys)',
      'Encrypted multi-device sync (phone · tablet · desktop)',
      '5 GB encrypted personal vault for photos, audio & docs',
      'Community + email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro / Business',
    eyebrow: 'Most loved',
    desc: 'For SMEs, agencies and offices handling confidential information.',
    price: yearly ? 6 : 8,
    currency: '€',
    suffix: yearly ? '/ user / month · billed yearly' : '/ user / month',
    sub: yearly ? 'Equivalent to €72 / user / year' : 'Cancel any time',
    cta: 'Start 14-day trial',
    ctaHref: '/register',
    highlight: true,
    icon: Users,
    features: [
      'Everything in Personal',
      'Team admin console · onboard & offboard in seconds',
      'Remote device revocation if a device is lost or stolen',
      'Federated corporate identity (you@yourcompany.com)',
      'Priority relay · ultra-low latency (sub-50 ms)',
      'Preferential technical support · 4h SLA',
      '100 GB encrypted vault per user',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    eyebrow: 'Protocol as a Service',
    desc: 'Full ECHO Protocol embedded in your stack. Sovereign, audited, on-prem.',
    price: null,
    currency: '',
    suffix: 'Custom pricing',
    sub: 'Quote in 24 hours',
    cta: 'Enterprise details',
    ctaHref: '/docs',
    highlight: false,
    icon: Building2,
    features: [
      'Everything in Pro',
      'Embed the Echo Protocol in your own software via API / SDK',
      'On-premise self-hosted nodes for full data sovereignty',
      'SOC 2 & strict GDPR compliance pack',
      'Single Sign-On (Azure AD, Okta, Google Workspace…)',
      'Data Loss Prevention (DLP) policies',
      'Automated legal-hold message retention',
      'Hardware-key enforcement (YubiKey, FIDO2)',
      '99.99% SLA · 24/7 incident response',
      'Dedicated Trust Engineer assigned to your org',
    ],
  },
]

/* =====================================================================
 *  Page
 * ===================================================================== */
export default function PricingPage() {
  const [yearly, setYearly] = useState(true)
  const plans = buildPlans(yearly)

  return (
    <PageShell
      eyebrow='Pricing · Three tiers'
      icon={Sparkles}
      title={
        <>
          Pay for the engineering. <br className='hidden sm:block' />
          <span className='echo-gradient-text'>Never with your data.</span>
        </>
      }
      subtitle='ECHO is funded by users — not advertisers. Cancel any time, export everything, take your keys with you.'
      hideFooter
      hideDecorativeBg
      backgroundColor='#000'
    >
      {/* ============================================================
          Monthly / Yearly toggle
      ============================================================ */}
      <div className='flex justify-center -mt-2'>
        <div
          data-testid='pricing-toggle'
          className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1'
        >
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
              yearly ? 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white' : 'text-[#cfcfdc]'
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

      {/* ============================================================
          Plan cards
      ============================================================ */}
      <section className='mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch'>
        {plans.map((p, i) => {
          const Icon = p.icon
          return (
            <article
              key={p.id}
              data-testid={`pricing-card-${p.id}`}
              className={`relative rounded-[28px] p-7 flex flex-col anim-fade-up ${
                p.highlight
                  ? 'bg-[#0c0c10] border border-white/[0.08] shadow-[0_24px_70px_-45px_rgba(255,255,255,0.22)]'
                  : 'glass cyber-border shadow-[0_24px_70px_-45px_rgba(255,255,255,0.16)]'
              }`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {p.highlight && (
                <span
                  data-testid='pricing-most-loved'
                  className='absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-[#0b0b10] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/90'
                >
                  Most loved
                </span>
              )}

              <div className='flex items-center justify-between'>
                <div>
                  <div className='text-[11px] uppercase tracking-wider text-[#a0a0a0]'>
                    {p.eyebrow}
                  </div>
                  <h3 className='mt-1 text-2xl font-semibold tracking-tight'>{p.name}</h3>
                </div>
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                    p.highlight ? 'bg-white/[0.08]' : 'bg-white/[0.08]'
                  }`}
                >
                  <Icon className='h-5 w-5 text-white' />
                </span>
              </div>

              <p className='mt-3 text-sm text-[#a8a8b8] leading-relaxed min-h-[48px]'>{p.desc}</p>

              {/* Price */}
              <div className='mt-6 flex items-end gap-2'>
                {p.price === null ? (
                  <span className='text-4xl font-semibold'>Custom pricing</span>
                ) : (
                  <>
                    <span className='text-5xl font-semibold tracking-tight'>
                      {p.currency}
                      {p.price}
                    </span>
                    <span className='pb-1.5 text-sm text-[#a0a0a0]'>{p.suffix}</span>
                  </>
                )}
              </div>
              {p.sub && <div className='text-[11px] text-[#7a7a8a]'>{p.sub}</div>}

              <div className='my-6 divider-glow' />

              {/* Features */}
              <ul className='space-y-3 text-sm text-[#cfcfdc] flex-1'>
                {p.features.map((f, idx) => (
                  <li key={f} className='flex items-start gap-2.5'>
                    <span className='mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full shrink-0 bg-white/[0.85]'>
                      <Check className='h-2.5 w-2.5 text-[#111]' strokeWidth={3} />
                    </span>
                    <span className={idx === 0 ? 'font-medium text-white' : ''}>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                data-testid={`pricing-cta-${p.id}`}
                href={p.ctaHref}
                className={`mt-7 ${p.highlight ? 'btn-primary' : 'btn-ghost'}`}
              >
                {p.cta}
                <ArrowRight className='h-4 w-4' />
              </a>
            </article>
          )
        })}
      </section>

      <div className='h-4' />
    </PageShell>
  )
}
