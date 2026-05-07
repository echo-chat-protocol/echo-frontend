import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Heart,
  MessageCircle,
  Share2,
  Users,
  Github,
  Calendar,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Globe,
  Code,
  ExternalLink,
} from 'lucide-react'
import { FaDiscord, FaXTwitter } from 'react-icons/fa6'
import { motion } from 'framer-motion'
import Navbar from '../components/HomepageComponents/Navbar'
import Footer from '../components/HomepageComponents/Footer'

const Community = () => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('all')
  const [showAllEvents, setShowAllEvents] = useState(false)

  // Mock Data
  const platforms = [
    {
      name: 'Discord',
      description: t('communityPage.platforms.discordDesc'),
      icon: FaDiscord,
      color: 'bg-[#5865F2]',
      link: '#',
      members: '12.5k',
    },
    {
      name: 'GitHub',
      description: t('communityPage.platforms.githubDesc'),
      icon: Github,
      color: 'bg-[#333]',
      link: '#',
      members: '4.2k',
    },
    {
      name: 'X',
      description: t('communityPage.platforms.twitterDesc'),
      icon: FaXTwitter,
      color: 'bg-zinc-900 border border-white/20',
      link: '#',
      members: '25k',
    },
  ]

  const events = [
    {
      title: 'Echo Security Summit 2026',
      date: 'March 15, 2026',
      type: 'Virtual Conference',
      description: 'Deep dive into post-quantum cryptography and the future of privacy.',
      attendees: 1200,
      link: '/community/events/security-summit',
      color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    },
    {
      title: 'Global Hackathon',
      date: 'April 1–3, 2026',
      type: 'Competition',
      description: 'Build privacy-first apps on top of the Echo Protocol. $50k in prizes.',
      attendees: 500,
      link: '/community/events/hackathon',
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    },
    {
      title: 'Community Town Hall',
      date: 'Every Friday',
      type: 'Live Stream',
      description: 'Weekly updates from the core team and Q&A session.',
      attendees: 300,
      link: '/community/events/town-hall',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'EchoCon 2026',
      date: 'June 10–11, 2026',
      type: 'Developer Conference',
      description: 'Two days of talks, workshops and networking in Madrid — plus full live stream.',
      attendees: 800,
      link: '/community/events/echocon',
      color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20',
    },
    {
      title: 'Privacy Workshop Series',
      date: 'Monthly • First Friday',
      type: 'Workshop',
      description: 'Monthly live sessions on cryptography, ZK proofs and secure systems. Free.',
      attendees: 120,
      link: '/community/events/privacy-workshop',
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Open Source Contributors Day',
      date: 'July 4, 2026',
      type: 'Hackday',
      description:
        'A full day pushing Echo’s open source projects forward. Pick an issue, get merged.',
      attendees: 200,
      link: '/community/events/open-source-day',
      color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    },
  ]

  const contributors = [
    { name: 'Sarah J.', role: 'Core Maintainer', avatar: '👩‍💻', contributions: 450 },
    { name: 'Alex M.', role: 'Security Researcher', avatar: '🕵️‍♂️', contributions: 120 },
    { name: 'David K.', role: 'Community Lead', avatar: '👨‍🏫', contributions: 850 },
    { name: 'Elena R.', role: 'UI/UX Designer', avatar: '🎨', contributions: 230 },
  ]

  const [posts, setPosts] = useState([
    {
      id: 1,
      author: 'Alice Chen',
      handle: '@alicechen',
      avatar: '👩‍💻',
      badge: 'maintainer',
      content:
        'Just deployed Echo to production. The encryption performance is incredible - 99.9% throughput at 256-bit AES. No compromises.',
      timestamp: '2h ago',
      likes: 245,
      replies: 18,
      category: 'announcements',
      liked: false,
    },
    {
      id: 2,
      author: 'Security Team',
      handle: '@echosecurity',
      avatar: '🔒',
      badge: 'official',
      content:
        'Security audit completed. Third-party audit from Verifide confirms X3DH implementation is correct and secure. Full report available in docs.',
      timestamp: '4h ago',
      likes: 892,
      replies: 34,
      category: 'security',
      liked: false,
    },
    {
      id: 3,
      author: 'Dev Community',
      handle: '@echodevs',
      avatar: '👨‍💻',
      badge: 'community',
      content:
        'New SDK released: Python 0.9.0 with async support and improved typing. Feedback welcome on the new API design!',
      timestamp: '6h ago',
      likes: 156,
      replies: 23,
      category: 'devs',
      liked: false,
    },
  ])

  const toggleLike = (id) => {
    setPosts(
      posts.map((p) =>
        p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
      )
    )
  }

  return (
    <div className='min-h-screen bg-black text-white selection:bg-violet-500/30'>
      <Navbar />

      {/* Background Effects */}
      <div className='fixed inset-0 pointer-events-none'>
        <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] opacity-50' />
        <div className='absolute bottom-0 right-0 w-[800px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] opacity-30' />
      </div>

      <main className='relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto'>
        {/* Hero Section */}
        <div className='text-center mb-24'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className='text-5xl md:text-7xl font-bold mb-6 tracking-tight'>
              {t('communityPage.heroTitle')}{' '}
              <span className='text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400'>
                {t('communityPage.heroTitleHighlight')}
              </span>
            </h1>
            <p className='text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed'>
              {t('communityPage.heroDesc')}
            </p>
          </motion.div>
        </div>

        {/* Platforms Grid */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-32'>
          {platforms.map((platform, index) => (
            <motion.a
              href={platform.link}
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className='group relative p-8 rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-all duration-300 overflow-hidden'
            >
              <div
                className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500 ${platform.color}`}
              />

              <div className='relative z-10'>
                <div
                  className={`w-14 h-14 rounded-2xl ${platform.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  <platform.icon className='w-7 h-7 text-white' />
                </div>

                <h3 className='text-2xl font-bold mb-2'>{platform.name}</h3>
                <p className='text-zinc-400 mb-6 min-h-[3rem]'>{platform.description}</p>

                <div className='flex items-center justify-between pt-6 border-t border-white/5'>
                  <div className='flex items-center text-sm text-zinc-500'>
                    <Users className='w-4 h-4 mr-2' />
                    {platform.members} {t('communityPage.platforms.members')}
                  </div>
                  <span className='flex items-center text-sm font-medium text-white group-hover:translate-x-1 transition-transform'>
                    {t('communityPage.platforms.join')} <ArrowRight className='w-4 h-4 ml-1' />
                  </span>
                </div>
              </div>
            </motion.a>
          ))}
        </div>

        {/* Events & Contributors Split */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-12 mb-32'>
          {/* Events */}
          <div>
            <div className='flex items-center justify-between mb-8'>
              <h2 className='text-3xl font-bold'>{t('communityPage.events.title')}</h2>
              <button
                onClick={() => setShowAllEvents((v) => !v)}
                className='flex items-center gap-1.5 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors'
              >
                {showAllEvents ? (
                  <>
                    {t('communityPage.events.showLess')} <ChevronUp className='w-4 h-4' />
                  </>
                ) : (
                  <>
                    {t('communityPage.events.viewAll')} <ChevronDown className='w-4 h-4' />
                  </>
                )}
              </button>
            </div>
            <div className='space-y-4'>
              {(showAllEvents ? events : events.slice(0, 3)).map((event, index) => (
                <Link to={event.link} key={index} className='block'>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className='p-6 rounded-2xl bg-zinc-900/30 border border-white/5 hover:bg-zinc-900/50 transition-colors group'
                  >
                    <div className='flex justify-between items-start mb-4'>
                      <div>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 border ${event.color}`}
                        >
                          {event.type}
                        </span>
                        <h3 className='text-xl font-bold group-hover:text-violet-400 transition-colors'>
                          {event.title}
                        </h3>
                      </div>
                      <div className='text-right'>
                        <div className='flex items-center text-zinc-400 text-sm mb-1'>
                          <Calendar className='w-4 h-4 mr-2' />
                          {event.date}
                        </div>
                      </div>
                    </div>
                    <p className='text-zinc-400 text-sm mb-4'>{event.description}</p>
                    <div className='flex items-center text-xs text-zinc-500'>
                      <Users className='w-3 h-3 mr-1' />
                      {event.attendees} {t('communityPage.events.attending')}
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>

          {/* Contributors */}
          <div>
            <div className='flex items-center justify-between mb-8'>
              <h2 className='text-3xl font-bold'>{t('communityPage.contributors.title')}</h2>
              <Link
                to='/community/leaderboard'
                className='text-violet-400 hover:text-violet-300 text-sm font-medium flex items-center gap-1 transition-colors'
              >
                {t('communityPage.contributors.leaderboard')} <ArrowRight className='w-3.5 h-3.5' />
              </Link>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              {contributors.map((contributor, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className='p-6 rounded-2xl bg-zinc-900/30 border border-white/5 text-center hover:border-violet-500/30 transition-colors'
                >
                  <div className='w-16 h-16 mx-auto bg-zinc-800 rounded-full flex items-center justify-center text-3xl mb-4 border-2 border-zinc-700'>
                    {contributor.avatar}
                  </div>
                  <h3 className='font-bold text-lg mb-1'>{contributor.name}</h3>
                  <p className='text-violet-400 text-xs font-bold uppercase tracking-wider mb-3'>
                    {contributor.role}
                  </p>
                  <div className='inline-flex items-center px-3 py-1 rounded-full bg-white/5 text-xs text-zinc-400'>
                    <Code className='w-3 h-3 mr-1' />
                    {contributor.contributions} {t('communityPage.contributors.commits')}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className='mt-6 p-6 rounded-2xl bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 border border-violet-500/20 text-center'>
              <h3 className='font-bold mb-2'>{t('communityPage.contributors.ctaTitle')}</h3>
              <p className='text-sm text-zinc-400 mb-4'>
                {t('communityPage.contributors.ctaDesc')}
              </p>
              <button className='px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-zinc-200 transition-colors'>
                {t('communityPage.contributors.ctaButton')}
              </button>
            </div>
          </div>
        </div>

        {/* Discussion Feed */}
        <div className='max-w-3xl mx-auto'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-bold mb-4'>{t('communityPage.updates.title')}</h2>
            <div className='flex justify-center space-x-2'>
              {['all', 'announcements', 'devs', 'security'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-white text-black'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {t(`communityPage.updates.tabs.${tab}`)}
                </button>
              ))}
            </div>
          </div>

          <div className='space-y-6'>
            {posts
              .filter((p) => activeTab === 'all' || p.category === activeTab)
              .map((post) => (
                <motion.div
                  key={post.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className='p-6 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-white/10 transition-colors'
                >
                  <div className='flex items-start justify-between mb-4'>
                    <div className='flex items-center space-x-3'>
                      <div className='w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xl'>
                        {post.avatar}
                      </div>
                      <div>
                        <div className='flex items-center gap-2'>
                          <span className='font-bold text-white'>{post.author}</span>
                          {post.badge && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                                post.badge === 'official'
                                  ? 'bg-violet-500/20 text-violet-300'
                                  : post.badge === 'maintainer'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-blue-500/20 text-blue-300'
                              }`}
                            >
                              {post.badge}
                            </span>
                          )}
                        </div>
                        <span className='text-sm text-zinc-500'>
                          {post.handle} • {post.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className='text-zinc-300 leading-relaxed mb-6 pl-13'>{post.content}</p>

                  <div className='flex items-center space-x-6 text-zinc-500 text-sm'>
                    <button
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center space-x-2 transition-colors ${post.liked ? 'text-rose-500' : 'hover:text-rose-500'}`}
                    >
                      <Heart className={`w-4 h-4 ${post.liked ? 'fill-current' : ''}`} />
                      <span>{post.likes}</span>
                    </button>
                    <button className='flex items-center space-x-2 hover:text-white transition-colors'>
                      <MessageCircle className='w-4 h-4' />
                      <span>{post.replies}</span>
                    </button>
                    <button className='flex items-center space-x-2 hover:text-white transition-colors'>
                      <Share2 className='w-4 h-4' />
                      <span>{t('communityPage.updates.share')}</span>
                    </button>
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

export default Community
