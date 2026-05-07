import React, { useEffect } from 'react'
import { Shield, Lock, Eye, FileText, Server, UserCheck } from 'lucide-react'
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

const PrivacyPolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <PageWrapper>
      <Navbar />

      <main className='pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-12'>
          <div className='inline-flex items-center justify-center p-3 bg-violet-500/10 rounded-2xl mb-6 ring-1 ring-violet-500/20'>
            <Shield className='w-8 h-8 text-violet-400' />
          </div>
          <h1 className='text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight'>
            Privacy Policy
          </h1>
          <p className='text-lg text-white/50 max-w-2xl mx-auto leading-relaxed'>
            We believe privacy is a fundamental human right. This policy outlines how Echo protects
            your data in compliance with GDPR.
          </p>
          <span className='inline-block mt-4 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/40'>
            Last Updated: February 1, 2026
          </span>
        </div>

        <SectionCard title='1. Introduction' icon={FileText}>
          <p>
            Echo ("we," "our," or "us") is committed to protecting your privacy and ensuring the
            security of your personal data. This Privacy Policy explains how we collect, use,
            disclose, and safeguard your information when you use our secure messaging application
            and website (the "Service").
          </p>
          <p>
            We operate in strict compliance with the General Data Protection Regulation (GDPR) (EU)
            2016/679. By using Echo, you agree to the collection and use of information in
            accordance with this policy.
          </p>
        </SectionCard>

        <SectionCard title='2. Data Controller' icon={UserCheck}>
          <p>For the purposes of the GDPR, the Data Controller is:</p>
          <div className='mt-4 p-5 bg-black/30 border border-white/10 rounded-xl'>
            <p className='font-semibold text-white'>Echo Technologies Ltd.</p>
            <p>Calle Pintor Velázquez, 2 · Madrid, 28932 · Spain</p>
            <p className='mt-2'>
              DPO:{' '}
              <a
                href='mailto:dpo@echo.app'
                className='text-violet-400 hover:text-violet-300 transition-colors'
              >
                dpo@echo.app
              </a>
            </p>
          </div>
        </SectionCard>

        <SectionCard title='3. Information We Collect' icon={Eye}>
          <p className='font-semibold text-white/80'>Information You Provide</p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>
              <span className='text-white/80 font-medium'>Account Information:</span> Email or phone
              number. We do not require your real name.
            </li>
            <li>
              <span className='text-white/80 font-medium'>Profile Information:</span> Optional
              profile picture or display name, visible to your contacts.
            </li>
            <li>
              <span className='text-white/80 font-medium'>Support Communications:</span> Content of
              messages you send us for support.
            </li>
          </ul>
          <p className='font-semibold text-white/80 mt-4'>Automatically Collected</p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>
              <span className='text-white/80 font-medium'>Log Data:</span> Minimal server logs for
              security, auto-deleted every 7 days.
            </li>
            <li>
              <span className='text-white/80 font-medium'>Usage Data:</span> Anonymous aggregated
              statistics only — no individual tracking.
            </li>
          </ul>
          <div className='mt-4 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl'>
            <p className='font-bold text-emerald-300 flex items-center gap-2 mb-1'>
              <Lock className='w-4 h-4' /> End-to-End Encryption
            </p>
            <p className='text-sm text-emerald-300/80'>
              We cannot read your messages or listen to your calls. All content is end-to-end
              encrypted. Decryption keys are stored only on your device — we have zero knowledge of
              your private communications.
            </p>
          </div>
        </SectionCard>

        <SectionCard title='4. Legal Basis for Processing' icon={Shield}>
          <ul className='list-disc pl-5 space-y-2'>
            <li>
              <span className='text-white/80 font-medium'>Contractual Necessity:</span> To provide
              the Service you requested.
            </li>
            <li>
              <span className='text-white/80 font-medium'>Legitimate Interests:</span> To improve
              security and prevent fraud.
            </li>
            <li>
              <span className='text-white/80 font-medium'>Consent:</span> For optional features,
              which you can withdraw at any time.
            </li>
            <li>
              <span className='text-white/80 font-medium'>Legal Obligation:</span> To comply with
              applicable laws.
            </li>
          </ul>
        </SectionCard>

        <SectionCard title='5. Your GDPR Rights' icon={UserCheck}>
          <p>If you are a resident of the EEA, you have the following rights:</p>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4'>
            {[
              {
                icon: Eye,
                title: 'Right to Access',
                desc: 'Request copies of your personal data.',
              },
              {
                icon: FileText,
                title: 'Right to Rectification',
                desc: 'Correct inaccurate or incomplete information.',
              },
              {
                icon: UserCheck,
                title: 'Right to Erasure',
                desc: 'Request deletion ("Right to be Forgotten").',
              },
              {
                icon: Server,
                title: 'Right to Portability',
                desc: 'Receive your data in a machine-readable format.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className='p-4 bg-black/30 border border-white/10 rounded-xl'>
                <p className='font-semibold text-white flex items-center gap-2 mb-1'>
                  <Icon className='w-4 h-4 text-violet-400' /> {title}
                </p>
                <p className='text-sm'>{desc}</p>
              </div>
            ))}
          </div>
          <p className='mt-4'>
            To exercise these rights, contact us at{' '}
            <a
              href='mailto:privacy@echo.app'
              className='text-violet-400 hover:text-violet-300 transition-colors'
            >
              privacy@echo.app
            </a>
            . We respond within one month.
          </p>
        </SectionCard>

        <SectionCard title='6. Data Retention' icon={Server}>
          <ul className='list-disc pl-5 space-y-2'>
            <li>
              <span className='text-white/80 font-medium'>Messages:</span> Stored only until
              delivered, then deleted. Undelivered messages deleted after 30 days.
            </li>
            <li>
              <span className='text-white/80 font-medium'>Account Info:</span> Retained until you
              delete your account.
            </li>
            <li>
              <span className='text-white/80 font-medium'>Logs:</span> Retained for 7 days then
              overwritten.
            </li>
          </ul>
        </SectionCard>

        <SectionCard title='7. Contact Us' icon={FileText}>
          <p>If you have any questions about this Privacy Policy, please contact us:</p>
          <div className='mt-3 space-y-1'>
            <p>
              📧{' '}
              <a
                href='mailto:privacy@echo.app'
                className='text-violet-400 hover:text-violet-300 transition-colors'
              >
                privacy@echo.app
              </a>
            </p>
            <p>
              🌐{' '}
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

export default PrivacyPolicy
