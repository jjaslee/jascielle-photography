/**
 * OriginKit-style flip gallery: one photographic plane, subtle tilt, click to flip.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import ProtectedImage from '../ProtectedImage'
import HeroImageLayers from './HeroImageLayers'
import { computeHeroPointer } from '../../utils/heroProximity'

const TILT_MAX_X = 7
const TILT_MAX_Y = 10
const FLIP_DURATION = 0.8
const AUTOPLAY_MS = 8000
const TILT_LERP = 0.1
const ORIENTATION_PARALLAX_RANGE_DEG = 25
const ORIENTATION_TILT_RANGE_DEG = 18
const ORIENTATION_TILT_DEAD_ZONE_DEG = 1.25
const ORIENTATION_TILT_RESPONSE = 0.85
const ORIENTATION_TILT_MAX_X = 11
const ORIENTATION_TILT_MAX_Y = 14
const ORIENTATION_STATIONARY_THRESHOLD_DEG = 0.65
const ORIENTATION_IDLE_DELAY_MS = 1000
const ORIENTATION_IDLE_RETURN_MS = 700
const ORIENTATION_REACTIVATION_THRESHOLD_DEG = 1.75
const MOBILE_TILT_MAX_X = 9
const MOBILE_TILT_MAX_Y = 11
const MOBILE_TILT_MAX_SCALE = 1.03
const MOBILE_TILT_SCALE_DEAD_ZONE = 0.08
const MOBILE_TILT_CUE_LERP = 0.22
const MOBILE_TILT_CUE_MS = 980
const MOBILE_TILT_CUE_KEYFRAMES = [
  { at: 0, x: 0, y: 0 },
  { at: 120, x: -0.7, y: 1.5 },
  { at: 240, x: -1.4, y: 3 },
  { at: 420, x: -2.1, y: 4.5 },
  { at: 560, x: -2.1, y: 4.5 },
  { at: 720, x: -0.93, y: 2 },
  { at: MOBILE_TILT_CUE_MS, x: 0, y: 0 },
]

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
    hasTouchInput()
  )
}

function hasTouchInput() {
  return (
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    window.matchMedia('(any-pointer: coarse)').matches
  )
}

function canUseTouchTilt() {
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    hasTouchInput()
  )
}

function clampOrientation(value) {
  return Math.max(-1, Math.min(1, value))
}

function mobileTiltFromNormalizedInput(horizontal, vertical) {
  return {
    x: vertical * MOBILE_TILT_MAX_X,
    y: -horizontal * MOBILE_TILT_MAX_Y,
  }
}

function orientationTiltFromNormalizedInput(horizontal, vertical) {
  return {
    x: vertical * ORIENTATION_TILT_MAX_X,
    y: -horizontal * ORIENTATION_TILT_MAX_Y,
  }
}

function normalizeOrientationTilt(delta) {
  const magnitude = Math.abs(delta)
  if (magnitude <= ORIENTATION_TILT_DEAD_ZONE_DEG) return 0

  const normalized =
    (magnitude - ORIENTATION_TILT_DEAD_ZONE_DEG) /
    (ORIENTATION_TILT_RANGE_DEG - ORIENTATION_TILT_DEAD_ZONE_DEG)
  return Math.sign(delta) * Math.pow(clampOrientation(normalized), ORIENTATION_TILT_RESPONSE)
}

function sampleIntroTiltCue(elapsed) {
  const clampedElapsed = Math.max(0, Math.min(MOBILE_TILT_CUE_MS, elapsed))
  const endIndex = MOBILE_TILT_CUE_KEYFRAMES.findIndex(
    (keyframe) => keyframe.at >= clampedElapsed,
  )
  const next = MOBILE_TILT_CUE_KEYFRAMES[Math.max(0, endIndex)]
  const previous = MOBILE_TILT_CUE_KEYFRAMES[Math.max(0, endIndex - 1)]
  const span = Math.max(1, next.at - previous.at)
  const progress = (clampedElapsed - previous.at) / span
  const eased = 0.5 - Math.cos(Math.PI * progress) / 2

  return {
    x: previous.x + (next.x - previous.x) * eased,
    y: previous.y + (next.y - previous.y) * eased,
    complete: clampedElapsed >= MOBILE_TILT_CUE_MS,
  }
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

function HeroSlide({
  image,
  stageRef,
  orientationRef,
  motionKicksRef,
  interactionEnabledRef,
  heroPointerRef,
}) {
  if (image.layers) {
    return (
      <HeroImageLayers
        layers={image.layers}
        alt={image.alt}
        stageRef={stageRef}
        orientationRef={orientationRef}
        motionKicksRef={motionKicksRef}
        interactionEnabledRef={interactionEnabledRef}
        heroPointerRef={heroPointerRef}
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

export default function HeroFlipGallery({
  images,
  interactionEnabledRef,
  interactionReady = true,
}) {
  const interactionRef = interactionEnabledRef ?? { current: true }
  const stageRef = useRef(null)
  const tiltRef = useRef(null)
  const flipRef = useRef(null)
  const flippingRef = useRef(false)
  const flipStartFrameRef = useRef(0)
  const flipRotationRef = useRef(0)
  const visibleFaceRef = useRef('front')
  const autoplayRef = useRef(null)
  const touchStartRef = useRef(null)
  const touchBoundsRef = useRef(null)
  const orientationRef = useRef({
    x: 0,
    y: 0,
    tiltX: 0,
    tiltY: 0,
    available: false,
    idle: false,
  })
  const motionKicksRef = useRef(new Set())
  const heroPointerRef = useRef({ nx: 0, ny: 0, influence: 0, touching: false })
  const orientationBaselineRef = useRef(null)
  const orientationActivityRef = useRef({
    state: 'calibrating',
    latestAxes: null,
    idleAxes: null,
    meaningfulDelta: null,
    idleTimer: 0,
  })
  const orientationPermissionRef = useRef('idle')
  const orientationCleanupRef = useRef(null)
  const introTiltCueRef = useRef({
    active: false,
    played: false,
    startedAt: 0,
    x: 0,
    y: 0,
  })

  const [index, setIndex] = useState(0)
  const [frontIndex, setFrontIndex] = useState(0)
  const [backIndex, setBackIndex] = useState(1)
  const [reducedMotion, setReducedMotion] = useState(false)

  const cancelIntroTiltCue = useCallback(() => {
    const cue = introTiltCueRef.current
    cue.active = false
    motionKicksRef.current.forEach((kick) => kick())
  }, [])

  const resetOrientation = useCallback(() => {
    const activity = orientationActivityRef.current
    window.clearTimeout(activity.idleTimer)
    activity.state = 'calibrating'
    activity.latestAxes = null
    activity.idleAxes = null
    activity.meaningfulDelta = null
    activity.idleTimer = 0
    orientationBaselineRef.current = null
    orientationRef.current.x = 0
    orientationRef.current.y = 0
    orientationRef.current.tiltX = 0
    orientationRef.current.tiltY = 0
    orientationRef.current.available = false
    orientationRef.current.idle = false
    motionKicksRef.current.forEach((kick) => kick())
  }, [])

  const enterOrientationIdle = useCallback(() => {
    const activity = orientationActivityRef.current
    if (activity.state !== 'active') return

    activity.state = 'idle'
    activity.idleAxes = activity.latestAxes
    activity.idleTimer = 0
    orientationRef.current.x = 0
    orientationRef.current.y = 0
    orientationRef.current.tiltX = 0
    orientationRef.current.tiltY = 0
    orientationRef.current.available = false
    orientationRef.current.idle = true
    motionKicksRef.current.forEach((kick) => kick())
  }, [])

  const startOrientationListening = useCallback(() => {
    if (
      reducedMotion ||
      prefersReducedMotion() ||
      !canUseOrientation() ||
      orientationCleanupRef.current
    ) {
      return false
    }

    const scheduleIdleReturn = () => {
      const activity = orientationActivityRef.current
      window.clearTimeout(activity.idleTimer)
      activity.idleTimer = window.setTimeout(
        enterOrientationIdle,
        ORIENTATION_IDLE_DELAY_MS,
      )
    }

    const onOrientation = (event) => {
      if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return

      const axes = screenAdjustedAxes(event.beta, event.gamma)
      const activity = orientationActivityRef.current
      activity.latestAxes = axes

      if (activity.state === 'idle') {
        const idleAxes = activity.idleAxes ?? axes
        const movement = Math.max(
          Math.abs(axes.x - idleAxes.x),
          Math.abs(axes.y - idleAxes.y),
        )
        if (movement < ORIENTATION_REACTIVATION_THRESHOLD_DEG) return

        activity.state = 'calibrating'
        activity.idleAxes = null
        activity.meaningfulDelta = null
        orientationBaselineRef.current = { ...axes, samples: 1 }
        orientationRef.current.idle = false
        return
      }

      const baseline = orientationBaselineRef.current
      if (!baseline) {
        orientationBaselineRef.current = { ...axes, samples: 1 }
        return
      }

      if (baseline.samples < 4) {
        const samples = baseline.samples + 1
        baseline.x += (axes.x - baseline.x) / samples
        baseline.y += (axes.y - baseline.y) / samples
        baseline.samples = samples
        if (samples < 4) return
      }

      const deltaX = axes.x - baseline.x
      const deltaY = axes.y - baseline.y
      const previousMeaningful = activity.meaningfulDelta
      const meaningfulMovement = previousMeaningful
        ? Math.max(
            Math.abs(deltaX - previousMeaningful.x),
            Math.abs(deltaY - previousMeaningful.y),
          )
        : Infinity

      if (
        activity.state === 'calibrating' ||
        meaningfulMovement >= ORIENTATION_STATIONARY_THRESHOLD_DEG
      ) {
        activity.state = 'active'
        activity.meaningfulDelta = { x: deltaX, y: deltaY }
        scheduleIdleReturn()
      }

      orientationRef.current.x = clampOrientation(
        deltaX / ORIENTATION_PARALLAX_RANGE_DEG,
      )
      orientationRef.current.y = clampOrientation(
        deltaY / ORIENTATION_PARALLAX_RANGE_DEG,
      )
      orientationRef.current.tiltX = normalizeOrientationTilt(deltaX)
      orientationRef.current.tiltY = normalizeOrientationTilt(deltaY)
      orientationRef.current.available = true
      orientationRef.current.idle = false
      orientationPermissionRef.current = 'active'
      if (introTiltCueRef.current.active) cancelIntroTiltCue()
      motionKicksRef.current.forEach((kick) => kick())
    }

    window.addEventListener('deviceorientation', onOrientation, { passive: true })
    window.addEventListener('orientationchange', resetOrientation)
    window.screen?.orientation?.addEventListener?.('change', resetOrientation)
    orientationCleanupRef.current = () => {
      window.removeEventListener('deviceorientation', onOrientation)
      window.removeEventListener('orientationchange', resetOrientation)
      window.screen?.orientation?.removeEventListener?.('change', resetOrientation)
    }

    const OrientationEvent = window.DeviceOrientationEvent
    orientationPermissionRef.current =
      typeof OrientationEvent.requestPermission === 'function'
        ? 'awaiting-gesture'
        : 'listening'
    return true
  }, [cancelIntroTiltCue, enterOrientationIdle, reducedMotion, resetOrientation])

  const requestOrientationAccess = useCallback(() => {
    if (reducedMotion || prefersReducedMotion() || !canUseOrientation()) return

    const OrientationEvent = window.DeviceOrientationEvent
    const permissionRequired =
      typeof OrientationEvent.requestPermission === 'function'
    if (
      permissionRequired &&
      (orientationPermissionRef.current === 'requested' ||
        orientationPermissionRef.current === 'denied' ||
        orientationPermissionRef.current === 'active')
    ) {
      return
    }

    startOrientationListening()
    if (!permissionRequired) return

    orientationPermissionRef.current = 'requested'
    const denyOrientationAccess = () => {
      orientationPermissionRef.current = 'denied'
      orientationCleanupRef.current?.()
      orientationCleanupRef.current = null
      resetOrientation()
    }
    OrientationEvent.requestPermission()
      .then((permission) => {
        if (permission === 'granted') {
          orientationPermissionRef.current = 'listening'
          startOrientationListening()
          return
        }
        denyOrientationAccess()
      })
      .catch(denyOrientationAccess)
  }, [reducedMotion, resetOrientation, startOrientationListening])

  useEffect(() => {
    return () => {
      orientationCleanupRef.current?.()
      window.clearTimeout(orientationActivityRef.current.idleTimer)
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
    resetOrientation()
  }, [reducedMotion, resetOrientation])

  useEffect(() => {
    if (!interactionReady || reducedMotion || prefersReducedMotion()) return
    if (!canUseOrientation()) {
      orientationPermissionRef.current = 'unsupported'
      return
    }
    startOrientationListening()
  }, [interactionReady, reducedMotion, startOrientationListening])

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
      const nextFace = visibleFaceRef.current === 'front' ? 'back' : 'front'
      const targetRotation = flipRotationRef.current + rotation
      if (nextFace === 'front') setFrontIndex(targetIndex)
      else setBackIndex(targetIndex)

      // Let React commit the next hidden face before the 3D transform starts.
      flipStartFrameRef.current = requestAnimationFrame(() => {
        flipStartFrameRef.current = 0
        const flipEl = flipRef.current
        if (!flipEl) {
          flippingRef.current = false
          return
        }

        gsap.to(flipEl, {
          rotateY: targetRotation,
          force3D: true,
          duration: FLIP_DURATION,
          ease: 'power2.inOut',
          onComplete: () => {
            flipRotationRef.current = targetRotation
            visibleFaceRef.current = nextFace
            setIndex(targetIndex)
            if (nextFace === 'front') setBackIndex(wrap(targetIndex + 1))
            else setFrontIndex(wrap(targetIndex + 1))
            flippingRef.current = false
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
      if (visibleFaceRef.current === 'front') {
        setFrontIndex(next)
        setBackIndex(wrap(next + 1))
      } else {
        setBackIndex(next)
        setFrontIndex(wrap(next + 1))
      }
      return
    }

    animateFlip(next, 180)
  }, [animateFlip, count, index, reducedMotion, wrap])

  const flipBackward = useCallback(() => {
    if (flippingRef.current || count <= 1) return
    const prev = wrap(index - 1)

    if (reducedMotion) {
      setIndex(prev)
      if (visibleFaceRef.current === 'front') {
        setFrontIndex(prev)
        setBackIndex(wrap(prev + 1))
      } else {
        setBackIndex(prev)
        setFrontIndex(wrap(prev + 1))
      }
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
      if (flipRef.current) gsap.killTweensOf(flipRef.current)
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    const tiltEl = tiltRef.current
    const pointerTilt = canTilt()
    const touchTilt = canUseTouchTilt()
    const orientationTilt = canUseOrientation()
    const mobileTilt = window.matchMedia('(max-width: 767px)').matches
    if (!stage || !tiltEl || (!pointerTilt && !touchTilt && !orientationTilt)) return

    const pointerTarget = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let raf = 0
    let running = true
    let lastFrameAt = performance.now()

    const apply = (frameAt) => {
      const frameDuration = Math.min(32, Math.max(0, frameAt - lastFrameAt))
      lastFrameAt = frameAt
      if (!interactionRef.current) {
        current.x = 0
        current.y = 0
        tiltEl.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)'
        raf = 0
        return
      }
      const orientation = orientationRef.current
      const touch = heroPointerRef.current
      const cue = introTiltCueRef.current
      if (cue.active) {
        const cueSample = sampleIntroTiltCue(performance.now() - cue.startedAt)
        cue.x = cueSample.x
        cue.y = cueSample.y
        cue.active = !cueSample.complete
      }
      let targetX = 0
      let targetY = 0
      let idleReturning = false

      if (touchTilt && touch.touching && !flippingRef.current) {
        const touchTiltTarget = mobileTiltFromNormalizedInput(touch.nx, touch.ny)
        targetX = touchTiltTarget.x
        targetY = touchTiltTarget.y
      } else if (pointerTilt && touch.influence > 0) {
        targetX = pointerTarget.x
        targetY = pointerTarget.y
      } else if (orientationTilt && orientation.available) {
        const orientationTiltTarget = orientationTiltFromNormalizedInput(
          -orientation.tiltX,
          -orientation.tiltY,
        )
        targetX = orientationTiltTarget.x
        targetY = orientationTiltTarget.y
      } else if (cue.active) {
        targetX = cue.x
        targetY = cue.y
      } else if (orientationTilt) {
        const orientationTiltTarget = orientationTiltFromNormalizedInput(
          -orientation.tiltX,
          -orientation.tiltY,
        )
        targetX = orientationTiltTarget.x
        targetY = orientationTiltTarget.y
        idleReturning = orientation.idle
      } else if (pointerTilt) {
        targetX = pointerTarget.x
        targetY = pointerTarget.y
      }
      const tiltLerp = cue.active
        ? MOBILE_TILT_CUE_LERP
        : idleReturning
          ? 1 - Math.pow(0.05, frameDuration / ORIENTATION_IDLE_RETURN_MS)
          : TILT_LERP
      current.x += (targetX - current.x) * tiltLerp
      current.y += (targetY - current.y) * tiltLerp
      const tiltStrength = mobileTilt
        ? Math.min(
            1,
            Math.max(
              Math.abs(current.x) / MOBILE_TILT_MAX_X,
              Math.abs(current.y) / MOBILE_TILT_MAX_Y,
            ),
          )
        : 0
      const scaleProgress = Math.max(
        0,
        (tiltStrength - MOBILE_TILT_SCALE_DEAD_ZONE) /
          (1 - MOBILE_TILT_SCALE_DEAD_ZONE),
      )
      const scale = 1 + (MOBILE_TILT_MAX_SCALE - 1) * scaleProgress
      tiltEl.style.transform = `rotateX(${current.x}deg) rotateY(${current.y}deg) scale(${scale})`
      const settled =
        Math.abs(targetX - current.x) < 0.01 &&
        Math.abs(targetY - current.y) < 0.01
      if ((cue.active || !settled) && running) raf = requestAnimationFrame(apply)
      else raf = 0
    }

    const kick = () => {
      if (!interactionRef.current || !running || raf) return
      lastFrameAt = performance.now()
      raf = requestAnimationFrame(apply)
    }

    const onMove = (e) => {
      if (!interactionRef.current) return
      if (heroPointerRef.current.touching) return
      if (introTiltCueRef.current.active) cancelIntroTiltCue()
      const rect = stage.getBoundingClientRect()
      const pointer = computeHeroPointer(e.clientX, e.clientY, rect)
      heroPointerRef.current = pointer

      if (pointer.influence <= 0) {
        pointerTarget.x = 0
        pointerTarget.y = 0
      } else {
        pointerTarget.x = -pointer.ny * TILT_MAX_X * pointer.influence
        pointerTarget.y = pointer.nx * TILT_MAX_Y * pointer.influence
      }
      kick()
      motionKicksRef.current.forEach((fn) => fn())
    }

    const onLeave = () => {
      if (!interactionRef.current) return
      heroPointerRef.current = { nx: 0, ny: 0, influence: 0, touching: false }
      pointerTarget.x = 0
      pointerTarget.y = 0
      kick()
      motionKicksRef.current.forEach((fn) => fn())
    }

    if (pointerTilt) {
      window.addEventListener('mousemove', onMove, { passive: true })
      document.documentElement.addEventListener('mouseleave', onLeave)
    }
    motionKicksRef.current.add(kick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      if (pointerTilt) {
        window.removeEventListener('mousemove', onMove)
        document.documentElement.removeEventListener('mouseleave', onLeave)
      }
      motionKicksRef.current.delete(kick)
    }
  }, [cancelIntroTiltCue])

  useEffect(() => {
    const cue = introTiltCueRef.current
    const isMobileViewport = window.matchMedia('(max-width: 767px)').matches

    if (
      !interactionReady ||
      cue.played ||
      reducedMotion ||
      prefersReducedMotion() ||
      !isMobileViewport
    ) {
      return undefined
    }

    cue.played = true
    cue.active = true
    cue.startedAt = performance.now()
    cue.x = 0
    cue.y = 0
    motionKicksRef.current.forEach((kick) => kick())

    return cancelIntroTiltCue
  }, [cancelIntroTiltCue, interactionReady, reducedMotion])

  const onPointerDown = () => {
    if (!interactionRef.current) return
    requestOrientationAccess()
    cancelIntroTiltCue()
    resetAutoplay()
  }

  const onClick = (e) => {
    if (!interactionRef.current) return
    resetAutoplay()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < rect.width / 2) flipBackward()
    else flipForward()
  }

  const updateTouchTilt = (touch) => {
    if (!touch || !canUseTouchTilt() || flippingRef.current) return
    const rect = touchBoundsRef.current ?? stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const halfW = Math.max(rect.width * 0.5, 1)
    const halfH = Math.max(rect.height * 0.5, 1)
    const nx = Math.max(-1, Math.min(1, (touch.clientX - rect.left - halfW) / halfW))
    const ny = Math.max(-1, Math.min(1, (touch.clientY - rect.top - halfH) / halfH))
    heroPointerRef.current = { nx, ny, influence: 1, touching: true }
    motionKicksRef.current.forEach((kick) => kick())
  }

  const releaseTouchTilt = () => {
    heroPointerRef.current = { nx: 0, ny: 0, influence: 0, touching: false }
    motionKicksRef.current.forEach((kick) => kick())
  }

  const onTouchStart = (e) => {
    if (!interactionRef.current) return
    const touch = e.touches[0]
    requestOrientationAccess()
    cancelIntroTiltCue()
    touchBoundsRef.current = stageRef.current?.getBoundingClientRect() ?? null
    touchStartRef.current = touch
      ? { x: touch.clientX, y: touch.clientY }
      : null
    updateTouchTilt(touch)
    resetAutoplay()
  }

  const onTouchMove = (e) => {
    if (!interactionRef.current) return
    updateTouchTilt(e.touches[0])
  }

  const onTouchEnd = (e) => {
    if (!interactionRef.current) return
    releaseTouchTilt()
    const start = touchStartRef.current
    touchBoundsRef.current = null
    if (start == null) return
    const endTouch = e.changedTouches[0]
    touchStartRef.current = null
    if (!endTouch) return

    const deltaX = endTouch.clientX - start.x
    const deltaY = endTouch.clientY - start.y
    if (Math.abs(deltaY) > 12 && Math.abs(deltaY) > Math.abs(deltaX)) {
      return
    }

    if (Math.abs(deltaX) < 40) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = endTouch.clientX - rect.left
      if (x < rect.width / 2) flipBackward()
      else flipForward()
      return
    }
    if (deltaX < 0) flipForward()
    else flipBackward()
  }

  const onTouchCancel = () => {
    touchStartRef.current = null
    touchBoundsRef.current = null
    releaseTouchTilt()
  }

  const front = images[frontIndex]
  const back = images[backIndex]
  const touchCapable = hasTouchInput()

  return (
    <div
      ref={stageRef}
      className={`hero-flip-stage relative w-full aspect-[4/3] [perspective:725px] md:[perspective:800px] cursor-pointer select-none${
        touchCapable ? ' hero-flip-stage--touch-capable' : ''
      }`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      role="group"
      aria-roledescription="carousel"
      aria-label={`Hero photograph ${index + 1} of ${count}`}
    >
      <div
        ref={tiltRef}
        className="relative h-full w-full will-change-transform"
        style={{
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
        }}
      >
        <div
          ref={flipRef}
          className="relative h-full w-full will-change-transform"
          style={{
            transformStyle: 'preserve-3d',
            WebkitTransformStyle: 'preserve-3d',
          }}
        >
          <div
            className="hero-flip-face absolute inset-0 overflow-hidden bg-canvas"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg)',
            }}
          >
            <HeroSlide
              image={front}
              stageRef={stageRef}
              orientationRef={orientationRef}
              motionKicksRef={motionKicksRef}
              interactionEnabledRef={interactionRef}
              heroPointerRef={heroPointerRef}
            />
          </div>
          <div
            className="hero-flip-face absolute inset-0 overflow-hidden bg-canvas"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <HeroSlide
              image={back}
              stageRef={stageRef}
              orientationRef={orientationRef}
              motionKicksRef={motionKicksRef}
              interactionEnabledRef={interactionRef}
              heroPointerRef={heroPointerRef}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
