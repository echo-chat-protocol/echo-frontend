import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Users,
  Calendar,
  Clock,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/HomepageComponents/Navbar'
import Footer from '../../components/HomepageComponents/Footer'

const workshops = [
  {
    title: 'Intro to End-to-End Encryption',
    date: 'May 8, 2026',
    time: '18:00 CET',
    level: 'Beginner',
    levelColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    duration: '90 min',
    seats: 100,
    enrolled: 87,
    instructor: { name: 'Sara Okonkwo', role: 'Backend Engineer, Echo', avatar: '👩‍🏫' },
    description:
      'A hands-on introduction to the core concepts of end-to-end encryption. We cover symmetric vs. asymmetric cryptography, key exchange, and how Echo implements E2EE under the hood.',
    topics: [
      'Symmetric vs Asymmetric crypto',
      'Diffie-Hellman key exchange',
      'The X3DH protocol',
      'AES-256-GCM in practice',
      'Common vulnerabilities & how to avoid them',
    ],
  },
  {
    title: 'Zero-Knowledge Proofs for Developers',
    date: 'June 5, 2026',
    time: '18:00 CET',
    level: 'Intermediate',
    levelColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    duration: '2 hours',
    seats: 60,
    enrolled: 54,
    instructor: { name: 'Lena Hoffmann', role: 'Security Engineer, Open Privacy', avatar: '👩‍💻' },
    description:
      'Practical introduction to zero-knowledge proof systems. Learn how ZK proofs work, their applications in messaging and identity, and how to integrate them into your own projects.',
    topics: [
      'What are ZK proofs?',
      'zk-SNARKs vs zk-STARKs',
      'Building a simple ZK circuit',
      "ZK proofs in Echo's architecture",
      'Libraries: Circom, SnarkJS',
    ],
  },
  {
    title: 'Building on the Echo Protocol',
    date: 'July 3, 2026',
    time: '18:00 CET',
    level: 'Advanced',
    levelColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    duration: '3 hours',
    seats: 40,
    enrolled: 12,
    instructor: { name: 'Marco V.', role: 'Founder, Echo', avatar: '🧑‍💻' },
    description:
      'A deep technical workshop on integrating the Echo Protocol into your own applications. From key management to message delivery guarantees.',
    topics: [
      'Echo SDK setup',
      'Key registration & prekey bundles',
      'Sending your first encrypted message',
      'Group key management',
      'Handling offline delivery',
    ],
  },
]

