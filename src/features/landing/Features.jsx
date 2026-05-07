import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Shield, Lock, Key, RefreshCw, Zap, UserPlus, Globe, ChevronRight } from 'lucide-react'

const Features = () => {
  const [expandedIndex, setExpandedIndex] = useState(null)
  const { t } = useTranslation()

  const features = [
    {
      icon: Shield,
      title: t('features.echoProtocol'),
      desc: t('features.echoProtocolDesc'),
      details: t('features.echoProtocolDetails'),
      colSpan: 'md:col-span-2',
      gradient: 'from-violet-500/20 to-purple-500/20',
    },
    {
      icon: Lock,
      title: t('features.zeroKnowledge'),
      desc: t('features.zeroKnowledgeDesc'),
      details: t('features.zeroKnowledgeDetails'),
      colSpan: 'md:col-span-1',
      gradient: 'from-blue-500/20 to-cyan-500/20',
    },
    {
      icon: Zap,
      title: t('features.lightning'),
      desc: t('features.lightningDesc'),
      details: t('features.lightningDetails'),
      colSpan: 'md:col-span-1',
      gradient: 'from-amber-500/20 to-orange-500/20',
    },
    {
      icon: RefreshCw,
      title: t('features.ephemerals'),
      desc: t('features.ephemeralDesc'),
      details: t('features.ephemeralDetails'),
      colSpan: 'md:col-span-2',
      gradient: 'from-emerald-500/20 to-green-500/20',
    },
    {
      icon: Key,
      title: t('features.forwardSecrecy'),
      desc: t('features.forwardSecrecyDesc'),
      details: t('features.forwardSecrecyDetails'),
      colSpan: 'md:col-span-1',
      gradient: 'from-pink-500/20 to-rose-500/20',
    },
    {
      icon: UserPlus,
      title: t('features.groupChats'),
      desc: t('features.groupChatsDesc'),
      details: t('features.groupChatsDetails'),
      colSpan: 'md:col-span-1',
      gradient: 'from-indigo-500/20 to-blue-500/20',
    },
    {
      icon: Globe,
      title: t('features.decentralized'),
      desc: t('features.decentralizedDesc'),
      details: t('features.decentralizedDetails'),
      colSpan: 'md:col-span-1',
      gradient: 'from-teal-500/20 to-cyan-500/20',
    },
  ]

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

  return (
    <section id='features' className='py-32 px-6 relative'>
      <div className='max-w-7xl mx-auto'>
        <div className='mb-20'>
          <h2 className='text-4xl md:text-5xl font-bold mb-6'>
            {t('features.titleMain')}
            <br />
            <span className='text-zinc-500'>{t('features.titleSub')}</span>
          </h2>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 items-start'>
          {features.map((feature, i) => {
            const isExpanded = expandedIndex === i
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`group relative p-8 rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-all duration-500 overflow-hidden ${feature.colSpan}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />
                <div className='relative z-10 h-full flex flex-col pointer-events-none'>
                  <div className='mb-4'>
                    <div className='w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300'>
                      <feature.icon className='w-6 h-6 text-white' />
                    </div>
                    <h3 className='text-2xl font-semibold mb-2'>{feature.title}</h3>
                    <p className='text-zinc-400 leading-relaxed'>{feature.desc}</p>
                  </div>

                  <div
                    className={`overflow-hidden transition-all duration-500 ease-in-out ${
                      isExpanded ? 'max-h-[500px] opacity-100 mb-4' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className='pt-4 border-t border-white/10'>
                      <p className='text-zinc-300 text-sm leading-relaxed'>{feature.details}</p>
                    </div>
                  </div>

                  <div className='mt-auto'>
                    <button
                      type='button'
                      onClick={() => toggleExpand(i)}
                      className='pointer-events-auto flex items-center text-sm font-medium text-white/50 hover:text-white transition-colors focus:outline-none'
                    >
                      <span>{isExpanded ? t('features.showLess') : t('features.learnMore')}</span>
                      <ChevronRight
                        className={`w-4 h-4 ml-1 transition-transform duration-300 ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default Features
