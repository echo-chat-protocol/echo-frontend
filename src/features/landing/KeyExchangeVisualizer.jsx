import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { User } from 'lucide-react'

const KeyExchangeVisualizer = () => {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 })
  const [phase, setPhase] = useState(0)
  const { t } = useTranslation()

  useEffect(() => {
    if (inView) {
      const interval = setInterval(() => {
        setPhase((p) => (p + 1) % 5)
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [inView])

  return (
    <section ref={ref} className='py-32 px-6'>
      <div className='max-w-5xl mx-auto text-center'>
        <h2 className='text-3xl font-bold mb-16'>{t('keyExchange.title')}</h2>

        <div className='relative flex items-center justify-between max-w-3xl mx-auto h-40'>
          {/* Device A */}
          <div className='relative z-10 flex flex-col items-center gap-4'>
            <div className='w-20 h-20 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center shadow-xl'>
              <User className='w-8 h-8 text-violet-400' />
            </div>
            <span className='text-sm font-mono text-zinc-500'>{t('keyExchange.alice')}</span>
          </div>

          {/* Animated connection line */}
          <div className='absolute left-20 right-20 top-10 h-0.5 bg-zinc-800'>
            <motion.div
              className='absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-violet-500 rounded-full shadow-[0_0_15px_rgba(139,92,246,0.8)]'
              animate={{
                left: ['0%', '100%', '0%'],
                scale: [1, 1.5, 1],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          {/* Device B */}
          <div className='relative z-10 flex flex-col items-center gap-4'>
            <div className='w-20 h-20 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center shadow-xl'>
              <User className='w-8 h-8 text-blue-400' />
            </div>
            <span className='text-sm font-mono text-zinc-500'>{t('keyExchange.bob')}</span>
          </div>
        </div>

        <div className='mt-12 grid grid-cols-1 md:grid-cols-3 gap-4'>
          {[
            {
              title: t('keyExchange.protocols.x3dh'),
              desc: t('keyExchange.protocols.x3dhDesc'),
            },
            {
              title: t('keyExchange.protocols.doubleRatchet'),
              desc: t('keyExchange.protocols.doubleRatchetDesc'),
            },
            {
              title: t('keyExchange.protocols.forwardSecrecy'),
              desc: t('keyExchange.protocols.forwardSecrecyDesc'),
            },
          ].map((item, i) => (
            <div key={i} className='p-6 rounded-xl bg-white/5 border border-white/5'>
              <h3 className='font-semibold mb-2 text-white'>{item.title}</h3>
              <p className='text-sm text-zinc-400'>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default KeyExchangeVisualizer
