import React, { useEffect } from 'react'
import { Scale, ExternalLink } from 'lucide-react'
import Navbar from '@components/layout/Navbar'
import Footer from '@components/layout/Footer'
import PageWrapper from '@components/common/PageWrapper'

const LICENSES = [
  {
    name: 'Echo Frontend',
    license: 'MIT',
    url: 'https://github.com/echo-chat-protocol/echo-frontend/blob/master/LICENSE',
    description: 'The main Echo web and desktop application.',
    author: 'Marcos Cabrero, Gonzalo de la Lastra, Miguel Mascaró',
    year: '2024–2026',
  },
  {
    name: 'React',
    license: 'MIT',
    url: 'https://github.com/facebook/react/blob/main/LICENSE',
    description: 'The library for building user interfaces.',
    author: 'Meta Platforms, Inc.',
  },
  {
    name: 'Vite',
    license: 'MIT',
    url: 'https://github.com/vitejs/vite/blob/main/LICENSE',
    description: 'Next generation frontend tooling.',
    author: 'Evan You and Vite contributors',
  },
  {
    name: 'Framer Motion',
    license: 'MIT',
    url: 'https://github.com/framer/motion/blob/main/LICENSE.md',
    description: 'Animation library for React.',
    author: 'Framer B.V.',
  },
  {
    name: 'Tailwind CSS',
    license: 'MIT',
    url: 'https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE',
    description: 'Utility-first CSS framework.',
    author: 'Tailwind Labs Inc.',
  },
  {
    name: 'Socket.io-client',
    license: 'MIT',
    url: 'https://github.com/socketio/socket.io-client/blob/main/LICENSE',
    description: 'Real-time bidirectional event-based communication.',
    author: 'Socket.io contributors',
  },
  {
    name: 'react-router-dom',
    license: 'MIT',
    url: 'https://github.com/remix-run/react-router/blob/main/LICENSE.md',
    description: 'Declarative routing for React applications.',
    author: 'Remix Software Inc.',
  },
  {
    name: 'lucide-react',
    license: 'ISC',
    url: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE',
    description: 'Beautiful & consistent SVG icon set.',
    author: 'Lucide contributors',
  },
  {
    name: 'i18next',
    license: 'MIT',
    url: 'https://github.com/i18next/i18next/blob/master/LICENSE',
    description: 'Internationalisation framework.',
    author: 'i18next contributors',
  },
  {
    name: 'jwt-decode',
    license: 'MIT',
    url: 'https://github.com/auth0/jwt-decode/blob/main/LICENSE',
    description: 'Decode JWTs in the browser without validation.',
    author: 'Auth0, Inc.',
  },
  {
    name: 'crypto-js',
    license: 'MIT',
    url: 'https://github.com/brix/crypto-js/blob/develop/LICENSE',
    description: 'Standard and secure cryptographic algorithms in JavaScript.',
    author: 'Jeff Mott',
  },
  {
    name: 'wasm-bindgen',
    license: 'MIT / Apache-2.0',
    url: 'https://github.com/rustwasm/wasm-bindgen/blob/main/LICENSE-MIT',
    description: 'Facilitating high-level interactions between Wasm and JavaScript.',
    author: 'The wasm-bindgen developers',
  },
  {
    name: 'Tauri',
    license: 'MIT / Apache-2.0',
    url: 'https://github.com/tauri-apps/tauri/blob/dev/LICENSE_MIT',
    description: 'Build smaller, faster, and more secure desktop applications with a web frontend.',
    author: 'Tauri Programme within The Commons Conservancy',
  },
  {
    name: 'prop-types',
    license: 'MIT',
    url: 'https://github.com/facebook/prop-types/blob/main/LICENSE',
    description: 'Runtime type checking for React props.',
    author: 'Meta Platforms, Inc.',
  },
]

const LICENSE_COLOR = {
  MIT: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  ISC: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'MIT / Apache-2.0': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  'Apache-2.0': 'bg-violet-500/15 text-violet-400 border-violet-500/20',
}

const MIT_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`

const LicenseCard = ({ pkg }) => {
  const colorClass = LICENSE_COLOR[pkg.license] || LICENSE_COLOR.MIT
  return (
    <div className='bg-white/5 border border-white/10 rounded-2xl p-6'>
      <div className='flex items-start justify-between gap-4 mb-3'>
        <div>
          <p className='font-semibold text-white'>{pkg.name}</p>
          <p className='text-sm text-white/50 mt-0.5'>{pkg.description}</p>
        </div>
        <span
          className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${colorClass}`}
        >
          {pkg.license}
        </span>
      </div>
      {pkg.author && (
        <p className='text-xs text-white/40 mb-3'>
          Copyright © {pkg.year ?? new Date().getFullYear()} {pkg.author}
        </p>
      )}
      <p className='text-xs text-white/30 leading-relaxed whitespace-pre-wrap font-mono'>
        {MIT_TEXT}
      </p>
      {pkg.url && (
        <a
          href={pkg.url}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-1.5 mt-4 text-xs text-violet-400 hover:text-violet-300 transition-colors'
        >
          View full licence <ExternalLink className='w-3 h-3' />
        </a>
      )}
    </div>
  )
}

const LicensesPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <PageWrapper>
      <Navbar />
      <main className='pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-12'>
          <div className='inline-flex items-center justify-center p-3 bg-violet-500/10 rounded-2xl mb-6 ring-1 ring-violet-500/20'>
            <Scale className='w-8 h-8 text-violet-400' />
          </div>
          <h1 className='text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight'>
            Open Source Licences
          </h1>
          <p className='text-lg text-white/50 max-w-2xl mx-auto leading-relaxed'>
            Echo is built on the shoulders of the open-source community. Below is the full list of
            third-party libraries used in this project, along with their licence information.
          </p>
          <span className='inline-block mt-4 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/40'>
            Last Updated: February 1, 2026
          </span>
        </div>

        {/* Package list */}
        <div className='space-y-4'>
          {LICENSES.map((pkg) => (
            <LicenseCard key={pkg.name} pkg={pkg} />
          ))}
        </div>
      </main>
      <Footer />
    </PageWrapper>
  )
}

export default LicensesPage
