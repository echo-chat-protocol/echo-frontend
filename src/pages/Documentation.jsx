import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Search, Menu, X, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/HomepageComponents/Navbar'

const sections = [
  {
    id: 'overview',
    title: 'Overview',
    subsections: [
      { id: 'intro', title: 'Introduction' },
      { id: 'threat-model', title: 'Threat Model' },
      { id: 'stack-overview', title: 'Protocol Stack' },
    ],
  },
  {
    id: 'security',
    title: 'Security Model',
    subsections: [
      { id: 'attacks', title: 'Attacks' },
      { id: 'security-goals', title: 'Security Goals' },
      { id: 'limitations', title: 'Scope and Limitations' },
    ],
  },
  {
    id: 'primitives',
    title: 'Cryptographic Primitives',
    subsections: [
      { id: 'x25519', title: 'X25519 / ECDH' },
      { id: 'xeddsa', title: 'Ed25519 / XEdDSA' },
      { id: 'hkdf', title: 'HKDF-SHA256' },
      { id: 'aes-gcm', title: 'AES-256-GCM' },
    ],
  },
  {
    id: 'management',
    title: 'Key Management',
    subsections: [
      { id: 'identity-keys', title: 'Long-term Identity Keys' },
      { id: 'prekeys', title: 'Prekey Infrastructure' },
    ],
  },
]

