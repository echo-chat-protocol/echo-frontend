import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Code, Star, GitPullRequest, Shield, Trophy, ArrowLeft, Search, Filter } from 'lucide-react'
import { Link } from 'react-router-dom'
import Navbar from '../components/HomepageComponents/Navbar'
import Footer from '../components/HomepageComponents/Footer'

const ALL_CONTRIBUTORS = [
  {
    rank: 1,
    name: 'David K.',
    handle: '@davidk',
    avatar: '👨‍🏫',
    role: 'Community Lead',
    commits: 850,
    prs: 142,
    stars: 1240,
    badge: 'core',
    joined: 'Jan 2024',
  },
  {
    rank: 2,
    name: 'Sarah J.',
    handle: '@sarahj',
    avatar: '👩‍💻',
    role: 'Core Maintainer',
    commits: 720,
    prs: 118,
    stars: 980,
    badge: 'core',
    joined: 'Feb 2024',
  },
  {
    rank: 3,
    name: 'Elena R.',
    handle: '@elenar',
    avatar: '🎨',
    role: 'UI/UX Designer',
    commits: 510,
    prs: 87,
    stars: 430,
    badge: 'design',
    joined: 'Mar 2024',
  },
  {
    rank: 4,
    name: 'Marcus T.',
    handle: '@marcust',
    avatar: '🔐',
    role: 'Security Engineer',
    commits: 480,
    prs: 74,
    stars: 870,
    badge: 'security',
    joined: 'Jan 2024',
  },
  {
    rank: 5,
    name: 'Yuki S.',
    handle: '@yukis',
    avatar: '⚡',
    role: 'Protocol Engineer',
    commits: 440,
    prs: 65,
    stars: 760,
    badge: 'core',
    joined: 'Apr 2024',
  },
  {
    rank: 6,
    name: 'Alex M.',
    handle: '@alexm',
    avatar: '🕵️',
    role: 'Security Researcher',
    commits: 390,
    prs: 58,
    stars: 640,
    badge: 'security',
    joined: 'May 2024',
  },
  {
    rank: 7,
    name: 'Priya N.',
    handle: '@priyan',
    avatar: '👩‍🔬',
    role: 'Crypto Researcher',
    commits: 370,
    prs: 52,
    stars: 580,
    badge: 'research',
    joined: 'Jun 2024',
  },
  {
    rank: 8,
    name: 'Felix H.',
    handle: '@felixh',
    avatar: '🦀',
    role: 'Rust Backend Dev',
    commits: 340,
    prs: 49,
    stars: 510,
    badge: 'core',
    joined: 'Jul 2024',
  },
  {
    rank: 9,
    name: 'Lena V.',
    handle: '@lenav',
    avatar: '📱',
    role: 'Mobile Developer',
    commits: 310,
    prs: 44,
    stars: 490,
    badge: 'mobile',
    joined: 'Aug 2024',
  },
  {
    rank: 10,
    name: 'Omar A.',
    handle: '@omara',
    avatar: '🌐',
    role: 'Infra Engineer',
    commits: 290,
    prs: 41,
    stars: 410,
    badge: 'infra',
    joined: 'Sep 2024',
  },
  {
    rank: 11,
    name: 'Camille B.',
    handle: '@camilleb',
    avatar: '🎓',
    role: 'Docs Contributor',
    commits: 270,
    prs: 38,
    stars: 230,
    badge: 'docs',
    joined: 'Sep 2024',
  },
  {
    rank: 12,
    name: 'Riku M.',
    handle: '@rikum',
    avatar: '🧩',
    role: 'SDK Developer',
    commits: 255,
    prs: 36,
    stars: 370,
    badge: 'sdk',
    joined: 'Oct 2024',
  },
  {
    rank: 13,
    name: 'Ana G.',
    handle: '@anag',
    avatar: '🔬',
    role: 'QA Engineer',
    commits: 240,
    prs: 34,
    stars: 280,
    badge: 'qa',
    joined: 'Oct 2024',
  },
  {
    rank: 14,
    name: 'Tom W.',
    handle: '@tomw',
    avatar: '⚙️',
    role: 'DevOps Engineer',
    commits: 225,
    prs: 31,
    stars: 310,
    badge: 'infra',
    joined: 'Nov 2024',
  },
  {
    rank: 15,
    name: 'Hana L.',
    handle: '@hanal',
    avatar: '🌸',
    role: 'Frontend Developer',
    commits: 210,
    prs: 29,
    stars: 270,
    badge: 'design',
    joined: 'Nov 2024',
  },
  {
    rank: 16,
    name: 'Diego P.',
    handle: '@diegop',
    avatar: '🏆',
    role: 'Community Manager',
    commits: 195,
    prs: 27,
    stars: 200,
    badge: 'community',
    joined: 'Dec 2024',
  },
  {
    rank: 17,
    name: 'Nadia B.',
    handle: '@nadiab',
    avatar: '🔑',
    role: 'Crypto Auditor',
    commits: 185,
    prs: 25,
    stars: 380,
    badge: 'security',
    joined: 'Jan 2025',
  },
  {
    rank: 18,
    name: 'Jake R.',
    handle: '@jaker',
    avatar: '📡',
    role: 'WebSocket Engineer',
    commits: 175,
    prs: 23,
    stars: 290,
    badge: 'core',
    joined: 'Jan 2025',
  },
  {
    rank: 19,
    name: 'Mei Z.',
    handle: '@meiz',
    avatar: '💡',
    role: 'Feature Developer',
    commits: 165,
    prs: 21,
    stars: 220,
    badge: 'sdk',
    joined: 'Feb 2025',
  },
  {
    rank: 20,
    name: 'Karl S.',
    handle: '@karls',
    avatar: '🖥️',
    role: 'Systems Developer',
    commits: 155,
    prs: 19,
    stars: 260,
    badge: 'core',
    joined: 'Mar 2025',
  },
  {
    rank: 21,
    name: 'Rosa M.',
    handle: '@rosam',
    avatar: '📖',
    role: 'Technical Writer',
    commits: 145,
    prs: 17,
    stars: 150,
    badge: 'docs',
    joined: 'Mar 2025',
  },
  {
    rank: 22,
    name: 'Ivan P.',
    handle: '@ivanp',
    avatar: '🔒',
    role: 'Penetration Tester',
    commits: 135,
    prs: 15,
    stars: 310,
    badge: 'security',
    joined: 'Apr 2025',
  },
  {
    rank: 23,
    name: 'Chloe D.',
    handle: '@chloed',
    avatar: '🎯',
    role: 'Product Engineer',
    commits: 125,
    prs: 13,
    stars: 190,
    badge: 'sdk',
    joined: 'May 2025',
  },
  {
    rank: 24,
    name: 'Sam O.',
    handle: '@samo',
    avatar: '🌍',
    role: 'i18n Contributor',
    commits: 115,
    prs: 11,
    stars: 120,
    badge: 'docs',
    joined: 'Jun 2025',
  },
  {
    rank: 25,
    name: 'Aiko T.',
    handle: '@aikot',
    avatar: '🤖',
    role: 'AI Integrations',
    commits: 105,
    prs: 9,
    stars: 240,
    badge: 'core',
    joined: 'Jul 2025',
  },
]

