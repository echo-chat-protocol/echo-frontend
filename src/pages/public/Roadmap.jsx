import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  Circle,
  Clock,
  Rocket,
  Zap,
  Shield,
  Smartphone,
  Globe,
  Users,
  Package,
  ChevronDown,
} from 'lucide-react'
import Navbar from '../components/HomepageComponents/Navbar'
import Footer from '../components/HomepageComponents/Footer'
import PageWrapper from '../components/common/PageWrapper'

/* Icons/phases  non-translatable metadata */
const MILESTONE_META = [
  { icon: Rocket, phase: 'done' },
  { icon: Shield, phase: 'done' },
  { icon: Zap, phase: 'done' },
  { icon: Globe, phase: 'inprogress' },
  { icon: Smartphone, phase: 'planned' },
  { icon: Users, phase: 'planned' },
  { icon: Package, phase: 'planned' },
]

const nodeColorClass = (phase) =>
  phase === 'done'
    ? 'bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.7)]'
    : phase === 'inprogress'
      ? 'bg-violet-400  shadow-[0_0_16px_rgba(139,92,246,0.7)]'
      : 'bg-white/20'

/*  Card panel  */
const CardPanel = ({ milestone, ph, MIcon, slideFrom }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const PhIcon = ph.Icon

  return (
    <motion.div
      initial={{ opacity: 0, x: slideFrom === 'left' ? -48 : 48 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className='w-full max-w-sm bg-white/[0.04] border border-white/10 rounded-2xl p-6 group'
    >
      <div className='flex items-start justify-between gap-3 mb-4'>
        <div className='flex items-center gap-3'>
          <div className='p-2 rounded-xl bg-white/5 group-hover:bg-violet-500/10 transition-colors'>
            <MIcon className='w-5 h-5 text-violet-400' />
          </div>
          <div>
            <p className='text-[10px] uppercase tracking-widest text-white/30 leading-none mb-1'>
              {milestone.quarter}
            </p>
            <p className='text-base font-semibold text-white leading-tight'>{milestone.title}</p>
          </div>
        </div>
        <span
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${ph.textColor} ${ph.bg} ${ph.border}`}
        >
          <PhIcon className='w-3 h-3' />
          {ph.label}
        </span>
      </div>

      <p className='text-sm text-white/40 leading-relaxed mb-4'>{milestone.description}</p>

      <ul className='space-y-2.5 mb-4'>
        {milestone.items.map((item) => {
          const s = ph.statusMap[item.status]
          const Icon = s.Icon
          return (
            <li key={item.text} className='flex items-start gap-2.5'>
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${s.textColor}`} />
              <span
                className={`text-sm leading-snug ${item.status === 'planned' ? 'text-white/30' : 'text-white/65'}`}
              >
                {item.text}
              </span>
            </li>
          )
        })}
      </ul>

      <div className='border-t border-white/[0.06] mb-3' />

      <button
        onClick={() => setOpen((v) => !v)}
        className='flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium select-none'
      >
        <span>{open ? t('roadmap.showLess') : t('roadmap.showMore')}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className='flex items-center'
        >
          <ChevronDown className='w-3.5 h-3.5' />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key='details'
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className='overflow-hidden'
          >
            <dl className='mt-4 space-y-3'>
              {milestone.details.map((d) => (
                <div key={d.label} className='flex flex-col gap-0.5'>
                  <dt className='text-[10px] uppercase tracking-widest text-white/25 font-medium'>
                    {d.label}
                  </dt>
                  <dd className='text-xs text-white/55 leading-relaxed'>{d.value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/*  Responsive milestone wrapper  */
const MobileOrDesktop = ({ milestone, STATUS, index }) => {
  const ph = STATUS[milestone.phase]
  const MIcon = MILESTONE_META[index].icon
  const isRight = index % 2 === 0
  const nodeColor = nodeColorClass(milestone.phase)

  return (
    <>
      <div className='flex gap-6 md:hidden'>
        <div className='relative flex flex-col items-center'>
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.35, ease: 'backOut' }}
            className={`w-4 h-4 rounded-full ring-4 ring-black flex-shrink-0 mt-1 ${nodeColor}`}
          />
        </div>
        <CardPanel milestone={milestone} ph={ph} MIcon={MIcon} slideFrom='right' />
      </div>

      <div className='hidden md:grid md:grid-cols-[1fr_5rem_1fr] items-start'>
        <div className='flex justify-end pr-4'>
          {!isRight && <CardPanel milestone={milestone} ph={ph} MIcon={MIcon} slideFrom='left' />}
        </div>
        <div className='flex justify-center pt-6'>
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.35, ease: 'backOut' }}
            className={`w-5 h-5 rounded-full ring-4 ring-black z-10 ${nodeColor}`}
          />
        </div>
        <div className='flex justify-start pl-4'>
          {isRight && <CardPanel milestone={milestone} ph={ph} MIcon={MIcon} slideFrom='right' />}
        </div>
      </div>
    </>
  )
}

