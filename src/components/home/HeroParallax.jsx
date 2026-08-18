/**
 * Mouse-driven hero parallax over genuine alpha compositing layers.
 * Alpha is used as-is — never RGB-keyed.
 */
import { useEffect, useRef } from 'react'
import ProtectedImage from '../ProtectedImage'

const HERO_ALT = 'Silhouette at a harbour railing at twilight'
const SCALE = 1.04
const LERP = 0.08
const TEXT_RANGE = 3

const LAYERS = [
  {
    id: 'background',
    src: '/images/hero/hero-background.png',
    range: 4,
    alt: HERO_ALT,
  },
  {
    id: 'midground',
    src: '/images/hero/hero-midground.png',
    range: 8,
    alt: '',
  },
  {
    id: 'foreground',
    src: '/images/hero/hero-foreground.png',
    range: 12,
    alt: '',
  },
]

function canParallax() {
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  )
}

export default function HeroParallax({ stageRef, textRef }) {
  const layerRefs = useRef([])

  useEffect(() => {
    const stage = stageRef?.current
    if (!stage || !canParallax()) return

    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let raf = 0
    let running = true

    const apply = () => {
      current.x += (target.x - current.x) * LERP
      current.y += (target.y - current.y) * LERP

      LAYERS.forEach((layer, i) => {
        const el = layerRefs.current[i]
        if (!el) return
        const x = current.x * layer.range
        const y = current.y * layer.range
        el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${SCALE})`
      })

      const textEl = textRef?.current
      if (textEl) {
        const x = -current.x * TEXT_RANGE
        const y = -current.y * TEXT_RANGE
        textEl.style.transform = `translate3d(${x}px, ${y}px, 0)`
      }

      const settled =
        Math.abs(target.x - current.x) < 0.001 &&
        Math.abs(target.y - current.y) < 0.001
      if (!settled && running) raf = requestAnimationFrame(apply)
      else raf = 0
    }

    const kick = () => {
      if (!running || raf) return
      raf = requestAnimationFrame(apply)
    }

    const onMove = (e) => {
      const rect = stage.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      target.x = Math.max(-1, Math.min(1, nx))
      target.y = Math.max(-1, Math.min(1, ny))
      kick()
    }

    const onLeave = () => {
      target.x = 0
      target.y = 0
      kick()
    }

    stage.addEventListener('mousemove', onMove)
    stage.addEventListener('mouseleave', onLeave)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      stage.removeEventListener('mousemove', onMove)
      stage.removeEventListener('mouseleave', onLeave)
    }
  }, [stageRef, textRef])

  return (
    <div className="absolute inset-0 overflow-hidden">
      {LAYERS.map((layer, i) => (
        <div
          key={layer.id}
          ref={(el) => {
            layerRefs.current[i] = el
          }}
          className="absolute inset-0 will-change-transform"
          style={{ transform: `translate3d(0, 0, 0) scale(${SCALE})` }}
        >
          <ProtectedImage
            src={layer.src}
            alt={layer.alt}
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </div>
      ))}
    </div>
  )
}
