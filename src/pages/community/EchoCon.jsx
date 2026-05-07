import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, MapPin, Users, Mic, Code, Globe, ArrowRight, Star, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/HomepageComponents/Navbar'
import Footer from '../../components/HomepageComponents/Footer'

const speakers = [
  {
    name: 'Dr. Alice Chen',
    role: 'Cryptography Researcher, MIT',
    topic: 'Post-Quantum Protocols',
    avatar: '👩‍🔬',
    featured: true,
  },
  {
    name: 'Marco V.',
    role: 'Founder, Echo',
    topic: 'Echo v3.0 Vision',
    avatar: '🧑‍💻',
    featured: true,
  },
  {
    name: 'Lena Hoffmann',
    role: 'Security Engineer, Open Privacy',
    topic: 'Zero-Knowledge in Production',
    avatar: '👩‍💻',
    featured: true,
  },
  {
    name: 'James Park',
    role: 'Protocol Lead, Signal',
    topic: 'The Double Ratchet Today',
    avatar: '🕵️',
    featured: false,
  },
  {
    name: 'Sara Okonkwo',
    role: 'Backend Engineer, Echo',
    topic: 'Scaling Encrypted Infra',
    avatar: '👩‍🏫',
    featured: false,
  },
  {
    name: 'Dmitri Volkov',
    role: 'Open Source Advocate',
    topic: 'Community Governance Models',
    avatar: '🧑‍🏫',
    featured: false,
  },
]

const agenda = [
  {
    day: 'Day 1 – Jun 10',
    time: '09:00',
    title: 'Opening Keynote & Echo v3 Announcement',
    speaker: 'Marco V.',
  },
  {
    day: 'Day 1 – Jun 10',
    time: '10:30',
    title: 'Post-Quantum Cryptography Deep Dive',
    speaker: 'Dr. Alice Chen',
  },
  { day: 'Day 1 – Jun 10', time: '12:00', title: 'Lunch & Networking' },
  {
    day: 'Day 1 – Jun 10',
    time: '14:00',
    title: 'Zero-Knowledge Proofs in Real Products',
    speaker: 'Lena Hoffmann',
  },
  {
    day: 'Day 1 – Jun 10',
    time: '16:00',
    title: 'Open Source Panel Discussion',
    speaker: 'All Speakers',
  },
  {
    day: 'Day 2 – Jun 11',
    time: '09:00',
    title: 'Scaling End-to-End Encrypted Infrastructure',
    speaker: 'Sara Okonkwo',
  },
  {
    day: 'Day 2 – Jun 11',
    time: '10:30',
    title: 'The Double Ratchet Algorithm: Past & Future',
    speaker: 'James Park',
  },
  { day: 'Day 2 – Jun 11', time: '12:00', title: 'Lunch & Networking' },
  {
    day: 'Day 2 – Jun 11',
    time: '14:00',
    title: 'Community Governance Workshop',
    speaker: 'Dmitri Volkov',
  },
  { day: 'Day 2 – Jun 11', time: '16:30', title: 'Closing Ceremony & Awards' },
]

const stats = [
  { label: 'Attendees', value: '800+', icon: Users },
  { label: 'Speakers', value: '18', icon: Mic },
  { label: 'Sessions', value: '14', icon: Code },
  { label: 'Countries', value: '40+', icon: Globe },
]

