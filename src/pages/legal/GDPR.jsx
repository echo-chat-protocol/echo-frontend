import React, { useEffect } from 'react'
import { Globe, Shield, Eye, Trash2, Download, UserCheck, Mail } from 'lucide-react'
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

const GDPR = () => {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <PageWrapper>
      <Navbar />
      <main className='pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto'>
        <div className='text-center mb-12'>
          <div className='inline-flex items-center justify-center p-3 bg-violet-500/10 rounded-2xl mb-6 ring-1 ring-violet-500/20'>
            <Globe className='w-8 h-8 text-violet-400' />
          </div>
          <h1 className='text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight'>
            GDPR Compliance
          </h1>
          <p className='text-lg text-white/50 max-w-2xl mx-auto leading-relaxed'>
            Echo is fully compliant with the General Data Protection Regulation (EU) 2016/679. Your
            data rights are a core part of how we build our product.
          </p>
          <span className='inline-block mt-4 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/40'>
            Last Updated: February 1, 2026
          </span>
        </div>

        <SectionCard title='What is GDPR?' icon={Globe}>
          <p>
            The General Data Protection Regulation (GDPR) is a regulation in EU law on data
            protection and privacy. It applies to all organisations that process personal data of
            individuals in the European Union, regardless of where the organisation is based.
          </p>
          <div className='p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl'>
            <p className='font-bold text-emerald-300 mb-2'>Echo's Privacy-First Architecture</p>
            <p className='text-emerald-300/80 text-sm'>
              All messages in Echo are end-to-end encrypted client-side using the Signal Protocol.
              This means Echo cannot read your messages they are private by design, not just by
              policy.
            </p>
          </div>
        </SectionCard>

        <SectionCard title='Your Rights Under GDPR' icon={Shield}>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2'>
            <div className='bg-black/30 border border-white/10 rounded-xl p-5'>
              <p className='font-semibold text-white mb-2 flex items-center gap-2'>
                <Eye className='w-4 h-4 text-violet-400' /> Right to Access
              </p>
              <p className='text-sm'>
                Request a copy of all personal data we hold about you at any time from your account
                settings.
              </p>
            </div>
            <div className='bg-black/30 border border-white/10 rounded-xl p-5'>
              <p className='font-semibold text-white mb-2 flex items-center gap-2'>
                <Trash2 className='w-4 h-4 text-violet-400' /> Right to Erasure
              </p>
              <p className='text-sm'>
                Request deletion of your personal data ("right to be forgotten"). We will process
                this within 30 days.
              </p>
            </div>
            <div className='bg-black/30 border border-white/10 rounded-xl p-5'>
              <p className='font-semibold text-white mb-2 flex items-center gap-2'>
                <Download className='w-4 h-4 text-violet-400' /> Data Portability
              </p>
              <p className='text-sm'>
                Export your data in a machine-readable format (JSON/CSV) directly from your account
                dashboard.
              </p>
            </div>
            <div className='bg-black/30 border border-white/10 rounded-xl p-5'>
              <p className='font-semibold text-white mb-2 flex items-center gap-2'>
                <UserCheck className='w-4 h-4 text-violet-400' /> Right to Rectification
              </p>
              <p className='text-sm'>
                Correct any inaccurate or incomplete personal data we hold about you via your
                profile settings.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title='Data Transfers' icon={Globe}>
          <p>
            Echo Technologies Ltd. is registered in Ireland (EU). All personal data is stored on
            servers within the European Economic Area (EEA). We do not transfer personal data to
            third countries without appropriate safeguards (Standard Contractual Clauses or adequacy
            decisions).
          </p>
        </SectionCard>

        <SectionCard title='Data Protection Officer' icon={Shield}>
          <p>
            We have appointed a Data Protection Officer (DPO) to oversee GDPR compliance. You can
            contact our DPO directly if you have concerns about how we handle your data.
          </p>
          <div className='mt-4 p-5 bg-white/5 border border-white/10 rounded-xl flex items-start gap-4'>
            <div className='p-2 rounded-lg bg-violet-500/10 flex-shrink-0'>
              <Mail className='w-5 h-5 text-violet-400' />
            </div>
            <div>
              <p className='font-semibold text-white'>Data Protection Officer</p>
              <p className='text-sm text-white/50 mt-1'>Echo Technologies Ltd.</p>
              <a
                href='mailto:dpo@echo.app'
                className='text-violet-400 hover:text-violet-300 transition-colors text-sm'
              >
                dpo@echo.app
              </a>
            </div>
          </div>
        </SectionCard>

        <SectionCard title='Lodge a Complaint' icon={Shield}>
          <p>
            If you believe we have not handled your personal data in accordance with GDPR, you have
            the right to lodge a complaint with your national supervisory authority. In Ireland,
            this is the Data Protection Commission (DPC):
          </p>
          <div className='mt-3 space-y-1'>
            <p>
              {' '}
              <a
                href='https://www.dataprotection.ie'
                target='_blank'
                rel='noopener noreferrer'
                className='text-violet-400 hover:text-violet-300 transition-colors'
              >
                www.dataprotection.ie
              </a>
            </p>
            <p>
              {' '}
              <a
                href='mailto:info@dataprotection.ie'
                className='text-violet-400 hover:text-violet-300 transition-colors'
              >
                info@dataprotection.ie
              </a>
            </p>
          </div>
        </SectionCard>
      </main>
      <Footer />
    </PageWrapper>
  )
}

export default GDPR
