import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Mail,
  Github,
  MessageSquare,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ArrowRight,
} from 'lucide-react'
import Navbar from '@components/layout/Navbar'
import Footer from '@components/layout/Footer'
import PageWrapper from '@components/common/PageWrapper'

/* Icons mapped by channel key  not translatable */
const CHANNEL_ICONS = {
  email: {
    Icon: Mail,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    href: (v) => `mailto:${v}`,
  },
  github: {
    Icon: Github,
    color: 'text-white/70',
    bg: 'bg-white/5',
    border: 'border-white/10',
    href: (v) => `https://${v}`,
  },
  discord: {
    Icon: MessageSquare,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    href: (v) => `https://${v}`,
  },
  responseTime: {
    Icon: Clock,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    href: null,
  },
}

const inputCls =
  'w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.07] transition-all'

const Field = ({ label, children, hint }) => (
  <div className='flex flex-col gap-1.5'>
    <label className='text-xs uppercase tracking-widest text-white/35 font-medium'>{label}</label>
    {children}
    {hint && <p className='text-xs text-white/25 mt-0.5'>{hint}</p>}
  </div>
)

export default function ContactUs() {
  const { t } = useTranslation()
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState(null)
  const [subjectOpen, setSubjectOpen] = useState(false)

  const subjects = t('contact.subjects', { returnObjects: true })
  const channels = t('contact.channels', { returnObjects: true })

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }))
  const pickSubject = (v) => {
    setForm((p) => ({ ...p, subject: v }))
    setSubjectOpen(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await new Promise((r) => setTimeout(r, 1600))
      setStatus('ok')
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch {
      setStatus('err')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageWrapper>
      <Navbar />
      <main className='pt-28 pb-24 px-4 sm:px-6'>
        {/* Header */}
        <div className='text-center mb-16 max-w-2xl mx-auto'>
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45 }}
            className='inline-flex items-center justify-center p-3 bg-violet-500/10 rounded-2xl mb-6 ring-1 ring-violet-500/20'
          >
            <Mail className='w-8 h-8 text-violet-400' />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className='text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight'
          >
            {t('contact.pageTitle')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className='text-lg text-white/45 leading-relaxed'
          >
            {t('contact.pageSubtitle')}
          </motion.p>
        </div>

        <div className='max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10 items-start'>
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className='bg-white/[0.04] border border-white/10 rounded-2xl p-8'
          >
            <h2 className='text-xl font-semibold text-white mb-7'>{t('contact.formTitle')}</h2>

            <AnimatePresence>
              {status === 'ok' && (
                <motion.div
                  key='ok'
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className='overflow-hidden mb-6'
                >
                  <div className='flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl'>
                    <CheckCircle2 className='w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5' />
                    <div>
                      <p className='text-sm font-medium text-emerald-400'>
                        {t('contact.successTitle')}
                      </p>
                      <p className='text-xs text-white/40 mt-0.5'>{t('contact.successDesc')}</p>
                    </div>
                  </div>
                </motion.div>
              )}
              {status === 'err' && (
                <motion.div
                  key='err'
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className='overflow-hidden mb-6'
                >
                  <div className='flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl'>
                    <AlertCircle className='w-5 h-5 text-red-400 flex-shrink-0 mt-0.5' />
                    <div>
                      <p className='text-sm font-medium text-red-400'>{t('contact.errorTitle')}</p>
                      <p className='text-xs text-white/40 mt-0.5'>{t('contact.errorDesc')}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className='space-y-5'>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
                <Field label={t('contact.nameLabel')}>
                  <input
                    type='text'
                    value={form.name}
                    onChange={set('name')}
                    placeholder={t('contact.namePlaceholder') || 'Marco'}
                    className={inputCls}
                    required
                  />
                </Field>
                <Field label={t('contact.emailLabel')}>
                  <input
                    type='email'
                    value={form.email}
                    onChange={set('email')}
                    placeholder='you@example.com'
                    className={inputCls}
                    required
                  />
                </Field>
              </div>

              <Field label={t('contact.subjectLabel')}>
                <div className='relative'>
                  <button
                    type='button'
                    onClick={() => setSubjectOpen((v) => !v)}
                    className={`${inputCls} flex items-center justify-between cursor-pointer text-left ${form.subject ? 'text-white' : 'text-white/20'}`}
                  >
                    <span>{form.subject || t('contact.subjectPlaceholder')}</span>
                    <motion.span
                      animate={{ rotate: subjectOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className='w-4 h-4 text-white/30' />
                    </motion.span>
                  </button>
                  <AnimatePresence>
                    {subjectOpen && (
                      <motion.ul
                        key='dropdown'
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.18 }}
                        className='absolute z-50 mt-1.5 w-full bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden'
                      >
                        {subjects.map((s) => (
                          <li
                            key={s}
                            onClick={() => pickSubject(s)}
                            className={`px-4 py-2.5 text-sm cursor-pointer transition-colors hover:bg-violet-500/10 ${form.subject === s ? 'text-violet-400' : 'text-white/70'}`}
                          >
                            {s}
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              </Field>

              <Field label={t('contact.messageLabel')} hint={t('contact.messageHint')}>
                <textarea
                  rows={6}
                  value={form.message}
                  onChange={set('message')}
                  placeholder={t('contact.messagePlaceholder')}
                  className={`${inputCls} resize-none`}
                  required
                />
              </Field>

              <button
                type='submit'
                disabled={submitting}
                className='w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-colors'
              >
                {submitting ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                      className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full'
                    />
                    {t('contact.sending')}
                  </>
                ) : (
                  <>
                    <Send className='w-4 h-4' />
                    {t('contact.sendButton')}
                  </>
                )}
              </button>
            </form>
          </motion.div>

          {/* Channel cards */}
          <div className='flex flex-col gap-4'>
            {Object.entries(channels).map(([key, ch], i) => {
              const meta = CHANNEL_ICONS[key]
              if (!meta) return null
              const { Icon, color, bg, border, href: hrefFn } = meta
              const href = hrefFn ? hrefFn(ch.value) : null
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, delay: 0.25 + i * 0.07 }}
                  className={`bg-white/[0.04] border ${border} rounded-2xl p-5`}
                >
                  <div className='flex items-start gap-4'>
                    <div className={`p-2.5 rounded-xl ${bg} flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <div className='min-w-0'>
                      <p className='text-sm font-semibold text-white mb-0.5'>{ch.title}</p>
                      <p className='text-xs text-white/40 leading-relaxed mb-2'>{ch.body}</p>
                      <p className={`text-xs font-mono truncate ${color} mb-3`}>{ch.value}</p>
                      {href && ch.cta && (
                        <a
                          href={href}
                          target='_blank'
                          rel='noopener noreferrer'
                          className={`inline-flex items-center gap-1 text-xs font-medium ${color} hover:underline`}
                        >
                          {ch.cta}
                          <ArrowRight className='w-3 h-3' />
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </main>
      <Footer />
    </PageWrapper>
  )
}
