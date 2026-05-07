import React, { useEffect } from 'react'
import { FileText, AlertTriangle, Shield, UserCheck, Scale } from 'lucide-react'
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

const TermsOfService = () => {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <PageWrapper>
      <Navbar />
      <main className='pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto'>
        <div className='text-center mb-12'>
          <div className='inline-flex items-center justify-center p-3 bg-violet-500/10 rounded-2xl mb-6 ring-1 ring-violet-500/20'>
            <FileText className='w-8 h-8 text-violet-400' />
          </div>
          <h1 className='text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight'>
            Terms of Service
          </h1>
          <p className='text-lg text-white/50 max-w-2xl mx-auto leading-relaxed'>
            Please read these terms carefully before using Echo. By accessing our Service, you agree
            to be bound by these Terms.
          </p>
          <span className='inline-block mt-4 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/40'>
            Last Updated: February 1, 2026
          </span>
        </div>

        <SectionCard title='1. Acceptance of Terms' icon={FileText}>
          <p>
            By accessing or using the Echo application, website, and services (collectively, the
            "Service"), you agree to be bound by these Terms of Service. If you disagree with any
            part of the terms, you may not access the Service.
          </p>
          <p>These Terms apply to all visitors, users, and others who access or use the Service.</p>
        </SectionCard>

        <SectionCard title='2. Accounts' icon={UserCheck}>
          <p>
            When you create an account, you must provide accurate, complete, and current
            information. You are responsible for safeguarding your password and for any activities
            under your account.
          </p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>Do not share your password with any third party.</li>
            <li>Notify us immediately of any unauthorized use of your account.</li>
            <li>You are solely responsible for all activity that occurs under your account.</li>
          </ul>
        </SectionCard>

        <SectionCard title='3. User Conduct' icon={Shield}>
          <p>You agree not to use the Service to:</p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>Violate any applicable national or international law or regulation.</li>
            <li>Exploit, harm, or attempt to exploit or harm minors in any way.</li>
            <li>
              Transmit unsolicited or unauthorized advertising or promotional material (spam).
            </li>
            <li>Impersonate Echo, an Echo employee, another user, or any third party.</li>
            <li>Engage in any conduct that restricts or inhibits anyone's use of the Service.</li>
          </ul>
        </SectionCard>

        <SectionCard title='4. Intellectual Property' icon={Scale}>
          <p>
            The Service and its original content, features, and functionality are and will remain
            the exclusive property of Echo Technologies Ltd. and its licensors. Our trademarks may
            not be used without the prior written consent of Echo Technologies Ltd.
          </p>
        </SectionCard>

        <SectionCard title='5. Limitation of Liability' icon={AlertTriangle}>
          <div className='p-5 bg-amber-500/10 border border-amber-500/20 rounded-xl'>
            <p className='font-bold text-amber-300 flex items-center gap-2 mb-2'>
              <AlertTriangle className='w-4 h-4' /> Important Notice
            </p>
            <p className='text-amber-300/80 text-sm'>
              In no event shall Echo Technologies Ltd. be liable for any indirect, incidental,
              special, consequential, or punitive damages resulting from your access to or use of
              the Service, any conduct or content of any third party, or unauthorized access to your
              data.
            </p>
          </div>
        </SectionCard>

        <SectionCard title='6. Disclaimer' icon={Shield}>
          <p>
            The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any
            kind. Echo does not warrant that the Service will function uninterrupted, secure, or
            available at any particular time or location.
          </p>
        </SectionCard>

        <SectionCard title='7. Governing Law' icon={Scale}>
          <p>
            These Terms shall be governed and construed in accordance with the laws of Spain and
            Ireland, without regard to conflict of law provisions. Our failure to enforce any right
            shall not be considered a waiver of those rights.
          </p>
        </SectionCard>

        <SectionCard title='8. Contact Us' icon={FileText}>
          <p>If you have any questions about these Terms, please contact us:</p>
          <div className='mt-3 space-y-1'>
            <p>
              {' '}
              <a
                href='mailto:legal@echo.app'
                className='text-violet-400 hover:text-violet-300 transition-colors'
              >
                legal@echo.app
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

export default TermsOfService
