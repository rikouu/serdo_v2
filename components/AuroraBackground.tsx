import React, { useEffect, useState } from 'react'

export const AuroraBackground: React.FC<{ intensity?: number }>=({ intensity=1 })=>{
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const nx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth - 0.5) * 2))
      const ny = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight - 0.5) * 2))
      setPos({ x: nx, y: ny })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const shiftX = (v: number) => v + pos.x * 60
  const shiftY = (v: number) => v + pos.y * 45

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <svg className="w-[150vw] h-[150vh] -translate-x-[25vw] -translate-y-[25vh]" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="a_grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7C3AED"/>
            <stop offset="55%" stopColor="#3B82F6"/>
            <stop offset="100%" stopColor="#06B6D4"/>
          </radialGradient>
          <filter id="blur_s">
            <feGaussianBlur stdDeviation={60 * intensity}/>
          </filter>
          <filter id="blur_m">
            <feGaussianBlur stdDeviation={90 * intensity}/>
          </filter>
          <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0"/>
            <stop offset="50%" stopColor="#fff" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
          </linearGradient>
        </defs>

        <style>
          {`
          @keyframes rotateSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes dash { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 900; } }
          @keyframes shimmer { 0%{ opacity: .0 } 50%{ opacity: .18 } 100%{ opacity: .0 } }
          .grid { animation: rotateSlow 180s linear infinite; transform-origin: 800px 500px; }
          .dash { animation: dash 30s linear infinite; }
          .beam { animation: shimmer 22s ease-in-out infinite; }
          `}
        </style>

        <rect x="-200" y="-200" width="2000" height="1400" fill="url(#a_grad)" opacity="0.6"/>
        <g filter="url(#blur_m)" opacity="0.5">
          <circle cx={shiftX(360)} cy={shiftY(300)} r="220" fill="#06B6D4"/>
          <circle cx={shiftX(1160)} cy={shiftY(700)} r="260" fill="#3B82F6"/>
          <circle cx={shiftX(980)} cy={shiftY(260)} r="200" fill="#7C3AED"/>
        </g>
        <g className="grid" opacity="0.12">
          <rect x="200" y="150" width="1200" height="700" fill="none" stroke="#fff" strokeOpacity="0.2"/>
          {Array.from({length:12}).map((_,i)=>{
            const y = 150 + i*58
            return <line key={'h'+i} x1={200} y1={y} x2={1400} y2={y} stroke="#fff" strokeOpacity={i%3===0?0.22:0.1} strokeWidth={i%4===0?1.1:.5} className="dash" strokeDasharray="100 26"/>
          })}
          {Array.from({length:18}).map((_,i)=>{
            const x = 200 + i*66
            return <line key={'v'+i} x1={x} y1={150} x2={x} y2={850} stroke="#fff" strokeOpacity={i%4===0?0.2:0.09} strokeWidth={i%5===0?1.0:.45} className="dash" strokeDasharray="90 28"/>
          })}
        </g>

        <g opacity="0.15">
          <rect x="-600" y="280" width="820" height="64" fill="url(#beam)" className="beam">
            <animateTransform attributeName="transform" type="translate" values="0 0; 2200 0" dur="24s" repeatCount="indefinite"/>
          </rect>
          <rect x="-800" y="660" width="1100" height="58" fill="url(#beam)" className="beam">
            <animateTransform attributeName="transform" type="translate" values="0 0; 2200 0" dur="32s" repeatCount="indefinite"/>
          </rect>
        </g>
      </svg>
    </div>
  )
}