const BADGE_STYLES = {
  core: 'bg-violet-500/15 text-violet-300 border border-violet-500/25',
  security: 'bg-rose-500/15    text-rose-300    border border-rose-500/25',
  design: 'bg-pink-500/15    text-pink-300    border border-pink-500/25',
  research: 'bg-amber-500/15   text-amber-300   border border-amber-500/25',
  mobile: 'bg-cyan-500/15    text-cyan-300    border border-cyan-500/25',
  infra: 'bg-indigo-500/15  text-indigo-300  border border-indigo-500/25',
  docs: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
  sdk: 'bg-teal-500/15    text-teal-300    border border-teal-500/25',
  qa: 'bg-orange-500/15  text-orange-300  border border-orange-500/25',
  community: 'bg-blue-500/15   text-blue-300    border border-blue-500/25',
}

const RANK_STYLES = {
  1: 'text-yellow-400 font-black text-xl',
  2: 'text-zinc-300   font-black text-xl',
  3: 'text-amber-600  font-black text-xl',
}

const PODIUM_RING = {
  1: 'ring-2 ring-yellow-400/50',
  2: 'ring-2 ring-zinc-400/40',
  3: 'ring-2 ring-amber-600/40',
}

const SORT_OPTIONS = ['Commits', 'Pull Requests', 'Stars']