const contentMap = {
  intro: {
    title: 'Echo Protocol',
    content: `Echo Protocol is a custom end-to-end encrypted messaging protocol for 1-to-1 and group communication.

It is implemented in Echo Chat, the multiplatform messaging app developed as a capstone project at Immune Institute of Technology.

Core design goals:
- Messages stay as opaque ciphertext on the server
- Session setup uses X3DH
- Ongoing 1-to-1 messaging uses Double Ratchet
- Group sessions use a TreeKEM-based key tree
- The implementation targets Signal-grade security as a design goal within academic constraints`,
  },
  'threat-model': {
    title: 'Threat Model',
    content: `Echo assumes an adversary with control of the server and the network transport.

The model includes:
- An honest-but-curious server that may log ciphertext, metadata, and public keys
- A Dolev-Yao network that can replay, drop, modify, or intercept traffic
- Uncompromised endpoints during normal operation

Out of scope:
- Side-channel attacks
- OS-level compromise
- Physical device access`,
  },
  'stack-overview': {
    title: 'Protocol Stack',
    content: `The protocol stack is layered around authenticated encryption and ratcheted key agreement.

1. Application layer: plaintext messages and attachments before encryption
2. Session establishment: X3DH or TreeKEM commits
3. Symmetric encryption: AES-256-GCM (AEAD)
4. Key derivation: HKDF-SHA256
5. Asymmetric primitives: X25519 and Ed25519

1-to-1 flow:
Alice fetches Bob's prekey bundle, performs X3DH, derives chain keys, and starts Double Ratchet messaging.

Group flow:
A group admin creates a TreeKEM key tree, sends Welcome messages, and later advances epochs through Commits when membership changes.`,
  },
  attacks: {
    title: 'Attacks',
    content: `Echo's documentation explicitly covers the attack classes below:

- Side-channel attacks at the hardware layer
- Subgroup attacks at the crypto layer
- Passive eavesdropping at the crypto layer
- Man-in-the-middle attacks during session establishment
- Key compromise and post-compromise window attacks in the messaging layer
- Replay attacks in the messaging layer
- Unauthorized forward and retrospective access at the application layer`,
  },
  'security-goals': {
    title: 'Security Goals',
    content: `Compliant implementations should provide:

- Confidentiality
- Mutual authentication
- Forward secrecy
- Post-compromise security
- Message integrity
- Replay resistance
- Deniability
- Group backward secrecy`,
  },
  limitations: {
    title: 'Scope and Limitations',
    content: `Echo Protocol is an academic implementation and has not undergone formal security proof or third-party audit.

Known limitations:
- Trust-on-first-use is used for initial key verification
- Key transparency and safety numbers are not yet implemented
- A Tamarin or ProVerif model is recommended before production use`,
  },
  x25519: {
    title: 'X25519 / ECDH',
    content: `X25519 scalar multiplication is used as the ECDH primitive for key agreement.

The spec notes that Curve25519 was chosen to avoid subgroup attacks that affect finite-field constructions. Private keys are clamped so the scalar lies in the correct subgroup.

Private key generation:
\`\`\`text
Random Bytes -> clamp(Random Bytes) = privateKey
\`\`\`

Clamping rules:
- k[0] &= 248: clear bits 0, 1, and 2
- k[31] &= 127: clear bit 255
- k[31] |= 64: set bit 254`,
  },
  xeddsa: {
    title: 'Ed25519 / XEdDSA',
    content: `Ed25519 is used for signatures, and XEdDSA lets X25519-derived material participate in signing workflows.

The spec describes XEdDSA as a way to derive an EdDSA-compatible signing scalar and public key from X25519 private key material so the same long-term key pair can support both Diffie-Hellman and signature verification.

Signature flow:
- Hash the private key with SHA-512
- Clamp the first 32 bytes to form the signing scalar
- Derive the nonce deterministically from the prefix and message
- Compute the signature as R | S

Verification checks:
\`\`\`text
S · B =? R + k · A
\`\`\``,
  },
  hkdf: {
    title: 'HKDF-SHA256',
    content: `HKDF is used to derive multiple context-specific keys from a single shared secret.

The spec breaks HKDF into two phases:
- Extract: HMAC(salt, input key material) produces a pseudorandom key
- Expand: hkdfExpand(PRK, info, L) derives usable keys

Domain separation matters. The spec uses info labels such as EchoProtocol/v1/X3DH_SK so different protocol components do not reuse the same derived material.`,
  },
  'aes-gcm': {
    title: 'AES-256-GCM',
    content: `Echo uses AES-256-GCM as its AEAD construction.

Properties from the spec:
- AES-256 provides the symmetric encryption primitive
- GCM adds authentication and integrity
- The nonce is 96 bits and must never be reused for the same key
- Additional Authenticated Data protects metadata such as counters, ratchet headers, and timestamps

The spec notes that the 1-to-1 Double Ratchet path uses random 96-bit AES-GCM nonces from the browser CSPRNG, while counters are authenticated as AAD for replay handling and state tracking.`,
  },
  'identity-keys': {
    title: 'Long-term Identity Keys',
    content: `Each user holds a long-term identity key pair at registration.

The spec defines:
- IK_priv: x25519 scalar used as the long-term private identity key
- IK_pub_25519: X25519 public key published to the server

The private identity key is used as the DH input in X3DH and as the scalar root for XEdDSA signing.`,
  },
  prekeys: {
    title: 'Prekey Infrastructure',
    content: `Prekey infrastructure supports asynchronous session setup.

The documentation describes the initial exchange as:
- Fetch the recipient's prekey bundle from the server
- Perform X3DH to establish a shared root key
- Derive directional chain keys
- Begin ratcheted message encryption

For group sessions, the spec uses TreeKEM commits and Welcome messages to distribute epoch secrets to members.`,
  },
}

