import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HelpCircle,
  ChevronDown,
  MessageCircle,
  Book,
  Shield,
  Zap,
  Search,
  ArrowRight,
} from 'lucide-react'
import Navbar from '../components/HomepageComponents/Navbar'
import Footer from '../components/HomepageComponents/Footer'
import ParticlesBackground from '../components/HomepageComponents/ParticlesBackground'

const CATEGORIES = [
  {
    id: 'general',
    icon: HelpCircle,
    label: 'General',
    faqs: [
      {
        q: 'What is Echo?',
        a: 'Echo is an open-source, end-to-end encrypted messaging application. All cryptographic operations are performed client-side using custom Rust modules compiled to WebAssembly, meaning your keys and messages never leave your device in plaintext.',
      },
      {
        q: 'Is Echo free?',
        a: 'Yes. Echo is free and open source under the MIT licence. The web app is always free. Premium features for teams and enterprises are planned for the future.',
      },
      {
        q: 'What platforms does Echo support?',
        a: 'Echo currently runs as a web app in any modern browser. A native desktop app (Windows, macOS, Linux) built with Tauri is in active development. Mobile apps are on the roadmap for 2026.',
      },
      {
        q: 'Do I need to install anything?',
        a: 'No. You can use Echo directly from your browser at any time. If you prefer a native desktop experience, download the Tauri-based app when it is released.',
      },
    ],
  },
  {
    id: 'security',
    icon: Shield,
    label: 'Security & Privacy',
    faqs: [
      {
        q: 'How does Echo encrypt my messages?',
        a: 'Echo uses the X3DH (Extended Triple Diffie-Hellman) key agreement protocol to establish a shared secret between users, combined with AES-256 symmetric encryption for message content. All of this runs in your browser via WebAssembly.',
      },
      {
        q: 'Can Echo read my messages?',
        a: 'No. Echo uses true end-to-end encryption. Private keys are generated and remain on your device. The server only ever sees encrypted ciphertext and never has access to your plaintext messages or private keys.',
      },
      {
        q: 'What is XEdDSA and why does Echo use it?',
        a: 'XEdDSA is a signature scheme that enables EdDSA-style cryptographic signatures using X25519 (Curve25519) keys. Echo uses it to authenticate signed pre-keys during key exchange, preventing man-in-the-middle attacks.',
      },
      {
        q: 'Are deleted messages truly deleted?',
        a: 'Messages are stored encrypted on the server so conversations can sync across sessions. We are working on a local-only storage mode for maximum privacy where nothing is persisted server-side.',
      },
    ],
  },
  {
    id: 'account',
    icon: Zap,
    label: 'Account & Usage',
    faqs: [
      {
        q: 'How do I create an account?',
        a: 'Navigate to /register, enter a username and password, and your cryptographic keys are automatically generated on your device during registration.',
      },
      {
        q: 'What happens if I forget my password?',
        a: 'Because key material is derived from your credentials, password recovery is currently not available without risking key compromise. We are designing a secure account-recovery flow for a future release.',
      },
      {
        q: 'Can I run Echo on my own server?',
        a: 'Self-hosting is on the roadmap. The backend is open source and documented. For now, you can run it locally by cloning the repository and following the README setup instructions.',
      },
      {
        q: 'How do I change my profile picture?',
        a: 'Navigate to your profile page from the Dashboard sidebar. Click your avatar to upload a new image. Images are processed and stored client-side before being sent.',
      },
    ],
  },
  {
    id: 'developer',
    icon: Book,
    label: 'Developer',
    faqs: [
      {
        q: 'How do I build Echo locally?',
        a: 'You need Node.js 20+, Rust, and wasm-pack. Clone the repository, build each Rust WASM module with `wasm-pack build --target web`, then run `npm install && npm run dev`. See the README for detailed steps.',
      },
      {
        q: 'Can I contribute to Echo?',
        a: 'Absolutely. Echo is open source under the MIT licence. Fork the repository on GitHub, make your changes on a feature branch, and open a pull request. All contributions are welcome.',
      },
      {
        q: 'Where is the API documentation?',
        a: 'Visit /docs for the full protocol documentation, or use the API Playground at /api-playground to try live requests against the Echo API.',
      },
    ],
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.5 } }),
}

const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={`border rounded-xl transition-all duration-300 ${open ? 'border-violet-500/40 bg-violet-600/5' : 'border-white/10 bg-white/5'}`}
    >
      <button
        onClick={() => setOpen(!open)}
        className='w-full flex items-center justify-between gap-4 p-5 text-left'
      >
        <span className='text-sm font-medium text-white'>{q}</span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-zinc-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className='overflow-hidden'
          >
            <p className='px-5 pb-5 text-sm text-zinc-400 leading-relaxed'>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const HelpPage = () => {
  const [activeCategory, setActiveCategory] = useState('general')

  const current = CATEGORIES.find((c) => c.id === activeCategory)

  return (
    <div className='min-h-screen bg-black text-white font-sans relative overflow-hidden'>
      <ParticlesBackground />
      <div className='relative z-10'>
        <Navbar />

        <div className='max-w-4xl mx-auto px-6 py-24'>
          {/* Hero */}
          <motion.div
            initial='hidden'
            animate='visible'
            variants={fadeUp}
            className='text-center mb-16'
          >
            <div className='inline-flex items-center gap-2 bg-violet-600/15 border border-violet-500/30 text-violet-300 text-sm px-4 py-1.5 rounded-full mb-6'>
              <HelpCircle className='w-4 h-4' />
              Help Center
            </div>
            <h1 className='text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent'>
              How can we help?
            </h1>
            <p className='text-zinc-400 text-xl max-w-xl mx-auto'>
              Answers to the most common questions about Echo.
            </p>
          </motion.div>

          {/* Category Tabs */}
          <div className='flex flex-wrap gap-2 mb-10 justify-center'>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const isActive = cat.id === activeCategory
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-violet-600 text-white'
                      : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/10'
                  }`}
                >
                  <Icon className='w-4 h-4' />
                  {cat.label}
                </button>
              )
            })}
          </div>

          {/* FAQs */}
          <AnimatePresence mode='wait'>
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className='space-y-3'
            >
              {current.faqs.map((faq) => (
                <FaqItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Still need help? */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className='mt-16 bg-gradient-to-r from-violet-600/10 to-violet-900/10 border border-violet-500/20 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6'
          >
            <div className='flex items-center gap-4'>
              <div className='w-12 h-12 rounded-full bg-violet-600/20 flex items-center justify-center'>
                <MessageCircle className='w-6 h-6 text-violet-400' />
              </div>
              <div>
                <h3 className='font-semibold text-white mb-1'>Still have questions?</h3>
                <p className='text-zinc-400 text-sm'>
                  Our team is happy to help — reach out any time.
                </p>
              </div>
            </div>
            <a
              href='/contact-us'
              className='flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all duration-300'
            >
              Contact us <ArrowRight className='w-4 h-4' />
            </a>
          </motion.div>
        </div>

        <Footer />
      </div>
    </div>
  )
}

export default HelpPage
