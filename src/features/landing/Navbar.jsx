import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const NAV = [
  { key: 'features', href: '#features' },
  { key: 'security', href: '#security' },
  { key: 'pricing', href: '/pricingpage' },
  { key: 'docs', href: '/docs' },
]

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('es') ? 'en' : 'es'
    i18n.changeLanguage(nextLang)
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close sheet on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <header
      data-testid='echo-navbar'
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'py-2' : 'py-4'
      }`}
    >
      <div
        className={`relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-300 ${
          scrolled
            ? 'rounded-full glass-strong'
            : 'rounded-2xl bg-transparent border border-transparent'
        }`}
      >
        <nav className='flex h-14 items-center justify-between'>
          {/* Brand */}
          <Link
            to='/'
            onClick={() => window.scrollTo(0, 0)}
            data-testid='navbar-brand'
            className='flex items-center gap-2.5 group'
          >
            <img src='/echo-logo.svg' alt='ECHO Logo' className='h-9 w-9 object-contain' />
            <span className='text-lg font-semibold tracking-tight text-white'>ECHO</span>
          </Link>

          {/* Desktop nav */}
          <ul className='hidden md:flex md:absolute md:left-1/2 md:-translate-x-1/2 items-center gap-8 text-sm text-[#cfcfcf]'>
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  data-testid={`navbar-link-${item.key}`}
                  href={item.href}
                  className='relative transition-colors hover:text-white'
                >
                  {t(`nav.${item.key}`)}
                  <span className='absolute -bottom-1 left-0 h-px w-0 bg-gradient-to-r from-[#7c3aed] to-[#a855f7] transition-all duration-300 group-hover:w-full' />
                </a>
              </li>
            ))}
          </ul>

          {/* Desktop CTAs */}
          <div className='hidden md:flex items-center gap-3'>
            <button
              onClick={toggleLanguage}
              className='flex items-center gap-1.5 text-sm font-medium text-[#cfcfcf] hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/5 mr-1'
            >
              <Globe className='h-4 w-4' />
              {i18n.language.startsWith('es') ? 'ES' : 'EN'}
            </button>
            <Link
              data-testid='navbar-signin'
              to='/login'
              className='text-sm text-[#cfcfcf] hover:text-white transition-colors'
            >
              {t('nav.signin')}
            </Link>
            <Link
              data-testid='navbar-cta'
              to='/register'
              className='inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/90'
            >
              {t('nav.signup')}
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            data-testid='navbar-mobile-toggle'
            onClick={() => setOpen((v) => !v)}
            aria-label='Toggle menu'
            aria-expanded={open}
            className='md:hidden inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-white transition-all active:scale-95'
          >
            {open ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
          </button>
        </nav>

        {/* Mobile sheet — animated max-height transition */}
        <div
          data-testid='navbar-mobile-sheet'
          className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
            open ? 'max-h-[600px] opacity-100 mt-2' : 'max-h-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className='rounded-2xl glass p-4'>
            <ul className='flex flex-col gap-0.5 text-[#e5e5e5]'>
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className='block px-3 py-2.5 rounded-xl text-[15px] hover:bg-white/[0.05] hover:text-white transition-colors'
                  >
                    {t(`nav.${item.key}`)}
                  </a>
                </li>
              ))}

              {/* Divider */}
              <li aria-hidden='true'>
                <div className='my-2 h-px bg-white/[0.08]' />
              </li>

              {/* Language toggle */}
              <li>
                <button
                  onClick={toggleLanguage}
                  className='flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-[15px] text-[#cfcfcf] hover:bg-white/[0.05] hover:text-white transition-colors'
                >
                  <Globe className='h-4 w-4 shrink-0' />
                  {i18n.language.startsWith('es') ? 'Español' : 'English'}
                </button>
              </li>

              {/* Sign in */}
              <li>
                <a
                  href='/login'
                  onClick={() => setOpen(false)}
                  className='block px-3 py-2.5 rounded-xl text-[15px] text-[#cfcfcf] hover:bg-white/[0.05] hover:text-white transition-colors'
                >
                  {t('nav.signin')}
                </a>
              </li>

              {/* Sign up CTA */}
              <li className='mt-2'>
                <a
                  href='/register'
                  onClick={() => setOpen(false)}
                  className='inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90'
                >
                  {t('nav.signup')}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </header>
  )
}
