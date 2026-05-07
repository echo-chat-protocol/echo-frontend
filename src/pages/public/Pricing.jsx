import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ArrowRight, Zap, Shield, Building2, ChevronDown } from 'lucide-react'
import Navbar from '../components/HomepageComponents/Navbar'
import Footer from '../components/HomepageComponents/Footer'

/*  animation helper  */
const fu = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, delay },
})

/*  data  */
const plans = [
  {
    name: 'Free',
    icon: Zap,
    monthly: 0,
    description: 'Perfect for individuals and small teams getting started with secure messaging.',
    users: 'Up to 5 users',
    cta: 'Get started free',
    ctaLink: '/register',
    highlighted: false,
    badge: null,
    features: [
      'End-to-end encryption',
      'Up to 5 team members',
      '5 GB storage',
      'Basic messaging & channels',
      'Mobile & desktop apps',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    icon: Shield,
    monthly: 12,
    description:
      'For growing teams that need advanced security, integrations, and priority support.',
    users: 'Per user / month',
    cta: 'Start free trial',
    ctaLink: '/register',
    highlighted: true,
    badge: 'Most Popular',
    features: [
      'Everything in Free',
      'Unlimited team members',
      '100 GB storage per user',
      'Advanced encryption keys',
      'Guest access & permissions',
      'REST API & webhooks',
      'SSO / SAML integration',
      'Audit logs (90 days)',
      'Priority support (24 h SLA)',
      'Custom branding',
    ],
  },
  {
    name: 'Enterprise',
    icon: Building2,
    monthly: null,
    description:
      'Custom deployment for large organisations with compliance and security requirements.',
    users: '50+ users',
    cta: 'Contact sales',
    ctaLink: '/contact-us',
    highlighted: false,
    badge: null,
    features: [
      'Everything in Pro',
      'Unlimited storage',
      'On-premise deployment',
      'White-label options',
      'Dedicated account manager',
      'Custom SLA & uptime guarantee',
      'Advanced admin panel',
      'Compliance reports (SOC 2, HIPAA)',
      'Audit logs (unlimited)',
      '24/7 phone & email support',
    ],
  },
]

const comparisonRows = [
  { label: 'Team members', free: 'Up to 5', pro: 'Unlimited', enterprise: 'Unlimited' },
  { label: 'Storage', free: '5 GB total', pro: '100 GB/user', enterprise: 'Unlimited' },
  { label: 'End-to-end encryption', free: true, pro: true, enterprise: true },
  { label: 'Mobile & desktop apps', free: true, pro: true, enterprise: true },
  { label: 'API & webhooks', free: false, pro: true, enterprise: true },
  { label: 'SSO / SAML', free: false, pro: true, enterprise: true },
  { label: 'Guest access', free: false, pro: true, enterprise: true },
  { label: 'Custom branding', free: false, pro: true, enterprise: true },
  { label: 'Audit logs', free: false, pro: '90 days', enterprise: 'Unlimited' },
  { label: 'On-premise deploy', free: false, pro: false, enterprise: true },
  { label: 'Dedicated support', free: false, pro: false, enterprise: true },
  { label: 'Compliance reports', free: false, pro: false, enterprise: true },
]

const faqs = [
  {
    q: 'Can I switch plans at any time?',
    a: 'Yes. Upgrades take effect immediately and are prorated. Downgrades apply at the start of your next billing cycle.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept Visa, Mastercard, American Express, PayPal, Apple Pay, Google Pay, and bank transfers for Enterprise plans  all processed securely via Stripe.',
  },
  {
    q: 'Is there a free trial for Pro?',
    a: 'Every Pro and Enterprise plan includes a 14-day full-feature trial. No credit card required to start.',
  },
  {
    q: 'What does end-to-end encryption mean for my data?',
    a: 'All messages are encrypted on your device before transmission using the Signal Protocol. Not even Echo can read your messages.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'Yes  we offer a 30-day money-back guarantee on all paid plans, no questions asked.',
  },
  {
    q: 'Can I deploy Echo on my own servers?',
    a: 'On-premise deployment is available on the Enterprise plan. Contact our sales team for setup and licensing details.',
  },
]

// icon = Simple Icons slug (https://simpleicons.org) · null = text wordmark
const companies = [
  { name: 'IBM', icon: 'ibm' },
  { name: 'Cisco', icon: 'cisco' },
  { name: 'Cloudflare', icon: 'cloudflare' },
  { name: 'Stripe', icon: 'stripe' },
  { name: 'Twilio', icon: 'twilio' },
  { name: 'HashiCorp', icon: 'hashicorp' },
  { name: 'MongoDB', icon: 'mongodb' },
  { name: 'Elastic', icon: 'elastic' },
  { name: 'Datadog', icon: 'datadog' },
  { name: 'Snowflake', icon: 'snowflake' },
  { name: 'Okta', icon: 'okta' },
  { name: 'Palantir', icon: 'palantir' },
  { name: 'Accenture', icon: null },
  { name: 'Deloitte', icon: null },
  { name: 'KPMG', icon: null },
  { name: 'PwC', icon: null },
]

const LogoItem = ({ c, opacity }) => (
  <div className='flex items-center justify-center h-10 select-none flex-shrink-0 px-2'>
    {c.icon ? (
      <img
        src={`https://cdn.simpleicons.org/${c.icon}/ffffff`}
        alt={c.name}
        width={72}
        height={28}
        className='object-contain max-h-7'
        style={{ opacity, filter: 'brightness(0) invert(1)' }}
        onError={(e) => {
          const txt = e.currentTarget.nextSibling
          e.currentTarget.style.display = 'none'
          if (txt) txt.style.display = 'block'
        }}
      />
    ) : null}
    <span
      className='text-xs font-bold tracking-[0.15em] uppercase whitespace-nowrap'
      style={{ display: c.icon ? 'none' : 'block', color: `rgba(255,255,255,${opacity})` }}
    >
      {c.name}
    </span>
  </div>
)

/*  component  */
const Pricing = () => {
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [openFaq, setOpenFaq] = useState(null)

  const getPrice = (monthly) => {
    if (monthly === null || monthly === 0) return monthly
    return billingPeriod === 'yearly' ? Math.round(monthly * 0.8) : monthly
  }

  return (
    <div className='min-h-screen bg-neutral-950 text-white overflow-x-hidden'>
      {/* marquee keyframes */}
      <style>{`
        @keyframes marquee     { from { transform: translateX(0)    } to { transform: translateX(-50%) } }
        @keyframes marquee-rev { from { transform: translateX(-50%) } to { transform: translateX(0)    } }
        .echo-marquee     { animation: marquee     35s linear infinite; }
        .echo-marquee-rev { animation: marquee-rev 42s linear infinite; }
      `}</style>

      <Navbar />

      {/* == HERO ================================================== */}
      <section className='relative pt-44 pb-28 overflow-hidden'>
        {/* grid bg */}
        <div className='absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:72px_72px]' />
        {/* glow */}
        <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none' />

        <div className='relative z-10 max-w-5xl mx-auto px-6 text-center'>
          <motion.p {...fu(0)} className='text-xs uppercase tracking-[0.2em] text-white/25 mb-6'>
            Pricing
          </motion.p>
          <motion.h1
            {...fu(0.05)}
            className='text-6xl sm:text-8xl font-extrabold tracking-tighter leading-none mb-6'
          >
            Security that
            <br />
            <span className='text-violet-400'>scales with you</span>
          </motion.h1>
          <motion.p {...fu(0.1)} className='text-lg text-white/40 max-w-xl mx-auto mb-12'>
            Transparent pricing. No hidden fees. Cancel or switch plans at any time.
          </motion.p>

          {/* billing toggle */}
          <motion.div
            {...fu(0.15)}
            className='inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10'
          >
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-black'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                billingPeriod === 'yearly'
                  ? 'bg-white text-black'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Yearly
              <span className='text-xs font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30'>
                -20%
              </span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* == PLANS ================================================= */}
      <section className='relative pb-24 px-6'>
        <div className='max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch'>
          {plans.map((plan, i) => {
            const price = getPrice(plan.monthly)
            const Icon = plan.icon
            return (
              <motion.div
                key={plan.name}
                {...fu(i * 0.08)}
                className={`relative flex flex-col rounded-2xl p-8 border transition-all duration-300 ${
                  plan.highlighted
                    ? 'border-violet-500/50 bg-gradient-to-b from-violet-950/40 to-neutral-950 shadow-[0_0_70px_-10px_rgba(139,92,246,0.3)]'
                    : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15'
                }`}
              >
                {/* popular badge */}
                {plan.badge && (
                  <div className='absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold bg-violet-600 text-white tracking-wide whitespace-nowrap'>
                    {plan.badge}
                  </div>
                )}

                {/* icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 ${
                    plan.highlighted ? 'bg-violet-500/20' : 'bg-white/5'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${plan.highlighted ? 'text-violet-400' : 'text-white/40'}`}
                  />
                </div>

                <h3 className='text-xl font-bold mb-1'>{plan.name}</h3>
                <p className='text-sm text-white/40 mb-6 leading-relaxed'>{plan.description}</p>

                {/* price */}
                <div className='mb-8'>
                  {price === null ? (
                    <p className='text-5xl font-extrabold tracking-tighter'>Custom</p>
                  ) : price === 0 ? (
                    <p className='text-5xl font-extrabold tracking-tighter'>Free</p>
                  ) : (
                    <div className='flex items-end gap-1'>
                      <span className='text-5xl font-extrabold tracking-tighter'>${price}</span>
                      <span className='text-white/40 mb-2 text-sm'>/user/mo</span>
                    </div>
                  )}
                  {billingPeriod === 'yearly' && price !== null && price !== 0 && (
                    <p className='text-xs text-white/30 mt-1'>Billed annually · save 20%</p>
                  )}
                  <p className='text-xs text-white/30 mt-1'>{plan.users}</p>
                </div>

                {/* cta */}
                <Link
                  to={plan.ctaLink}
                  className={`w-full text-center py-3 rounded-xl font-semibold text-sm transition-all duration-200 mb-8 block ${
                    plan.highlighted
                      ? 'bg-violet-600 hover:bg-violet-500 text-white'
                      : 'bg-white/[0.08] hover:bg-white/[0.12] text-white'
                  }`}
                >
                  {plan.cta}
                </Link>

                {/* features */}
                <ul className='space-y-3 mt-auto'>
                  {plan.features.map((f, fi) => (
                    <li key={fi} className='flex items-start gap-3 text-sm text-white/55'>
                      <Check className='w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5' />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* == PAYMENT METHODS ======================================= */}
      <section className='py-16 border-y border-white/[0.06]'>
        <div className='max-w-4xl mx-auto px-6'>
          <motion.p
            {...fu(0)}
            className='text-center text-xs uppercase tracking-[0.2em] text-white/20 mb-8'
          >
            Secure checkout via
          </motion.p>
          <motion.div {...fu(0.05)} className='flex flex-wrap justify-center gap-3'>
            {/* Visa */}
            <div className='flex items-center justify-center px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 min-w-[80px]'>
              <span className='text-base font-extrabold italic tracking-tight text-white'>
                VISA
              </span>
            </div>

            {/* Mastercard */}
            <div className='flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10'>
              <div className='flex -space-x-2.5'>
                <div className='w-6 h-6 rounded-full bg-[#eb001b]' />
                <div className='w-6 h-6 rounded-full bg-[#f79e1b]' />
              </div>
              <span className='text-xs font-semibold text-white/60'>Mastercard</span>
            </div>

            {/* PayPal */}
            <div className='flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10'>
              <span className='font-extrabold text-sm leading-none'>
                <span style={{ color: '#009cde' }}>Pay</span>
                <span style={{ color: '#fff', opacity: 0.9 }}>Pal</span>
              </span>
            </div>

            {/* Apple Pay */}
            <div className='flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10'>
              <svg className='w-5 h-5 fill-white' viewBox='0 0 24 24'>
                <path d='M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z' />
              </svg>
              <span className='text-xs font-semibold text-white/60'>Apple Pay</span>
            </div>

            {/* Google Pay */}
            <div className='flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10'>
              <span className='text-sm font-bold leading-none'>
                <span style={{ color: '#4285F4' }}>G</span>
                <span style={{ color: '#EA4335' }}>o</span>
                <span style={{ color: '#FBBC05' }}>o</span>
                <span style={{ color: '#4285F4' }}>g</span>
                <span style={{ color: '#34A853' }}>l</span>
                <span style={{ color: '#EA4335' }}>e</span>
              </span>
              <span className='text-xs font-semibold text-white/60'>Pay</span>
            </div>

            {/* Stripe */}
            <div className='flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#635bff]/10 border border-[#635bff]/30'>
              <span className='text-sm font-extrabold' style={{ color: '#635bff' }}>
                stripe
              </span>
            </div>

            {/* Amex */}
            <div className='flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#016fd0]/10 border border-[#016fd0]/30'>
              <span className='text-xs font-bold tracking-widest' style={{ color: '#016fd0' }}>
                AMEX
              </span>
            </div>

            {/* SEPA */}
            <div className='flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10'>
              <span className='text-xs font-bold text-white/50 tracking-wider'>SEPA</span>
            </div>
          </motion.div>
          <motion.p {...fu(0.1)} className='text-center text-xs text-white/20 mt-6'>
            All transactions secured and processed via Stripe · PCI DSS Level 1 certified
          </motion.p>
        </div>
      </section>

      {/* == COMPARISON TABLE ====================================== */}
      <section className='py-24 px-6'>
        <div className='max-w-5xl mx-auto'>
          <motion.p
            {...fu(0)}
            className='text-xs uppercase tracking-[0.2em] text-white/25 text-center mb-4'
          >
            Compare plans
          </motion.p>
          <motion.h2
            {...fu(0.05)}
            className='text-4xl sm:text-5xl font-extrabold tracking-tighter text-center mb-16'
          >
            Everything side by side
          </motion.h2>

          <motion.div
            {...fu(0.1)}
            className='rounded-2xl border border-white/[0.08] overflow-hidden'
          >
            {/* header row */}
            <div className='grid grid-cols-4 bg-white/[0.03] border-b border-white/[0.08]'>
              <div className='p-5 text-xs uppercase tracking-widest text-white/25'>Feature</div>
              {plans.map((p) => (
                <div
                  key={p.name}
                  className={`p-5 text-center text-sm font-bold ${
                    p.highlighted ? 'text-violet-400' : 'text-white/50'
                  }`}
                >
                  {p.name}
                </div>
              ))}
            </div>
            {/* data rows */}
            {comparisonRows.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-4 border-b border-white/[0.05] last:border-0 ${
                  i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'
                }`}
              >
                <div className='p-4 text-sm text-white/45 flex items-center'>{row.label}</div>
                {['free', 'pro', 'enterprise'].map((key) => (
                  <div key={key} className='p-4 flex items-center justify-center'>
                    {typeof row[key] === 'boolean' ? (
                      row[key] ? (
                        <Check className='w-4 h-4 text-violet-400' />
                      ) : (
                        <span className='block w-4 h-px bg-white/15 rounded-full' />
                      )
                    ) : (
                      <span className='text-xs text-white/55 text-center'>{row[key]}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* == COMPANIES CAROUSEL ==================================== */}
      <section className='py-16 border-y border-white/[0.06] overflow-hidden'>
        <div className='max-w-5xl mx-auto px-6 mb-10'>
          <motion.p
            {...fu(0)}
            className='text-center text-xs uppercase tracking-[0.2em] text-white/20'
          >
            Trusted by teams at
          </motion.p>
        </div>

        {/* row 1 - left */}
        <div className='overflow-hidden mb-6'>
          <div className='echo-marquee flex items-center gap-10 w-max'>
            {[...companies, ...companies].map((c, i) => (
              <LogoItem key={i} c={c} opacity={0.3} />
            ))}
          </div>
        </div>

        {/* row 2 - reverse */}
        <div className='overflow-hidden'>
          <div className='echo-marquee-rev flex items-center gap-10 w-max'>
            {[...companies.slice().reverse(), ...companies.slice().reverse()].map((c, i) => (
              <LogoItem key={i} c={c} opacity={0.18} />
            ))}
          </div>
        </div>
      </section>

      {/* == FAQ =================================================== */}
      <section className='py-24 px-6'>
        <div className='max-w-3xl mx-auto'>
          <motion.p {...fu(0)} className='text-xs uppercase tracking-[0.2em] text-white/25 mb-4'>
            FAQ
          </motion.p>
          <motion.h2
            {...fu(0.05)}
            className='text-4xl sm:text-5xl font-extrabold tracking-tighter mb-14'
          >
            Common questions
          </motion.h2>

          <div className='space-y-3'>
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                {...fu(0.03 * i)}
                className='border border-white/[0.08] rounded-xl overflow-hidden'
              >
                <button
                  className='w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors duration-150'
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className='text-sm font-semibold pr-4'>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-white/35 flex-shrink-0 transition-transform duration-300 ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className='overflow-hidden'
                    >
                      <p className='px-5 pb-5 text-sm text-white/40 leading-relaxed'>{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* == CTA BANNER ============================================ */}
      <section className='py-24 px-6'>
        <div className='max-w-4xl mx-auto'>
          <motion.div
            {...fu(0)}
            className='relative rounded-3xl overflow-hidden border border-violet-500/20 p-16 text-center'
            style={{
              background:
                'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.15) 0%, transparent 70%)',
            }}
          >
            {/* grid overlay */}
            <div className='absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:48px_48px]' />

            <div className='relative z-10'>
              <p className='text-xs uppercase tracking-[0.2em] text-white/25 mb-6'>Get started</p>
              <h2 className='text-5xl sm:text-6xl font-extrabold tracking-tighter mb-4 leading-tight'>
                Not sure which
                <br />
                plan fits you?
              </h2>
              <p className='text-white/40 mb-10 max-w-md mx-auto'>
                Our team will help you find the right plan for your organisation&apos;s security
                needs.
              </p>
              <div className='flex flex-col sm:flex-row gap-3 justify-center'>
                <Link
                  to='/register'
                  className='px-8 py-3.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all duration-200 text-sm'
                >
                  Start for free
                </Link>
                <Link
                  to='/contact-us'
                  className='px-8 py-3.5 bg-white/[0.08] hover:bg-white/[0.12] text-white font-semibold rounded-xl transition-all duration-200 text-sm flex items-center gap-2 justify-center'
                >
                  Talk to sales <ArrowRight className='w-4 h-4' />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

export default Pricing