const PrivacyWorkshop = () => {
  const [expanded, setExpanded] = useState(null)

  return (
    <div className='min-h-screen bg-black text-white selection:bg-amber-500/30'>
      <Navbar />

      <div className='fixed inset-0 pointer-events-none'>
        <div className='absolute top-0 right-0 w-[800px] h-[600px] bg-amber-900/10 rounded-full blur-[140px] opacity-50' />
        <div className='absolute bottom-0 left-0 w-[600px] h-[500px] bg-orange-900/10 rounded-full blur-[120px] opacity-30' />
      </div>

      <main className='relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto'>
        {/* Hero */}
        <div className='text-center mb-20'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className='inline-block px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-sm font-bold mb-6 border border-amber-500/20 uppercase tracking-widest'>
              Monthly Series
            </span>
            <h1 className='text-5xl md:text-7xl font-bold mb-6 tracking-tight'>
              Privacy{' '}
              <span className='text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400'>
                Workshop Series
              </span>
            </h1>
            <p className='text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed'>
              Monthly live workshops on cryptography, privacy engineering, and building secure
              systems. Free for everyone.
            </p>
            <div className='flex items-center justify-center gap-6 text-zinc-500 text-sm mt-8'>
              <span className='flex items-center gap-2'>
                <Calendar className='w-4 h-4 text-amber-400' /> Monthly · First Friday
              </span>
              <span className='flex items-center gap-2'>
                <Clock className='w-4 h-4 text-amber-400' /> 18:00 CET
              </span>
              <span className='flex items-center gap-2'>
                <Users className='w-4 h-4 text-amber-400' /> Limited seats
              </span>
            </div>
          </motion.div>
        </div>

        {/* Workshops */}
        <div className='space-y-5 mb-16'>
          {workshops.map((ws, i) => {
            const pct = Math.round((ws.enrolled / ws.seats) * 100)
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className='rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-white/10 transition-colors overflow-hidden'
              >
                <div className='p-6 md:p-8'>
                  <div className='flex flex-col md:flex-row md:items-start gap-6'>
                    {/* Date block */}
                    <div className='flex-shrink-0 text-center bg-zinc-800 rounded-xl px-5 py-4 w-24'>
                      <div className='text-xs text-zinc-500 uppercase'>{ws.date.split(' ')[0]}</div>
                      <div className='text-3xl font-black text-white'>
                        {ws.date.split(' ')[1].replace(',', '')}
                      </div>
                      <div className='text-xs text-zinc-500'>{ws.date.split(' ')[2]}</div>
                    </div>

                    <div className='flex-1'>
                      <div className='flex flex-wrap items-center gap-3 mb-3'>
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border ${ws.levelColor}`}
                        >
                          {ws.level}
                        </span>
                        <span className='text-xs text-zinc-500 flex items-center gap-1'>
                          <Clock className='w-3 h-3' />
                          {ws.duration}
                        </span>
                        <span className='text-xs text-zinc-500 flex items-center gap-1'>
                          <Calendar className='w-3 h-3' />
                          {ws.time}
                        </span>
                      </div>
                      <h3 className='text-xl md:text-2xl font-bold text-white mb-2'>{ws.title}</h3>
                      <div className='flex items-center gap-3 mb-4'>
                        <span className='text-2xl'>{ws.instructor.avatar}</span>
                        <div>
                          <span className='text-sm font-bold text-white'>{ws.instructor.name}</span>
                          <span className='text-xs text-zinc-500 ml-2'>{ws.instructor.role}</span>
                        </div>
                      </div>

                      {/* Seats progress */}
                      <div className='mb-4'>
                        <div className='flex justify-between text-xs text-zinc-500 mb-1.5'>
                          <span>
                            {ws.enrolled}/{ws.seats} enrolled
                          </span>
                          <span>{ws.seats - ws.enrolled} seats left</span>
                        </div>
                        <div className='h-1.5 rounded-full bg-zinc-800'>
                          <div
                            className='h-full rounded-full bg-amber-500'
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className='flex items-center gap-4'>
                        <button className='px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-lg transition-colors'>
                          Reserve Seat
                        </button>
                        <button
                          onClick={() => setExpanded(expanded === i ? null : i)}
                          className='flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors'
                        >
                          {expanded === i ? (
                            <>
                              <ChevronUp className='w-4 h-4' /> Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className='w-4 h-4' /> Details
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable details */}
                  <motion.div
                    initial={false}
                    animate={{
                      height: expanded === i ? 'auto' : 0,
                      opacity: expanded === i ? 1 : 0,
                    }}
                    className='overflow-hidden'
                  >
                    <div className='pt-6 mt-6 border-t border-white/5 grid md:grid-cols-2 gap-6'>
                      <div>
                        <h4 className='text-sm font-bold text-zinc-300 mb-3 uppercase tracking-wider'>
                          About This Workshop
                        </h4>
                        <p className='text-zinc-400 text-sm leading-relaxed'>{ws.description}</p>
                      </div>
                      <div>
                        <h4 className='text-sm font-bold text-zinc-300 mb-3 uppercase tracking-wider'>
                          What You'll Learn
                        </h4>
                        <ul className='space-y-2'>
                          {ws.topics.map((t, ti) => (
                            <li key={ti} className='flex items-center gap-2 text-sm text-zinc-400'>
                              <CheckCircle className='w-4 h-4 text-amber-400 flex-shrink-0' /> {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )
          })}
        </div>

        <div className='text-center'>
          <Link
            to='/community'
            className='inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors'
          >
            ← Back to Community
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default PrivacyWorkshop
