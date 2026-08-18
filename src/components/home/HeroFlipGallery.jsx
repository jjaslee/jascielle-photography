/**
 * OriginKit-style flip gallery: one photographic plane, subtle tilt, click to flip.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import ProtectedImage from '../ProtectedImage'
import HeroImageLayers from './HeroImageLayers'

const TILT_MAX_X = 7
const TILT_MAX_Y = 10
const FLIP_DURATION = 0.8
const AUTOPLAY_MS = 8000
const TILT_LERP = 0.1
const ORIENTATION_RANGE_DEG = 25
const MOBILE_TILT_MAX_X = 3.5
const MOBILE_TILT_MAX_Y = 5

function canTilt() {
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  )
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function canUseOrientation() {
  return (
    typeof window !== 'undefined' &&
    'DeviceOrientationEvent' in window &&
    window.matchMedia('(pointer: coarse)').matches
  )
}

function clampOrientation(value) {
  return Math.max(-1, Math.min(1, value))
}

function screenAngle() {
  const angle = window.screen?.orientation?.angle ?? window.orientation ?? 0
  return ((angle % 360) + 360) % 360
}

function screenAdjustedAxes(beta, gamma) {
  switch (screenAngle()) {
    case 90:
      return { x: beta, y: -gamma }
    case 180:
      return { x: -gamma, y: -beta }
    case 270:
      return { x: -beta, y: gamma }
    default:
      return { x: gamma, y: beta }
  }
}

function HeroSlide({ image, stageRef, orientationRef, motionKicksRef }) {
  if (image.layers) {
    return (
      <HeroImageLayers
        layers={image.layers}
        alt={image.alt}
        stageRef={stageRef}
        orientationRef={orientationRef}
        motionKicksRef={motionKicksRef}
      />
    )
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      <ProtectedImage
        src={image.src}
        alt={image.alt}
        loading="eager"
        decoding="async"
        className="absolute inset-0 h-full w-full scale-[1.04] object-cover object-center"
      />
    </div>
  )
}

export default function HeroFlipGallery({ images }) {
  const stageRef = useRef(null)
  const tiltRef = useRef(null)
  const flipRef = useRef(null)
  const flippingRef = useRef(false)
  const flipStartFrameRef = useRef(0)
  const flipSettleFrameRef = useRef(0)
  const autoplayRef = useRef(null)
  const touchStartRef = useRef(null)
  const orientationRef = useRef({ x: 0, y: 0, available: false })
  const motionKicksRef = useRef(new Set())
  const orientationBaselineRef = useRef(null)
  const orientationPermissionRef = useRef('idle')
  const orientationCleanupRef = useRef(null)

  const [index, setIndex] = useState(0)
  const [backIndex, setBackIndex] = useState(1)
  const [reducedMotion, setReducedMotion] = useState(false)

  const requestOrientationAccess = useCallback(() => {
    if (
      reducedMotion ||
      !canUseOrientation() ||
      orientationPermissionRef.current !== 'idle'
    ) {
      return
    }

    orientationPermissionRef.current = 'requested'
    const OrientationEvent = window.DeviceOrientationEvent

    const enable = (permission) => {
      if (permission && permission !== 'granted') {
        orientationPermissionRef.current = 'denied'
        return
      }

      const resetOrientation = () => {
        orientationBaselineRef.current = null
        orientationRef.current.x = 0
        orientationRef.current.y = 0
        orientationRef.current.available = false
        motionKicksRef.current.forEach((kick) => kick())
      }

      const onOrientation = (event) => {
        if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return

        const axes = screenAdjustedAxes(event.beta, event.gamma)
        if (!orientationBaselineRef.current) {
          orientationBaselineRef.current = axes
        }

        orientationRef.current.x = clampOrientation(
          (axes.x - orientationBaselineRef.current.x) / ORIENTATION_RANGE_DEG,
        )
        orientationRef.current.y = clampOrientation(
          (axes.y - orientationBaselineRef.current.y) / ORIENTATION_RANGE_DEG,
        )
        orientationRef.current.available = true
        motionKicksRef.current.forEach((kick) => kick())
      }

      window.addEventListener('deviceorientation', onOrientation, {
        passive: true,
      })
      window.addEventListener('orientationchange', resetOrientation)
      window.screen?.orientation?.addEventListener?.('change', resetOrientation)
      orientationCleanupRef.current = () => {
        window.removeEventListener('deviceorientation', onOrientation)
        window.removeEventListener('orientationchange', resetOrientation)
        window.screen?.orientation?.removeEventListener?.('change', resetOrientation)
      }
      orientationPermissionRef.current = 'active'
    }

    if (typeof OrientationEvent.requestPermission === 'function') {
      OrientationEvent.requestPermission().then(enable).catch(() => {
        orientationPermissionRef.current = 'denied'
      })
    } else {
      enable('granted')
    }
  }, [reducedMotion])

  useEffect(() => {
    return () => {
      orientationCleanupRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (!reducedMotion) {
      if (orientationPermissionRef.current === 'disabled') {
        orientationPermissionRef.current = 'idle'
      }
      return
    }
    orientationCleanupRef.current?.()
    orientationCleanupRef.current = null
    orientationPermissionRef.current = 'disabled'
    orientationRef.current.x = 0
    orientationRef.current.y = 0
    orientationRef.current.available = false
  }, [reducedMotion])

  const count = images.length

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const wrap = useCallback(
    (i) => ((i % count) + count) % count,
    [count],
  )

  const resetAutoplay = useCallback(() => {
    if (autoplayRef.current) clearInterval(autoplayRef.current)
    if (prefersReducedMotion() || count <= 1) return

    autoplayRef.current = window.setInterval(() => {
      if (!flippingRef.current) flipForwardRef.current?.()
    }, AUTOPLAY_MS)
  }, [count])

  const flipForwardRef = useRef(null)

  const animateFlip = useCallback(
    (targetIndex, rotation) => {
      flippingRef.current = true
      setBackIndex(targetIndex)

      // Let React commit the next hidden face before the 3D transform starts.
      flipStartFrameRef.current = requestAnimationFrame(() => {
        flipStartFrameRef.current = 0
        const flipEl = flipRef.current
        if (!flipEl) {
          flippingRef.current = false
          return
        }

        gsap.to(flipEl, {
          rotateY: rotation,
          duration: FLIP_DURATION,
          ease: 'power2.inOut',
          onComplete: () => {
            // Keep the card edge-on while React swaps the visible face.
            setIndex(targetIndex)
            setBackIndex(wrap(targetIndex + 1))
            flipSettleFrameRef.current = requestAnimationFrame(() => {
              flipSettleFrameRef.current = 0
              if (!flipRef.current) {
                flippingRef.current = false
                return
              }
              gsap.set(flipRef.current, { rotateY: 0 })
              flippingRef.current = false
            })
          },
        })
      })
    },
    [wrap],
  )

  const flipForward = useCallback(() => {
    if (flippingRef.current || count <= 1) return
    const next = wrap(index + 1)

    if (reducedMotion) {
      setIndex(next)
      setBackIndex(wrap(next + 1))
      return
    }

    animateFlip(next, 180)
  }, [animateFlip, count, index, reducedMotion, wrap])

  const flipBackward = useCallback(() => {
    if (flippingRef.current || count <= 1) return
    const prev = wrap(index - 1)

    if (reducedMotion) {
      setIndex(prev)
      setBackIndex(wrap(prev + 1))
      return
    }

    animateFlip(prev, -180)
  }, [animateFlip, count, index, reducedMotion, wrap])

  flipForwardRef.current = flipForward

  useEffect(() => {
    resetAutoplay()
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current)
    }
  }, [resetAutoplay, index])

  useEffect(() => {
    return () => {
      if (flipStartFrameRef.current) {
        cancelAnimationFrame(flipStartFrameRef.current)
      }
      if (flipSettleFrameRef.current) {
        cancelAnimationFrame(flipSettleFrameRef.current)
      }
      if (flipRef.current) gsap.killTweensOf(flipRef.current)
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    const tiltEl = tiltRef.current
    const pointerTilt = canTilt()
    const orientationTilt = !pointerTilt && canUseOrientation()
    if (!stage || !tiltEl || (!pointerTilt && !orientationTilt)) return

    const pointerTarget = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let raf = 0
    let running = true

    const apply = () => {
      const orientation = orientationRef.current
      const targetX = pointerTilt
        ? pointerTarget.x
        : -orientation.y * MOBILE_TILT_MAX_X
      const targetY = pointerTilt
        ? pointerTarget.y
        : orientation.x * MOBILE_TILT_MAX_Y
      current.x += (targetX - current.x) * TILT_LERP
      current.y += (targetY - current.y) * TILT_LERP
      tiltEl.style.transform = `rotateX(${current.x}deg) rotateY(${current.y}deg)`
      const settled =
        Math.abs(targetX - current.x) < 0.01 &&
        Math.abs(targetY - current.y) < 0.01
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
      pointerTarget.x = -ny * TILT_MAX_X
      pointerTarget.y = nx * TILT_MAX_Y
      kick()
    }

    const onLeave = () => {
      pointerTarget.x = 0
      pointerTarget.y = 0
      kick()
    }

    if (pointerTilt) {
      stage.addEventListener('mousemove', onMove)
      stage.addEventListener('mouseleave', onLeave)
    }
    if (orientationTilt) motionKicksRef.current.add(kick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      if (pointerTilt) {
        stage.removeEventListener('mousemove', onMove)
        stage.removeEventListener('mouseleave', onLeave)
      }
      if (orientationTilt) motionKicksRef.current.delete(kick)
    }
  }, [])

  const onPointerDown = () => {
    resetAutoplay()
    requestOrientationAccess()
  }

  const onClick = (e) => {
    resetAutoplay()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < rect.width / 2) flipBackward()
    else flipForward()
  }

  const onTouchStart = (e) => {
    touchStartRef.current = e.touches[0]?.clientX ?? null
    resetAutoplay()
    requestOrientationAccess()
  }

  const onTouchEnd = (e) => {
    const start = touchStartRef.current
    if (start == null) return
    const end = e.changedTouches[0]?.clientX ?? start
    const delta = end - start
    touchStartRef.current = null
    if (Math.abs(delta) < 40) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = end - rect.left
      if (x < rect.width / 2) flipBackward()
      else flipForward()
      return
    }
    if (delta < 0) flipForward()
    else flipBackward()
  }

  const front = images[index]
  const back = images[backIndex]

  return (
    <div
      ref={stageRef}
      className="hero-flip-stage relative w-full aspect-[4/3] [perspective:800px] cursor-pointer select-none"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="group"
      aria-roledescription="carousel"
      aria-label={`Hero photograph ${index + 1} of ${count}`}
    >
      <div
        ref={tiltRef}
        className="relative h-full w-full will-change-transform"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div
          ref={flipRef}
          className="relative h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div
            className="hero-flip-face absolute inset-0 overflow-hidden bg-canvas"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <HeroSlide
              image={front}
              stageRef={stageRef}
              orientationRef={orientationRef}
              motionKicksRef={motionKicksRef}
            />
          </div>
          <div
            className="hero-flip-face absolute inset-0 overflow-hidden bg-canvas"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <HeroSlide
              image={back}
              stageRef={stageRef}
              orientationRef={orientationRef}
              motionKicksRef={motionKicksRef}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
