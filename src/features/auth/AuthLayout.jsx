import React from 'react'
import { motion } from 'framer-motion'
import Navbar from './HomepageComponents/Navbar'

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className='min-h-screen bg-black text-white font-sans overflow-hidden'>
      <Navbar />

      <div className='relative min-h-screen flex items-center justify-center pt-20 px-4'>
        <div className='absolute inset-0 overflow-hidden pointer-events-none'>
          <div className='absolute top-20 left-10 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-deep-sea-float'></div>
          <div className='absolute bottom-20 right-10 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-deep-sea-float animation-delay-2000'></div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className='w-full max-w-md relative z-10'
        >
          <div className='bg-gradient-to-br from-purple-900/20 to-transparent border border-purple-500/30 rounded-2xl p-8 shadow-2xl'>
            <div className='text-center mb-8'>
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className='text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent'
              >
                {title}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className='text-gray-400 text-sm'
              >
                {subtitle}
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {children}
            </motion.div>

            <div className='absolute -top-1 -left-1 w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mix-blend-screen opacity-0 group-hover:opacity-20 blur-3xl transition-opacity duration-500'></div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className='text-center text-xs text-gray-500 mt-6'
          >
            🔐 Your data is encrypted end-to-end. We can't see your messages.
          </motion.p>
        </motion.div>
      </div>
    </div>
  )
}

export default AuthLayout
