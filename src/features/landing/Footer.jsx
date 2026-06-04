import { FaGithub, FaLinkedinIn, FaXTwitter, FaEnvelope } from 'react-icons/fa6'
import { FiArrowUpRight } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import ParticlesBackground from '@/components/animations/ParticlesBackground'

const COLS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', to: '/features' },
      { label: 'Security', to: '/security' },
      { label: 'Download', to: '/download' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', to: '/docs' },
      { label: 'Community', to: '/community' },
      { label: 'Help', to: '/help' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Blog', to: '/blog' },
      { label: 'Contact', to: '/contact' },
    ],
  },
]

export default function Footer() {
  return (
    <footer data-testid='footer' id='download' className='relative pt-20 pb-8 overflow-hidden'>
      {/* Keep the footer clean so the text stays readable */}
      <div className='grid-overlay footer-grid' />
      <div className='absolute inset-0 opacity-10 pointer-events-none'>
        <ParticlesBackground />
      </div>

      <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        {/* Top horizontal row: brand · sections · social */}
        <div className='flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between'>
          {/* Brand */}
          <div className='lg:max-w-xs'>
            <Link to='/' className='flex items-center gap-2.5 w-fit'>
              <img src='/echo-logo.svg' alt='ECHO Logo' className='h-9 w-9 object-contain' />
              <span className='text-lg font-semibold tracking-tight text-white'>ECHO</span>
            </Link>
            <p className='mt-5 text-sm leading-relaxed text-white/85'>
              Secure messaging. Built on battle-tested cryptographic protocols. No backdoors.
            </p>
            <div className='mt-5 flex gap-4 text-white/80'>
              {[
                { icon: FaGithub, label: 'github' },
                { icon: FaLinkedinIn, label: 'linkedin' },
                { icon: FaXTwitter, label: 'x' },
                { icon: FaEnvelope, label: 'email' },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  data-testid={`footer-social-${label}`}
                  href='#'
                  aria-label={label}
                  className='transition-colors hover:text-white'
                >
                  <Icon className='h-5 w-5' />
                </a>
              ))}
            </div>
          </div>

          {/* Horizontal columns */}
          <nav
            data-testid='footer-nav'
            className='flex flex-1 flex-wrap gap-x-12 gap-y-8 lg:justify-end'
          >
            {COLS.map((col) => (
              <div key={col.title} className='min-w-[140px]'>
                <div className='text-[12px] font-semibold uppercase tracking-[0.18em] text-white'>
                  {col.title}
                </div>
                <ul className='mt-5 flex flex-col gap-3 text-[14px]'>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        to={l.to}
                        className='inline-flex items-center gap-1.5 text-white/80 transition-colors hover:text-white group'
                      >
                        {l.label}
                        <FiArrowUpRight className='h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0' />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className='mt-14 h-px w-full bg-white/20' />

        {/* Bottom horizontal strip */}
        <div className='mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-[13px] text-white/70'>
          <p className='text-white/70'>© {new Date().getFullYear()} Echo. All rights reserved.</p>
          <div className='flex flex-wrap gap-x-6 gap-y-2'>
            {[
              { label: 'Privacy', to: '/privacy' },
              { label: 'Terms', to: '/terms' },
              { label: 'GDPR', to: '/gdpr' },
              { label: 'Licenses', to: '/licenses' },
            ].map((l) => (
              <Link key={l.label} to={l.to} className='hover:text-white transition-colors'>
                {l.label}
              </Link>
            ))}
          </div>
          <span className='font-mono text-[12px] text-white/60'>
            v{__APP_VERSION__} · sha 7f9a1c
          </span>
        </div>
      </div>
    </footer>
  )
}
