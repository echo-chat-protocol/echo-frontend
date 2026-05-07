import React from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Users, Calendar, Mic, Video, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Navbar from '../../components/HomepageComponents/Navbar'
import Footer from '../../components/HomepageComponents/Footer'

const TownHall = () => {
  const { t } = useTranslation()

  const featuredTopics = t('townHall.featured.items', { returnObjects: true })
  const questions = t('townHall.questions.items', { returnObjects: true })

  return (
    <div className='min-h-screen bg-black text-white selection:bg-emerald-500/30'>
      <Navbar />

      <div className='fixed inset-0 pointer-events-none'>
        <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-900/20 rounded-full blur-[120px] opacity-40' />
      </div>

      <main className='relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto'>
        {/* Hero */}
        <div className='text-center mb-20'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className='inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-bold mb-6 border border-emerald-500/20'>
              {t('townHall.badge')}
            </span>
            <h1 className='text-5xl md:text-7xl font-bold mb-6 tracking-tight'>
              {t('townHall.title')}{' '}
              <span className='text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400'>
                {t('townHall.titleHighlight')}
              </span>
            </h1>
            <p className='text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-8'>
              {t('townHall.description')}
            </p>
            <div className='flex justify-center gap-4'>
              <button className='px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-lg transition-colors flex items-center gap-2'>
                <Calendar className='w-5 h-5' /> {t('townHall.watch')}
              </button>
              <button className='px-8 py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-full font-bold text-lg border border-white/10 transition-colors'>
                {t('townHall.submit')}
              </button>
            </div>
          </motion.div>
        </div>

        {/* Next Event Card */}
        <div className='max-w-4xl mx-auto mb-24'>
          <div className='bg-zinc-900/50 border border-emerald-500/30 rounded-3xl p-8 md:p-12 relative overflow-hidden'>
            <div className='absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]' />

            <div className='relative z-10 flex flex-col md:flex-row gap-8 items-center'>
              <div className='flex-1'>
                <h2 className='text-2xl font-bold mb-2 text-emerald-400'>
                  {t('townHall.nextEvent.title')}: {t('townHall.nextEvent.date')}
                </h2>
                <h3 className='text-4xl font-bold text-white mb-4'>{featuredTopics[0].title}</h3>
                <p className='text-zinc-400 mb-6'>{featuredTopics[0].desc}</p>
                <div className='flex items-center gap-4'>
                  <div className='flex -space-x-3'>
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className='w-10 h-10 rounded-full bg-zinc-800 border-2 border-black flex items-center justify-center text-xs font-bold'
                      >
                        U{i}
                      </div>
                    ))}
                  </div>
                  <span className='text-sm text-zinc-500'>
                    +450 {t('communityPage.events.attending')}
                  </span>
                </div>
              </div>

              <div className='w-full md:w-auto bg-black/50 rounded-2xl p-6 border border-white/10 min-w-[250px]'>
                <div className='text-sm text-zinc-500 mb-4 font-mono'>HOSTS</div>
                <div className='space-y-4'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-full bg-zinc-800' />
                    <div>
                      <div className='font-bold'>Marco</div>
                      <div className='text-xs text-zinc-500'>Founder</div>
                    </div>
                  </div>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-full bg-zinc-800' />
                    <div>
                      <div className='font-bold'>Sarah</div>
                      <div className='text-xs text-zinc-500'>Lead Dev</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Past Recordings */}
        <div>
          <div className='flex items-center justify-between mb-8'>
            <h2 className='text-3xl font-bold'>{t('townHall.watch')}</h2>
            <a
              href='#'
              className='text-emerald-400 hover:text-emerald-300 flex items-center gap-2 text-sm font-bold'
            >
              {t('communityPage.events.viewAll')} <ArrowRight className='w-4 h-4' />
            </a>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            {[
              {
                title: 'March Town Hall',
                date: 'March 1, 2026',
                views: '1.2k views',
                topic: 'Security Audit Results',
              },
              {
                title: 'February Town Hall',
                date: 'Feb 1, 2026',
                views: '980 views',
                topic: 'Community Governance',
              },
              {
                title: 'January Town Hall',
                date: 'Jan 1, 2026',
                views: '1.5k views',
                topic: '2026 Vision',
              },
            ].map((video, i) => (
              <motion.div key={i} whileHover={{ y: -5 }} className='group cursor-pointer'>
                <div className='aspect-video bg-zinc-900 rounded-xl border border-white/10 mb-4 relative overflow-hidden group-hover:border-emerald-500/50 transition-colors'>
                  <div className='absolute inset-0 flex items-center justify-center'>
                    <div className='w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform'>
                      <Video className='w-5 h-5 text-white' />
                    </div>
                  </div>
                </div>
                <h3 className='font-bold text-lg mb-1 group-hover:text-emerald-400 transition-colors'>
                  {video.title}
                </h3>
                <div className='flex items-center gap-3 text-sm text-zinc-500'>
                  <span>{video.date}</span>
                  <span>•</span>
                  <span>{video.views}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default TownHall
