import { useLocation } from 'react-router-dom'
import Navbar from '@/features/landing/Navbar'
import Footer from '@/features/landing/Footer'
import ParticlesBackground from '@/components/animations/ParticlesBackground'
import { useEffect } from 'react'

/**
 * Shared shell for every static informational page reachable from the footer.
 * - Renders the floating Navbar and the global Footer.
 * - Provides an animated hero header (eyebrow / title / subtitle).
 * - Children render as the page body inside a max-width container.
 */
export default function PageShell({
  title,
  subtitle,
  children,
  hideHero = false,
  hideFooter = false,
  hideDecorativeBg = false,
  backgroundColor = '#090909',
}) {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div
      data-testid='page-shell'
      className='relative min-h-screen text-[#f5f5f5] overflow-x-hidden'
      style={{ background: backgroundColor }}
    >
      <Navbar />

      {!hideHero && (
        <header className='relative pt-36 pb-16 sm:pt-44 sm:pb-20 overflow-hidden'>
          {!hideDecorativeBg && <div className='aurora-bg opacity-70' />}
          {!hideDecorativeBg && <div className='grid-overlay' />}
          {!hideDecorativeBg && (
            <div className='absolute inset-0 opacity-50'>
              <ParticlesBackground />
            </div>
          )}
          {!hideDecorativeBg && <div className='noise-overlay' />}

          <div className='relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center'>
            <h1
              className='anim-fade-up mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]'
              style={{ animationDelay: '120ms' }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className='anim-fade-up mx-auto mt-5 max-w-2xl text-base sm:text-lg text-[#b9b9c4] leading-relaxed'
                style={{ animationDelay: '240ms' }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </header>
      )}

      {!hideHero && (
        <div
          aria-hidden='true'
          className='pointer-events-none h-10 bg-gradient-to-b'
          style={{ background: `linear-gradient(to bottom, ${backgroundColor}, transparent)` }}
        />
      )}

      <main
        data-testid='page-shell-main'
        className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-24'
      >
        {children}
      </main>

      {!hideFooter && <Footer />}
    </div>
  )
}
