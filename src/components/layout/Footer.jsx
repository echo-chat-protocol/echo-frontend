import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, Linkedin, Github } from 'lucide-react'
import { FaXTwitter } from 'react-icons/fa6'

const Footer = () => {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  const footerSections = [
    {
      title: t('footer.product.title'),
      links: [
        { label: t('footer.product.features'), href: '/#features' },
        { label: t('footer.product.security'), href: '/documentation/protocols' },
        { label: t('footer.product.download'), href: '/download' },
        { label: t('footer.product.roadmap'), href: '/roadmap' },
      ],
    },
    {
      title: t('footer.resources.title'),
      links: [
        { label: t('footer.resources.docs'), href: '/documentation' },
        { label: t('footer.resources.community'), href: '/community' },
        { label: t('footer.resources.help'), href: '/help' },
        { label: t('footer.resources.status'), href: '/status' },
      ],
    },
    {
      title: t('footer.company.title'),
      links: [
        { label: t('footer.company.about'), href: '/about-us' },
        { label: t('footer.company.careers'), href: '/careers' },
        { label: t('footer.company.blog'), href: '/blog' },
        { label: t('footer.company.contact'), href: '/contact-us' },
      ],
    },
  ]

  const legalLinks = [
    { label: t('footer.legal.privacy'), href: '/legal/privacy-policy' },
    { label: t('footer.legal.terms'), href: '/legal/terms-of-service' },
    { label: t('footer.legal.cookies'), href: '/legal/cookie-policy' },
    { label: t('footer.legal.gdpr'), href: '/legal/gdpr' },
    { label: t('footer.legal.licenses'), href: '/legal/licenses' },
  ]

  const socialLinks = [
    { icon: Github, href: '#', label: 'GitHub' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
    { icon: FaXTwitter, href: '#', label: 'X' },
    { icon: Mail, href: 'mailto:support@echo.dev', label: 'Email' },
  ]

  return (
    <footer className='bg-transparent border-t border-white/10 pt-20 pb-10 relative z-10'>
      {/* Background Glow */}
      <div className='absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-600/5 blur-[100px] rounded-full pointer-events-none' />

      <div className='max-w-7xl mx-auto px-6 relative z-10'>
        {/* Main Footer Content */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16'>
          {/* Brand Section */}
          <div className='lg:col-span-2'>
            <div className='flex items-center gap-3 mb-6'>
              <img src='/echo-logo.svg' alt='Echo Logo' className='h-8 w-8' />
              <span className='text-xl font-bold text-white tracking-wide'>ECHO</span>
            </div>
            <p className='text-zinc-400 text-sm leading-relaxed mb-6 max-w-md'>
              {t('footer.tagline')}
            </p>
            {/* Social Links */}
            <div className='flex items-center gap-4'>
              {socialLinks.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className='text-zinc-400 hover:text-violet-400 transition-colors duration-300'
                  >
                    <Icon className='w-5 h-5' />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Footer Links Sections */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className='text-sm font-bold text-white mb-6 uppercase tracking-wider'>
                {section.title}
              </h3>
              <ul className='space-y-4'>
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className='text-zinc-400 hover:text-violet-400 text-sm transition-colors duration-300'
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className='h-px bg-white/10 mb-8'></div>

        {/* Bottom Section */}
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-6'>
          {/* Copyright */}
          <p className='text-zinc-500 text-sm'>
            &copy; {currentYear} Echo. {t('footer.rights')}
          </p>

          {/* Legal Links */}
          <div className='flex flex-wrap gap-6'>
            {legalLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className='text-zinc-500 hover:text-violet-400 text-sm transition-colors duration-300'
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
