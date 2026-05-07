import React from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Lock, Cpu, Code, Shield, GitMerge, Key, Server } from 'lucide-react'
import Navbar from '@components/layout/Navbar'
import Footer from '@components/layout/Footer'
import PageWrapper from '@components/common/PageWrapper'

const AboutUs = () => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  const glassStyle = 'bg-white/5 backdrop-blur-md border border-white/10 rounded-xl shadow-lg'

  const milestones = [
    { year: 'November 2024', event: 'Project conception and initial development' },
    { year: 'Q1 2025', event: 'First cryptographic protocols implemented' },
    { year: 'Q2 2025', event: 'WebAssembly modules successfully compiled' },
    { year: 'Q3 2025', event: 'Alpha release with end-to-end encryption' },
    { year: '2026', event: 'Open source release under MIT license' },
    { year: '2027', event: 'Stable version with enterprise support' },
  ]

  const team = [
    {
      name: 'Marcos Cabrero',
      role: 'Frontend Architect',
      contribution: 'Developed the entire user interface and client-side applications',
      icon: <Code className='w-6 h-6 text-white' />,
    },
    {
      name: 'Miguel Mascaró',
      role: 'Security & Backend Engineer',
      contribution: 'Implemented core security protocols and server infrastructure',
      icon: <Lock className='w-6 h-6 text-white' />,
    },
    {
      name: 'Gonzalo de la Lastra',
      role: 'Quality Assurance Lead',
      contribution: 'Ensured system integrity and resolved technical conflicts',
      icon: <Cpu className='w-6 h-6 text-white' />,
    },
  ]

  const techStack = [
    {
      name: 'Rust',
      description: 'For cryptographic operations',
      icon: <Code className='w-6 h-6 text-white' />,
    },
    {
      name: 'WebAssembly',
      description: 'Browser-based encryption',
      icon: <Server className='w-6 h-6 text-white' />,
    },
    {
      name: 'React',
      description: 'Modern UI framework',
      icon: <GitMerge className='w-6 h-6 text-white' />,
    },
  ]

  return (
    <PageWrapper>
      <div className='relative z-10'>
        <Navbar />
        <div className='max-w-6xl mx-auto px-6 py-20'>
          {/* Hero Section */}
          <section className='text-center mb-20'>
            <motion.h1
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className='text-5xl font-bold mb-6 text-white'
            >
              Echo Protocol
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className='text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed'
            >
              Open-source end-to-end encrypted communication
            </motion.p>
          </section>

          {/* Mission */}
          <section className='mb-28' ref={ref}>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 items-center'>
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.8 }}
                className={`${glassStyle} p-8`}
              >
                <h2 className='text-3xl font-bold mb-6 text-white'>Our Mission</h2>
                <div className='space-y-6 text-gray-300 leading-relaxed'>
                  <p>
                    Echo was born from a simple idea: privacy should be the norm, not a premium
                    feature.
                  </p>
                  <p>
                    We created a communication protocol that combines military-grade encryption with
                    the performance needed for real-world use, while remaining completely open
                    source.
                  </p>
                  <p>
                    Our cryptographic modules in Rust implement advanced algorithms like X3DH and
                    XEdDSA, offering security comparable to industry leaders.
                  </p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3, duration: 0.8 }}
                className={`${glassStyle} p-8`}
              >
                <h3 className='text-2xl font-semibold mb-6 flex items-center text-white'>
                  <Shield className='w-8 h-8 text-white mr-3' />
                  Security First
                </h3>
                <ul className='space-y-4 text-gray-300'>
                  {milestones.map((item, index) => (
                    <li key={index} className='flex items-start'>
                      <span className='block w-2 h-2 bg-white rounded-full mt-2 mr-3'></span>
                      <div>
                        <span className='font-medium text-white'>{item.year}:</span> {item.event}
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </section>

          {/* Technology */}
          <section className='mb-28'>
            <h2 className='text-3xl font-bold mb-16 text-center text-white'>Technology Stack</h2>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              {techStack.map((tech, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 50 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  className={`${glassStyle} p-6 hover:border-white/30 transition-all`}
                >
                  <div
                    className={`w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mb-4`}
                  >
                    {tech.icon}
                  </div>
                  <h3 className='text-xl font-semibold mb-2 text-white'>{tech.name}</h3>
                  <p className='text-gray-400'>{tech.description}</p>
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.4, duration: 0.8 }}
              className={`${glassStyle} mt-12 p-8`}
            >
              <h3 className='text-xl font-semibold mb-4 text-white'>Cryptographic Innovations</h3>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div>
                  <h4 className='font-medium mb-2 flex items-center text-white'>
                    <Key className='w-5 h-5 text-white mr-2' />
                    X3DH Protocol
                  </h4>
                  <p className='text-gray-400 text-sm leading-relaxed'>
                    Implements Extended Triple Diffie-Hellman for perfect forward secrecy.
                  </p>
                </div>
                <div>
                  <h4 className='font-medium mb-2 flex items-center text-white'>
                    <Lock className='w-5 h-5 text-white mr-2' />
                    XEdDSA Signatures
                  </h4>
                  <p className='text-gray-400 text-sm leading-relaxed'>
                    Digital signature algorithm on Edwards curve adapted for X25519 keys.
                  </p>
                </div>
              </div>
            </motion.div>
          </section>

          {/* Team */}
          <section className='mb-28'>
            <h2 className='text-3xl font-bold mb-16 text-center text-white'>The Team</h2>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              {team.map((member, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  className={`${glassStyle} p-6 hover:border-white/30 transition-all`}
                >
                  <div className='w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4'>
                    {member.icon}
                  </div>
                  <h3 className='text-xl font-semibold text-center text-white'>{member.name}</h3>
                  <p className='text-gray-400 text-center mb-3'>{member.role}</p>
                  <p className='text-gray-300 text-center leading-relaxed'>{member.contribution}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className='text-center'>
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.3, duration: 0.8 }}
              className={`${glassStyle} inline-block px-8 py-6`}
            >
              <h2 className='text-2xl font-semibold mb-4 text-white'>
                Ready to try secure communication?
              </h2>
              <div className='flex justify-center space-x-4 mt-4'>
                <a
                  href='https://github.com/Mascaro101/Echo-Chat-App'
                  className='px-6 py-2 bg-white text-black rounded-full hover:bg-gray-200 transition-colors font-medium'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  View on GitHub
                </a>
                <a
                  href='/login'
                  className='px-6 py-2 border border-white text-white rounded-full hover:bg-white/10 transition-colors font-medium'
                >
                  Get Started
                </a>
              </div>
            </motion.div>
          </section>
        </div>
        <Footer />
      </div>
    </PageWrapper>
  )
}

export default AboutUs
