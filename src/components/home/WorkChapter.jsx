import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLenisRef } from '../../context/LenisContext'
import { useSalienceHandoff } from '../../context/SalienceHandoffContext'
import { homeWorkCategories } from '../../data/galleries'
import { apertureCloseFromChapter, APERTURE_CLOSE_END } from './ApertureIris'
import {
  ENTER_SCROLL_SVH,
  enterAllowsInteraction,
  enterStartIntoWorkPx,
} from './workEnter'
import { blindCloseTotalMs } from './workBlind'
import WorkRows from './WorkRows'

/** Pull Work under the last stretch of Salience so assemble happens over black. */
const OVERLAP_SVH = 220
/**
 * Fully-open browse window after scroll-scrubbed assemble — and after the
 * overlap pin is consumed, so blinds aren’t followed by a long black sticky tail.
 */
const WORK_EXPLORE_SVH = 20
/** Scroll distance after explore used for blinds 0→1 */
const BLIND_SCROLL_SVH = 55
/**
 * Chapter height. Enter scrub uses absolute scrolledIntoWork after close+hold;
 * explore + blinds follow once assemble is complete and past overlap.
 */
const CHAPTER_SVH = OVERLAP_SVH + WORK_EXPLORE_SVH + BLIND_SCROLL_SVH + 100

/** Nav / hash target: past overlap so rows are fully assembled. */
const NAV_OFFSET_SVH = OVERLAP_SVH

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / Math.max(edge1 - edge0, 1e-6))
  return t * t * (3 - 2 * t)
}

/** Live Salience handoff from DOM — same math as SalienceSection, no React lag. */
function readSalienceHandoff() {
  const el = document.getElementById('salience')
  if (!el) {
    return { progress: 1, close: 0, past: true }
  }
  const rect = el.getBoundingClientRect()
  const vh = window.innerHeight
  const range = rect.height - vh
  const progress =
    range <= 0 ? 1 : clamp01(-rect.top / range)
  const close = apertureCloseFromChapter(progress)
  const past = rect.bottom <= 0
  return { progress, close, past }
}

/**
 * Single WorkRows instance for the homepage.
 * Assembles over black via scroll after the aperture releases; owns blinds after.
 */
