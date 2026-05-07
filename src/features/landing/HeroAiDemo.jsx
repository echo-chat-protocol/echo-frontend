import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Lock,
  Zap,
  Server,
  Globe,
  User,
  Sparkles,
  BarChart,
  Cpu,
  Search,
  Database,
  PenTool,
  Mail,
  TrendingUp,
  Users,
  MessageCircle,
  Code,
  Network,
  Check,
  RefreshCw,
} from 'lucide-react'

const DEMO_SCENARIOS = [
  {
    text: 'Summarize the key decisions from the engineering sync',
    results: [
      {
        icon: Shield,
        title: 'Protocol Update',
        desc: 'Consensus to implement post-quantum cryptography by Q4.',
      },
      {
        icon: Zap,
        title: 'Performance',
        desc: 'New Rust-based websocket server reduced latency by 40%.',
      },
      {
        icon: Server,
        title: 'Infrastructure',
        desc: 'Decentralized relay nodes are now fully operational.',
      },
    ],
  },
  {
    text: 'Analyze the security audit logs for suspicious activity',
    results: [
      {
        icon: Lock,
        title: 'Failed Attempts',
        desc: 'Detected and blocked 450 brute-force attempts from known botnet.',
      },
      {
        icon: Globe,
        title: 'Geo-Fencing',
        desc: 'Traffic from restricted regions has been successfully filtered.',
      },
      {
        icon: User,
        title: 'User Safety',
        desc: 'No compromised accounts detected in the last 24 hours.',
      },
    ],
  },
  {
    text: 'Draft a release note for the new encrypted voice feature',
    results: [
      {
        icon: PenTool,
        title: 'Key Feature',
        desc: 'Crystal clear voice calls secured with ZRTP protocol.',
      },
      {
        icon: Check,
        title: 'Availability',
        desc: 'Rolling out to iOS and Android users starting today.',
      },
      { icon: Shield, title: 'Privacy', desc: 'No metadata retention for call logs or duration.' },
    ],
  },
  {
    text: 'Generate ideas for the community engagement campaign',
    results: [
      {
        icon: Users,
        title: 'Bug Bounty',
        desc: 'Launch a new reward tier for critical protocol vulnerabilities.',
      },
      {
        icon: MessageCircle,
        title: 'AMA Session',
        desc: 'Host a live Q&A with the core cryptography team.',
      },
      { icon: Code, title: 'Hackathon', desc: 'Sponsor a decentralized app development contest.' },
    ],
  },
  {
    text: 'Optimize the database query for message retrieval',
    results: [
      {
        icon: Database,
        title: 'Indexing',
        desc: 'Added composite index on timestamp and sender_id.',
      },
      {
        icon: Zap,
        title: 'Caching',
        desc: 'Implemented Redis layer for frequently accessed public keys.',
      },
      {
        icon: Cpu,
        title: 'Load Reduction',
        desc: 'Database CPU usage dropped by 35% during peak hours.',
      },
    ],
  },
  {
    text: 'Review the Q3 user growth metrics',
    results: [
      {
        icon: TrendingUp,
        title: 'Active Users',
        desc: 'Daily Active Users (DAU) increased by 15% month-over-month.',
      },
      {
        icon: Globe,
        title: 'Expansion',
        desc: 'Significant adoption spike in privacy-conscious regions.',
      },
      { icon: BarChart, title: 'Retention', desc: 'User retention rate remains steady at 85%.' },
    ],
  },
  {
    text: 'Scan the codebase for deprecated dependencies',
    results: [
      { icon: Search, title: 'Scan Complete', desc: 'Found 3 packages requiring updates.' },
      { icon: Code, title: 'React', desc: 'Update to v19 recommended for concurrent features.' },
      {
        icon: Shield,
        title: 'Vulnerability',
        desc: 'Patched a minor regex denial of service in a sub-dependency.',
      },
    ],
  },
  {
    text: 'Evaluate the cost of new relay servers',
    results: [
      {
        icon: Server,
        title: 'Hosting',
        desc: 'Switching to bare-metal providers saves 20% monthly.',
      },
      {
        icon: Network,
        title: 'Bandwidth',
        desc: 'Negotiated unmetered egress for high-traffic nodes.',
      },
      {
        icon: BarChart,
        title: 'Projection',
        desc: 'Infrastructure costs stable for next 6 months.',
      },
    ],
  },
]

