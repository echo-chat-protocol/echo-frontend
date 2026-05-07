import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import CryptoJS from 'crypto-js'
import { Lock, Key, Copy, Check, Unlock } from 'lucide-react'

const CipherPlayground = () => {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })
  const [plaintext, setPlaintext] = useState('Hello, Echo!')
  const [secretKey, setSecretKey] = useState('EchoSecurityKey123')
  const [ciphertext, setCiphertext] = useState('')
  const [decrypted, setDecrypted] = useState('')
  const [copied, setCopied] = useState(false)
  const [showDecrypt, setShowDecrypt] = useState(false)
  const [encryptionStep, setEncryptionStep] = useState(0)
  const { t } = useTranslation()

  useEffect(() => {
    if (!plaintext || !secretKey) return

    const timer = setTimeout(() => {
      const encrypted = CryptoJS.AES.encrypt(plaintext, secretKey).toString()
      setCiphertext(encrypted)
      setEncryptionStep(1)

      setTimeout(() => {
        const dec = CryptoJS.AES.decrypt(encrypted, secretKey).toString(CryptoJS.enc.Utf8)
        setDecrypted(dec)
        setEncryptionStep(2)
      }, 800)
    }, 300)

    return () => clearTimeout(timer)
  }, [plaintext, secretKey])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(ciphertext)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section ref={ref} className='py-32 px-6'>
      <div className='max-w-6xl mx-auto'>
        <div className='text-center mb-16'>
          <div className='inline-flex items-center justify-center bg-violet-500/10 text-violet-400 px-4 py-1 rounded-full mb-4 text-sm font-medium border border-violet-500/20'>
            <Lock className='w-4 h-4 mr-2' /> {t('cipher.badge')}
          </div>
          <h2 className='text-4xl font-bold mb-4'>{t('cipher.title')}</h2>
          <p className='text-zinc-400'>{t('cipher.description')}</p>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
          {/* Input */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className='bg-black/40 border border-white/10 rounded-2xl p-8'
          >
            <div className='flex items-center gap-3 mb-6'>
              <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
              <h3 className='text-lg font-semibold'>{t('cipher.plaintext')}</h3>
            </div>
            <textarea
              value={plaintext}
              onChange={(e) => {
                setPlaintext(e.target.value)
                setEncryptionStep(0)
              }}
              className='w-full h-32 bg-zinc-900/50 border border-white/10 rounded-lg p-4 text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors resize-none font-mono text-sm'
              placeholder={t('cipher.enterMessage')}
            />
            <div className='mt-6'>
              <div className='flex items-center gap-3 mb-2'>
                <Key className='w-4 h-4 text-zinc-500' />
                <span className='text-sm font-medium text-zinc-400'>{t('cipher.secretKey')}</span>
              </div>
              <input
                type='text'
                value={secretKey}
                onChange={(e) => {
                  setSecretKey(e.target.value)
                  setEncryptionStep(0)
                }}
                className='w-full bg-zinc-900/50 border border-white/10 rounded-lg p-3 text-white font-mono text-sm focus:outline-none focus:border-violet-500/50 transition-colors'
              />
            </div>
          </motion.div>

          {/* Output */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className='flex flex-col gap-6'
          >
            <div className='bg-violet-900/10 border border-violet-500/20 rounded-2xl p-8 relative overflow-hidden'>
              <div className='absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none' />
              <div className='flex items-center gap-3 mb-6'>
                <div
                  className={`w-2 h-2 rounded-full ${
                    encryptionStep >= 1 ? 'bg-violet-500 animate-pulse' : 'bg-zinc-700'
                  }`}
                />
                <h3 className='text-lg font-semibold text-violet-200'>{t('cipher.ciphertext')}</h3>
              </div>
              <div className='bg-black/40 border border-violet-500/20 rounded-lg p-4 min-h-[120px] break-all font-mono text-xs text-violet-300/80'>
                {ciphertext || t('cipher.waitingForInput')}
              </div>
              <button
                onClick={copyToClipboard}
                className='mt-4 flex items-center gap-2 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors'
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? t('cipher.copied') : t('cipher.copyToClipboard')}
              </button>
            </div>

            <div className='bg-zinc-900/30 border border-white/5 rounded-2xl p-6'>
              <button
                onClick={() => setShowDecrypt(!showDecrypt)}
                className='w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2'
              >
                <Unlock size={16} />
                {showDecrypt ? t('cipher.hide') : t('cipher.decrypt')}
              </button>
              <AnimatePresence>
                {showDecrypt && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className='overflow-hidden'
                  >
                    <div className='mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg'>
                      <p className='text-green-400 font-mono text-sm'>{decrypted}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default CipherPlayground
