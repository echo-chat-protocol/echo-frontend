import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  RefreshCw,
  Server,
  Globe,
  Zap,
  Database,
  Lock,
  Bell,
} from 'lucide-react'
import Navbar from '../components/HomepageComponents/Navbar'
import Footer from '../components/HomepageComponents/Footer'
import PageWrapper from '../components/common/PageWrapper'

/* Non-translatable: icon + status id mappings */
const SERVICE_ICONS = [Server, Globe, Zap, Database, Lock, Bell]

const CFG_META = {
  operational: {
    Icon: CheckCircle2,
    color: 'text-emerald-400',
    dot: 'bg-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  degraded: {
    Icon: AlertTriangle,
    color: 'text-yellow-400',
    dot: 'bg-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
  },
  outage: {
    Icon: XCircle,
    color: 'text-red-400',
    dot: 'bg-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
  maintenance: {
    Icon: Wrench,
    color: 'text-blue-400',
    dot: 'bg-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/10',
  },
}

const INCIDENT_COLORS = {
  resolved: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  monitoring: 'text-yellow-400  bg-yellow-500/10  border-yellow-500/20',
  maintenance: 'text-blue-400    bg-blue-500/10    border-blue-500/10',
}

function useStatuses(serviceCount) {
  const [statuses, setStatuses] = useState(() => Array(serviceCount).fill('operational'))
  const randomize = useCallback(() => {
    const pool = ['operational', 'operational', 'operational', 'degraded']
    setStatuses(
      Array.from({ length: serviceCount }, () => pool[Math.floor(Math.random() * pool.length)])
    )
  }, [serviceCount])
  useEffect(() => {
    randomize()
    const id = setInterval(randomize, 30000)
    return () => clearInterval(id)
  }, [randomize])
  return { statuses, refresh: randomize }
}

export default function StatusPage() {
  const { t } = useTranslation()
  const [lastChecked, setLastChecked] = useState(new Date())

  const serviceData = t('statusPage.services', { returnObjects: true })
  const incidentData = t('statusPage.incidents', { returnObjects: true })

  const services = Array.isArray(serviceData) ? serviceData : []
  const incidents = Array.isArray(incidentData) ? incidentData : []

  const { statuses, refresh } = useStatuses(services.length)

  const handleRefresh = () => {
    refresh()
    setLastChecked(new Date())
  }

  const hasIssue = statuses.some((s) => s !== 'operational')
  const summary = hasIssue ? CFG_META.degraded : CFG_META.operational

  const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <PageWrapper>
      <Navbar />
      <main className='pt-28 pb-24 px-4 sm:px-6 max-w-4xl mx-auto'>
        {/* Header row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10'
        >
          <div>
            <h1 className='text-3xl font-bold text-white tracking-tight'>
              {t('statusPage.pageTitle')}
            </h1>
            <p className='text-sm text-white/35 mt-1'>
              {t('statusPage.lastChecked')}{' '}
              <span className='text-white/55'>{fmt(lastChecked)}</span>
            </p>
          </div>
          <div className='flex items-center gap-3'>
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${summary.bg} ${summary.border}`}
            >
              <span className={`w-2 h-2 rounded-full ${summary.dot} animate-pulse`} />
              <span className={`text-sm font-medium ${summary.color}`}>
                {hasIssue ? t('statusPage.disruption') : t('statusPage.allOperational')}
              </span>
            </div>
            <button
              onClick={handleRefresh}
              className='p-2 rounded-xl bg-white/[0.04] border border-white/10 hover:border-violet-500/40 hover:bg-violet-500/10 transition-all group'
            >
              <RefreshCw className='w-4 h-4 text-white/40 group-hover:text-violet-400 transition-colors' />
            </button>
          </div>
        </motion.div>

        {/* Services table-card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className='bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden mb-10'
        >
          {services.map((svc, i) => {
            const StatusIcon = SERVICE_ICONS[i] || Server
            const statusKey = statuses[i] || 'operational'
            const cfg = CFG_META[statusKey] || CFG_META.operational
            const { Icon: SIcon, color, dot } = cfg
            const label = t(`statusPage.${statusKey}`)
            return (
              <div
                key={i}
                className={`flex items-center gap-4 px-5 py-4 ${i < services.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
              >
                <div className='p-2 bg-white/[0.04] rounded-lg flex-shrink-0'>
                  <StatusIcon className='w-4 h-4 text-white/40' />
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium text-white'>{svc.label}</p>
                  <p className='text-xs text-white/35 truncate'>{svc.desc}</p>
                </div>
                <div className='flex items-center gap-1.5 flex-shrink-0'>
                  <span className={`w-2 h-2 rounded-full ${dot}`} />
                  <span className={`text-xs font-medium ${color}`}>{label}</span>
                </div>
              </div>
            )
          })}
        </motion.div>

        {/* Incidents */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          <h2 className='text-lg font-semibold text-white mb-5'>
            {t('statusPage.incidentHistory')}
          </h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            {incidents.map((inc, i) => {
              const colorCls = INCIDENT_COLORS[inc.type] || INCIDENT_COLORS.resolved
              return (
                <div key={i} className='bg-white/[0.04] border border-white/10 rounded-xl p-5'>
                  <div className='flex items-center justify-between mb-2'>
                    <span className='text-xs text-white/35'>{inc.date}</span>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${colorCls}`}
                    >
                      {inc.type}
                    </span>
                  </div>
                  <p className='text-sm font-medium text-white mb-1'>{inc.title}</p>
                  <p className='text-xs text-white/40 leading-relaxed'>{inc.body}</p>
                </div>
              )
            })}
          </div>
        </motion.div>
      </main>
      <Footer />
    </PageWrapper>
  )
}
