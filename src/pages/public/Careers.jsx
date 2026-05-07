import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Github,
  Mail,
  ArrowRight,
  Shield,
  Code2,
  Cpu,
  Globe,
  Lock,
  Users,
  Zap,
  Star,
  MessageSquare,
  Heart,
  ChevronRight,
  Terminal,
  Layers,
  Braces,
} from 'lucide-react'
import Navbar from '../components/HomepageComponents/Navbar'
import Footer from '../components/HomepageComponents/Footer'
import PageWrapper from '../components/common/PageWrapper'

/*  Data  */
const PRINCIPLES = [
  {
    n: '01',
    icon: Shield,
    color: 'from-violet-500 to-violet-700',
    title: 'Privacy is non-negotiable',
    body: 'Every feature we ship is evaluated against one question: does this protect the user? We never trade security for growth.',
  },
  {
    n: '02',
    icon: Code2,
    color: 'from-emerald-500 to-emerald-700',
    title: 'Open by design',
    body: 'The entire Echo codebase lives in the open under MIT. Real security cannot be verified in secret.',
  },
  {
    n: '03',
    icon: Cpu,
    color: 'from-fuchsia-500 to-fuchsia-700',
    title: 'Always pushing forward',
    body: "Rust WASM, X3DH, Double Ratchet  we build what doesn't exist yet because the world needs it.",
  },
]

const STACK = [
  { label: 'React 18', icon: Braces, color: 'text-cyan-400' },
  { label: 'Rust + WASM', icon: Cpu, color: 'text-orange-400' },
  { label: 'TypeScript', icon: Braces, color: 'text-blue-400' },
  { label: 'Tailwind CSS', icon: Layers, color: 'text-teal-400' },
  { label: 'WebCrypto', icon: Lock, color: 'text-violet-400' },
  { label: 'Vite 5', icon: Zap, color: 'text-yellow-400' },
  { label: 'Framer Motion', icon: Star, color: 'text-pink-400' },
  { label: 'i18next', icon: Globe, color: 'text-emerald-400' },
]

const PERKS = [
  {
    icon: Lock,
    title: 'Real-world impact',
    body: 'Every line you write encrypts messages for real users.',
  },
  { icon: Users, title: 'No bureaucracy', body: 'Small team. Your PR ships  no committee needed.' },
  { icon: Star, title: 'Public attribution', body: 'Your name in the commit history, forever.' },
  { icon: Terminal, title: 'Modern tooling', body: 'Rust, WASM, React 18  always bleeding edge.' },
  {
    icon: MessageSquare,
    title: 'Async & remote',
    body: 'Contribute from anywhere, on your own schedule.',
  },
  {
    icon: Heart,
    title: 'Mission-driven',
    body: 'We exist to make private communication universal.',
  },
]

const STEPS = [
  {
    label: 'Explore',
    desc: 'Star the repo and read the README. Get familiar with the architecture.',
    href: 'https://github.com/Pringles505/Echo-Chat',
    cta: 'View on GitHub',
  },
  {
    label: 'Claim',
    desc: 'Browse issues tagged good first issue or help wanted and leave a comment.',
    href: 'https://github.com/Pringles505/Echo-Chat/issues',
    cta: 'Open issues',
  },
  {
    label: 'Ship',
    desc: 'Open a pull request. We review every submission with respect and care.',
    href: null,
    cta: null,
  },
]

const fu = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, delay },
})