const HeroAiDemo = () => {
  const [scenario, setScenario] = useState(
    () => DEMO_SCENARIOS[Math.floor(Math.random() * DEMO_SCENARIOS.length)]
  )
  const [displayedText, setDisplayedText] = useState('')
  const [status, setStatus] = useState('typing') // 'typing' | 'ready' | 'processing' | 'done'
  const { t } = useTranslation()

  useEffect(() => {
    let isMounted = true

    const typeText = async () => {
      setStatus('typing')
      setDisplayedText('')

      await new Promise((r) => setTimeout(r, 500))
      if (!isMounted) return

      for (let i = 1; i <= scenario.text.length; i++) {
        if (!isMounted) return
        setDisplayedText(scenario.text.slice(0, i))
        await new Promise((resolve) => setTimeout(resolve, 30))
      }

      if (isMounted) setStatus('ready')
    }

    typeText()

    return () => {
      isMounted = false
    }
  }, [scenario])

  const handleButtonClick = async () => {
    if (status === 'ready') {
      setStatus('processing')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setStatus('done')
    } else if (status === 'done') {
      let nextScenario
      do {
        nextScenario = DEMO_SCENARIOS[Math.floor(Math.random() * DEMO_SCENARIOS.length)]
      } while (nextScenario === scenario)
      setScenario(nextScenario)
    }
  }

  return (
    <section className='py-32 px-6 relative overflow-hidden'>
      <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-purple-600/20 blur-[100px] rounded-full pointer-events-none' />

      <div className='max-w-3xl mx-auto relative z-10'>
        <div className='text-center mb-16'>
          <div className='inline-flex items-center justify-center bg-purple-500/10 text-purple-400 px-4 py-1 rounded-full mb-4 text-sm font-medium border border-purple-500/20'>
            <Sparkles className='w-4 h-4 mr-2' /> {t('ai.badge')}
          </div>
          <h2 className='text-4xl md:text-5xl font-bold mb-6'>
            {t('ai.title')} <span className='text-purple-400'>{t('ai.titleHighlight')}</span>
          </h2>
          <p className='text-zinc-400 text-lg'>{t('ai.description')}</p>
        </div>

        <motion.div
          layout
          className='bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden min-h-[200px]'
        >
          <motion.div layout className='p-8'>
            <div className='flex flex-col gap-6'>
              <div className='min-h-[60px] flex items-center'>
                <span className='text-2xl md:text-3xl font-medium text-white/90'>
                  {displayedText}
                  {status === 'typing' && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className='inline-block w-0.5 h-8 bg-purple-400 ml-1 align-middle'
                    />
                  )}
                </span>
              </div>

              <div className='flex justify-between items-center border-t border-white/5 pt-6'>
                <div className='flex gap-2'>
                  <div className='w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50' />
                  <div className='w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50' />
                  <div className='w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50' />
                </div>

                <motion.button
                  layout
                  onClick={handleButtonClick}
                  disabled={status === 'typing' || status === 'processing'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    status === 'processing'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 cursor-wait'
                      : status === 'done'
                        ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                        : 'bg-purple-600 text-white hover:bg-purple-500 border border-purple-500 shadow-lg shadow-purple-500/20'
                  } ${status === 'typing' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {status === 'processing' ? (
                    <>
                      <Sparkles className='w-4 h-4 animate-spin' />
                      {t('ai.analyzing')}
                    </>
                  ) : status === 'done' ? (
                    <>
                      <RefreshCw className='w-4 h-4' />
                      {t('ai.tryAnother')}
                    </>
                  ) : (
                    <>
                      <Sparkles className='w-4 h-4' />
                      {t('ai.generateReport')}
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            <AnimatePresence mode='wait'>
              {status === 'done' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className='overflow-hidden'
                >
                  <div className='pt-8 space-y-3'>
                    {scenario.results.map((item, index) => (
                      <motion.div
                        key={`${scenario.text}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className='flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors'
                      >
                        <div className='p-2 rounded-lg bg-purple-500/20 text-purple-300 flex-shrink-0'>
                          <item.icon className='w-5 h-5' />
                        </div>
                        <div>
                          <h4 className='text-sm font-semibold text-white mb-1'>{item.title}</h4>
                          <p className='text-sm text-zinc-400 leading-relaxed'>{item.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default HeroAiDemo
