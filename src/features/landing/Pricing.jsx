import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(true)
  const { t } = useTranslation()

  const plans = [
    {
      name: t('pricing.plans.starter.name'),
      desc: t('pricing.plans.starter.desc'),
      price: '0',
      features: t('pricing.plans.starter.features', { returnObjects: true }),
      cta: t('pricing.getStarted'),
      highlight: false,
    },
    {
      name: t('pricing.plans.pro.name'),
      desc: t('pricing.plans.pro.desc'),
      price: isAnnual ? '8' : '12',
      period: isAnnual ? t('pricing.billedYearly') : '/mo',
      features: t('pricing.plans.pro.features', { returnObjects: true }),
      cta: t('pricing.startFreeTrial'),
      highlight: true,
    },
    {
      name: t('pricing.plans.business.name'),
      desc: t('pricing.plans.business.desc'),
      price: isAnnual ? '24' : '30',
      period: t('pricing.perUserMonth'),
      features: t('pricing.plans.business.features', { returnObjects: true }),
      cta: t('pricing.contactSales'),
      highlight: false,
    },
  ]

  return (
    <section id='pricing' className='py-32 px-6 relative overflow-hidden'>
      <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none' />

      <div className='max-w-7xl mx-auto relative z-10'>
        <div className='text-center mb-16'>
          <h2 className='text-4xl md:text-5xl font-bold mb-6'>{t('pricing.title')}</h2>
          <p className='text-zinc-400 text-lg max-w-2xl mx-auto mb-10'>
            {t('pricing.description')}
          </p>

          {/* Billing toggle */}
          <div className='flex items-center justify-center gap-4 mb-12'>
            <span className={`text-sm font-medium ${!isAnnual ? 'text-white' : 'text-zinc-500'}`}>
              {t('pricing.monthly')}
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className='w-14 h-8 bg-white/10 rounded-full p-1 relative transition-colors hover:bg-white/20'
              aria-label='Toggle billing period'
            >
              <motion.div
                animate={{ x: isAnnual ? 24 : 0 }}
                className='w-6 h-6 bg-violet-500 rounded-full shadow-lg'
              />
            </button>
            <span className={`text-sm font-medium ${isAnnual ? 'text-white' : 'text-zinc-500'}`}>
              {t('pricing.yearly')}{' '}
              <span className='text-violet-400 text-xs ml-1'>({t('pricing.save')})</span>
            </span>
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative p-8 rounded-3xl border flex flex-col transition-all duration-300 group ${
                plan.highlight
                  ? 'bg-zinc-900/80 border-violet-500/50 shadow-[0_0_40px_rgba(139,92,246,0.15)]'
                  : 'bg-zinc-900/40 border-white/10 hover:border-white/20'
              }`}
            >
              {plan.highlight && (
                <div className='absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-bold rounded-full shadow-lg'>
                  {t('pricing.recommended')}
                </div>
              )}

              <div className='mb-8'>
                <h3 className='text-xl font-bold text-white mb-2'>{plan.name}</h3>
                <p className='text-sm text-zinc-400 h-10'>{plan.desc}</p>
              </div>

              <div className='mb-8'>
                <div className='flex items-baseline gap-1'>
                  <span className='text-4xl font-bold text-white'>€{plan.price}</span>
                  {plan.price !== '0' && (
                    <span className='text-zinc-500 text-sm'>{plan.period}</span>
                  )}
                </div>
              </div>

              <ul className='space-y-4 mb-8 flex-1'>
                {plan.features.map((f, j) => (
                  <li key={j} className='flex items-start gap-3 text-sm text-zinc-300'>
                    <div
                      className={`mt-0.5 p-0.5 rounded-full ${
                        plan.highlight
                          ? 'bg-violet-500/20 text-violet-400'
                          : 'bg-white/10 text-zinc-400'
                      }`}
                    >
                      <Check size={12} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-4 rounded-xl font-semibold transition-all duration-300 ${
                  plan.highlight
                    ? 'bg-white text-black hover:bg-zinc-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                    : 'bg-white/5 text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Pricing
