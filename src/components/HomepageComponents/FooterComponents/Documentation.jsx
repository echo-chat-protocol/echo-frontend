import Navbar from '@components/layout/Navbar'
import Footer from '@components/layout/Footer'
import ParticlesBackground from '@components/animations/ParticlesBackground'

const Documentation = () => {
  return (
    <div className='min-h-screen bg-primary-1000 text-white font-sans'>
      <ParticlesBackground />
      <Navbar />
      <div className='relative z-10 max-w-5xl mx-auto px-6 py-12 md:py-20'>
        {/* Header Section */}
        <div className='text-center mb-16'>
          <h1 className='text-4xl font-bold mb-4 text-white'>Echo Technical Documentation</h1>
          <div className='flex justify-center space-x-4 mb-6'>
            <a
              href='https://www.rust-lang.org/'
              target='_blank'
              rel='noopener noreferrer'
              className='bg-white/10 px-3 py-1 rounded-full text-sm hover:bg-white/20 transition-colors'
            >
              Rust
            </a>
            <a
              href='https://webassembly.org/'
              target='_blank'
              rel='noopener noreferrer'
              className='bg-white/10 px-3 py-1 rounded-full text-sm hover:bg-white/20 transition-colors'
            >
              WASM
            </a>
            <span className='bg-white/10 px-3 py-1 rounded-full text-sm'>
              End-to-End Encryption
            </span>
          </div>
          <p className='text-white/80 text-lg max-w-3xl mx-auto'>
            Comprehensive guide to Echo's security architecture and cryptographic protocols
          </p>
        </div>

        <div className='prose prose-invert max-w-none'>
          {/* Introduction Section */}
          <section className='mb-16'>
            <h2 className='text-3xl font-bold mb-6 border-b border-white/20 pb-2'>Introduction</h2>
            <p className='text-lg mb-6'>
              Echo is an open-source, end-to-end encrypted chat app built with a security protocol
              inspired by the{' '}
              <a
                href='https://signal.org/docs/'
                className='text-purple-500 hover:underline'
                target='_blank'
                rel='noopener noreferrer'
              >
                Signal Protocol
              </a>
              .
            </p>
            <p className='mb-6'>
              All cryptographic operations in Echo are powered by custom Rust modules developed from
              the ground up, handling:
            </p>
            <ul className='list-disc pl-6 space-y-2 mb-6'>
              <li>
                <span className='font-semibold'>X3DH</span> - Key agreement protocol
              </li>
              <li>
                <span className='font-semibold'>XEdDSA</span> - Signature scheme
              </li>
              <li>
                <span className='font-semibold'>AES-256</span> - Encryption
              </li>
            </ul>
          </section>

          {/* X3DH Section */}
          <section className='mb-20'>
            <h2 className='text-3xl font-bold mb-6 border-b border-white/20 pb-2'>X3DH Protocol</h2>
            <p className='mb-6'>
              Extended Triple Diffie-Hellman is a key agreement protocol that ensures{' '}
              <span className='font-semibold text-purple-500'>forward secrecy</span> and{' '}
              <span className='font-semibold text-purple-500'>deniability</span>.
            </p>

            <div className='bg-white/5 p-6 rounded-xl mb-8'>
              <h3 className='text-2xl font-semibold mb-4 text-purple-500'>Key Components</h3>
              <ul className='list-disc pl-6 space-y-3'>
                <li>
                  <span className='font-semibold'>Identity Key (IK):</span> Long-term key pair for
                  authentication
                </li>
                <li>
                  <span className='font-semibold'>Signed Prekey (SPK):</span> Short-term key signed
                  by IK, rotated periodically
                </li>
                <li>
                  <span className='font-semibold'>One-Time Prekeys (OPK):</span> Optional single-use
                  keys for forward secrecy
                </li>
              </ul>
            </div>

            <div className='bg-white/5 p-6 rounded-xl mb-8'>
              <h3 className='text-2xl font-semibold mb-4 text-purple-500'>Key Exchange Process</h3>
              <ol className='list-decimal pl-6 space-y-3'>
                <li>
                  Alice fetches Bob's prekeys (IK<sub>B</sub>, SPK<sub>B</sub>, OPK<sub>B</sub>)
                </li>
                <li>
                  Alice verifies SPK<sub>B</sub>'s signature using XEdDSA
                </li>
                <li>
                  Alice performs three DH operations:
                  <div className='bg-black/30 p-4 rounded-lg mt-3 space-y-2'>
                    <div className='font-mono'>DH1 = DH(IK_A, SPK_B) # Identity × SignedPreKey</div>
                    <div className='font-mono'>DH2 = DH(EK_A, IK_B) # Ephemeral × Identity</div>
                    <div className='font-mono'>
                      DH3 = DH(EK_A, SPK_B) # Ephemeral × SignedPreKey
                    </div>
                    <div className='font-mono'>DH4 = DH(EK_A, OPK_B) # Ephemeral × OneTimeKey</div>
                  </div>
                </li>
                <li>
                  The shared secret is derived as:
                  <pre className='bg-black/30 p-4 rounded-lg mt-3 overflow-x-auto'>
                    <code>SK = KDF(DH1 || DH2 || DH3 || DH4)</code>
                  </pre>
                </li>
              </ol>
            </div>
          </section>

          {/* XEdDSA Section */}
          <section className='mb-20'>
            <h2 className='text-3xl font-bold mb-6 border-b border-white/20 pb-2'>
              XEdDSA Protocol
            </h2>
            <p className='mb-6'>
              EdDSA for X25519 converts X25519 keys to Edwards form for signing while maintaining
              compatibility with X3DH.
            </p>

            <div className='grid md:grid-cols-2 gap-8 mb-8'>
              <div className='bg-white/5 p-6 rounded-xl'>
                <h3 className='text-2xl font-semibold mb-4 text-purple-500'>Signing Process</h3>
                <ol className='list-decimal pl-6 space-y-3'>
                  <li>Convert private key to Edwards form via SHA-512</li>
                  <li>
                    First 32 bytes are clamped to become{' '}
                    <code className='bg-white/10 px-1 rounded'>a</code>
                  </li>
                  <li>
                    Last 32 bytes become the{' '}
                    <code className='bg-white/10 px-1 rounded'>Prefix</code>
                  </li>
                  <li>
                    Compute nonce:{' '}
                    <code className='bg-white/10 px-1 rounded'>r = SHA(Prefix + message) % L</code>
                  </li>
                  <li>
                    Calculate nonce point: <code className='bg-white/10 px-1 rounded'>R = B·r</code>
                  </li>
                  <li>
                    Compute challenge hash:{' '}
                    <code className='bg-white/10 px-1 rounded'>k = SHA(R ‖ A ‖ message) % L</code>
                  </li>
                  <li>
                    Create signature: <code className='bg-white/10 px-1 rounded'>(R, S)</code> where{' '}
                    <code className='bg-white/10 px-1 rounded'>S = (r + k·a) mod L</code>
                  </li>
                </ol>
              </div>

              <div className='bg-white/5 p-6 rounded-xl'>
                <h3 className='text-2xl font-semibold mb-4 text-purple-500'>
                  Verification Process
                </h3>
                <ol className='list-decimal pl-6 space-y-3'>
                  <li>
                    Decompress signature into <code className='bg-white/10 px-1 rounded'>R</code>{' '}
                    and <code className='bg-white/10 px-1 rounded'>S</code>
                  </li>
                  <li>
                    Reconstruct public key <code className='bg-white/10 px-1 rounded'>A</code>
                  </li>
                  <li>
                    Compute challenge hash:{' '}
                    <code className='bg-white/10 px-1 rounded'>k = SHA(R ‖ A ‖ message) % L</code>
                  </li>
                  <li>
                    Verify: <code className='bg-white/10 px-1 rounded'>S·B = R + k·A</code>
                  </li>
                </ol>
              </div>
            </div>

            {/* Clamping Table */}
            <div className='bg-white/5 p-6 rounded-xl mb-8'>
              <h3 className='text-2xl font-semibold mb-4 text-purple-500'>Clamping Process</h3>
              <div className='overflow-x-auto'>
                <table className='min-w-full border-collapse'>
                  <thead>
                    <tr className='border-b border-white/20'>
                      <th className='py-3 px-4 text-left font-medium'>Byte Index</th>
                      <th className='py-3 px-4 text-left font-medium'>Description</th>
                      <th className='py-3 px-4 text-left font-medium'>Operation</th>
                      <th className='py-3 px-4 text-left font-medium'>Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['0', 'Least significant byte', 'a[0] &= 248', 'Clears bits 0, 1, 2'],
                      ['1-30', 'Middle bytes', 'No change', 'Retains entropy'],
                      [
                        '31',
                        'Most significant byte',
                        'a[31] &= 127; a[31] = 64',
                        'Ensures security bounds',
                      ],
                    ].map(([index, desc, op, purpose]) => (
                      <tr key={index} className='border-b border-white/10'>
                        <td className='py-3 px-4 font-mono'>{index}</td>
                        <td className='py-3 px-4'>{desc}</td>
                        <td className='py-3 px-4 font-mono'>{op}</td>
                        <td className='py-3 px-4'>{purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Key Terminology Table */}
            <div className='bg-white/5 p-6 rounded-xl mt-8'>
              <h3 className='text-2xl font-semibold mb-4 text-purple-500'>Key Terminology</h3>
              <div className='overflow-x-auto'>
                <table className='min-w-full border-collapse'>
                  <thead>
                    <tr className='border-b border-white/20'>
                      <th className='py-3 px-4 text-left font-medium'>Term</th>
                      <th className='py-3 px-4 text-left font-medium'>Description</th>
                      <th className='py-3 px-4 text-left font-medium'>Curve Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['xprivIK', 'X25519 private key (32-byte scalar)', 'Montgomery'],
                      ['xpubIK', 'X25519 public key (Derived from xprivIK)', 'Montgomery'],
                      ['xpubPK', 'X25519 public pre key (Derived from xprivPK)', 'Montgomery'],
                      ['a', 'Clamped Edwards private scalar (derived from xprivIK)', 'Edwards'],
                      ['Prefix', 'Generated with a (derived from xprivIK)', 'Edwards'],
                      ['A', 'Edwards public key (derived from a)', 'Edwards'],
                      ['r', 'Deterministic nonce', 'Edwards'],
                      ['R', 'Nonce point (R = r * B)', 'Edwards'],
                      ['k', 'Challenge hash (k = H(R ‖ A ‖ M), where H is SHA-512)', 'N/A'],
                      ['S', 'Signature scalar (S = (r + k * a) mod L)', 'Edwards'],
                      [
                        'L',
                        'Order of the curve (2²⁵² + 27742317777372353535851937790883648493)',
                        'N/A',
                      ],
                      ['B', 'Basepoint (curve generator)', 'Edwards/Montgomery'],
                    ].map(([term, desc, form]) => (
                      <tr key={term} className='border-b border-white/10'>
                        <td className='py-3 px-4 font-mono'>{term}</td>
                        <td className='py-3 px-4'>{desc}</td>
                        <td className='py-3 px-4'>{form}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* References Section */}
          <section className='mb-10'>
            <h2 className='text-3xl font-bold mb-6 border-b border-white/20 pb-2'>References</h2>
            <ul className='space-y-3'>
              {[
                ['Signal XEdDSA Specification', 'https://signal.org/docs/specifications/xeddsa/'],
                ['RFC 8032: Ed25519', 'https://datatracker.ietf.org/doc/html/rfc8032'],
                ['RFC 7748: Curve25519', 'https://datatracker.ietf.org/doc/html/rfc7748'],
              ].map(([title, url]) => (
                <li key={url}>
                  <a
                    href={url}
                    className='text-white hover:underline flex items-center'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {title}
                    <svg
                      className='w-4 h-4 ml-1'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
                      />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default Documentation
