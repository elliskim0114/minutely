import { useEffect, useRef } from 'react'
import { useStore } from '../store'

const COLORS = ['#FF4D1C', '#FF7A52', '#FFB8A0', '#95CFA0', '#A0AAFF', '#F0D080', '#D8A0D8', '#60D080']
const SHAPES = ['●', '★', '✦', '◆', '▲']
const COUNT = 28

interface Particle {
  el: HTMLSpanElement
  vx: number
  vy: number
  gravity: number
  x: number
  y: number
  rot: number
  rotV: number
  scale: number
  alpha: number
  decay: number
}

export default function Confetti() {
  const confettiKey = useStore(s => s.confettiKey)
  const containerRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (confettiKey === 0) return
    const container = containerRef.current
    if (!container) return

    // Clear old particles
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    particlesRef.current.forEach(p => p.el.remove())
    particlesRef.current = []

    // Origin: center of viewport top-ish
    const ox = window.innerWidth / 2
    const oy = window.innerHeight * 0.4

    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement('span')
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)]
      el.textContent = shape
      el.style.cssText = `
        position:fixed;
        left:${ox}px;top:${oy}px;
        color:${color};
        font-size:${10 + Math.random() * 10}px;
        pointer-events:none;
        z-index:9999;
        user-select:none;
        will-change:transform,opacity;
      `
      container.appendChild(el)

      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4
      const speed = 4 + Math.random() * 9
      particlesRef.current.push({
        el,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.22 + Math.random() * 0.15,
        x: ox,
        y: oy,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 12,
        scale: 0.5 + Math.random() * 0.8,
        alpha: 1,
        decay: 0.012 + Math.random() * 0.01,
      })
    }

    const tick = () => {
      let alive = false
      particlesRef.current.forEach(p => {
        if (p.alpha <= 0) return
        p.x += p.vx
        p.y += p.vy
        p.vy += p.gravity
        p.vx *= 0.98
        p.rot += p.rotV
        p.alpha -= p.decay
        if (p.alpha < 0) p.alpha = 0
        else alive = true
        p.el.style.transform = `translate(${p.x - ox}px,${p.y - oy}px) rotate(${p.rot}deg) scale(${p.scale})`
        p.el.style.opacity = String(p.alpha)
      })
      if (alive) rafRef.current = requestAnimationFrame(tick)
      else {
        particlesRef.current.forEach(p => p.el.remove())
        particlesRef.current = []
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [confettiKey])

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }} />
}
