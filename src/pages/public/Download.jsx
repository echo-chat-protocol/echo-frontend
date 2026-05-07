import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Monitor,
  Apple,
  Smartphone,
  ShieldCheck,
  Github,
  ExternalLink,
  Download,
} from 'lucide-react'
import Navbar from '../components/HomepageComponents/Navbar'
import Footer from '../components/HomepageComponents/Footer'
import PageWrapper from '../components/common/PageWrapper'

const COMING_SOON_ICONS = [
  {
    key: 'macos',
    Icon: Apple,
    color: 'text-white/50',
    bg: 'bg-white/5',
    border: 'border-white/10',
  },
  {
    key: 'android',
    Icon: Smartphone,
    color: 'text-green-400/50',
    bg: 'bg-green-500/5',
    border: 'border-green-500/10',
  },
  {
    key: 'ios',
    Icon: Smartphone,
    color: 'text-blue-400/50',
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/10',
  },
]

const GUARANTEE_ICONS = ['', '', '', '']

export default function DownloadPage() {
  const { t } = useTranslation()
  const win = t('download.windows', { returnObjects: true })
  const sec = t('download.security', { returnObjects: true })
  const platforms = t('download.platforms', { returnObjects: true })
  const guarantees = Array.isArray(sec.guarantees) ? sec.guarantees : []

  return (
    <PageWrapper>
      <Navbar />
      <main className='pt-28 pb-24 px-4 sm:px-6'>
        {/* Header */}
        <div className='text-center mb-16 max-w-2xl mx-auto'>
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45 }}
            className='inline-flex items-center justify-center p-3 bg-violet-500/10 rounded-2xl mb-6 ring-1 ring-violet-500/20'
          >
            <Download className='w-8 h-8 text-violet-400' />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className='text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight'
          >
            {t('download.pageTitle')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className='text-lg text-white/45 leading-relaxed'
          >
            {t('download.pageSubtitle')}
          </motion.p>
        </div>

        {/* Windows hero card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className='max-w-2xl mx-auto mb-10 bg-white/[0.04] border border-violet-500/25 rounded-2xl p-8 relative overflow-hidden'
        >
          <div className='absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none' />
          <div className='relative flex flex-col sm:flex-row sm:items-center gap-6'>
            <div className='flex-shrink-0 p-4 bg-violet-500/10 rounded-2xl w-fit'>
              <Monitor className='w-10 h-10 text-violet-400' />
            </div>
            <div className='flex-1'>
              <div className='flex items-center gap-2 mb-1'>
                <span className='text-2xl font-bold text-white'>Windows</span>
                <span className='text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30'>
                  {win.badge}
                </span>
              </div>
              <p className='text-sm text-white/40 mb-4'>{win.sub}</p>
              <ul className='space-y-1.5 mb-6'>
                {(win.features || []).map((f) => (
                  <li key={f} className='flex items-center gap-2 text-sm text-white/60'>
                    <ShieldCheck className='w-3.5 h-3.5 text-emerald-400 flex-shrink-0' /> {f}
                  </li>
                ))}
              </ul>
              <div className='flex flex-col sm:flex-row gap-3'>
                <a
                  href='https://github.com/Enriquefft/Echo/releases/latest'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-medium py-2.5 px-5 rounded-xl transition-colors text-sm'
                >
                  <Download className='w-4 h-4' />
                  {win.downloadBtn}
                </a>
                <a
                  href='https://github.com/Enriquefft/Echo/releases'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex items-center justify-center gap-2 border border-white/10 hover:border-violet-500/40 text-white/60 hover:text-white font-medium py-2.5 px-5 rounded-xl transition-all text-sm'
                >
                  <ExternalLink className='w-3.5 h-3.5' />
                  {win.releasesBtn}
                </a>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Coming soon */}
        <div className='max-w-2xl mx-auto grid grid-cols-3 gap-4 mb-16'>
          {COMING_SOON_ICONS.map(({ key, Icon, color, bg, border }, i) => {
            const pl = platforms[key] || {}
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.07 }}
                className={`${bg} border ${border} rounded-xl p-4 flex flex-col items-center text-center gap-2`}
              >
                <Icon className={`w-7 h-7 ${color}`} />
                <div>
                  <p className={`text-sm font-medium ${color}`}>{pl.label}</p>
                  <p className='text-[10px] text-white/25 mt-0.5'>{t('download.soonLabel')}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Security strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.5 }}
          className='max-w-2xl mx-auto bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8'
        >
          <h3 className='text-sm font-semibold text-white/60 uppercase tracking-widest mb-4'>
            {sec.title}
          </h3>
          <div className='grid grid-cols-2 gap-3'>
            {guarantees.map((g, i) => (
              <div key={i} className='flex items-center gap-2 text-sm text-white/50'>
                <span className='text-base'>{GUARANTEE_ICONS[i] || ''}</span>
                {g}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Build from source */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className='text-center text-sm text-white/30'
        >
          {t('download.buildFromSource')}{' '}
          <a
            href='https://github.com/Enriquefft/Echo'
            target='_blank'
            rel='noopener noreferrer'
            className='text-violet-400 hover:text-violet-300 underline inline-flex items-center gap-1'
          >
            <Github className='w-3.5 h-3.5' />
            {t('download.viewOnGithub')}
          </a>
        </motion.p>
      </main>
      <Footer />
    </PageWrapper>
  )
}