/*  Stat pill  */
const StatPill = ({ value, label, color }) => (
  <div className={`flex flex-col items-center px-6 py-3 rounded-2xl border ${color}`}>
    <span className='text-2xl font-bold text-white tabular-nums'>{value}</span>
    <span className='text-xs text-white/40 mt-0.5 uppercase tracking-widest'>{label}</span>
  </div>
)

/*  Page  */
const RoadmapPage = () => {
  const { t } = useTranslation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const milestoneData = t('roadmap.milestones', { returnObjects: true })
  const MILESTONES = MILESTONE_META.map((meta, i) => ({ ...meta, ...milestoneData[i] }))

  const STATUS = {
    done: {
      label: t('roadmap.shipped'),
      textColor: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      Icon: CheckCircle2,
      statusMap: {},
    },
    inprogress: {
      label: t('roadmap.inProgress'),
      textColor: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      Icon: Clock,
      statusMap: {},
    },
    planned: {
      label: t('roadmap.planned'),
      textColor: 'text-white/30',
      bg: 'bg-white/5',
      border: 'border-white/10',
      Icon: Circle,
      statusMap: {},
    },
  }
  const statusMap = {
    done: { Icon: CheckCircle2, textColor: 'text-emerald-400' },
    inprogress: { Icon: Clock, textColor: 'text-violet-400' },
    planned: { Icon: Circle, textColor: 'text-white/30' },
  }
  Object.values(STATUS).forEach((s) => {
    s.statusMap = statusMap
  })

  const allItems = MILESTONES.flatMap((m) => m.items)
  const doneCount = allItems.filter((i) => i.status === 'done').length
  const ipCount = allItems.filter((i) => i.status === 'inprogress').length
  const planCount = allItems.filter((i) => i.status === 'planned').length
  const pct = Math.round((doneCount / allItems.length) * 100)

  return (
    <PageWrapper>
      <Navbar />
      <main className='pt-28 pb-24 px-4 sm:px-6'>
        <div className='text-center mb-16 max-w-2xl mx-auto'>
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45 }}
            className='inline-flex items-center justify-center p-3 bg-violet-500/10 rounded-2xl mb-6 ring-1 ring-violet-500/20'
          >
            <Rocket className='w-8 h-8 text-violet-400' />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className='text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight'
          >
            {t('roadmap.pageTitle')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className='text-lg text-white/45 leading-relaxed max-w-xl mx-auto'
          >
            {t('roadmap.pageSubtitle')}
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28 }}
          className='flex flex-wrap items-center justify-center gap-4 mb-6'
        >
          <StatPill
            value={doneCount}
            label={t('roadmap.shipped')}
            color='bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          />
          <StatPill
            value={ipCount}
            label={t('roadmap.inProgress')}
            color='bg-violet-500/10  border-violet-500/20  text-violet-400'
          />
          <StatPill
            value={planCount}
            label={t('roadmap.planned')}
            color='bg-white/5        border-white/10       text-white/30'
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.36 }}
          className='max-w-sm mx-auto mb-20'
        >
          <div className='flex justify-between text-xs text-white/30 mb-1.5'>
            <span>{t('roadmap.overallProgress')}</span>
            <span>{pct}%</span>
          </div>
          <div className='h-1.5 bg-white/5 rounded-full overflow-hidden'>
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className='h-full bg-gradient-to-r from-violet-500 to-emerald-400 rounded-full'
            />
          </div>
        </motion.div>

        <div className='relative max-w-4xl mx-auto'>
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            className='absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/40 via-white/10 to-white/5 origin-top hidden md:block'
          />
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            className='absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/40 via-white/10 to-white/5 origin-top md:hidden'
          />
          <div className='space-y-16 md:space-y-20'>
            {MILESTONES.map((milestone, i) => (
              <MobileOrDesktop key={i} milestone={milestone} STATUS={STATUS} index={i} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </PageWrapper>
  )
}

export default RoadmapPage
