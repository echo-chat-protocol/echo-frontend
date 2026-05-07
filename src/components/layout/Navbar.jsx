import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, X } from 'lucide-react'
import gsap from 'gsap'
import Logo from './Logo'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const { t, i18n } = useTranslation()
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isOpen) {
      gsap.to('.mobile-menu', {
        duration: 0.3,
        height: 'auto',
        opacity: 1,
        display: 'block',
        ease: 'power2.out',
      })
    } else {
      gsap.to('.mobile-menu', {
        duration: 0.3,
        height: 0,
        opacity: 0,
        display: 'none',
        ease: 'power2.in',
      })
    }
  }, [isOpen])

  const navLinks = [
    { label: t('nav.product'), href: '/#features' },
    { label: t('nav.docs'), href: '/documentation' },
    { label: t('nav.community'), href: '/community' },
    { label: t('nav.blog'), href: '/blog' },
    { label: t('nav.pricing'), href: '/pricing' },
    { label: t('nav.demo'), href: '/demo' },
  ]

  const languages = [
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
  ]

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
  }

  return (
    <div className='fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4'>
      <nav
        className={`w-full max-w-6xl rounded-2xl transition-all duration-300 ${
          scrolled || isOpen
            ? 'bg-neutral-900/80 backdrop-blur-xl border border-white/10 shadow-2xl'
            : 'bg-neutral-900/40 backdrop-blur-md border border-white/5'
        }`}
      >
        <div className='px-6 h-16 flex items-center justify-between'>
          {/* Logo */}
          <Link
            to='/'
            className='flex items-center space-x-2 group hover:opacity-80 transition-opacity duration-250'
          >
            <Logo size='md' variant='gradient' />
            <span className='text-lg font-bold text-white tracking-wide'>ECHO</span>
          </Link>

          {/* Desktop Navigation */}
          <div className='hidden lg:flex items-center space-x-1'>
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className='px-4 py-2 text-neutral-300 hover:text-white hover:bg-white/5 rounded-full transition-all duration-250 text-sm font-medium'
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right Actions */}
          <div className='flex items-center space-x-3'>
            {/* Language Selector */}
            <div className='hidden sm:flex items-center gap-0 bg-white/5 rounded-full p-0.5 border border-white/10'>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`px-3 py-1 rounded-full text-xs font-bold tracking-widest transition-all duration-200 ${
                    i18n.language === lang.code
                      ? 'bg-white text-black shadow'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {lang.code.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Auth Buttons */}
            <div className='hidden md:flex items-center space-x-3'>
              <Link
                to='/auth/login'
                className='text-neutral-300 hover:text-white text-sm font-medium transition-colors duration-250 px-3 py-2'
              >
                {t('nav.login')}
              </Link>
              <Link
                to='/auth/register'
                className='px-5 py-2 bg-white text-black hover:bg-neutral-200 text-sm font-semibold rounded-full transition-colors duration-250'
              >
                {t('nav.register')}
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className='lg:hidden p-2 rounded-full text-neutral-300 hover:bg-white/10 transition-colors duration-250'
            >
              {isOpen ? <X className='w-5 h-5' /> : <Menu className='w-5 h-5' />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className='mobile-menu hidden overflow-hidden border-t border-white/5'>
          <div className='p-4 space-y-2'>
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className='block px-4 py-3 text-neutral-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors duration-250 text-sm font-medium'
              >
                {link.label}
              </a>
            ))}

            {/* Mobile Language Selector */}
            <div className='flex items-center justify-center gap-2 py-3 border-t border-b border-white/5 my-2'>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-250 ${
                    i18n.language === lang.code
                      ? 'bg-primary-600 text-white'
                      : 'text-neutral-300 hover:bg-white/5 hover:text-white border border-white/10'
                  }`}
                >
                  <span className='text-lg'>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>

            <div className='pt-4 mt-4 grid grid-cols-2 gap-4'>
              <Link
                to='/auth/login'
                onClick={() => setIsOpen(false)}
                className='flex justify-center px-4 py-3 text-neutral-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors duration-250 text-sm font-medium border border-white/10'
              >
                {t('nav.login')}
              </Link>
              <Link
                to='/auth/register'
                onClick={() => setIsOpen(false)}
                className='flex justify-center px-4 py-3 bg-white text-black hover:bg-neutral-200 rounded-xl transition-colors duration-250 text-sm font-semibold'
              >
                {t('nav.register')}
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </div>
  )
}

export default Navbar
