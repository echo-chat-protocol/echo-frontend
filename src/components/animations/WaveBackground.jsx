import { useEffect, useRef } from 'react'

const WaveBackground = () => {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()

    const waves = [
      { offset: 0.25, length: 0.5, amplitude: 0.1, speed: 0.1, color: '#5750a1' },
      { offset: 0.1, length: 0.6, amplitude: 0.08, speed: 0.11, color: '#8c85c2' },
      { offset: 0.2, length: 0.4, amplitude: 0.06, speed: 0.05, color: '#5750a1' },
    ]

    let animationFrameId
    let time = 0

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      waves.forEach((wave) => {
        const baseY = canvas.height * (1 - wave.offset)
        const gradient = ctx.createLinearGradient(
          0,
          baseY - wave.amplitude * canvas.height,
          0,
          canvas.height
        )
        gradient.addColorStop(0, `${wave.color}00`)
        gradient.addColorStop(0.5, `${wave.color}66`)
        gradient.addColorStop(1, `${wave.color}cc`)

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.moveTo(0, baseY)

        for (let x = 0; x < canvas.width; x++) {
          const dx = (x / canvas.width) * wave.length * Math.PI * 2
          const y = Math.sin(dx + time * wave.speed * Math.PI * 2) * wave.amplitude * canvas.height
          ctx.lineTo(x, baseY + y)
        }

        ctx.lineTo(canvas.width, canvas.height)
        ctx.lineTo(0, canvas.height)
        ctx.closePath()
        ctx.fill()
      })

      time += 0.016
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className='absolute bottom-0 left-0 w-full h-[100vh] z-0 pointer-events-none'
    />
  )
}

export default WaveBackground
