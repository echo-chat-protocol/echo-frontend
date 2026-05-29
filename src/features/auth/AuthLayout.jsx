import { Link } from 'react-router-dom'
import ParticlesBackground from '@/components/animations/ParticlesBackground'

/**
 * Shared shell used by Login and Register pages.
 * Left panel: brand storytelling. Right panel: the form.
 */
export default function AuthLayout({
  title,
  subtitle,
  testimonial,
  children,
  footerLinkLabel,
  footerLinkText,
  footerLinkTo,
}) {
  return (
    <div
      data-testid='auth-shell'
      className='relative min-h-screen w-full text-white overflow-hidden'
      style={{ background: '#000' }}
    >
      {/* Background */}
      <div className='aurora-bg' />
      <div className='grid-overlay' />
      <div className='absolute inset-0 opacity-60'>
        <ParticlesBackground />
      </div>
      <div className='noise-overlay' />

      <div className='relative z-10 grid min-h-screen lg:grid-cols-2'>
        {/* Left brand panel */}
        <aside className='hidden lg:flex flex-col justify-between p-10 xl:p-14 border-r border-white/5'>
          <Link to='/' className='flex items-center gap-2.5 group w-fit'>
            <img src='/echo-logo.svg' alt='ECHO Logo' className='h-9 w-9 object-contain' />
            <span className='text-lg font-semibold tracking-tight text-white'>ECHO</span>
          </Link>

          <div className='max-w-md'>
            <h2 className='text-4xl xl:text-5xl font-semibold tracking-tight leading-[1.05]'>
              <span className='echo-gradient-text'>Whisper, never shout.</span>
            </h2>
            <p className='mt-5 text-[#b9b9c4] leading-relaxed'>
              Your keys are forged on this device the moment you sign in. We never see them, store
              them, or transmit them. That&apos;s the whole point.
            </p>

            <div className='mt-10 glass cyber-border rounded-2xl p-5'>
              <p className='text-sm text-[#e9e9ef] leading-relaxed'>
                &quot;
                {testimonial?.quote ??
                  'ECHO is what every privacy researcher hopes a messenger could be — and the audits actually back it up.'}
                &quot;
              </p>
              <div className='mt-4 flex items-center gap-3'>
                <span className='inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a855f7] text-sm font-semibold'>
                  {testimonial?.initials ?? 'MR'}
                </span>
                <div>
                  <div className='text-sm font-medium'>{testimonial?.name ?? 'Maya Rashidov'}</div>
                  <div className='text-xs text-[#a0a0a0]'>
                    {testimonial?.role ?? 'Security researcher · Cure53'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className='text-xs text-[#7a7a8a] flex items-center gap-4'>
            <span>SOC 2 · GDPR</span>
            <span className='font-mono'>v{__APP_VERSION__}</span>
          </div>
        </aside>

        {/* Right form panel */}
        <main className='flex items-center justify-center p-6 sm:p-10'>
          <div className='w-full max-w-md anim-fade-up'>
            {/* Mobile brand */}
            <Link to='/' className='lg:hidden flex items-center gap-2.5 mb-8 w-fit'>
              <img src='/echo-logo.svg' alt='ECHO Logo' className='h-9 w-9 object-contain' />
              <span className='text-lg font-semibold tracking-tight text-white'>ECHO</span>
            </Link>

            <h1 className='text-3xl sm:text-4xl font-semibold tracking-tight leading-tight'>
              {title}
            </h1>
            <p className='mt-3 text-[#b9b9c4]'>{subtitle}</p>

            <div className='mt-8'>{children}</div>

            <p className='mt-8 text-sm text-[#a0a0a0]'>
              {footerLinkLabel}{' '}
              <Link
                data-testid='auth-footer-link'
                to={footerLinkTo}
                className='text-white font-medium underline-offset-4 hover:underline'
              >
                {footerLinkText}
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