function renderContent(content, copiedCode, onCopy) {
  if (!content) return null

  const parts = content.split(/(```[\s\S]*?```)/g)

  return parts.map((part, index) => {
    if (part.startsWith('```')) {
      const match = part.match(/```(\w+)?\n([\s\S]*?)```/)
      if (!match) return null

      const language = match[1] || 'text'
      const code = match[2]

      return (
        <div key={index} className='relative my-6 group'>
          <div className='bg-black/50 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm'>
            <div className='flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/[0.03]'>
              <span className='text-xs text-violet-300 uppercase tracking-wider font-semibold'>
                {language}
              </span>
              <button
                onClick={() => onCopy(code)}
                className='p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100'
              >
                {copiedCode === code ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <pre className='text-sm font-mono text-zinc-300 leading-relaxed p-6 overflow-x-auto'>
              {code}
            </pre>
          </div>
        </div>
      )
    }

    return (
      <div key={index} className='text-zinc-400 leading-relaxed mb-4 whitespace-pre-line'>
        {part}
      </div>
    )
  })
}

const Documentation = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentSection, setCurrentSection] = useState('intro')
  const [copiedCode, setCopiedCode] = useState(null)

  const filteredSections = sections
    .map((section) => ({
      ...section,
      subsections: section.subsections.filter((sub) =>
        `${section.title} ${sub.title}`.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((section) => section.subsections.length > 0)

  const currentContent = contentMap[currentSection]
  const allSections = sections.flatMap((section) => section.subsections)

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(text)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className='min-h-screen flex flex-col bg-black text-white selection:bg-violet-500/30'>
      <Navbar />

      <div className='fixed inset-0 pointer-events-none'>
        <div className='absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px]' />
        <div className='absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[100px]' />
      </div>

      <div className='flex flex-1 pt-20 relative z-10'>
        <aside
          className={`w-72 shrink-0 bg-black/95 backdrop-blur-xl border-r border-white/10 overflow-y-auto transition-transform duration-300 z-40
          fixed top-20 left-0 bottom-0
          lg:sticky lg:top-20 lg:bottom-auto lg:h-[calc(100vh-5rem)] lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className='p-6'>
            <div className='relative mb-8'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500' />
              <input
                type='text'
                placeholder='Search docs...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm transition-all'
              />
            </div>

            <nav className='space-y-6 pb-10'>
              {filteredSections.map((section) => (
                <div key={section.id}>
                  <h3 className='px-3 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2'>
                    {section.title}
                  </h3>
                  <div className='space-y-1'>
                    {section.subsections.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setCurrentSection(sub.id)
                          setSidebarOpen(false)
                          window.scrollTo({ top: 0, behavior: 'instant' })
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                          currentSection === sub.id
                            ? 'bg-violet-600/10 text-violet-400 font-medium border border-violet-500/20'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {sub.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <main className='flex-1 flex flex-col relative z-10'>
          <div className='flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full'>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className='lg:hidden mb-6 p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white'
            >
              {sidebarOpen ? <X className='w-5 h-5' /> : <Menu className='w-5 h-5' />}
            </button>

            <div className='flex items-center space-x-2 text-sm text-zinc-500 mb-8'>
              <Link to='/documentation' className='hover:text-violet-400 transition-colors'>
                Docs
              </Link>
              <ChevronRight className='w-4 h-4' />
              <span className='text-zinc-300'>{currentContent?.title}</span>
            </div>

            <AnimatePresence mode='wait'>
              <motion.div
                key={currentSection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className='min-h-[60vh]'
              >
                <h1 className='text-4xl md:text-5xl font-bold text-white mb-8 tracking-tight'>
                  {currentContent?.title}
                </h1>
                <div className='prose prose-invert max-w-none'>
                  {renderContent(currentContent?.content, copiedCode, handleCopy)}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className='flex justify-between items-center mt-16 pt-8 border-t border-white/10'>
              <button
                onClick={() => {
                  const currentIndex = allSections.findIndex((s) => s.id === currentSection)
                  if (currentIndex > 0) {
                    setCurrentSection(allSections[currentIndex - 1].id)
                    window.scrollTo({ top: 0, behavior: 'instant' })
                  }
                }}
                className='group flex items-center space-x-2 text-zinc-400 hover:text-violet-400 transition-colors'
                disabled={currentSection === allSections[0].id}
              >
                <ChevronRight className='w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform' />
                <span className='text-sm font-medium'>Previous</span>
              </button>

              <button
                onClick={() => {
                  const currentIndex = allSections.findIndex((s) => s.id === currentSection)
                  if (currentIndex < allSections.length - 1) {
                    setCurrentSection(allSections[currentIndex + 1].id)
                    window.scrollTo({ top: 0, behavior: 'instant' })
                  }
                }}
                className='group flex items-center space-x-2 text-zinc-400 hover:text-violet-400 transition-colors'
              >
                <span className='text-sm font-medium'>Next</span>
                <ChevronRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Documentation
