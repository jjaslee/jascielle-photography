import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Scene, ScrollTransform, useSceneContext } from 'react-kino'
import { featuredWork } from '../../data/galleries'
import ProtectedImage from '../ProtectedImage'
import BarrelRollLabel from '../BarrelRollLabel'
import { protectedGalleryHandlers } from '../../utils/imageProtection'
import { SMOOTH_SCROLL_STATE, useFooterNavClick } from '../../hooks/useScrollToTop'
import { useLenisRef } from '../../context/LenisContext'

const DEFAULT_FOOTER_LABEL = 'Jascielle Photography'
const CHAPTER_SVH = 340
const SETTLED = 0.9
const REVEAL_FRACTION = 0.55
const APPROACH_LEAD = 0.26

// Flip ranges — unchanged
const RANGES = [
  [0.0, 0.54],
  [0.14, 0.70],
  [0.28, 0.86],
]

// CTA final phase — only starts after all cards are flat
const CTA_START = 0.72
const CTA_END = 0.97
const HOLD_START = CTA_END
// HOLD_START → 1.00 is quiet hold

const PRINT_POSE = {
  x: 0, y: -8, z: 0,
  rotate: 0, rotateX: -82, rotateY: 0,
  scale: 1, opacity: 0.96,
}
const FLAT_POSE = {
  x: 0, y: 0, z: 0,
  rotate: 0, rotateX: 0, rotateY: 0,
  scale: 1, opacity: 1,
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function canFinePointer() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

function rangeProgress(p, start, end) {
  return clamp01((p - start) / Math.max(end - start, 1e-6))
}

/** Slow hinge start, mid-swing carry, long settling tail — scroll-scrubbed, no overshoot. */
function featuredSwingEase(t) {
  const x = clamp01(t)
  if (x < 0.38) {
    const u = x / 0.38
    return 0.38 * u ** 3
  }
  const u = (x - 0.38) / 0.62
  return 0.38 + 0.62 * (1 - (1 - u) ** 2.4)
}

function easeOutQuint(t) {
  return 1 - (1 - clamp01(t)) ** 9
}

function easeOutGrid(t) {
  return 1 - (1 - clamp01(t)) ** 6
}

function featuredProgress(sceneProgress, headingTop, viewportHeight) {
  const approachStart = viewportHeight * 0.88
  const approachEnd = 120

  const approachP =
    headingTop >= approachStart
      ? 0
      : clamp01((approachStart - headingTop) / Math.max(approachStart - approachEnd, 1)) *
        APPROACH_LEAD

  const pinP =
    sceneProgress > 0
      ? APPROACH_LEAD + sceneProgress * (1 - APPROACH_LEAD)
      : headingTop <= approachEnd
        ? APPROACH_LEAD
        : 0

  return Math.max(approachP, pinP)
}

function FeaturedPrint({ index, progress, settledRef, finePointerRef, children }) {
  const [start, end] = RANGES[index]
  const settledAt = start + (end - start) * SETTLED
  const settled = progress >= settledAt

  settledRef.current[index] = settled

  return (
    <ScrollTransform
      progress={progress}
      from={{ opacity: 0 }}
      to={{ opacity: 1 }}
      at={start}
      span={(end - start) * REVEAL_FRACTION}
      easing={featuredSwingEase}
      style={{
        pointerEvents: !finePointerRef.current || settled ? 'auto' : 'none',
      }}
    >
      <ScrollTransform
        progress={progress}
        from={PRINT_POSE}
        to={FLAT_POSE}
        at={start}
        span={end - start}
        easing={featuredSwingEase}
        perspective={1400}
        transformOrigin="center top"
        className="featured-print"
      >
        {children}
      </ScrollTransform>
    </ScrollTransform>
  )
}

function FeaturedFooter({ footerLabel, year, onFooterNavClick }) {
  return (
    <footer className="featured-meta section-pad font-mono font-light tracking-nav uppercase text-[11px] md:text-xs text-ink/70 mt-auto pt-10 md:pt-12 pb-5 md:pb-6">
      <p className="featured-meta__hover" aria-live="polite">
        <span key={footerLabel} className="featured-meta__label">
          {footerLabel}
        </span>
      </p>
      <nav className="featured-meta__nav" aria-label="Footer">
        <a
          href="https://www.instagram.com/jascielle_photos/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Instagram
        </a>
        <span className="featured-meta__sep" aria-hidden="true">·</span>
        <a href="mailto:jascielle.photos@gmail.com">Email</a>
        <span className="featured-meta__sep" aria-hidden="true">·</span>
        <Link
          to="/book"
          state={SMOOTH_SCROLL_STATE}
          onClick={onFooterNavClick('/book')}
        >
          Book
        </Link>
      </nav>
      <p className="featured-meta__copy">© {year}</p>
    </footer>
  )
}

function FeaturedStage({
  items,
  footerLabel,
  year,
  onFooterNavClick,
  settledRef,
  finePointerRef,
  setHoverIfSettled,
  clearHover,
}) {
  const { progress: sceneProgress } = useSceneContext()
  const lenisRef = useLenisRef()
  const headingRef = useRef(null)
  const gridWrapRef = useRef(null)
  const ctaRef = useRef(null)
  const mobileCtaRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const isWide = useRef(false)

  useEffect(() => {
    const checkWide = () => {
      isWide.current = window.innerWidth >= 768
    }
    checkWide()
    window.addEventListener('resize', checkWide)
    return () => window.removeEventListener('resize', checkWide)
  }, [])

  useEffect(() => {
    const update = () => {
      const headingTop = headingRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY
      const p = featuredProgress(sceneProgress, headingTop, window.innerHeight)
      setProgress(p)

      // Imperatively drive final-phase transforms to avoid per-frame re-renders
      const gridWrap = gridWrapRef.current
      const cta = ctaRef.current
      if (!gridWrap || !cta) return

      if (isWide.current) {
        const tGrid = easeOutGrid(rangeProgress(p, CTA_START, CTA_END))
        const t = easeOutQuint(rangeProgress(p, CTA_START, CTA_END))
        gridWrap.style.transform = `translateX(${-115 * tGrid}px)`
        cta.style.opacity = String(t)
        cta.style.transform = `translateX(${52 * (1 - t)}px)`
      } else {
        gridWrap.style.transform = ''
        cta.style.opacity = '0'
        cta.style.transform = ''
        const mobileCta = mobileCtaRef.current
        if (mobileCta) {
          const t = easeOutCubic(rangeProgress(p, CTA_START, CTA_END))
          mobileCta.style.opacity = String(t)
          mobileCta.style.transform = `translateY(${10 * (1 - t)}px)`
        }
      }
    }

    update()

    let detachLenis = () => {}
    const attachLenis = () => {
      const lenis = lenisRef?.current
      if (!lenis) return false
      lenis.on('scroll', update)
      detachLenis = () => lenis.off('scroll', update)
      return true
    }

    const raf = requestAnimationFrame(() => {
      if (!attachLenis()) {
        window.addEventListener('scroll', update, { passive: true })
        detachLenis = () => window.removeEventListener('scroll', update)
      }
      update()
    })

    window.addEventListener('resize', update)

    return () => {
      cancelAnimationFrame(raf)
      detachLenis()
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [sceneProgress, lenisRef])

  // Auto-pulse CTA every ~10s
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const INTERVAL = 5_000
    const HOLD = 700

    const play = () => {
      const stage = gridWrapRef.current?.closest('.featured-stage')
      if (!stage) return
      const links = stage.querySelectorAll('.featured-cta-link')
      links.forEach((el) => {
        el.classList.add('is-playing')
        setTimeout(() => el.classList.remove('is-playing'), HOLD)
      })
    }

    const id = setInterval(play, INTERVAL)
    return () => clearInterval(id)
  }, [])

  return (
    <section
      id="featured"
      className="featured-stage flex h-full flex-col overflow-x-clip bg-canvas text-ink"
      aria-labelledby="featured-heading"
    >
      <h2
        ref={headingRef}
        id="featured-heading"
        className="font-display font-normal text-center text-ink leading-[1.1] pt-16 md:pt-24 pb-12 md:pb-[5rem] text-[clamp(3.25rem,5.5vw,5.75rem)]"
      >
        Featured
      </h2>

      {/* Desktop: row with grid + CTA side by side. Mobile: grid stacked, CTA below. */}
      <div className="flex min-h-0 flex-1 flex-col items-center px-6 pt-0 -translate-y-5 md:-translate-y-6 md:px-12">
        {/* Outer row — centers the [grid + CTA] pair on desktop */}
        <div className="relative flex items-center justify-center">
          {/* Photo group — shifts left on desktop final phase */}
          <div ref={gridWrapRef} style={{ willChange: 'transform' }}>
            <ul
              className="featured-grid gallery-protected"
              onMouseLeave={clearHover}
              {...protectedGalleryHandlers}
            >
              {items.map((item, index) => (
                <li key={item.id} className="featured-item">
                  <FeaturedPrint
                    index={index}
                    progress={progress}
                    settledRef={settledRef}
                    finePointerRef={finePointerRef}
                  >
                    <Link
                      to={item.to}
                      className="focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ink"
                      aria-label={item.title}
                      onClick={(e) => {
                        if (finePointerRef.current && !settledRef.current[index]) {
                          e.preventDefault()
                        }
                      }}
                      onMouseEnter={() => setHoverIfSettled(item.id, index)}
                      onFocus={() => setHoverIfSettled(item.id, index)}
                      onBlur={clearHover}
                    >
                      <ProtectedImage
                        src={item.image}
                        alt={item.alt}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    </Link>
                  </FeaturedPrint>
                </li>
              ))}
            </ul>

            {/* Mobile CTA — below the grid, right-aligned */}
            <div
              ref={mobileCtaRef}
              className="featured-cta-mobile md:hidden mt-6 flex justify-end"
            >
              <Link
                to="/work"
                aria-label="View all work"
                tabIndex={-1}
                className="featured-cta-link font-mono font-light text-[13px] tracking-[0.08em] uppercase text-ink/70"
              >
                <BarrelRollLabel text="View all work" />{' '}
                <span className="featured-cta-arrow">→</span>
              </Link>
            </div>
          </div>

          {/* Desktop CTA — absolutely positioned to the right of the group */}
          <div
            ref={ctaRef}
            className="featured-cta-desktop hidden md:flex absolute left-full ml-[24px] items-center"
            style={{ opacity: 0, willChange: 'transform, opacity' }}
          >
            <Link
              to="/work"
              aria-label="View all work"
              className="featured-cta-link font-mono font-light text-[13px] tracking-[0.08em] uppercase text-ink/70 whitespace-nowrap"
            >
              <BarrelRollLabel text="View all work" />{' '}
              <span className="featured-cta-arrow">→</span>
            </Link>
          </div>
        </div>
      </div>

      <FeaturedFooter
        footerLabel={footerLabel}
        year={year}
        onFooterNavClick={onFooterNavClick}
      />
    </section>
  )
}

export default function Featured({ items = featuredWork }) {
  const [hoveredId, setHoveredId] = useState(null)
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window === 'undefined' ? false : prefersReducedMotion(),
  )
  const onFooterNavClick = useFooterNavClick()
  const settledRef = useRef([false, false, false])
  const finePointerRef = useRef(false)

  const hovered = items.find((item) => item.id === hoveredId)
  const footerLabel = hovered?.footerLabel ?? DEFAULT_FOOTER_LABEL
  const year = new Date().getFullYear()

  const clearHover = () => setHoveredId(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    finePointerRef.current = canFinePointer()
    const onResize = () => { finePointerRef.current = canFinePointer() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const setHoverIfSettled = (id, index) => {
    if (!finePointerRef.current) return
    if (!settledRef.current[index]) return
    setHoveredId(id)
  }

  if (reducedMotion) {
    return (
      <section
        id="featured"
        className="relative z-10 flex min-h-[100svh] flex-col bg-canvas text-ink"
        aria-labelledby="featured-heading"
      >
        <h2
          id="featured-heading"
          className="font-display font-normal text-center text-ink leading-[1.1] pt-16 md:pt-24 pb-12 md:pb-[5rem] text-[clamp(3.25rem,5.5vw,5.75rem)]"
        >
          Featured
        </h2>
        <div className="px-6 md:px-12 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            <ul className="featured-grid gallery-protected" {...protectedGalleryHandlers}>
              {items.map((item) => (
                <li key={item.id} className="featured-item">
                  <div className="featured-print">
                    <Link to={item.to} aria-label={item.title}>
                      <ProtectedImage src={item.image} alt={item.alt} loading="lazy" decoding="async" draggable={false} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop CTA visible flat in reduced-motion */}
            <div className="hidden md:flex absolute left-full ml-[24px] items-center">
              <Link to="/work" aria-label="View all work" className="featured-cta-link font-mono font-light text-[13px] tracking-[0.08em] uppercase text-ink/70 whitespace-nowrap">
                <BarrelRollLabel text="View all work" />{' '}
                <span className="featured-cta-arrow">→</span>
              </Link>
            </div>
          </div>
          {/* Mobile CTA */}
          <div className="md:hidden mt-6 flex justify-end w-full max-w-[min(86vw,22rem)]">
            <Link to="/work" aria-label="View all work" className="featured-cta-link font-mono font-light text-[13px] tracking-[0.08em] uppercase text-ink/70">
              <BarrelRollLabel text="View all work" />{' '}
              <span className="featured-cta-arrow">→</span>
            </Link>
          </div>
        </div>
        <FeaturedFooter footerLabel={footerLabel} year={year} onFooterNavClick={onFooterNavClick} />
      </section>
    )
  }

  return (
    <Scene
      duration={`${CHAPTER_SVH}svh`}
      className="relative z-10 bg-canvas text-ink"
      style={{ overflow: 'visible' }}
    >
      <FeaturedStage
        items={items}
        footerLabel={footerLabel}
        year={year}
        onFooterNavClick={onFooterNavClick}
        settledRef={settledRef}
        finePointerRef={finePointerRef}
        setHoverIfSettled={setHoverIfSettled}
        clearHover={clearHover}
      />
    </Scene>
  )
}
