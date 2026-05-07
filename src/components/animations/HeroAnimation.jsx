import React, { useState, useRef } from 'react'
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from 'framer-motion'
import { X } from 'lucide-react'

/*  data  */
const INNER_R = 155
const OUTER_R = 255
const INNER_SPEED = 0.009 // deg / ms
const OUTER_SPEED = 0.0055

const innerNodes = [
  {
    id: 'aes',
    label: 'AES-256',
    startAngle: 90,
    desc: 'Military-grade symmetric encryption. Every message is protected with a unique AES-256-GCM key generated on your device.',
  },
  {
    id: 'e2ee',
    label: 'E2EE',
    startAngle: 210,
    desc: 'End-to-End Encryption. Only sender and recipient can read messages  not even Echo servers have access.',
  },
  {
    id: 'sha',
    label: 'SHA-256',
    startAngle: 330,
    desc: 'Cryptographic hashing verifies message integrity and instantly detects any tampering in transit.',
  },
]

const outerNodes = [
  {
    id: 'rsa',
    label: 'RSA-4096',
    startAngle: 45,
    desc: 'Asymmetric cryptography used for secure key exchange and digital identity verification.',
  },
  {
    id: 'pfs',
    label: 'PFS',
    startAngle: 135,
    desc: 'Perfect Forward Secrecy. Every session uses unique keys  compromise of one never exposes past messages.',
  },
  {
    id: 'nologs',
    label: 'No Logs',
    startAngle: 225,
    desc: 'Zero-knowledge architecture. Echo never stores your messages, encryption keys, or metadata.',
  },
  {
    id: 'onion',
    label: 'Onion Routing',
    startAngle: 315,
    desc: 'Traffic is bounced through multiple encrypted relay nodes, hiding your IP address and physical location.',
  },
]

/*  helpers  */
const toRad = (deg) => (deg - 90) * (Math.PI / 180)
const circleXY = (deg, r) => [Math.cos(toRad(deg)) * r, Math.sin(toRad(deg)) * r]

