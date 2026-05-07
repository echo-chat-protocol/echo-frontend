import React from 'react'
import { motion } from 'framer-motion'
import { Calendar, MapPin, Shield, Lock, User, Clock, CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Navbar from '../../components/HomepageComponents/Navbar'
import Footer from '../../components/HomepageComponents/Footer'

const SecuritySummit = () => {
  const { t } = useTranslation()

  const schedule = t('securitySummit.agenda.items', { returnObjects: true })
  const whyAttendItems = t('securitySummit.whyAttend.items', { returnObjects: true })
  const whyAttendIcons = [Shield, Lock, User]

  return (
    <div className='min-h-screen bg-black text-white selection:bg-violet-500/30'>
      <Navbar />

      <div className='fixed inset-0 pointer-events-none'>
        <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-violet-900/20 rounded-full blur-[120px] opacity-50' />
      </div>

      <main className='relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto'>
        {/* Hero */}
        <div className='text-center mb-20'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className='inline-block px-4 py-1.5 rounded-full bg-violet-500/10 text-violet-400 text-sm font-bold mb-6 border border-violet-500/20'>
              {t('securitySummit.date')}
            </span>
            <h1 className='text-5xl md:text-7xl font-bold mb-6 tracking-tight'>
              {t('securitySummit.title')}{' '}
              <span className='text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400'>
                {t('securitySummit.titleHighlight')}
              </span>
            </h1>
            <p className='text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-8'>
              {t('securitySummit.description')}
            </p>
            <button className='px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-zinc-200 transition-colors'>
              {t('securitySummit.register')}
            </button>
          </motion.div>
        </div>

        {/* Stats */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-6 mb-24'>
          {[
            { label: t('securitySummit.stats.attendees'), value: '1,200+' },
            { label: t('securitySummit.stats.speakers'), value: '25+' },
            { label: t('securitySummit.stats.sessions'), value: '12' },
            { label: t('securitySummit.stats.workshops'), value: '4' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className='p-6 rounded-2xl bg-zinc-900/30 border border-white/5 text-center'
            >
              <div className='text-3xl font-bold text-white mb-1'>{stat.value}</div>
              <div className='text-sm text-zinc-500'>{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Content Grid */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-12 mb-24'>
          <div className='lg:col-span-2'>
            <h2 className='text-3xl font-bold mb-8'>{t('securitySummit.agenda.title')}</h2>
            <div className='space-y-4'>
              {schedule.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className='flex items-center gap-6 p-6 rounded-xl bg-zinc-900/30 border border-white/5 hover:border-violet-500/30 transition-colors'
                >
                  <div className='w-24 text-sm font-mono text-violet-400'>{item.time}</div>
                  <div>
                    <h3 className='text-lg font-bold text-white'>{item.title}</h3>
                    <p className='text-zinc-400 text-sm'>{item.speaker}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div>
            <h2 className='text-3xl font-bold mb-8'>{t('securitySummit.whyAttend.title')}</h2>
            <div className='space-y-6'>
              {whyAttendItems.map((item, i) => {
                const Icon = whyAttendIcons[i]
                return (
                  <div key={i} className='flex gap-4'>
                    <div className='w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0'>
                      <Icon className='w-6 h-6 text-violet-400' />
                    </div>
                    <div>
                      <h3 className='font-bold text-white mb-1'>{item.title}</h3>
                      <p className='text-sm text-zinc-400'>{item.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Registration Form */}
        <div className='max-w-2xl mx-auto bg-zinc-900/50 border border-white/10 rounded-3xl p-8 md:p-12'>
          <div className='text-center mb-8'>
            <h2 className='text-3xl font-bold mb-4'>{t('securitySummit.form.title')}</h2>
            <p className='text-zinc-400'>{t('securitySummit.form.desc')}</p>
          </div>
          <form className='space-y-4' onSubmit={(e) => e.preventDefault()}>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <input
                type='text'
                placeholder={t('securitySummit.form.firstName')}
                className='w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-violet-500'
              />
              <input
                type='text'
                placeholder={t('securitySummit.form.lastName')}
                className='w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-violet-500'
              />
            </div>
            <input
              type='email'
              placeholder={t('securitySummit.form.email')}
              className='w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-violet-500'
            />
            <button className='w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-lg transition-colors'>
              {t('securitySummit.form.submit')}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default SecuritySummit
