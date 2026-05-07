import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Github,
  Code,
  Star,
  GitPullRequest,
  Calendar,
  MapPin,
  Clock,
  Users,
  Zap,
  Award,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/HomepageComponents/Navbar'
import Footer from '../../components/HomepageComponents/Footer'

const projects = [
  {
    name: 'echo-core',
    description: 'The main Echo Protocol implementation — Rust backend.',
    tag: 'Core',
    tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    stars: 2840,
    issues: 18,
    difficulty: 'Advanced',
  },
  {
    name: 'echo-sdk-js',
    description: 'JavaScript/TypeScript client SDK for integrating Echo Protocol.',
    tag: 'SDK',
    tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    stars: 1120,
    issues: 34,
    difficulty: 'Intermediate',
  },
  {
    name: 'echo-frontend',
    description: 'React web app — this very project. UI, UX, components.',
    tag: 'Frontend',
    tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    stars: 874,
    issues: 42,
    difficulty: 'Beginner',
  },
  {
    name: 'echo-docs',
    description: 'Official documentation site. Contribute guides, fix typos.',
    tag: 'Docs',
    tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    stars: 310,
    issues: 9,
    difficulty: 'Beginner',
  },
  {
    name: 'echo-mobile',
    description: 'React Native mobile app — iOS & Android.',
    tag: 'Mobile',
    tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    stars: 640,
    issues: 27,
    difficulty: 'Intermediate',
  },
  {
    name: 'echo-infra',
    description: 'Infrastructure, Docker configs, Kubernetes manifests.',
    tag: 'Infra',
    tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    stars: 490,
    issues: 11,
    difficulty: 'Advanced',
  },
]

const schedule = [
  { time: '10:00', event: 'Kick-off stream — Team welcome & project overview' },
  { time: '10:30', event: 'Issue triage session — pick your first contribution' },
  { time: '12:00', event: 'Lunch break (remote: take a walk!)' },
  { time: '13:00', event: 'Core team live coding — pairing on open issues' },
  { time: '15:00', event: 'PR submission wave — aim to merge 50 PRs by 17:00' },
  { time: '17:00', event: 'Closing ceremony — top contributors announced' },
]

const difficultyColors = {
  Beginner: 'text-emerald-400',
  Intermediate: 'text-amber-400',
  Advanced: 'text-rose-400',
}

const OpenSourceDay = () => {
  const [filter, setFilter] = useState('All')
  const filters = ['All', 'Beginner', 'Intermediate', 'Advanced']

  const filtered = filter === 'All' ? projects : projects.filter((p) => p.difficulty === filter)

  return (
    <div className='min-h-screen bg-black text-white selection:bg-emerald-500/30'>
      <Navbar />

      <div className='fixed inset-0 pointer-events-none'>
        <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-emerald-900/10 rounded-full blur-[140px] opacity-50' />
      </div>

      <main className='relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto'>
        {/* Hero */}
        <div className='text-center mb-20'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className='inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-bold mb-6 border border-emerald-500/20 uppercase tracking-widest'>
              Annual Event
            </span>
            <h1 className='text-5xl md:text-7xl font-bold mb-6 tracking-tight'>
              Open Source{' '}
              <span className='text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400'>
                Contributors Day
              </span>
            </h1>
            <p className='text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-8'>
              A full day dedicated to pushing Echo's open source projects forward together. Pick an
              issue, write code, get merged.
            </p>
            <div className='flex flex-wrap items-center justify-center gap-6 text-zinc-500 text-sm mb-10'>
              <span className='flex items-center gap-2'>
                <Calendar className='w-4 h-4 text-emerald-400' /> July 4, 2026
              </span>
              <span className='flex items-center gap-2'>
                <Clock className='w-4 h-4 text-emerald-400' /> 10:00 – 18:00 CET
              </span>
              <span className='flex items-center gap-2'>
                <Github className='w-4 h-4 text-emerald-400' /> Remote · GitHub
              </span>
            </div>
            <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
              <a
                href='https://github.com/echo-chat-protocol'
                target='_blank'
                rel='noreferrer'
                className='flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg rounded-full transition-all'
              >
                <Github className='w-5 h-5' /> Join on GitHub
              </a>
              <button className='px-8 py-4 bg-zinc-900 text-white font-bold text-lg rounded-full border border-white/10 hover:bg-zinc-800 transition-all'>
                Get Notified
              </button>
            </div>
          </motion.div>
        </div>

        {/* Stats strip */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-5 mb-24'>
          {[
            { icon: Users, label: 'Last year contributors', value: '180+' },
            { icon: GitPullRequest, label: 'PRs merged', value: '94' },
            { icon: Star, label: 'New GitHub stars', value: '650+' },
            { icon: Award, label: 'Prizes handed out', value: '12' },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className='p-6 rounded-2xl bg-zinc-900/30 border border-white/5 text-center'
            >
              <s.icon className='w-6 h-6 text-emerald-400 mx-auto mb-3' />
              <div className='text-3xl font-black text-white mb-1'>{s.value}</div>
              <div className='text-xs text-zinc-500'>{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Projects */}
        <div className='mb-24'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8'>
            <h2 className='text-3xl font-bold'>Projects to Contribute To</h2>
            <div className='flex gap-2'>
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    filter === f
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/10'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
            {filtered.map((proj, i) => (
              <motion.div
                key={proj.name}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -4 }}
                className='p-6 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-emerald-500/30 transition-colors'
              >
                <div className='flex items-start justify-between mb-4'>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${proj.tagColor}`}
                  >
                    {proj.tag}
                  </span>
                  <span className={`text-xs font-bold ${difficultyColors[proj.difficulty]}`}>
                    {proj.difficulty}
                  </span>
                </div>
                <div className='flex items-center gap-2 mb-2'>
                  <Github className='w-4 h-4 text-zinc-500' />
                  <h3 className='font-bold text-white'>{proj.name}</h3>
                </div>
                <p className='text-zinc-400 text-sm leading-relaxed mb-5'>{proj.description}</p>
                <div className='flex items-center justify-between text-xs text-zinc-500 border-t border-white/5 pt-4'>
                  <span className='flex items-center gap-1'>
                    <Star className='w-3.5 h-3.5' /> {proj.stars.toLocaleString()}
                  </span>
                  <span className='flex items-center gap-1'>
                    <Code className='w-3.5 h-3.5' /> {proj.issues} open issues
                  </span>
                  <a
                    href='#'
                    className='flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors font-medium'
                  >
                    Explore <Zap className='w-3.5 h-3.5' />
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div className='max-w-3xl mx-auto mb-16'>
          <h2 className='text-3xl font-bold mb-10 text-center'>Day Schedule</h2>
          <div className='space-y-4 border-l-2 border-white/10 pl-8 ml-4'>
            {schedule.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className='relative'
              >
                <div className='absolute -left-[41px] top-1 w-4 h-4 rounded-full bg-black border-4 border-emerald-500' />
                <div className='text-emerald-400 font-mono text-sm mb-1'>{item.time}</div>
                <p className='text-zinc-300'>{item.event}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className='text-center'>
          <Link
            to='/community'
            className='inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors'
          >
            ← Back to Community
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default OpenSourceDay