/*  Page  */
export default function CareersPage() {
  return (
    <PageWrapper>
      <Navbar />

      {/*  HERO  */}
      <section className='relative pt-36 pb-28 px-4 sm:px-6 overflow-hidden'>
        {/* Grid background */}
        <div className='absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none' />
        <div className='absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black pointer-events-none' />
        <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-violet-600/10 blur-[140px] rounded-full pointer-events-none' />

        <div className='relative max-w-5xl mx-auto'>
          <motion.p
            {...fu(0)}
            className='text-violet-400 text-sm font-mono uppercase tracking-[0.2em] mb-6'
          >
            Careers at Echo
          </motion.p>
          <motion.h1
            {...fu(0.06)}
            className='text-6xl md:text-8xl font-extrabold tracking-tighter text-white leading-[0.92] mb-8'
          >
            Build what
            <br />
            <span className='text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400'>
              matters most
            </span>
          </motion.h1>
          <motion.p {...fu(0.12)} className='text-white/45 text-xl max-w-xl leading-relaxed mb-10'>
            Echo is open-source, volunteer-driven, and built by people who believe privacy is a
            human right. No paid roles today but your contribution ships to real users tomorrow.
          </motion.p>
          <motion.div {...fu(0.18)} className='flex flex-wrap gap-3'>
            <a
              href='https://github.com/Pringles505/Echo-Chat'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-2 bg-white text-black font-semibold px-6 py-3 rounded-full hover:bg-white/90 transition-colors text-sm'
            >
              <Github className='w-4 h-4' /> View on GitHub
            </a>
            <a
              href='https://github.com/Pringles505/Echo-Chat/issues'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-2 bg-white/5 border border-white/15 text-white font-medium px-6 py-3 rounded-full hover:bg-white/10 transition-colors text-sm'
            >
              Browse open issues <ArrowRight className='w-4 h-4' />
            </a>
          </motion.div>
        </div>
      </section>

      {/*  PRINCIPLES  */}
      <section className='py-24 px-4 sm:px-6 border-y border-white/[0.06]'>
        <div className='max-w-5xl mx-auto'>
          <motion.p
            {...fu(0)}
            className='text-xs text-white/25 uppercase tracking-[0.2em] text-center mb-14'
          >
            Our principles
          </motion.p>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            {PRINCIPLES.map(({ n, icon: Icon, color, title, body }, i) => (
              <motion.div
                key={n}
                {...fu(i * 0.1)}
                className='relative bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 overflow-hidden group hover:border-white/20 transition-colors duration-500'
              >
                <div
                  className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${color} opacity-[0.06] rounded-full blur-2xl translate-x-10 -translate-y-10 group-hover:opacity-[0.12] transition-opacity duration-500`}
                />
                <span className='text-6xl font-black text-white/[0.06] absolute top-4 right-6 leading-none select-none'>
                  {n}
                </span>
                <div
                  className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-6`}
                >
                  <Icon className='w-5 h-5 text-white' />
                </div>
                <h3 className='text-base font-bold text-white mb-3 leading-snug'>{title}</h3>
                <p className='text-sm text-white/40 leading-relaxed'>{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/*  STACK  */}
      <section className='py-24 px-4 sm:px-6'>
        <div className='max-w-5xl mx-auto'>
          <motion.p
            {...fu(0)}
            className='text-xs text-white/25 uppercase tracking-[0.2em] text-center mb-14'
          >
            Our stack
          </motion.p>
          <motion.div {...fu(0.06)} className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
            {STACK.map(({ label, icon: Icon, color }) => (
              <div
                key={label}
                className='flex items-center gap-3 bg-white/[0.03] border border-white/[0.07] rounded-2xl px-5 py-4 hover:border-white/15 transition-colors'
              >
                <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
                <span className='text-sm text-white/60 font-medium'>{label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/*  WHY CONTRIBUTE  */}
      <section className='py-24 px-4 sm:px-6 border-y border-white/[0.06]'>
        <div className='max-w-5xl mx-auto'>
          <motion.p
            {...fu(0)}
            className='text-xs text-white/25 uppercase tracking-[0.2em] text-center mb-14'
          >
            Why contribute
          </motion.p>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {PERKS.map(({ icon: Icon, title, body }, i) => (
              <motion.div
                key={title}
                {...fu(i * 0.07)}
                className='flex gap-4 p-5 bg-white/[0.02] border border-white/[0.07] rounded-2xl hover:bg-white/[0.05] hover:border-white/15 transition-all duration-300'
              >
                <div className='p-2 bg-violet-500/10 rounded-xl flex-shrink-0 self-start'>
                  <Icon className='w-4 h-4 text-violet-400' />
                </div>
                <div>
                  <p className='text-sm font-semibold text-white mb-1'>{title}</p>
                  <p className='text-xs text-white/35 leading-relaxed'>{body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/*  OPEN POSITIONS  */}
      <section className='py-24 px-4 sm:px-6'>
        <div className='max-w-3xl mx-auto text-center'>
          <motion.p {...fu(0)} className='text-xs text-white/25 uppercase tracking-[0.2em] mb-14'>
            Open positions
          </motion.p>
          <motion.div
            {...fu(0.08)}
            className='border border-dashed border-white/15 rounded-3xl p-16'
          >
            <div className='w-16 h-16 rounded-3xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-6'>
              <Github className='w-8 h-8 text-violet-400' />
            </div>
            <h3 className='text-xl font-bold text-white mb-3'>No paid positions open</h3>
            <p className='text-white/35 text-sm max-w-sm mx-auto leading-relaxed mb-8'>
              Echo runs entirely on volunteer contributions. Star the repo, pick an issue, and open
              a pull request that's how every team member started.
            </p>
            <a
              href='https://github.com/Pringles505/Echo-Chat'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-6 py-3 rounded-full transition-colors'
            >
              <Github className='w-4 h-4' /> Contribute on GitHub
            </a>
          </motion.div>
        </div>
      </section>

      {/*  HOW TO START  */}
      <section className='py-24 px-4 sm:px-6 border-t border-white/[0.06]'>
        <div className='max-w-2xl mx-auto'>
          <motion.p
            {...fu(0)}
            className='text-xs text-white/25 uppercase tracking-[0.2em] text-center mb-14'
          >
            How to get started
          </motion.p>
          <div className='relative'>
            <div className='absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-violet-500/40 via-violet-500/20 to-transparent' />
            <div className='space-y-10'>
              {STEPS.map(({ label, desc, href, cta }, i) => (
                <motion.div key={label} {...fu(i * 0.1)} className='flex gap-6'>
                  <div className='w-10 h-10 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center flex-shrink-0 text-violet-400 text-sm font-bold z-10'>
                    {i + 1}
                  </div>
                  <div className='pt-1.5'>
                    <p className='text-sm font-semibold text-white mb-1'>{label}</p>
                    <p className='text-sm text-white/35 leading-relaxed mb-3'>{desc}</p>
                    {cta && href && (
                      <a
                        href={href}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors'
                      >
                        {cta} <ChevronRight className='w-3 h-3' />
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/*  FINAL CTA  */}
      <section className='py-24 px-4 sm:px-6'>
        <motion.div
          {...fu(0)}
          className='max-w-5xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-900/40 to-black border border-violet-500/20 p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8'
        >
          <div className='absolute inset-0 bg-[radial-gradient(circle_at_0%_50%,rgba(139,92,246,0.15),transparent_60%)] pointer-events-none' />
          <div className='relative'>
            <h2 className='text-3xl font-bold text-white mb-3 tracking-tight'>
              Still have questions?
            </h2>
            <p className='text-white/40 max-w-md leading-relaxed'>
              Whether you're curious about the protocol, want to join the team, or just want to say
              hello we read every message.
            </p>
          </div>
          <a
            href='mailto:support@echo-chat.dev'
            className='relative flex-shrink-0 inline-flex items-center gap-2 bg-white text-black font-semibold px-7 py-3.5 rounded-full hover:bg-white/90 transition-colors text-sm whitespace-nowrap'
          >
            <Mail className='w-4 h-4' /> Email us
          </a>
        </motion.div>
      </section>

      <Footer />
    </PageWrapper>
  )
}
