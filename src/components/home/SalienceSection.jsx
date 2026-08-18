import { useEffect, useMemo, useRef, useState } from 'react'
import CRTEffect from 'vault66-crt-effect'
import 'vault66-crt-effect/style.css'
import { useLenisRef } from '../../context/LenisContext'
import { useSalienceHandoff } from '../../context/SalienceHandoffContext'
import ApertureIris, {
  APERTURE_CLOSE_END,
  APERTURE_CLOSE_START,
  apertureCloseFromChapter,
  applyApertureClose,
} from './ApertureIris'
import { BLACK_HOLD_SVH } from './workEnter'

const DEFINITION =
  'Perceptual salience modulation describes how the brain dynamically shifts attention toward sensory stimuli based on context, memory, and internal state.'

const WARM_WORDS = new Set(['perceptual', 'salience'])
const COOL_WORDS = new Set(['attention', 'sensory', 'stimuli', 'memory'])

/** Restrained CRT values — direct package props, with scroll-driven CSS-var ramps. */
const CRT = {
  desktop: {
    scanline: 0.075,
    noise: 0.035,
    curvature: 0.24,
    vignette: 0.2,
    chromatic: 0.08,
  },
  mobile: {
    scanline: 0.05,
    noise: 0.018,
    curvature: 0.14,
    vignette: 0.12,
    chromatic: 0.04,
  },
}

function wordKey(word) {
  return word.replace(/[^\w]/g, '').toLowerCase()
}

