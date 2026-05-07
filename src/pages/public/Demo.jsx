import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, RefreshCw, Lock, Unlock } from 'lucide-react'
import Navbar from '../components/HomepageComponents/Navbar'
import Footer from '../components/HomepageComponents/Footer'
import gsap from 'gsap'

const Demo = () => {
  const { t } = useTranslation()
  const [plaintext, setPlaintext] = useState('Hello, Echo!')
  const [ciphertext, setCiphertext] = useState('')
  const [key, setKey] = useState('32bytes32bytes32bytes32bytes32by')
  const [showCiphertext, setShowCiphertext] = useState(false)
  const [copied, setCopied] = useState(false)
  const ciphertextRef = useRef(null)

  // Simple encryption simulation (not real cryptography)
  const encryptMessage = () => {
    // Mock encryption - in reality this would use the WASM modules
    const encrypted = Buffer.from(plaintext).toString('base64')
    setCiphertext(encrypted)
    setShowCiphertext(true)

    gsap.fromTo(
      ciphertextRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
    )
  }

  const decryptMessage = () => {
    // Mock decryption
    try {
      const decrypted = Buffer.from(ciphertext, 'base64').toString('utf-8')
      alert(`Decrypted message: ${decrypted}`)
    } catch {
      alert('Invalid ciphertext')
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(ciphertext)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const generateKey = () => {
    // Generate random 32-byte key
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let newKey = ''
    for (let i = 0; i < 32; i++) {
      newKey += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setKey(newKey)
  }

  const resetDemo = () => {
    setPlaintext('Hello, Echo!')
    setCiphertext('')
    setShowCiphertext(false)
    generateKey()
  }

  return (
    <div className='min-h-screen bg-neutral-950'>
      <Navbar />

      <main className='pt-24'>
        {/* Hero */}
        <section className='relative py-16 border-b border-primary-800/20'>
          <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center'>
            <h1 className='text-4xl sm:text-5xl font-bold text-white mb-4'>Encryption Demo</h1>
            <p className='text-neutral-400 text-lg'>
              See how Echo encrypts your messages in real-time
            </p>
          </div>
        </section>

        {/* Demo Container */}
        <section className='relative py-20'>
          <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
              {/* Plaintext */}
              <div className='md:col-span-1'>
                <div className='sticky top-24'>
                  <h3 className='text-lg font-bold text-white mb-4'>Plaintext Message</h3>
                  <div className='p-4 bg-neutral-900 border border-primary-800/20 rounded-lg'>
                    <textarea
                      value={plaintext}
                      onChange={(e) => setPlaintext(e.target.value)}
                      className='w-full bg-transparent text-white outline-none resize-none text-sm font-mono'
                      rows='4'
                    />
                  </div>
                </div>
              </div>

              {/* Actions & Key */}
              <div className='md:col-span-1'>
                <h3 className='text-lg font-bold text-white mb-4'>Encryption Key</h3>
                <div className='p-4 bg-neutral-900 border border-primary-800/20 rounded-lg mb-6'>
                  <p className='text-neutral-500 text-xs mb-2 uppercase font-bold'>
                    256-bit AES Key
                  </p>
                  <code className='text-primary-400 text-xs break-all font-mono'>{key}</code>
                </div>

                {/* Action Buttons */}
                <div className='space-y-3'>
                  <button
                    onClick={encryptMessage}
                    className='w-full flex items-center justify-center space-x-2 px-4 py-3 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-lg transition-colors duration-250'
                  >
                    <Lock className='w-5 h-5' />
                    <span>Encrypt</span>
                  </button>

                  <button
                    onClick={generateKey}
                    className='w-full flex items-center justify-center space-x-2 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-primary-400 font-semibold rounded-lg transition-colors duration-250 border border-primary-800/20'
                  >
                    <RefreshCw className='w-5 h-5' />
                    <span>New Key</span>
                  </button>

                  <button
                    onClick={resetDemo}
                    className='w-full px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold rounded-lg transition-colors duration-250 border border-primary-800/20'
                  >
                    Reset
                  </button>
                </div>

                {/* Info Box */}
                <div className='mt-6 p-4 bg-primary-950/30 border border-primary-800/50 rounded-lg'>
                  <p className='text-neutral-400 text-xs leading-relaxed'>
                    This demo shows symmetric encryption. Echo uses X3DH for key exchange and Double
                    Ratchet for forward secrecy in production.
                  </p>
                </div>
              </div>

              {/* Ciphertext */}
              <div className='md:col-span-1'>
                <h3 className='text-lg font-bold text-white mb-4'>Ciphertext</h3>
                {showCiphertext ? (
                  <div
                    className='p-4 bg-neutral-900 border border-primary-800/20 rounded-lg mb-4'
                    ref={ciphertextRef}
                  >
                    <p className='text-neutral-500 text-xs mb-2 uppercase font-bold'>Encrypted</p>
                    <code className='text-emerald-400 text-xs break-all font-mono'>
                      {ciphertext}
                    </code>
                  </div>
                ) : (
                  <div className='p-4 bg-neutral-900 border border-primary-800/20 rounded-lg mb-4 flex items-center justify-center h-32 text-neutral-500'>
                    <p className='text-sm text-center'>Encrypted message will appear here</p>
                  </div>
                )}

                {showCiphertext && (
                  <div className='space-y-3'>
                    <button
                      onClick={copyToClipboard}
                      className='w-full flex items-center justify-center space-x-2 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-primary-400 font-semibold rounded-lg transition-colors duration-250 border border-primary-800/20'
                    >
                      <Copy className='w-5 h-5' />
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>

                    <button
                      onClick={decryptMessage}
                      className='w-full flex items-center justify-center space-x-2 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-primary-400 font-semibold rounded-lg transition-colors duration-250 border border-primary-800/20'
                    >
                      <Unlock className='w-5 h-5' />
                      <span>Decrypt</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Information Sections */}
        <section className='relative py-20 bg-neutral-900/50 border-y border-primary-800/20'>
          <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-12'>
              {/* X3DH Protocol */}
              <div>
                <h3 className='text-2xl font-bold text-white mb-4'>X3DH Key Exchange</h3>
                <p className='text-neutral-400 mb-4'>
                  Echo uses the Extended Triple Diffie-Hellman (X3DH) protocol to establish secure
                  channels between devices. This provides:
                </p>
                <ul className='space-y-2 text-neutral-300 text-sm'>
                  <li className='flex items-start space-x-2'>
                    <span className='text-primary-400 mt-1'>✓</span>
                    <span>
                      Forward secrecy: past messages stay safe even if keys are compromised
                    </span>
                  </li>
                  <li className='flex items-start space-x-2'>
                    <span className='text-primary-400 mt-1'>✓</span>
                    <span>Break-in recovery: automatic key refresh prevents full compromise</span>
                  </li>
                  <li className='flex items-start space-x-2'>
                    <span className='text-primary-400 mt-1'>✓</span>
                    <span>Authentication: cryptographic proof of peer identity</span>
                  </li>
                  <li className='flex items-start space-x-2'>
                    <span className='text-primary-400 mt-1'>✓</span>
                    <span>Asynchronous: works even when parties aren't online simultaneously</span>
                  </li>
                </ul>
              </div>

              {/* Double Ratchet */}
              <div>
                <h3 className='text-2xl font-bold text-white mb-4'>Double Ratchet Algorithm</h3>
                <p className='text-neutral-400 mb-4'>
                  After initial key exchange, the Double Ratchet algorithm provides additional
                  layers of security:
                </p>
                <ul className='space-y-2 text-neutral-300 text-sm'>
                  <li className='flex items-start space-x-2'>
                    <span className='text-primary-400 mt-1'>✓</span>
                    <span>KDF Ratchet: derives message-specific keys from chain key</span>
                  </li>
                  <li className='flex items-start space-x-2'>
                    <span className='text-primary-400 mt-1'>✓</span>
                    <span>
                      DH Ratchet: periodically exchanges new Diffie-Hellman ephemeral keys
                    </span>
                  </li>
                  <li className='flex items-start space-x-2'>
                    <span className='text-primary-400 mt-1'>✓</span>
                    <span>Out-of-order resilience: handles messages arriving in any order</span>
                  </li>
                  <li className='flex items-start space-x-2'>
                    <span className='text-primary-400 mt-1'>✓</span>
                    <span>
                      Perfect forward secrecy: compromising one key doesn't break all messages
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Learning Path */}
        <section className='relative py-20'>
          <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
            <h2 className='text-3xl font-bold text-white mb-12 text-center'>Learn More</h2>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              {[
                {
                  title: 'Getting Started',
                  description: 'Learn how to integrate Echo into your app',
                  href: '/documentation',
                },
                {
                  title: 'Security Protocols',
                  description: 'Deep dive into X3DH and Double Ratchet',
                  href: '/documentation/protocols',
                },
                {
                  title: 'API Reference',
                  description: 'Complete API documentation',
                  href: '/documentation',
                },
              ].map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  className='p-6 bg-neutral-900/50 border border-primary-800/20 rounded-lg hover:border-primary-600/40 hover:bg-neutral-900/70 transition-all duration-250 group'
                >
                  <h3 className='text-lg font-bold text-white mb-2 group-hover:text-primary-400 transition-colors duration-250'>
                    {item.title}
                  </h3>
                  <p className='text-neutral-400 text-sm'>{item.description}</p>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default Demo
