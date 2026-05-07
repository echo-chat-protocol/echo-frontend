import Navbar from './HomepageComponents/Navbar'
import Footer from './HomepageComponents/Footer'
import HeroAnimation from './HomepageComponents/HeroAnimation'
import Hero from './landing/Hero'
import Features from './landing/Features'
import CodeTypingSection from './landing/CodeTypingSection'
import HeroAiDemo from './landing/HeroAiDemo'
import CipherPlayground from './landing/CipherPlayground'
import SecurityDocs from './landing/SecurityDocs'
import Pricing from './landing/Pricing'
import ParticlesBackground from './HomepageComponents/ParticlesBackground'

const SectionWrap = ({ children }) => (
  <div className='relative'>
    <div className='absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-black to-transparent pointer-events-none z-10' />
    <div className='absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black to-transparent pointer-events-none z-10' />
    {children}
  </div>
)

export default function LandingPage() {
  return (
    <div className='relative min-h-screen bg-black text-white selection:bg-violet-500/30 font-sans overflow-x-hidden'>
      {/* Partículas — SOLO en la landing */}
      <ParticlesBackground />

      {/* Glow de fondo */}
      <div className='fixed inset-0 pointer-events-none z-0'>
        <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] opacity-50' />
        <div className='absolute bottom-0 right-0 w-[800px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] opacity-30' />
      </div>

      <div className='relative z-10'>
        <Navbar />
        <main>
          <Hero />
          <SectionWrap>
            <Features />
          </SectionWrap>
          <SectionWrap>
            <CodeTypingSection />
          </SectionWrap>
          <SectionWrap>
            <HeroAiDemo />
          </SectionWrap>
          <SectionWrap>
            <HeroAnimation />
          </SectionWrap>
          <SectionWrap>
            <CipherPlayground />
          </SectionWrap>
          <SectionWrap>
            <SecurityDocs />
          </SectionWrap>
          <SectionWrap>
            <Pricing />
          </SectionWrap>
        </main>
        <Footer />
      </div>
    </div>
  )
}
