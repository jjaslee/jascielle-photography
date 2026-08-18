/**
 * Subtle pointer parallax for layered hero photographs.
 */
import { useEffect, useMemo, useRef } from 'react'
import ProtectedImage from '../ProtectedImage'

const LERP = 0.08
const EDGE_CROP_SCALE = 1.04

const LAYER_RANGES = {
  background: 2.5,
  midground: 4.5,
  foreground: 7,
  canopy: 6,
  reflection: 5,
}

const LAYER_KEYS = ['background', 'midground', 'foreground', 'canopy', 'reflection']

function getLayerOrder(layers) {
  return LAYER_KEYS.filter((key) => layers[key])
}

function canParallax() {
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  )
}

function canOrientationParallax() {
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    'DeviceOrientationEvent' in window &&
    window.matchMedia('(pointer: coarse)').matches
  )
}

export default function HeroImageLayers({
  layers,
  alt,
  stageRef,
  orientationRef,
  motionKicksRef,
}) {
  const layerRefs = useRef([])
  const layerOrder = useMemo(() => getLayerOrder(layers), [layers])

  useEffect(() => {
    const stage = stageRef?.current
    const pointerParallax = canParallax()
    const orientationParallax = !pointerParallax && canOrientationParallax()
    if (!stage || (!pointerParallax && !orientationParallax)) return

    const pointerTarget = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let raf = 0
    let running = true

    const apply = () => {
      const orientation = orientationRef?.current
      const targetX = pointerParallax ? pointerTarget.x : orientation?.x ?? 0
      const targetY = pointerParallax ? pointerTarget.y : orientation?.y ?? 0
      current.x += (targetX - current.x) * LERP
      current.y += (targetY - current.y) * LERP

      layerOrder.forEach((key, i) => {
        const el = layerRefs.current[i]
        if (!el) return
        const range = LAYER_RANGES[key]
        const x = current.x * range
        const y = current.y * range
        el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${EDGE_CROP_SCALE})`
      })

      const settled =
        Math.abs(targetX - current.x) < 0.001 &&
        Math.abs(targetY - current.y) < 0.001
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
      pointerTarget.x = Math.max(-1, Math.min(1, nx))
      pointerTarget.y = Math.max(-1, Math.min(1, ny))
      kick()
    }

    const onLeave = () => {
      pointerTarget.x = 0
      pointerTarget.y = 0
      kick()
    }

    if (pointerParallax) {
      stage.addEventListener('mousemove', onMove)
      stage.addEventListener('mouseleave', onLeave)
    }
    if (orientationParallax && motionKicksRef?.current) {
      motionKicksRef.current.add(kick)
    }

    return () => {
      running = false
      cancelAnimationFrame(raf)
      if (pointerParallax) {
        stage.removeEventListener('mousemove', onMove)
        stage.removeEventListener('mouseleave', onLeave)
      }
      if (orientationParallax) motionKicksRef?.current?.delete(kick)
    }
  }, [stageRef, layerOrder, orientationRef, motionKicksRef])

  return (
    <>
      {layerOrder.map((key, i) => (
        <div
          key={key}
          ref={(el) => {
            layerRefs.current[i] = el
          }}
          className="absolute inset-0 will-change-transform"
          style={{ transform: `scale(${EDGE_CROP_SCALE})` }}
        >
          <ProtectedImage
            src={layers[key]}
            alt={i === 0 ? alt : ''}
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </div>
      ))}
    </>
  )
}
