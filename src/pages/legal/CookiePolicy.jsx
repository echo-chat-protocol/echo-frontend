import React, { useEffect } from 'react'
import { Cookie, Settings, BarChart2, Lock, RefreshCw } from 'lucide-react'
import Navbar from '@components/layout/Navbar'
import Footer from '@components/layout/Footer'
import PageWrapper from '@components/common/PageWrapper'

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className='bg-white/5 border border-white/10 rounded-2xl p-8 mb-6'>
    <div className='flex items-center gap-3 mb-5'>
      {Icon && (
        <div className='p-2 rounded-lg bg-violet-500/10'>
          <Icon className='w-5 h-5 text-violet-400' />
        </div>
      )}
      <h2 className='text-xl font-bold text-white'>{title}</h2>
    </div>
    <div className='text-white/60 leading-relaxed space-y-3'>{children}</div>
  </div>
)

const CookiePolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <PageWrapper>
      <Navbar />
      <main className='pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto'>
        <div className='text-center mb-12'>
          <div className='inline-flex items-center justify-center p-3 bg-violet-500/10 rounded-2xl mb-6 ring-1 ring-violet-500/20'>
            <Cookie className='w-8 h-8 text-violet-400' />
          </div>
          <h1 className='text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight'>
            Cookie Policy
          </h1>
          <p className='text-lg text-white/50 max-w-2xl mx-auto leading-relaxed'>
            We use cookies to improve your experience. This policy explains what cookies are, how we
            use them, and how you can control them.
          </p>
          <span className='inline-block mt-4 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/40'>
            Last Updated: February 1, 2026
          </span>
        </div>

        <SectionCard title='What Are Cookies?' icon={Cookie}>
          <p>
            Cookies are small text files placed on your device when you visit a website. They are
            widely used to make websites work more efficiently and provide information to site
            owners.
          </p>
          <p>
            Echo uses a minimal set of cookies. Because all messages are encrypted client-side, no
            message content is ever stored in cookies or sent to our servers.
          </p>
        </SectionCard>

        <SectionCard title='Why We Use Cookies' icon={Settings}>
          <p>
            We use cookies and similar technologies to keep you signed in, remember your
            preferences, and understand how our Service is used so we can improve it.
          </p>
        </SectionCard>

        <SectionCard title='Types of Cookies We Use' icon={BarChart2}>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2'>
            <div className='bg-black/30 border border-white/10 rounded-xl p-5'>
              <p className='font-semibold text-white mb-2 flex items-center gap-2'>
                <Lock className='w-4 h-4 text-violet-400' /> Essential
              </p>
              <p className='text-sm'>
                Required for the Service to function. Cannot be disabled they include session tokens
                and CSRF protection.
              </p>
            </div>
            <div className='bg-black/30 border border-white/10 rounded-xl p-5'>
              <p className='font-semibold text-white mb-2 flex items-center gap-2'>
                <Settings className='w-4 h-4 text-violet-400' /> Preferences
              </p>
              <p className='text-sm'>
                Remember your settings such as language selection and UI theme so you do not have to
                reconfigure them on each visit.
              </p>
            </div>
            <div className='bg-black/30 border border-white/10 rounded-xl p-5'>
              <p className='font-semibold text-white mb-2 flex items-center gap-2'>
                <BarChart2 className='w-4 h-4 text-violet-400' /> Analytics
              </p>
              <p className='text-sm'>
                Help us understand how users interact with the Service. All analytics data is
                anonymised and aggregated.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title='How to Control Cookies' icon={Settings}>
          <p>
            You can instruct your browser to refuse or delete cookies. Most browsers allow you to:
          </p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>View, block, or delete cookies via browser settings.</li>
            <li>Accept or reject cookies from specific sites.</li>
            <li>Set notifications when cookies are placed.</li>
          </ul>
          <p>Note that disabling cookies may affect the functionality of the Service.</p>
        </SectionCard>

        <SectionCard title='Local Storage' icon={Lock}>
          <div className='p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl'>
            <p className='font-bold text-emerald-300 mb-2'>End-to-End Encryption Notice</p>
            <p className='text-emerald-300/80 text-sm'>
              Echo stores your encryption keys exclusively in your device's Local Storage. This data
              never leaves your device and is never transmitted to our servers, ensuring your
              messages remain private.
            </p>
          </div>
        </SectionCard>

        <SectionCard title='Policy Updates' icon={RefreshCw}>
          <p>
            We may update this Cookie Policy from time to time. We will notify you of significant
            changes by posting a notice in the app or by email. Your continued use of the Service
            after any changes constitutes acceptance of the new policy.
          </p>
        </SectionCard>

        <SectionCard title='Contact Us' icon={Cookie}>
          <p>If you have questions about our use of cookies, please reach out:</p>
          <div className='mt-3 space-y-1'>
            <p>
              {' '}
              <a
                href='mailto:privacy@echo.app'
                className='text-violet-400 hover:text-violet-300 transition-colors'
              >
                privacy@echo.app
              </a>
            </p>
            <p>
              {' '}
              <a
                href='/contact-us'
                className='text-violet-400 hover:text-violet-300 transition-colors'
              >
                echo.app/contact-us
              </a>
            </p>
          </div>
        </SectionCard>
      </main>
      <Footer />
    </PageWrapper>
  )
}

export default CookiePolicy