/*  OrbitNode  */
const OrbitNode = ({ node, r, speed, active, setActive, paused }) => {
  const nx = useMotionValue(circleXY(node.startAngle, r)[0])
  const ny = useMotionValue(circleXY(node.startAngle, r)[1])
  const isActive = active === node.id

  const speedRef = useRef(speed)
  const pausedRef = useRef(paused)
  const lastTRef = useRef(null)
  const angleRef = useRef(node.startAngle)
  speedRef.current = speed
  pausedRef.current = paused

  useAnimationFrame((t) => {
    const dt = lastTRef.current !== null ? t - lastTRef.current : 0
    lastTRef.current = t
    if (!pausedRef.current) {
      angleRef.current = (angleRef.current + dt * speedRef.current) % 360
    }
    const [x, y] = circleXY(angleRef.current, r)
    nx.set(x)
    ny.set(y)
  })

  return (
    <motion.div
      className='absolute'
      style={{ x: nx, y: ny, translateX: '-50%', translateY: '-50%', zIndex: isActive ? 50 : 10 }}
    >
      <div
        className='relative flex flex-col items-center cursor-pointer group'
        onMouseEnter={() => setActive(node.id)}
        onMouseLeave={() => setActive(null)}
      >
        {/* glowing dot */}
        <motion.div
          className='w-2.5 h-2.5 rounded-full mb-1.5'
          animate={
            isActive
              ? {
                  backgroundColor: 'rgb(167,139,250)',
                  boxShadow: '0 0 18px 5px rgba(139,92,246,0.65)',
                }
              : {
                  backgroundColor: 'rgba(255,255,255,0.75)',
                  boxShadow: '0 0 8px 1px rgba(255,255,255,0.15)',
                }
          }
          transition={{ duration: 0.2 }}
        />

        {/* label */}
        <span
          className={`text-[11px] font-mono font-semibold whitespace-nowrap transition-colors duration-200 ${
            isActive ? 'text-violet-300' : 'text-white/80 group-hover:text-white'
          }`}
        >
          {node.label}
        </span>

        {/* tooltip */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.93 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className='absolute left-1/2 -translate-x-1/2 bottom-full mb-4 w-56 p-4 rounded-xl pointer-events-none'
              style={{
                background: 'rgba(9,9,11,0.97)',
                border: '1px solid rgba(139,92,246,0.28)',
                boxShadow: '0 8px 40px rgba(139,92,246,0.18)',
                zIndex: 200,
              }}
            >
              <p className='text-[10px] font-bold text-violet-400 mb-1.5 uppercase tracking-widest'>
                {node.label}
              </p>
              <p className='text-xs text-white/50 leading-relaxed'>{node.desc}</p>
              <div className='absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-violet-500/25' />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/*  main component  */
const HeroAnimation = () => {
  const [active, setActive] = useState(null)
  const [logoOpen, setLogoOpen] = useState(false)
  const paused = active !== null
  const ref = useRef(null)

  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const smx = useSpring(mx, { stiffness: 150, damping: 22 })
  const smy = useSpring(my, { stiffness: 150, damping: 22 })
  const rotX = useTransform(smy, [-0.5, 0.5], ['8deg', '-8deg'])
  const rotY = useTransform(smx, [-0.5, 0.5], ['-8deg', '8deg'])

  const handleMouseMove = (e) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const dist = Math.hypot(
      e.clientX - (rect.left + rect.width / 2),
      e.clientY - (rect.top + rect.height / 2)
    )
    if (dist < 380) {
      mx.set((e.clientX - rect.left) / rect.width - 0.5)
      my.set((e.clientY - rect.top) / rect.height - 0.5)
    } else {
      mx.set(0)
      my.set(0)
    }
  }

  return (
    <section
      ref={ref}
      className='relative w-full h-[780px] flex flex-col items-center justify-center'
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        mx.set(0)
        my.set(0)
        setActive(null)
      }}
      style={{ perspective: '1200px' }}
    >
      {/* grid background */}
      <div
        className='absolute inset-0 pointer-events-none'
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      {/* radial vignette */}
      <div
        className='absolute inset-0 pointer-events-none'
        style={{
          background: 'radial-gradient(ellipse 70% 65% at center, transparent 30%, black 80%)',
        }}
      />

      {/* 3D tilt container */}
      <motion.div
        style={{ rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d' }}
        className='relative flex items-center justify-center w-[580px] h-[580px]'
      >
        {/* ambient violet glow */}
        <div
          className='absolute w-72 h-72 rounded-full pointer-events-none'
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* outer orbit ring */}
        <div
          className='absolute border border-white/[0.06] rounded-full'
          style={{ width: OUTER_R * 2, height: OUTER_R * 2, transform: 'translateZ(-20px)' }}
        />

        {/* inner orbit ring  dashed */}
        <div
          className='absolute border border-white/[0.08] border-dashed rounded-full'
          style={{ width: INNER_R * 2, height: INNER_R * 2, transform: 'translateZ(-10px)' }}
        />

        {/* inner nodes */}
        {innerNodes.map((n) => (
          <OrbitNode
            key={n.id}
            node={n}
            r={INNER_R}
            speed={INNER_SPEED}
            active={active}
            setActive={setActive}
            paused={paused}
          />
        ))}

        {/* outer nodes */}
        {outerNodes.map((n) => (
          <OrbitNode
            key={n.id}
            node={n}
            r={OUTER_R}
            speed={OUTER_SPEED}
            active={active}
            setActive={setActive}
            paused={paused}
          />
        ))}

        {/* center logo */}
        <motion.div
          className='relative z-20 w-36 h-36 rounded-full flex items-center justify-center cursor-pointer'
          style={{
            transform: 'translateZ(50px)',
            background: 'rgba(9,9,11,1)',
            border: '1px solid rgba(139,92,246,0.25)',
            boxShadow: '0 0 60px -8px rgba(139,92,246,0.45), 0 0 0 1px rgba(139,92,246,0.1)',
          }}
          whileHover={{ scale: 1.07 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={() => setLogoOpen(true)}
          title='Click to expand'
        >
          {/* outer pulse ring */}
          <motion.div
            className='absolute inset-0 rounded-full'
            style={{ border: '1px solid rgba(139,92,246,0.2)' }}
            animate={{ scale: [1, 1.45, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* second pulse, offset */}
          <motion.div
            className='absolute inset-0 rounded-full'
            style={{ border: '1px solid rgba(139,92,246,0.12)' }}
            animate={{ scale: [1, 1.7, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
          <img
            src='/EchoProtocolLogo.png'
            alt='Echo Protocol'
            className='w-20 h-20 object-contain'
            style={{ filter: 'drop-shadow(0 0 14px rgba(139,92,246,0.7))' }}
          />
        </motion.div>
      </motion.div>

      {/* bottom label */}
      <div className='relative z-20 mt-10 text-center pointer-events-none'>
        <p className='text-xs uppercase tracking-[0.2em] text-white/60 mb-3'>
          Security Architecture
        </p>
        <h3
          className='text-3xl font-extrabold text-white tracking-tighter'
          style={{ textShadow: '0 0 40px rgba(255,255,255,0.25)' }}
        >
          Hover the nodes to explore each encryption layer
        </h3>
      </div>

      {/* logo lightbox */}
      <AnimatePresence>
        {logoOpen && (
          <motion.div
            className='fixed inset-0 z-[999] flex items-center justify-center'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setLogoOpen(false)}
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
          >
            <motion.div
              className='relative flex flex-col items-center gap-6'
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.75, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* glow */}
              <div
                className='absolute w-72 h-72 rounded-full pointer-events-none'
                style={{
                  background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 70%)',
                  filter: 'blur(50px)',
                }}
              />
              <img
                src='/EchoProtocolLogo.png'
                alt='Echo Protocol'
                className='w-64 h-64 object-contain relative z-10'
                style={{ filter: 'drop-shadow(0 0 40px rgba(139,92,246,0.8))' }}
              />
              <p className='text-white/40 text-sm tracking-widest uppercase relative z-10'>
                Echo Protocol
              </p>
              <button
                className='relative z-10 w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 transition-colors duration-150'
                onClick={() => setLogoOpen(false)}
              >
                <X className='w-4 h-4 text-white/50' />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export default HeroAnimation