function hueFor(word) {
  const key = wordKey(word)
  if (WARM_WORDS.has(key)) return 'warm'
  if (COOL_WORDS.has(key)) return 'cool'
  return null
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function crtRamp(p) {
  if (p >= APERTURE_CLOSE_END) return 0
  const highlight = Math.min(1, p / 0.55)
  const close = Math.min(
    1,
    Math.max(0, (p - APERTURE_CLOSE_START) / (APERTURE_CLOSE_END - APERTURE_CLOSE_START)),
  )
  return Math.min(1, highlight * 0.82 + close * 0.18)
}

function applyCrtProgress(root, p) {
  const wrapper = root?.querySelector('.crt-effect-wrapper')
  if (!wrapper) return

  const intensity = crtRamp(p)
  const values = window.matchMedia('(max-width: 767px)').matches
    ? CRT.mobile
    : CRT.desktop

  wrapper.style.setProperty('--scanline-opacity', String(values.scanline * intensity))
  wrapper.style.setProperty('--noise-opacity', String(values.noise * intensity))
  wrapper.style.setProperty('--curvature-intensity', String(values.curvature * intensity))
  wrapper.style.setProperty('--vignette-intensity', String(values.vignette * intensity))
  wrapper.style.setProperty('--glitch-intensity', String(values.chromatic * intensity))

  const inner = root.querySelector('.crt-inner')
  if (inner) {
    inner.style.animationPlayState = intensity > 0.001 ? 'running' : 'paused'
  }

  const noise = root.querySelector('.crt-noise')
  if (noise) {
    noise.style.animationPlayState = intensity > 0.001 ? 'running' : 'paused'
  }
}

function SalienceCRT({ children, crtRef, reducedMotion = false }) {
  return (
    <div ref={crtRef} className="salience-crt w-full">
      <CRTEffect
        theme="custom"
        scanlineColor="#E8EDF2"
        scanlineOpacity={reducedMotion ? 0.035 : 0}
        scanlineThickness={1}
        scanlineGap={4}
        scanlineOrientation="horizontal"
        enableScanlines
        enableSweep={false}
        enableGlow={false}
        enableEdgeGlow={false}
        enableFlicker={false}
        enableGlitch={!reducedMotion}
        glitchChromatic={!reducedMotion}
        glitchIntensity={0}
        glitchSpeed={3.5}
        enableVignette={false}
        vignetteIntensity={0}
        enableCurvature={false}
        curvatureIntensity={0}
        enableNoise={!reducedMotion}
        noiseOpacity={0}
        tintText={false}
      >
        {children}
      </CRTEffect>
    </div>
  )
}

function SalienceText({ animated }) {
  const words = useMemo(() => DEFINITION.trim().split(/\s+/), [])
  const last = Math.max(words.length - 1, 1)

  return (
    <p
      id="salience-heading"
      className="font-serif font-bold text-pretty text-[1.5rem] sm:text-[2rem] md:text-[2.75rem] lg:text-[4rem] leading-[1.2] md:leading-[1.12] tracking-[-0.015em]"
    >
      {words.map((word, i) => {
        const hue = hueFor(word)
        const hueClass =
          hue === 'warm'
            ? 'salience-word--warm'
            : hue === 'cool'
              ? 'salience-word--cool'
              : ''
        const staticClass =
          hue === 'warm'
            ? 'text-salience-warm'
            : hue === 'cool'
              ? 'text-salience-cool'
              : 'text-salience'

        return (
          <span key={`${word}-${i}`} className="inline">
            {animated ? (
              <span
                className={`salience-word ${hueClass}`.trim()}
                style={{ '--t': i / last }}
              >
                {word}
              </span>
            ) : (
              <span className={staticClass}>{word}</span>
            )}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        )
      })}
    </p>
  )
}

/**
 * Salience chapter: text highlight + restrained CRT treatment + aperture close.
 * After full closure + brief black hold, the iris is removed (not reopened).
 * WorkChapter owns the assemble-over-black sequence underneath.
 */
export default function SalienceSection() {
  const chapterRef = useRef(null)
  const stageRef = useRef(null)
  const textRef = useRef(null)
  const irisRef = useRef(null)
  const irisSvgRef = useRef(null)
  const crtRef = useRef(null)
  const holdRafRef = useRef(0)
  const lenisRef = useLenisRef()
  const { setHandoff } = useSalienceHandoff()
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window === 'undefined' ? false : prefersReducedMotion(),
  )
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      setHandoff({ progress: 1, apertureClose: 0, irisReleased: true })
      return
    }

    const chapter = chapterRef.current
    const stage = stageRef.current
    const text = textRef.current
    if (!chapter || !stage || !text) return

    const setIrisReleasedVisual = (released) => {
      const svg =
        irisSvgRef.current ||
        irisRef.current?.ownerSVGElement ||
        null
      if (svg) {
        irisSvgRef.current = svg
        // Keep geometry at full close underneath; hide so Work can assemble.
        svg.style.visibility = released ? 'hidden' : 'visible'
        svg.style.opacity = released ? '0' : '1'
      }
    }

    const updateProgress = () => {
      const rect = chapter.getBoundingClientRect()
      const vh = window.innerHeight
      const range = Math.max(rect.height - vh, 0)
      const p = range <= 0 ? 1 : Math.min(1, Math.max(0, -rect.top / range))
      const highlight = Math.min(1, p / 0.55)
      const close = apertureCloseFromChapter(p)
      const past = rect.bottom <= 0
      const holdSpan = range > 0 ? (BLACK_HOLD_SVH / 100) * vh / range : 0
      const releaseAt = APERTURE_CLOSE_END + holdSpan

      stage.style.setProperty('--salience-p', String(highlight))
      applyCrtProgress(crtRef.current, p)

      // Keep the content present until the final blade state is reached.
      const showText = close < 0.999
      text.style.opacity = showText ? '1' : '0'

      if (holdRafRef.current) {
        cancelAnimationFrame(holdRafRef.current)
        holdRafRef.current = 0
      }

      if (past) {
        applyApertureClose(irisRef.current, 1)
        setIrisReleasedVisual(true)
        stage.dataset.irisReleased = '1'
        setHandoff({ progress: 1, apertureClose: 1, irisReleased: true })
        return
      }

      if (close >= 0.999) {
        applyApertureClose(irisRef.current, 1)
        // Scroll-linked black hold — reversible, no timer.
        const released = p >= releaseAt
        setIrisReleasedVisual(released)
        stage.dataset.irisReleased = released ? '1' : '0'
        setHandoff({
          progress: p,
          apertureClose: 1,
          irisReleased: released,
        })
        return
      }

      // Scrolling back through the close — restore iris. Keep blades closed
      // until Work has mostly retracted so we never reopen onto half-assembled rows.
      const workEl = document.getElementById('work')
      const enterP = Number(workEl?.dataset.enterProgress || 0)
      const keepClosedForRetract = enterP > 0.12
      const visualClose = keepClosedForRetract ? 1 : close
      setIrisReleasedVisual(false)
      stage.dataset.irisReleased = '0'
      applyApertureClose(irisRef.current, visualClose)
      setHandoff({
        progress: p,
        apertureClose: close,
        irisReleased: false,
      })
      if (keepClosedForRetract) {
        holdRafRef.current = requestAnimationFrame(updateProgress)
      }
    }

    updateProgress()

    let detachLenis = () => {}
    const attachLenis = () => {
      const lenis = lenisRef?.current
      if (!lenis) return false
      lenis.on('scroll', updateProgress)
      detachLenis = () => lenis.off('scroll', updateProgress)
      return true
    }

    const raf = requestAnimationFrame(() => {
      if (!attachLenis()) {
        window.addEventListener('scroll', updateProgress, { passive: true })
        detachLenis = () =>
          window.removeEventListener('scroll', updateProgress)
      }
      updateProgress()
    })

    const onResize = updateProgress
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current)
      detachLenis()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', updateProgress)
    }
  }, [reducedMotion, lenisRef, setHandoff])

  if (reducedMotion) {
    return (
      <section
        id="salience"
        className="relative z-40 bg-canvas text-ink section-pad py-28 md:py-40 lg:py-48"
        aria-labelledby="salience-heading"
      >
        <div className="w-full max-w-[960px] mx-auto">
          <SalienceCRT crtRef={crtRef} reducedMotion>
            <SalienceText animated={false} />
          </SalienceCRT>
        </div>
      </section>
    )
  }

  return (
    <section
      id="salience"
      ref={chapterRef}
      className="relative z-40 h-[340svh] bg-transparent text-ink pointer-events-none"
      aria-labelledby="salience-heading"
    >
      <div
        ref={stageRef}
        className="salience-stage pointer-events-none sticky top-0 z-40 h-[100svh] overflow-hidden bg-transparent"
      >
        <div
          ref={textRef}
          className="absolute inset-0 z-10 flex items-center section-pad bg-canvas pointer-events-none"
        >
          <SalienceCRT crtRef={crtRef}>
            <SalienceText animated />
          </SalienceCRT>
        </div>

        <ApertureIris pathRef={irisRef} />
      </div>
    </section>
  )
}