const Leaderboard = () => {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('Commits')
  const [badgeFilter, setBadgeFilter] = useState('All')

  const badges = ['All', ...Array.from(new Set(ALL_CONTRIBUTORS.map((c) => c.badge)))]

  const sortKey = { Commits: 'commits', 'Pull Requests': 'prs', Stars: 'stars' }[sort]

  const filtered = ALL_CONTRIBUTORS.filter(
    (c) =>
      (badgeFilter === 'All' || c.badge === badgeFilter) &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.handle.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => b[sortKey] - a[sortKey])

  return (
    <div className='min-h-screen bg-black text-white selection:bg-violet-500/30'>
      <Navbar />

      <div className='fixed inset-0 pointer-events-none'>
        <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-violet-900/10 rounded-full blur-[140px] opacity-60' />
      </div>

      <main className='relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-16'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className='inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400 text-sm font-bold mb-6 border border-yellow-500/20'>
              <Trophy className='w-4 h-4' /> Top Contributors
            </div>
            <h1 className='text-5xl md:text-7xl font-black mb-4 tracking-tighter'>
              Full{' '}
              <span className='text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400'>
                Leaderboard
              </span>
            </h1>
            <p className='text-zinc-400 text-lg max-w-xl mx-auto'>
              The 25 people who make Echo possible. Ranked by total contributions.
            </p>
          </motion.div>
        </div>

        {/* Podium top 3 */}
        <div className='grid grid-cols-3 gap-4 mb-16 max-w-2xl mx-auto items-end'>
          {[ALL_CONTRIBUTORS[1], ALL_CONTRIBUTORS[0], ALL_CONTRIBUTORS[2]].map((c) => (
            <motion.div
              key={c.rank}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: c.rank === 1 ? 0.1 : c.rank === 2 ? 0.2 : 0.3 }}
              className={`flex flex-col items-center text-center p-5 rounded-2xl bg-zinc-900/50 border border-white/5 ${c.rank === 1 ? 'scale-110 origin-bottom border-yellow-400/20 bg-zinc-900/70' : ''}`}
            >
              <div
                className={`w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-3xl mb-3 ${PODIUM_RING[c.rank]}`}
              >
                {c.avatar}
              </div>
              <div className={RANK_STYLES[c.rank] || 'text-zinc-400 font-bold'}>#{c.rank}</div>
              <div className='font-bold text-sm mt-1'>{c.name}</div>
              <div className='text-zinc-500 text-xs'>{c.commits} commits</div>
            </motion.div>
          ))}
        </div>

        {/* Controls */}
        <div className='flex flex-col sm:flex-row gap-4 mb-8'>
          <div className='flex-1 relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500' />
            <input
              type='text'
              placeholder='Search contributor...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors'
            />
          </div>

          <div className='flex items-center gap-2 flex-wrap'>
            <Filter className='w-4 h-4 text-zinc-500 flex-shrink-0' />
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setSort(opt)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${sort === opt ? 'bg-violet-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/10'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Badge filters */}
        <div className='flex flex-wrap gap-2 mb-8'>
          {badges.map((b) => (
            <button
              key={b}
              onClick={() => setBadgeFilter(b)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all capitalize ${
                badgeFilter === b
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/10'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className='overflow-hidden rounded-2xl border border-white/5'>
          {/* Header */}
          <div className='grid grid-cols-[2rem_1fr_auto_auto_auto_auto] gap-x-4 px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider bg-zinc-900/60 border-b border-white/5'>
            <span>#</span>
            <span>Contributor</span>
            <span className='hidden md:block'>Badge</span>
            <span className='text-center hidden sm:block'>Commits</span>
            <span className='text-center hidden sm:block'>PRs</span>
            <span className='text-center hidden sm:block'>Stars</span>
          </div>

          {filtered.map((c, i) => (
            <motion.div
              key={c.rank}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className='grid grid-cols-[2rem_1fr_auto_auto_auto_auto] gap-x-4 items-center px-6 py-4 border-b border-white/5 hover:bg-zinc-900/30 transition-colors last:border-0'
            >
              {/* Rank */}
              <span className={RANK_STYLES[c.rank] || 'text-zinc-500 font-bold text-sm'}>
                {c.rank <= 3 ? ['🥇', '🥈', '🥉'][c.rank - 1] : c.rank}
              </span>

              {/* Identity */}
              <div className='flex items-center gap-3 min-w-0'>
                <div
                  className={`w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xl flex-shrink-0 ${PODIUM_RING[c.rank] || ''}`}
                >
                  {c.avatar}
                </div>
                <div className='min-w-0'>
                  <div className='font-bold text-white text-sm truncate'>{c.name}</div>
                  <div className='text-zinc-500 text-xs truncate'>{c.role}</div>
                </div>
              </div>

              {/* Badge */}
              <span
                className={`hidden md:inline-flex text-[10px] font-bold px-2 py-1 rounded-full capitalize ${BADGE_STYLES[c.badge]}`}
              >
                {c.badge}
              </span>

              {/* Stats */}
              <div className='hidden sm:flex items-center gap-1.5 justify-center text-sm text-zinc-300'>
                <Code className='w-3.5 h-3.5 text-zinc-500' />
                {c.commits}
              </div>
              <div className='hidden sm:flex items-center gap-1.5 justify-center text-sm text-zinc-300'>
                <GitPullRequest className='w-3.5 h-3.5 text-zinc-500' />
                {c.prs}
              </div>
              <div className='hidden sm:flex items-center gap-1.5 justify-center text-sm text-zinc-300'>
                <Star className='w-3.5 h-3.5 text-zinc-500' />
                {c.stars}
              </div>
            </motion.div>
          ))}
        </div>

        <div className='mt-6 text-center text-zinc-600 text-xs'>
          Data last updated: February 25, 2026
        </div>

        <div className='mt-12 text-center'>
          <Link
            to='/community'
            className='inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors'
          >
            <ArrowLeft className='w-4 h-4' /> Back to Community
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Leaderboard