export default function WorkChapter({ categories = homeWorkCategories }) {
  const chapterRef = useRef(null)
  const hitRef = useRef(null)
  const lenisRef = useLenisRef()
  const navigate = useNavigate()
  const { irisReleased } = useSalienceHandoff()

  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window === 'undefined' ? false : prefersReducedMotion(),
  )
  const [blindProgress, setBlindProgress] = useState(0)
  const [enterProgress, setEnterProgress] = useState(0)
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [clickDriving, setClickDriving] = useState(false)

  const scrollProgressRef = useRef(0)
  const clickDrivingRef = useRef(false)
  const workInteractiveRef = useRef(false)
  const enterProgressRef = useRef(0)
  const rafClickRef = useRef(0)
  const navTimerRef = useRef(0)
  /** Document scrollY when assemble finished + past overlap — explore starts. */
  const exploreOriginYRef = useRef(null)
  /** Stable blind scrub span in px, captured at explore start. */
  const blindSpanPxRef = useRef(0)

  /** Only click-nav locks rows; handoff unlock is imperative pointer-events. */
  const rowsLocked = clickDriving

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    clickDrivingRef.current = clickDriving
  }, [clickDriving])

  /**
   * Scroll-scrub enter + explore + blinds from live layout.
   * Enter is an absolute function of scrolledIntoWork (reversible, no origin capture).
   */
  useEffect(() => {
    if (reducedMotion) {
      enterProgressRef.current = 1
      setEnterProgress(1)
      workInteractiveRef.current = true
      if (hitRef.current) hitRef.current.classList.add('is-live')
      return
    }

    const chapter = chapterRef.current
    if (!chapter) return

    const readScrollY = () => {
      const lenis = lenisRef?.current
      if (lenis && typeof lenis.scroll === 'number') return lenis.scroll
      return window.scrollY || document.documentElement.scrollTop || 0
    }

    const applyHitTesting = (interactive) => {
      workInteractiveRef.current = interactive
      const hit = hitRef.current
      if (!hit) return
      hit.classList.toggle(
        'is-live',
        interactive && !clickDrivingRef.current,
      )
    }

    const applyEnter = (next) => {
      const p = clamp01(next)
      if (Math.abs(p - enterProgressRef.current) > 0.0004) {
        enterProgressRef.current = p
        setEnterProgress(p)
      } else {
        enterProgressRef.current = p
      }
      return p
    }

    const update = () => {
      const { progress, close, past } = readSalienceHandoff()
      const vh = window.innerHeight
      const enterSpanPx = Math.max((ENTER_SCROLL_SVH / 100) * vh, 1)

      const rect = chapter.getBoundingClientRect()
      const range = rect.height - vh
      const scrolledIntoWork = Math.max(0, -rect.top)
      const sal = document.getElementById('salience')
      const enterStart = enterStartIntoWorkPx(sal, OVERLAP_SVH, vh)

      // Absolute scrub — same mapping scrolling down or back up.
      let enterP
      if (past) {
        enterP = applyEnter(1)
      } else if (close < 1 && progress < APERTURE_CLOSE_END) {
        enterP = applyEnter(0)
      } else {
        enterP = applyEnter((scrolledIntoWork - enterStart) / enterSpanPx)
      }

      const assembled = enterAllowsInteraction(enterP)
      applyHitTesting(past || assembled)

      if (clickDrivingRef.current) return

      const scrollY = readScrollY()

      if (range <= 0) {
        scrollProgressRef.current = 1
        setBlindProgress(1)
        return
      }

      const assembleDone = enterP >= 0.999 || past
      if (!assembleDone) {
        exploreOriginYRef.current = null
        blindSpanPxRef.current = 0
        if (scrollProgressRef.current !== 0) {
          scrollProgressRef.current = 0
          setBlindProgress(0)
        }
        return
      }

      const overlapPx = (OVERLAP_SVH / 100) * vh
      const pastOverlap = scrolledIntoWork >= overlapPx - 1
      if (!pastOverlap) {
        exploreOriginYRef.current = null
        blindSpanPxRef.current = 0
        if (scrollProgressRef.current !== 0) {
          scrollProgressRef.current = 0
          setBlindProgress(0)
        }
        return
      }

      const explorePx = (WORK_EXPLORE_SVH / 100) * vh

      if (exploreOriginYRef.current == null) {
        exploreOriginYRef.current = scrollY
        blindSpanPxRef.current = (BLIND_SCROLL_SVH / 100) * vh
      }

      const traveled = Math.max(0, scrollY - exploreOriginYRef.current)
      const blindSpan = Math.max(blindSpanPxRef.current, 1)
      const p =
        traveled <= explorePx
          ? 0
          : clamp01((traveled - explorePx) / blindSpan)

      scrollProgressRef.current = p
      setBlindProgress(p)
    }

    // Continuous RAF keeps Lenis + layout in lockstep (smoother than scroll events alone).
    let raf = 0
    const tick = () => {
      update()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    let detachLenis = () => {}
    const attachLenis = () => {
      const lenis = lenisRef?.current
      if (!lenis) return false
      lenis.on('scroll', update)
      detachLenis = () => lenis.off('scroll', update)
      return true
    }

    const boot = requestAnimationFrame(() => {
      if (!attachLenis()) {
        window.addEventListener('scroll', update, { passive: true })
        detachLenis = () =>
          window.removeEventListener('scroll', update)
      }
      update()
    })

    window.addEventListener('resize', update)

    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(boot)
      detachLenis()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
    }
  }, [reducedMotion, lenisRef])

  useEffect(
    () => () => {
      if (rafClickRef.current) cancelAnimationFrame(rafClickRef.current)
      if (navTimerRef.current) window.clearTimeout(navTimerRef.current)
    },
    [],
  )

  const selectCategory = (categoryId) => {
    if (clickDrivingRef.current || !workInteractiveRef.current) return
    const cat = categories.find((c) => c.id === categoryId)
    if (!cat?.destination) return

    const destination = cat.destination
    setSelectedCategoryId(categoryId)
    setClickDriving(true)
    clickDrivingRef.current = true
    if (hitRef.current) hitRef.current.classList.remove('is-live')

    const from = clamp01(scrollProgressRef.current)
    const duration = reducedMotion
      ? 0
      : Math.max(blindCloseTotalMs(categories.length) * (1 - from), 0)

    const finish = () => {
      if (rafClickRef.current) {
        cancelAnimationFrame(rafClickRef.current)
        rafClickRef.current = 0
      }
      if (navTimerRef.current) {
        window.clearTimeout(navTimerRef.current)
        navTimerRef.current = 0
      }
      setBlindProgress(1)
      navigate(destination)
    }

    if (duration < 16) {
      finish()
      return
    }

    navTimerRef.current = window.setTimeout(finish, duration)

    const start = performance.now()
    const tick = (now) => {
      const t = clamp01((now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setBlindProgress(from + (1 - from) * eased)
      if (t < 1) rafClickRef.current = requestAnimationFrame(tick)
    }
    rafClickRef.current = requestAnimationFrame(tick)
  }

  if (reducedMotion) {
    return (
      <section
        id="work"
        data-nav-scroll-offset-svh="0"
        className="relative z-10 bg-canvas text-ink"
        aria-label="Selected work"
      >
        <WorkRows
          categories={categories}
          id={null}
          selectedCategoryId={selectedCategoryId}
          locked={Boolean(selectedCategoryId)}
          blindProgress={selectedCategoryId ? 1 : 0}
          enterProgress={1}
          onSelectCategory={selectCategory}
        />
      </section>
    )
  }

  // Blinds stay above Spatial; veil holds until late close so the field
  // doesn’t show through the slats. Yield hit-testing when blinds finish.
  const yieldToSpatial = !clickDriving && blindProgress >= 0.98
  const stageVeil = clickDriving
    ? 1
    : 1 - smoothstep(0.62, 0.9, blindProgress)

  return (
    <section
      id="work"
      ref={chapterRef}
      className={`relative text-ink ${
        yieldToSpatial ? 'z-0 pointer-events-none' : 'z-30'
      }`}
      style={{
        marginTop: `-${OVERLAP_SVH}svh`,
        height: `${CHAPTER_SVH}svh`,
      }}
      data-nav-scroll-offset-svh={NAV_OFFSET_SVH}
      data-blind-progress={blindProgress.toFixed(4)}
      data-enter-progress={enterProgress.toFixed(4)}
      data-iris-released={irisReleased ? '1' : '0'}
      data-work-handoff={clickDriving ? 'hold' : 'scroll'}
      aria-label="Selected work"
    >
      <div className="sticky top-0 z-10 h-[100svh] overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-canvas"
          style={{ opacity: stageVeil }}
          aria-hidden
        />
        <div
          ref={hitRef}
          className="work-hit absolute inset-0 z-10"
        >
          <WorkRows
            categories={categories}
            id={null}
            fill
            locked={rowsLocked}
            selectedCategoryId={selectedCategoryId}
            blindProgress={blindProgress}
            enterProgress={enterProgress}
            onSelectCategory={selectCategory}
          />
        </div>

        {/* Click path only — hold a full veil until route change. */}
        <div
          className="pointer-events-none absolute inset-0 z-20 bg-canvas"
          style={{
            opacity: clickDriving
              ? blindProgress >= 0.94
                ? clamp01((blindProgress - 0.94) / 0.06)
                : 0
              : 0,
          }}
          aria-hidden
        />
      </div>
    </section>
  )
}
