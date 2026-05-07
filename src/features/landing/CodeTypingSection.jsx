import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Code, Copy, Check } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

const CodeTypingSection = () => {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })
  const [activeTab, setActiveTab] = useState(0)
  const [copied, setCopied] = useState(false)
  const [displayCode, setDisplayCode] = useState('')
  const { t } = useTranslation()

  const codeExamples = [
    {
      language: 'javascript',
      title: t('code.javascript'),
      code: `import { EchoClient } from '@echo/crypto';

const client = new EchoClient();

const message = 'Hello, Echo!';
const encrypted = await client.encrypt(
  message,
  recipientPublicKey
);

await client.sendMessage(encrypted);`,
    },
    {
      language: 'python',
      title: t('code.python'),
      code: `from echo_crypto import EchoClient

client = EchoClient()
message = "Hello, Echo!"

encrypted = client.encrypt(
    message,
    recipient_public_key
)

client.send_message(encrypted)`,
    },
    {
      language: 'go',
      title: t('code.go'),
      code: `package main

import "echo/crypto"

func main() {
    client := crypto.NewEchoClient()
    message := "Hello, Echo!"
    
    encrypted, _ := client.Encrypt(
        message,
        recipientKey,
    )
    
    client.SendMessage(encrypted)
}`,
    },
    {
      language: 'rust',
      title: t('code.rust'),
      code: `use echo_crypto::Client;

#[tokio::main]
async fn main() {
    let client = Client::new();
    let msg = "Hello, Echo!";
    
    let encrypted = client
        .encrypt(msg, &key)
        .await
        .unwrap();
    
    client.send(&encrypted).await;
}`,
    },
  ]

  useEffect(() => {
    if (inView) {
      const code = codeExamples[activeTab].code
      let index = 0
      setDisplayCode('')

      const interval = setInterval(() => {
        if (index <= code.length) {
          setDisplayCode(code.slice(0, index))
          index++
        } else {
          clearInterval(interval)
        }
      }, 10)

      return () => clearInterval(interval)
    }
  }, [activeTab, inView])

  const copyCode = () => {
    navigator.clipboard.writeText(codeExamples[activeTab].code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section ref={ref} className='py-32 px-6 relative'>
      <div className='max-w-5xl mx-auto'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className='text-center mb-16'
        >
          <div className='inline-flex items-center justify-center bg-violet-500/10 text-violet-400 px-4 py-1 rounded-full mb-4 text-sm font-medium border border-violet-500/20'>
            <Code className='w-4 h-4 mr-2' />
            {t('code.badge')}
          </div>
          <h2 className='text-4xl md:text-5xl font-bold mb-6'>{t('code.title')}</h2>
          <p className='text-zinc-400 text-lg'>{t('code.description')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className='bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm'
        >
          <div className='flex flex-wrap gap-0 border-b border-white/5 bg-black/20'>
            {codeExamples.map((example, index) => (
              <button
                key={index}
                onClick={() => {
                  setActiveTab(index)
                  setDisplayCode('')
                }}
                className={`flex-1 px-4 py-4 text-sm font-medium transition-all border-b-2 ${
                  activeTab === index
                    ? 'border-violet-500 text-violet-400 bg-violet-500/5'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                {example.title}
              </button>
            ))}
          </div>

          <div className='relative p-6 bg-black/50 min-h-[300px]'>
            <button
              onClick={copyCode}
              className='absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors flex items-center gap-2 z-10 border border-white/5'
            >
              {copied ? (
                <>
                  <Check size={14} />
                  <span className='text-xs font-medium'>{t('code.copied')}</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span className='text-xs font-medium'>{t('code.copy')}</span>
                </>
              )}
            </button>

            <div className='code-block text-sm overflow-x-auto'>
              {displayCode && (
                <SyntaxHighlighter
                  language={codeExamples[activeTab].language}
                  style={atomDark}
                  customStyle={{
                    background: 'transparent',
                    padding: '0',
                    margin: '0',
                    fontFamily: 'Fira Code, monospace',
                    fontSize: '0.9rem',
                  }}
                  showLineNumbers
                  wrapLines
                >
                  {displayCode}
                </SyntaxHighlighter>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.4 }}
          className='mt-12 grid grid-cols-2 md:grid-cols-4 gap-4'
        >
          {[
            { val: '5+', label: t('code.stats.languages') },
            { val: '<2 min', label: t('code.stats.setup') },
            { val: '100%', label: t('code.stats.openSource') },
            { val: '24/7', label: t('code.stats.support') },
          ].map((stat, i) => (
            <div
              key={i}
              className='bg-white/5 border border-white/5 rounded-xl p-6 text-center hover:bg-white/10 transition-colors'
            >
              <div className='text-2xl md:text-3xl font-bold text-white mb-2'>{stat.val}</div>
              <p className='text-sm text-zinc-400'>{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default CodeTypingSection
