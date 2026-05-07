import React from 'react'
import { motion } from 'framer-motion'
import { Code, Cpu, Globe, Trophy, Zap, Timer, Users, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Navbar from '../../components/HomepageComponents/Navbar'
import Footer from '../../components/HomepageComponents/Footer'

const GlobalHackathon = () => {
  const { t } = useTranslation()

  const tracks = [
    {
      icon: Lock,
      title: t('globalHackathon.tracks.privacy.title'),
      desc: t('globalHackathon.tracks.privacy.desc'),
      color: 'text-purple-400',
    },
    {
      icon: Globe,
      title: t('globalHackathon.tracks.decentralization.title'),
      desc: t('globalHackathon.tracks.decentralization.desc'),
      color: 'text-cyan-400',
    },
    {
      icon: Users,
      title: t('globalHackathon.tracks.social.title'),
      desc: t('globalHackathon.tracks.social.desc'),
      color: 'text-green-400',
    },
  ]

  const timelineItems = t('globalHackathon.timeline.items', { returnObjects: true })
  const prizes = t('globalHackathon.prizes', { returnObjects: true })

  return (
    <div className='min-h-screen bg-black text-white selection:bg-cyan-500/30'>
      <Navbar />

      <div className='fixed inset-0 pointer-events-none'>
        <div className='absolute top-0 right-0 w-[800px] h-[600px] bg-cyan-900/20 rounded-full blur-[120px] opacity-40' />
        <div className='absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-[120px] opacity-40' />
      </div>

      <main className='relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto'>
        {/* Hero */}
        <div className='text-center mb-24'>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className='inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-bold mb-8 border border-cyan-500/20'
          >
            <Zap className='w-4 h-4' />
            <span>{t('globalHackathon.badge')}</span>
          </motion.div>

          <h1 className='text-6xl md:text-8xl font-black mb-6 tracking-tighter uppercase'>
            {t('globalHackathon.title')}{' '}
            <span className='text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'>
              {t('globalHackathon.titleHighlight')}
            </span>
          </h1>

          <p className='text-xl text-zinc-400 max-w-2xl mx-auto mb-10'>
            {t('globalHackathon.description')}
          </p>

          <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
            <button className='px-8 py-4 bg-cyan-500 text-black font-bold text-lg rounded-lg hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]'>
              {t('globalHackathon.register')}
            </button>
            <button className='px-8 py-4 bg-zinc-900 text-white font-bold text-lg rounded-lg border border-white/10 hover:bg-zinc-800 transition-all'>
              {t('globalHackathon.rules')}
            </button>
          </div>
        </div>

        {/* Tracks */}
        <div className='mb-24'>
          <h2 className='text-3xl font-bold mb-10 text-center'>
            {t('globalHackathon.tracks.title')}
          </h2>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            {tracks.map((track, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5 }}
                className='p-8 rounded-2xl bg-zinc-900/50 border border-white/10 hover:border-white/20 transition-all'
              >
                <div
                  className={`w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-6 ${track.color}`}
                >
                  <track.icon className='w-6 h-6' />
                </div>
                <h3 className='text-xl font-bold mb-3'>{track.title}</h3>
                <p className='text-zinc-400 leading-relaxed'>{track.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Prizes */}
        <div className='relative rounded-3xl overflow-hidden bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-8 md:p-16 mb-24'>
          <div className='absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]' />

          <div className='relative z-10 text-center'>
            <h2 className='text-4xl font-bold mb-12'>{prizes.title}</h2>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-8 items-end'>
              <div className='order-2 md:order-1 p-6 rounded-2xl bg-zinc-900/50 border border-white/10'>
                <div className='text-2xl font-bold text-zinc-300 mb-2'>{prizes.second.title}</div>
                <div className='text-4xl font-black text-white mb-4'>{prizes.second.amount}</div>
                <ul className='text-sm text-zinc-400 space-y-2'>
                  {prizes.second.perks.map((perk, i) => (
                    <li key={i}>• {perk}</li>
                  ))}
                </ul>
              </div>

              <div className='order-1 md:order-2 p-8 rounded-2xl bg-zinc-800/50 border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.1)] transform md:-translate-y-4'>
                <div className='text-xl font-bold text-cyan-400 mb-2 uppercase tracking-widest'>
                  {prizes.first.title}
                </div>
                <div className='text-6xl font-black text-white mb-6'>{prizes.first.amount}</div>
                <ul className='text-zinc-300 space-y-3'>
                  <li className='flex items-center justify-center gap-2'>
                    <Trophy className='w-4 h-4 text-yellow-500' /> {prizes.first.perks[0]}
                  </li>
                  {prizes.first.perks.slice(1).map((perk, i) => (
                    <li key={i}>• {perk}</li>
                  ))}
                </ul>
              </div>

              <div className='order-3 p-6 rounded-2xl bg-zinc-900/50 border border-white/10'>
                <div className='text-2xl font-bold text-zinc-300 mb-2'>{prizes.third.title}</div>
                <div className='text-4xl font-black text-white mb-4'>{prizes.third.amount}</div>
                <ul className='text-sm text-zinc-400 space-y-2'>
                  {prizes.third.perks.map((perk, i) => (
                    <li key={i}>• {perk}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className='max-w-3xl mx-auto'>
          <h2 className='text-3xl font-bold mb-10 text-center'>
            {t('globalHackathon.timeline.title')}
          </h2>
          <div className='space-y-8 border-l-2 border-white/10 pl-8 ml-4'>
            {timelineItems.map((item, i) => (
              <div key={i} className='relative'>
                <div className='absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-black border-4 border-cyan-500' />
                <div className='text-cyan-400 font-mono text-sm mb-1'>
                  {item.day} • {item.time}
                </div>
                <h3 className='text-xl font-bold text-white mb-2'>{item.title}</h3>
                <p className='text-zinc-400'>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default GlobalHackathon