const EchoCon = () => {
  const [activeDay, setActiveDay] = useState('Day 1 – Jun 10')

  return (
    <div className='min-h-screen bg-black text-white selection:bg-violet-500/30'>
      <Navbar />

      <div className='fixed inset-0 pointer-events-none'>
        <div className='absolute top-0 left-0 w-[900px] h-[600px] bg-violet-900/15 rounded-full blur-[140px] opacity-60' />
        <div className='absolute bottom-0 right-0 w-[600px] h-[500px] bg-indigo-900/15 rounded-full blur-[120px] opacity-40' />
      </div>

      <main className='relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto'>
        {/* Hero */}
        <div className='text-center mb-24'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className='inline-block px-4 py-1.5 rounded-full bg-violet-500/10 text-violet-400 text-sm font-bold mb-6 border border-violet-500/20 uppercase tracking-widest'>
              In-Person + Streaming
            </span>
            <h1 className='text-6xl md:text-8xl font-black mb-4 tracking-tighter'>
              ECHO
              <span className='text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400'>
                CON
              </span>
            </h1>
            <p className='text-2xl text-zinc-400 font-light mb-2'>Developer Conference 2026</p>
            <div className='flex items-center justify-center gap-6 text-zinc-500 text-sm mt-6 mb-10'>
              <span className='flex items-center gap-2'>
                <Calendar className='w-4 h-4 text-violet-400' /> June 10–11, 2026
              </span>
              <span className='flex items-center gap-2'>
                <MapPin className='w-4 h-4 text-violet-400' /> Madrid, Spain + Live Stream
              </span>
              <span className='flex items-center gap-2'>
                <Clock className='w-4 h-4 text-violet-400' /> 2 Days
              </span>
            </div>
            <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
              <button className='px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white font-bold text-lg rounded-full transition-all shadow-[0_0_25px_rgba(139,92,246,0.35)]'>
                Register Now
              </button>
              <button className='px-8 py-4 bg-zinc-900 text-white font-bold text-lg rounded-full border border-white/10 hover:bg-zinc-800 transition-all'>
                View Full Agenda
              </button>
            </div>
          </motion.div>
        </div>

        {/* Stats */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-6 mb-24'>
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className='p-6 rounded-2xl bg-zinc-900/30 border border-white/5 text-center'
            >
              <s.icon className='w-6 h-6 text-violet-400 mx-auto mb-3' />
              <div className='text-3xl font-black text-white mb-1'>{s.value}</div>
              <div className='text-sm text-zinc-500'>{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Featured Speakers */}
        <div className='mb-24'>
          <h2 className='text-3xl font-bold mb-10'>Featured Speakers</h2>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
            {speakers
              .filter((s) => s.featured)
              .map((s, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -5 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className='p-8 rounded-3xl bg-zinc-900/50 border border-violet-500/20 hover:border-violet-500/40 transition-colors text-center'
                >
                  <div className='w-20 h-20 mx-auto rounded-full bg-zinc-800 border-2 border-violet-500/30 flex items-center justify-center text-4xl mb-5'>
                    {s.avatar}
                  </div>
                  <h3 className='text-xl font-bold mb-1'>{s.name}</h3>
                  <p className='text-violet-400 text-xs font-bold uppercase tracking-wider mb-3'>
                    {s.role}
                  </p>
                  <div className='inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-xs text-zinc-400'>
                    <Mic className='w-3 h-3' /> {s.topic}
                  </div>
                </motion.div>
              ))}
          </div>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            {speakers
              .filter((s) => !s.featured)
              .map((s, i) => (
                <div
                  key={i}
                  className='flex items-center gap-4 p-5 rounded-2xl bg-zinc-900/30 border border-white/5'
                >
                  <div className='w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-2xl flex-shrink-0'>
                    {s.avatar}
                  </div>
                  <div>
                    <h3 className='font-bold text-sm'>{s.name}</h3>
                    <p className='text-zinc-500 text-xs'>{s.role}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Agenda */}
        <div className='mb-24'>
          <h2 className='text-3xl font-bold mb-8'>Schedule</h2>
          <div className='flex gap-3 mb-8'>
            {['Day 1 – Jun 10', 'Day 2 – Jun 11'].map((day) => (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  activeDay === day
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/10'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
          <div className='space-y-3'>
            {agenda
              .filter((a) => a.day === activeDay)
              .map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className='flex items-center gap-6 p-5 rounded-xl bg-zinc-900/30 border border-white/5'
                >
                  <div className='w-16 text-sm font-mono text-violet-400 flex-shrink-0'>
                    {item.time}
                  </div>
                  <div>
                    <h3 className='font-bold text-white'>{item.title}</h3>
                    {item.speaker && <p className='text-zinc-500 text-sm mt-0.5'>{item.speaker}</p>}
                  </div>
                </motion.div>
              ))}
          </div>
        </div>

        {/* Location */}
        <div className='rounded-3xl overflow-hidden bg-zinc-900/50 border border-white/10 p-8 md:p-12 mb-16'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-10 items-center'>
            <div>
              <h2 className='text-3xl font-bold mb-4'>Venue</h2>
              <p className='text-zinc-400 mb-6 leading-relaxed'>
                EchoCon 2026 takes place at the{' '}
                <span className='text-white font-semibold'>Espacio Rastro</span>, a modern event
                space in the heart of Madrid — with a full live stream for remote attendees.
              </p>
              <div className='space-y-3 text-sm text-zinc-400'>
                <div className='flex items-center gap-3'>
                  <MapPin className='w-4 h-4 text-violet-400' /> Calle de la Ribera de Curtidores,
                  12, Madrid
                </div>
                <div className='flex items-center gap-3'>
                  <Calendar className='w-4 h-4 text-violet-400' /> June 10–11, 2026 · Doors open
                  08:30
                </div>
                <div className='flex items-center gap-3'>
                  <Globe className='w-4 h-4 text-violet-400' /> Free live stream available worldwide
                </div>
              </div>
            </div>
            <div className='aspect-video bg-zinc-800 rounded-2xl overflow-hidden border border-white/10'>
              <iframe
                src='https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3038!2d-3.7038!3d40.4063!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDI0JzIyLjciTiAzwrA0MicxMy43Ilc!5e0!3m2!1ses!2ses!4v1234567890'
                width='100%'
                height='100%'
                style={{ border: 0 }}
                allowFullScreen
                loading='lazy'
                referrerPolicy='no-referrer-when-downgrade'
              />
            </div>
          </div>
        </div>

        <div className='text-center'>
          <Link
            to='/community'
            className='inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors'
          >
            ← Back to Community
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default EchoCon
