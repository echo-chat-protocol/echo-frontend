import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Lock,
  EyeOff,
  Zap,
  TrendingUp,
  Users,
  BookOpen,
  ArrowRight,
  Code,
} from 'lucide-react'

const SecurityDocs = () => {
  const [activeTab, setActiveTab] = useState(0)
  const { t } = useTranslation()

  const protocols = [
    {
      icon: Lock,
      title: t('security.protocols.x3dh.title'),
      subtitle: t('security.protocols.x3dh.subtitle'),
      description: t('security.protocols.x3dh.description'),
      features: [
        'Identity-based authentication',
        'Forward secrecy guarantee',
        'Deniable authentication',
        'Post-compromise security',
      ],
      diagram: 'DH(IKa, SPKb) || DH(EKa, IKb) || DH(EKa, SPKb)',
    },
    {
      icon: TrendingUp,
      title: t('security.protocols.doubleRatchet.title'),
      subtitle: t('security.protocols.doubleRatchet.subtitle'),
      description: t('security.protocols.doubleRatchet.description'),
      features: [
        'Per-message key derivation',
        'Independent key chains',
        'Out-of-order message handling',
        'Efficient ratcheting',
      ],
      diagram: 'KDF(ratchet_key, chain_key) → (message_key, next_chain_key)',
    },
    {
      icon: Users,
      title: t('security.protocols.groupProtocol.title'),
      subtitle: t('security.protocols.groupProtocol.subtitle'),
      description: t('security.protocols.groupProtocol.description'),
      features: [
        'Scalable to 500+ members',
        'Linear communication overhead',
        'Group key updates',
        'Member removal support',
      ],
      diagram: 'Tree(member1, member2, ... memberN) → shared_group_key',
    },
    {
      icon: Zap,
      title: t('security.protocols.cryptoOps.title'),
      subtitle: t('security.protocols.cryptoOps.subtitle'),
      description: t('security.protocols.cryptoOps.description'),
      features: [
        'AES-256-GCM encryption',
        'SHA-256 hashing',
        'ED25519 signatures',
        'NIST P-256 curves (optional)',
      ],
      diagram: 'Plaintext → AES256(key) → Ciphertext + HMAC_AUTH',
    },
  ]

  const securityFeatures = [
    {
      title: t('security.guarantees.pfs.title'),
      description: t('security.guarantees.pfs.description'),
      icon: Shield,
    },
    {
      title: t('security.guarantees.bs.title'),
      description: t('security.guarantees.bs.description'),
      icon: Lock,
    },
    {
      title: t('security.guarantees.zka.title'),
      description: t('security.guarantees.zka.description'),
      icon: EyeOff,
    },
  ]

  return (
    <section id='security' className='py-32 px-6 relative overflow-hidden'>
      <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-violet-600/5 blur-[120px] rounded-full pointer-events-none' />

      <div className='max-w-6xl mx-auto relative z-10'>
        <div className='text-center mb-16'>
          <div className='inline-flex items-center justify-center bg-violet-500/10 text-violet-400 px-4 py-1.5 rounded-full mb-6 border border-violet-500/20'>
            <BookOpen className='w-4 h-4 mr-2' />
            <span className='text-sm font-medium'>{t('security.badge')}</span>
          </div>
          <h2 className='text-4xl md:text-5xl font-bold mb-6'>{t('security.title')}</h2>
          <p className='text-zinc-400 text-lg max-w-2xl mx-auto'>{t('security.description')}</p>
        </div>

        {/* Protocol tabs */}
        <div className='bg-zinc-900/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm mb-20'>
          <div className='flex flex-wrap border-b border-white/10'>
            {protocols.map((protocol, index) => {
              const Icon = protocol.icon
              return (
                <button
                  key={index}
                  onClick={() => setActiveTab(index)}
                  className={`flex-1 px-6 py-5 text-sm font-semibold transition-all flex items-center justify-center gap-3 relative ${
                    activeTab === index
                      ? 'text-white bg-white/5'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
                  }`}
                >
                  <Icon size={18} className={activeTab === index ? 'text-violet-400' : ''} />
                  <span className='hidden sm:inline'>{protocol.title}</span>
                  {activeTab === index && (
                    <motion.div
                      layoutId='activeTab'
                      className='absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500'
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div className='p-8 md:p-12 min-h-[400px]'>
            <AnimatePresence mode='wait'>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className='flex flex-col md:flex-row gap-12'>
                  <div className='flex-1'>
                    <div className='mb-6'>
                      <h3 className='text-2xl font-bold text-white mb-2'>
                        {protocols[activeTab].title}
                      </h3>
                      <p className='text-violet-400 font-medium'>{protocols[activeTab].subtitle}</p>
                    </div>
                    <p className='text-zinc-400 leading-relaxed mb-8'>
                      {protocols[activeTab].description}
                    </p>
                    <div className='space-y-4'>
                      <h4 className='text-xs font-bold text-zinc-500 uppercase tracking-wider'>
                        {t('security.keyFeatures')}
                      </h4>
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                        {protocols[activeTab].features.map((feature, idx) => (
                          <div
                            key={idx}
                            className='flex items-center gap-3 bg-white/5 border border-white/5 rounded-lg p-3'
                          >
                            <div className='w-1.5 h-1.5 bg-violet-500 rounded-full flex-shrink-0' />
                            <span className='text-zinc-300 text-sm'>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className='flex-1 flex flex-col justify-center'>
                    <div className='bg-black/50 border border-white/10 rounded-xl p-6 font-mono text-sm text-cyan-400 shadow-inner'>
                      <div className='flex items-center gap-2 mb-4 text-zinc-500 text-xs border-b border-white/5 pb-2'>
                        <Code size={12} />
                        <span>{t('security.protocolFlow')}</span>
                      </div>
                      {protocols[activeTab].diagram}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Security guarantees */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          {securityFeatures.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className='bg-zinc-900/40 border border-white/10 rounded-2xl p-8 hover:border-violet-500/30 transition-colors group'
              >
                <div className='w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300'>
                  <Icon className='w-6 h-6 text-violet-400' />
                </div>
                <h4 className='text-xl font-bold text-white mb-3'>{feature.title}</h4>
                <p className='text-zinc-400 leading-relaxed text-sm'>{feature.description}</p>
              </motion.div>
            )
          })}
        </div>

        <div className='mt-16 text-center'>
          <Link
            to='/docs'
            className='inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm border-b border-transparent hover:border-white pb-0.5'
          >
            {t('security.viewAudit')} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  )
}

export default SecurityDocs
