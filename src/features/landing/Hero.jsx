import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const Hero = () => {
  const { scrollY } = useScroll()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const y1 = useTransform(scrollY, [0, 500], [0, 200])

  return (
    <section className='relative flex flex-col items-center justify-center pt-56 pb-32 overflow-hidden'>
      {/* Background Effects */}
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(124,58,237,0.1),transparent_50%)]' />
      <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full opacity-50 pointer-events-none' />

      <div className='container mx-auto px-4 relative z-10 text-center'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <h1 className='text-6xl md:text-8xl font-bold tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/40'>
            ECHO
          </h1>

          <p className='text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed'>
            {t('hero.description')}
            <span className='text-zinc-500 block mt-2 text-lg'>{t('hero.tagline')}</span>
          </p>

          <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className='px-8 py-4 bg-white text-black rounded-full font-semibold text-lg hover:bg-zinc-200 transition-colors flex items-center gap-2'
              onClick={() => navigate('/register')}
            >
              {t('hero.ctaPrimary')} <ArrowRight size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className='px-8 py-4 bg-white/5 text-white border border-white/10 rounded-full font-semibold text-lg hover:bg-white/10 transition-colors'
              onClick={() => navigate('/login')}
            >
              {t('hero.ctaSecondary')}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Hero
