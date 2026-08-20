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

const TOUCH_LAYER_RANGES = {
  background: 2,
  midground: 3.5,
  foreground: 5.5,
  canopy: 5,
  reflection: 4,
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
    hasTouchInput()
  )
}

function hasTouchInput() {
  return (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(any-pointer: coarse)').matches
  )
}

function canTouchParallax() {
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    hasTouchInput()
  )
}

export default function HeroImageLayers({
  layers,
  alt,
  stageRef,
  orientationRef,
  motionKicksRef,
  interactionEnabledRef,
  heroPointerRef,
}) {
  const interactionRef = interactionEnabledRef ?? { current: true }
  const layerRefs = useRef([])
  const layerOrder = useMemo(() => getLayerOrder(layers), [layers])

  useEffect(() => {
    const stage = stageRef?.current
    const pointerParallax = canParallax()
    const touchParallax = canTouchParallax()
    const orientationParallax = canOrientationParallax()
    if (!stage || (!pointerParallax && !touchParallax && !orientationParallax)) return

    const current = { x: 0, y: 0 }
    let raf = 0
    let running = true

    const apply = () => {
      if (!interactionRef.current) {
        current.x = 0
        current.y = 0
        layerOrder.forEach((key, i) => {
          const el = layerRefs.current[i]
          if (!el) return
          el.style.transform = `translate3d(0px, 0px, 0) scale(${EDGE_CROP_SCALE})`
        })
        raf = 0
        return
      }
      const orientation = orientationRef?.current
      const ptr = heroPointerRef?.current ?? {
        nx: 0,
        ny: 0,
        influence: 0,
        touching: false,
      }
      const touching = touchParallax && ptr.touching
      let targetX = 0
      let targetY = 0
      if (touching) {
        targetX = ptr.nx
        targetY = ptr.ny
      } else if (pointerParallax && ptr.influence > 0) {
        targetX = ptr.nx * ptr.influence
        targetY = ptr.ny * ptr.influence
      } else if (orientationParallax) {
        targetX = orientation?.x ?? 0
        targetY = orientation?.y ?? 0
      }
      current.x += (targetX - current.x) * LERP
      current.y += (targetY - current.y) * LERP

      layerOrder.forEach((key, i) => {
        const el = layerRefs.current[i]
        if (!el) return
        const range = touching ? TOUCH_LAYER_RANGES[key] : LAYER_RANGES[key]
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
      if (!interactionRef.current || !running || raf) return
      raf = requestAnimationFrame(apply)
    }

    if (pointerParallax || touchParallax || orientationParallax) {
      motionKicksRef?.current?.add(kick)
    }

    return () => {
      running = false
      cancelAnimationFrame(raf)
      motionKicksRef?.current?.delete(kick)
    }
  }, [stageRef, layerOrder, orientationRef, motionKicksRef, heroPointerRef])

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
