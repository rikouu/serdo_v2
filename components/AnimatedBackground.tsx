import React, { useEffect, useRef, useState } from 'react'

export const AnimatedBackground: React.FC<{ intensity?: number }>=({ intensity=1 })=>{
  const blur1 = Math.round(50 * intensity)
  const blur2 = Math.round(70 * intensity)
  const opacity = Math.min(0.55, 0.4 * intensity)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [trail, setTrail] = useState({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)
  const [ripples, setRipples] = useState<Array<{x:number,y:number,id:number}>>([])
  const planePathRef = useRef<SVGPathElement | null>(null)
  const planeRef = useRef<SVGGElement | null>(null)
  const planeDirRef = useRef<SVGGElement | null>(null)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const nx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth - 0.5) * 2))
      const ny = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight - 0.5) * 2))
      setPos({ x: nx, y: ny })
    }
    const onClick = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 1600
      const y = (e.clientY / window.innerHeight) * 1000
      const id = Date.now() + Math.floor(Math.random()*1000)
      setRipples(r => r.slice(-4).concat([{ x, y, id }]))
      setTimeout(() => { setRipples(r => r.filter(rr => rr.id !== id)) }, 1800)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('click', onClick)
    const step = () => {
      setTrail(t => ({ x: t.x + (pos.x - t.x) * 0.06, y: t.y + (pos.y - t.y) * 0.06 }))
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
  useEffect(() => {
    let rid: number | null = null
    const speed = 120
    const tick = (ts: number) => {
      const path = planePathRef.current
      const plane = planeRef.current
      const dir = planeDirRef.current
      if (path && plane && dir) {
        const len = path.getTotalLength()
        const progress = (ts / 1000 * speed) % len
        const pt = path.getPointAtLength(progress)
        const ahead = path.getPointAtLength((progress + 2) % len)
        const angle = Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180 / Math.PI
        plane.setAttribute('transform', `translate(${pt.x}, ${pt.y})`)
        dir.setAttribute('transform', `rotate(${angle})`)
      }
      rid = requestAnimationFrame(tick)
    }
    rid = requestAnimationFrame(tick)
    return () => { if (rid) cancelAnimationFrame(rid) }
  }, [])
  const cx = 800 + pos.x * 240
  const cy = 500 + pos.y * 180
  const tx = 800 + trail.x * 300
  const ty = 500 + trail.y * 220
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <svg className="w-[140vw] h-[140vh] -translate-x-[20vw] -translate-y-[20vh]" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="abg_rad" gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={900}>
            <stop offset="0%" stopColor="#0EA5E9"/>
            <stop offset="50%" stopColor="#6366F1"/>
            <stop offset="100%" stopColor="#22C55E"/>
          </radialGradient>
          <radialGradient id="pointerGlow" gradientUnits="userSpaceOnUse" cx={tx} cy={ty} r={320}>
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.20"/>
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="abg_line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8B5CF6"/>
            <stop offset="50%" stopColor="#06B6D4"/>
            <stop offset="100%" stopColor="#F59E0B"/>
          </linearGradient>
          <filter id="abg_noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="2"/>
            <feGaussianBlur stdDeviation={blur1}/>
          </filter>
          <filter id="abg_flow">
            <feTurbulence type="turbulence" baseFrequency="0.002" numOctaves="3" seed="3"/>
            <feDisplacementMap in="SourceGraphic" scale="120"/>
            <feGaussianBlur stdDeviation={blur2}/>
          </filter>
          <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0"/>
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="20" />
          </filter>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cfe9ff"/>
            <stop offset="60%" stopColor="#eaf5ff"/>
            <stop offset="100%" stopColor="#f7fbff"/>
          </linearGradient>
          <radialGradient id="sunGrad" gradientUnits="userSpaceOnUse" cx={tx} cy={ty} r={220}>
            <stop offset="0%" stopColor="#fff5c2"/>
            <stop offset="100%" stopColor="#fff5c2" stopOpacity="0"/>
          </radialGradient>
          <filter id="cloudBlur">
            <feGaussianBlur stdDeviation={blur1}/>
          </filter>
          <filter id="airBlur">
            <feGaussianBlur stdDeviation={blur2}/>
          </filter>
          <linearGradient id="planeBody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="100%" stopColor="#dbeafe"/>
          </linearGradient>
          <linearGradient id="planeAccent" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#60a5fa"/>
            <stop offset="100%" stopColor="#22c55e"/>
          </linearGradient>
          <path id="planePath" d="M -200 520 C 200 460, 600 580, 1000 500 C 1400 420, 1800 560, 2000 500"/>
        </defs>

        <rect x="-200" y="-200" width="2000" height="1400" fill="url(#skyGrad)"/>
        <circle cx={tx} cy={ty} r="160" fill="url(#sunGrad)"/>
        <rect x="-200" y="-200" width="2000" height="1400" filter="url(#abg_noise)" opacity={opacity}/>
        <rect x="-200" y="-200" width="2000" height="1400" fill="url(#pointerGlow)" opacity="0.4"/>

        <g filter="url(#cloudBlur)" opacity="0.45">
          <g>
            <ellipse cx="220" cy="240" rx="140" ry="40" fill="#ffffff"/>
            <ellipse cx="300" cy="230" rx="100" ry="32" fill="#ffffff"/>
            <ellipse cx="140" cy="230" rx="90" ry="28" fill="#ffffff"/>
            <animateTransform attributeName="transform" type="translate" values={`0 0; ${-1800 - pos.x*60} 0`} dur="38s" repeatCount="indefinite"/>
          </g>
          <g>
            <ellipse cx="1280" cy="360" rx="160" ry="45" fill="#ffffff"/>
            <ellipse cx="1360" cy="350" rx="120" ry="35" fill="#ffffff"/>
            <ellipse cx="1220" cy="350" rx="100" ry="32" fill="#ffffff"/>
            <animateTransform attributeName="transform" type="translate" values={`0 0; ${-1800 - pos.x*40} 0`} dur="46s" repeatCount="indefinite"/>
          </g>
          <g>
            <ellipse cx="900" cy="160" rx="120" ry="35" fill="#ffffff"/>
            <ellipse cx="970" cy="150" rx="90" ry="28" fill="#ffffff"/>
            <ellipse cx="830" cy="150" rx="80" ry="25" fill="#ffffff"/>
            <animateTransform attributeName="transform" type="translate" values={`0 0; ${-1800 - pos.x*30} 0`} dur="42s" repeatCount="indefinite"/>
          </g>
        </g>
        <path ref={planePathRef} d="M -200 520 C 200 460, 600 580, 1000 500 C 1400 420, 1800 560, 2000 500" fill="none" stroke="none"/>
        <g opacity="0.95">
          <g id="plane" ref={planeRef}>
            <g ref={planeDirRef}>
              <ellipse cx="0" cy="0" rx="70" ry="26" fill="#0EA5E9" stroke="#1e293b" strokeOpacity="0.3" strokeWidth="2"/>
              <rect x="-16" y="-12" width="36" height="24" rx="6" fill="#ffffff" stroke="#1e293b" strokeOpacity="0.15"/>
              <ellipse cx="28" cy="-8" rx="12" ry="7" fill="#93c5fd"/>
              <path d="M-14 -10 L -52 -26 L -14 0 Z" fill="url(#planeAccent)"/>
              <path d="M14 10 L 52 26 L 14 0 Z" fill="url(#planeAccent)"/>
              <path d="M-66 0 L -80 -10 L -80 10 Z" fill="#64748b"/>
              <circle cx="-70" cy="0" r="2" fill="#9ca3af">
                <animate attributeName="r" values="2;6;2" dur="1.6s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.6;0;0.6" dur="1.6s" repeatCount="indefinite"/>
              </circle>
            </g>
          </g>
        </g>

        {ripples.map(r => (
          <g key={r.id} opacity="0.6">
            <circle cx={r.x} cy={r.y} r="0" stroke="#FFFFFF" strokeWidth="2" fill="none">
              <animate attributeName="r" from="0" to="300" dur="1.8s" begin="0s" fill="freeze"/>
              <animate attributeName="opacity" values="0.35;0" dur="1.8s" begin="0s" fill="freeze"/>
            </circle>
          </g>
        ))}
      </svg>
    </div>
  )
}
        <path id="planeFlyPath" d="M -200 520 C 200 460, 600 580, 1000 500 C 1400 420, 1800 560, 2000 500" fill="none" stroke="none"/>
