import React, { useEffect, useRef } from 'react'

export const PixelFieldBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    let width = 0, height = 0
    let pixels: { x:number;y:number;size:number;vx:number;vy:number;baseAlpha:number;phase:number;speed:number;jitter:number }[] = []
    const mouse = { x: null as number | null, y: null as number | null }
    const pulse = { x: 0, y: 0, t: -999 }
    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)
      initPixels()
    }
    const initPixels = () => {
      pixels = []
      const count = Math.min(4200, Math.floor((width * height) / 3000))
      for (let i = 0; i < count; i++) {
        const x = Math.random() * width
        const y = Math.random() * height
        const size = 1 + Math.random() * 2
        pixels.push({
          x, y, size,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          baseAlpha: 0.06 + Math.random() * 0.18,
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 0.7,
          jitter: 2 + Math.random() * 3
        })
      }
    }
    const draw = () => {
      ctx.fillStyle = 'rgba(2,3,7,0.24)'
      ctx.fillRect(0, 0, width, height)
      const t = performance.now() / 1000
      for (const p of pixels) {
        const n = Math.sin(t * p.speed + p.phase) * p.jitter
        p.vx += Math.sin(p.y * 0.002 + t * 0.7) * 0.02
        p.vy += Math.cos(p.x * 0.002 + t * 0.6) * 0.02
        p.vy += n * 0.0008
        let mouseFactor = 0
        if (mouse.x !== null && mouse.y !== null) {
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const radius = 200
          if (dist < radius && dist > 1) {
            const f = 1 - dist / radius
            mouseFactor = f
            const push = 0.6 * f
            p.vx += (dx / dist) * push
            p.vy += (dy / dist) * push
          }
        }
        const age = t - pulse.t
        let pulseFactor = 0
        if (age > 0 && age < 1.3) {
          const dx = p.x - pulse.x
          const dy = p.y - pulse.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const waveR = age * 650
          const thickness = 100
          const diff = Math.abs(dist - waveR)
          if (diff < thickness && dist > 0) {
            const f = 1 - diff / thickness
            pulseFactor = f
            const push = 1.0 * f
            p.vx += (dx / dist) * push
            p.vy += (dy / dist) * push
          }
        }
        p.vx *= 0.96
        p.vy *= 0.96
        p.x += p.vx
        p.y += p.vy
        if (p.x < -10) p.x = width + 10
        if (p.x > width + 10) p.x = -10
        if (p.y < -10) p.y = height + 10
        if (p.y > height + 10) p.y = -10
        let alpha = p.baseAlpha + 0.08 * Math.sin(t * 1.8 + p.phase)
        alpha += mouseFactor * 0.6 + pulseFactor * 0.9
        alpha = Math.max(0, Math.min(1, alpha))
        const energy = Math.min(1, mouseFactor * 1.4 + pulseFactor * 1.6)
        const r = 90 + energy * 20
        const g = 140 + energy * 115
        const b = 120 + energy * 40
        const sizeBoost = 1 + energy * 1.6
        const size = p.size * sizeBoost
        ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${alpha})`
        ctx.fillRect(p.x, p.y, size, size)
      }
      requestAnimationFrame(draw)
    }
    window.addEventListener('resize', resize)
    const onMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY }
    const onLeave = () => { mouse.x = mouse.y = null }
    const onClick = (e: MouseEvent) => { pulse.x = e.clientX; pulse.y = e.clientY; pulse.t = performance.now() / 1000 }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    window.addEventListener('click', onClick)
    resize()
    draw()
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('click', onClick)
    }
  }, [])
  return (
    <canvas ref={canvasRef} className="fixed inset-0 z-0" style={{ background: 'radial-gradient(circle at top,#1b222e 0,#050609 40%,#010104 100%)' }} />
  )
}
