import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { flushSync } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ProtectedImage from '../ProtectedImage'
import BarrelRollLabel from '../BarrelRollLabel'
import BlindExitLink from '../BlindExitLink'
import WorkImageLightbox from './WorkImageLightbox'
import { scrollToTop, useLenisRef } from '../../context/LenisContext'
import { getWorkCategoryPage } from '../../data/workCategories'
import { protectedGalleryHandlers } from '../../utils/imageProtection'

const GAP = 20
const ROW2_OFFSET = 60
const ROW_GAP = 28
const MOBILE_IMAGE_SCALE = {
  landscape: 1,
  square: 0.9,
  portrait: 0.74,
}
const GUTTER_VW = 8
const ACTIVATION_RATIO = 0.5
const UNDERLINE_MS = 380
const BOUNDARY_START = 0.06
const BOUNDARY_END = 0.94
const WHEEL_GAIN = 0.62
const SCROLL_LERP = 0.09
const KEYBOARD_SCROLL_RATIO = 0.2
const TOUCH_DRAG_THRESHOLD = 8
const TOUCH_VELOCITY_WINDOW_MS = 100
const TOUCH_MOMENTUM_MIN_VELOCITY = 0.12
const TOUCH_MOMENTUM_PROJECTION_MS = 220
const TOUCH_MOMENTUM_MAX_RATIO = 0.4
const TOUCH_MOMENTUM_MAX_DISTANCE = 360
const ABOUT_EXIT_MS = 360
const INITIAL_EDGE_COUNT = 12
const SECTION_GAP = GAP
const decodedSources = new Set()
const preloadPromises = new Map()

const SIZE = {
  landscape: { w: 240, h: 160 },
  portrait: { w: 120, h: 180 },
  square: { w: 200, h: 200 },
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function shouldIgnoreGalleryKey(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) {
    return true
  }
  if (!(event.target instanceof Element)) return false
  return Boolean(
    event.target.closest(
      'input, textarea, select, button, a, summary, [contenteditable], [role="button"], [role="link"], [role="textbox"], [role="combobox"], [role="listbox"], [role="menuitem"], [role="option"], [role="slider"], [role="spinbutton"], [role="switch"], [role="checkbox"], [role="radio"]',
    ),
  )
}

function useMatchMedia(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const sync = () => setMatches(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [query])
  return matches
}

function useAboutBoundaryExit(categoryId) {
  const navigate = useNavigate()
  const exitRef = useRef({
    running: false,
    navigated: false,
    layout: null,
    onAnimationEnd: null,
    timer: 0,
  })

  const clearPendingExit = useCallback(() => {
    const exit = exitRef.current
    window.clearTimeout(exit.timer)
    if (exit.layout && exit.onAnimationEnd) {
      exit.layout.removeEventListener('animationend', exit.onAnimationEnd)
    }
    exit.layout?.classList.remove('is-exiting-to-about')
  }, [])

  useEffect(() => clearPendingExit, [clearPendingExit])

  return useCallback((nav) => {
    if (categoryId !== 'spaces' || nav?.to !== '/about') return false

    const exit = exitRef.current
    if (exit.running) return true
    exit.running = true

    const layout = document.querySelector('.work-category-layout')
    if (!layout || prefersReducedMotion()) {
      exit.navigated = true
      navigate(nav.to)
      return true
    }

    const finish = () => {
      if (exit.navigated) return
      exit.navigated = true
      window.clearTimeout(exit.timer)
      layout.removeEventListener('animationend', exit.onAnimationEnd)
      navigate(nav.to)
    }
    const onAnimationEnd = (event) => {
      if (
        event.target === layout &&
        event.animationName === 'work-about-boundary-out'
      ) {
        finish()
      }
    }

    exit.layout = layout
    exit.onAnimationEnd = onAnimationEnd
    layout.addEventListener('animationend', onAnimationEnd)
    layout.classList.add('is-exiting-to-about')
    exit.timer = window.setTimeout(finish, ABOUT_EXIT_MS + 100)
    return true
  }, [categoryId, navigate])
}

function orientationFromImage(nw, nh) {
  if (nh > nw * 1.08) return 'portrait'
  if (Math.abs(nw - nh) < nw * 0.08) return 'square'
  return 'landscape'
}

function imageLayout(image) {
  const orientation = orientationFromImage(image.width, image.height)
  const bounds = SIZE[orientation]
  if (!image.width || !image.height) return bounds

  const scale = Math.min(bounds.w / image.width, bounds.h / image.height)
  return {
    w: image.width * scale,
    h: image.height * scale,
  }
}

function preloadImage(image) {
  if (!image?.src || typeof Image === 'undefined') return Promise.resolve()
  if (decodedSources.has(image.src)) return Promise.resolve()
  if (preloadPromises.has(image.src)) return preloadPromises.get(image.src)

  const promise = new Promise((resolve) => {
    const preload = new Image()
    preload.decoding = 'async'
    preload.onload = async () => {
      try {
        await preload.decode()
        decodedSources.add(image.src)
      } catch {
        // The mounted image can still retry decoding before reveal.
      }
      resolve()
    }
    preload.onerror = resolve
    preload.src = image.src
  })

  preloadPromises.set(image.src, promise)
  return promise
}

function categoryEdgeImages(category, edge) {
  if (!category) return []
  const images = category.sections.flatMap((section) => section.images)
  return edge === 'end'
    ? images.slice(-INITIAL_EDGE_COUNT)
    : images.slice(0, INITIAL_EDGE_COUNT)
}

function sectionGapForViewport() {
  return SECTION_GAP
}

function appendWidth(currentWidth, imageWidth) {
  return currentWidth === 0 ? imageWidth : currentWidth + GAP + imageWidth
}

/** Balance each section by projected rendered width without changing row order. */
function balanceSection(section) {
  const row1 = []
  const row2 = []
  let row1Width = 0
  let row2Width = 0

  section.images.forEach((image) => {
    const { w, h } = imageLayout(image)
    const laidOutImage = { ...image, layoutWidth: w, layoutHeight: h }
    const projectedRow1 = appendWidth(row1Width, w)
    const projectedRow2 = appendWidth(row2Width, w)
    const addToRow1 =
      Math.abs(projectedRow1 - row2Width) <=
      Math.abs(row1Width - projectedRow2)

    if (addToRow1) {
      row1.push(laidOutImage)
      row1Width = projectedRow1
    } else {
      row2.push(laidOutImage)
      row2Width = projectedRow2
    }
  })

  return {
    ...section,
    row1,
    row2,
    row1Width,
    row2Width,
  }
}

/** Build stable, content-sized subsection blocks from intrinsic image metadata. */
function buildTrack(sections, sectionGap) {
  const starts = {}
  const positionedBySrc = new Map()
  let row1Cursor = GAP
  let row2Cursor = GAP + ROW2_OFFSET

  const layoutSections = sections.map((section, sectionIndex) => {
    const balanced = balanceSection(section)
    const row1Start = row1Cursor
    const row2Start = row2Cursor
    starts[section.id] = Math.min(row1Start, row2Start)

    let row1X = row1Start
    const row1 = balanced.row1.map((image) => {
      const positioned = { ...image, sectionId: section.id, trackX: row1X }
      positionedBySrc.set(image.src, positioned)
      row1X += image.layoutWidth + GAP
      return positioned
    })

    let row2X = row2Start
    const row2 = balanced.row2.map((image) => {
      const positioned = { ...image, sectionId: section.id, trackX: row2X }
      positionedBySrc.set(image.src, positioned)
      row2X += image.layoutWidth + GAP
      return positioned
    })

    const positioned = { ...balanced, row1, row2, row1Start, row2Start }
    row1Cursor += balanced.row1Width
    row2Cursor += balanced.row2Width
    if (sectionIndex < sections.length - 1) {
      row1Cursor += sectionGap
      row2Cursor += sectionGap
    }
    return positioned
  })

  const flat = sections.flatMap((section) =>
    section.images.map((image) => positionedBySrc.get(image.src)),
  )

  return {
    flat,
    layoutSections,
    starts,
    width: Math.max(row1Cursor, row2Cursor),
  }
}

function buildMobileColumns(images) {
  const columns = [[], []]
  const projectedHeights = [0, 0]

  images.forEach((image) => {
    const aspectRatio =
      image.width && image.height ? image.width / image.height : 1
    const widthScale =
      aspectRatio > 1.15
        ? MOBILE_IMAGE_SCALE.landscape
        : aspectRatio >= 0.85
          ? MOBILE_IMAGE_SCALE.square
          : MOBILE_IMAGE_SCALE.portrait
    const columnIndex =
      projectedHeights[0] <= projectedHeights[1] ? 0 : 1
    columns[columnIndex].push({ ...image, mobileWidthScale: widthScale })
    projectedHeights[columnIndex] +=
      image.width && image.height
        ? widthScale * (image.height / image.width)
        : widthScale
  })

  return columns
}

function openImageFromKeyboard(event, image, onInspect) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  onInspect(image, event.currentTarget)
}

function GalleryImage({ image, requested, priority, onInspect }) {
  const mountedRef = useRef(true)
  const revealTimerRef = useRef(0)
  const [ready, setReady] = useState(() => decodedSources.has(image.src))

  useEffect(() => {
    if (requested && decodedSources.has(image.src)) setReady(true)
  }, [image.src, requested])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      window.clearTimeout(revealTimerRef.current)
    }
  }, [])

  const handleLoad = async (event) => {
    const node = event.currentTarget
    const reveal = () => {
      decodedSources.add(image.src)
      if (mountedRef.current) setReady(true)
    }

    revealTimerRef.current = window.setTimeout(reveal, 120)
    try {
      await node.decode()
    } catch {
      // A completed load is still safe to reveal if decode() is unavailable.
    }
    window.clearTimeout(revealTimerRef.current)
    reveal()
  }

  return (
    <ProtectedImage
      src={requested ? image.src : undefined}
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading={requested ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      draggable={false}
      role="button"
      tabIndex={requested && ready ? 0 : -1}
      aria-label={`Inspect photograph: ${image.alt}`}
      aria-haspopup="dialog"
      onClick={(event) => {
        if (requested && ready) onInspect(image, event.currentTarget)
      }}
      onKeyDown={(event) => openImageFromKeyboard(event, image, onInspect)}
      onLoad={handleLoad}
      className={`work-gallery-img work-gallery-inspectable block max-w-none shrink-0 object-contain${
        requested && ready ? ' is-ready' : ''
      }`}
      style={{ width: image.layoutWidth, height: image.layoutHeight }}
      {...protectedGalleryHandlers}
    />
  )
}

function CategoryNavArrow({ dir, nav, visible, onNavigate }) {
  if (!nav) return null
  const isPrev = dir === 'prev'
  const label = isPrev ? `← ${nav.label}` : `${nav.label} →`
  const rollText = isPrev ? nav.label : nav.label

  return (
    <div
      className={`work-gallery-chapter-nav work-gallery-chapter-nav--${dir}${
        visible ? ' is-visible' : ''
      }`}
      aria-hidden={!visible}
    >
      <a
        href={nav.to}
        onClick={(event) => {
          event.preventDefault()
          onNavigate(nav, dir)
        }}
        aria-label={label}
        tabIndex={visible ? undefined : -1}
        className="featured-cta-link font-mono font-light text-[13px] tracking-[0.08em] uppercase whitespace-nowrap"
      >
        {isPrev ? (
          <>
            <span className="featured-cta-arrow featured-cta-arrow--previous inline-block">
              ←
            </span>{' '}
            <BarrelRollLabel text={rollText} />
          </>
        ) : (
          <>
            <BarrelRollLabel text={rollText} />{' '}
            <span className="featured-cta-arrow">→</span>
          </>
        )}
      </a>
    </div>
  )
}

function SubcategoryNav({ sections, activeId, onSelect, flow = false }) {
  const labelsRef = useRef(null)
  const labelRefs = useRef({})
  const underlineRef = useRef(null)

  const placeUnderline = useCallback(() => {
    const container = labelsRef.current
    const underline = underlineRef.current
    const activeEl = labelRefs.current[activeId]
    if (!container || !underline || !activeEl) return
    const containerRect = container.getBoundingClientRect()
    const elRect = activeEl.getBoundingClientRect()
    underline.style.width = `${elRect.width}px`
    underline.style.left = `${elRect.left - containerRect.left}px`
  }, [activeId])

  useEffect(() => {
    placeUnderline()
    const container = labelsRef.current
    if (!container) return
    const ro = new ResizeObserver(placeUnderline)
    ro.observe(container)
    window.addEventListener('resize', placeUnderline)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', placeUnderline)
    }
  }, [placeUnderline, sections])

  return (
    <nav
      className={`work-gallery-subnav${
        flow ? ' work-gallery-subnav--flow' : ''
      }`}
      aria-label="Subcategory navigation"
    >
      <div ref={labelsRef} className="relative inline-flex items-center gap-8 md:gap-4 pb-2">
        {sections.map((section) => (
          <button
            key={section.id}
            ref={(el) => {
              labelRefs.current[section.id] = el
            }}
            type="button"
            onClick={() => onSelect(section.id)}
            className={`font-mono font-light text-[11px] md:text-xs tracking-[0.14em] uppercase transition-colors duration-300 ${
              activeId === section.id
                ? 'text-ink/95'
                : 'text-ink/55 dark:text-ink/45 hover:text-ink/70'
            }`}
          >
            {section.label}
          </button>
        ))}
        <span
          ref={underlineRef}
          className="work-gallery-subnav-underline"
          style={{ transitionDuration: `${UNDERLINE_MS}ms` }}
          aria-hidden="true"
        />
      </div>
    </nav>
  )
}

function WorkCategoryGalleryScroll({
  category,
  reduced = false,
  onInspect,
  onExitToAbout,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const lenisRef = useLenisRef()
  const viewportRef = useRef(null)
  const trackRef = useRef(null)
  const maxScrollRef = useRef(0)
  const sectionStartsRef = useRef({})
  const translateRef = useRef(0)
  const targetRef = useRef(0)
  const rafRef = useRef(0)
  const categoryTransitionRef = useRef(false)
  const touchDragRef = useRef(null)
  const touchMomentumRef = useRef(false)
  const suppressTouchClickRef = useRef(false)
  const suppressTouchClickTimerRef = useRef(0)
  const initialEndPendingRef = useRef(
    location.state?.initialGalleryPosition === 'end',
  )

  const startsAtEnd = location.state?.initialGalleryPosition === 'end'
  const firstSectionId = category.sections[0]?.id ?? null
  const lastSectionId = category.sections.at(-1)?.id ?? null
  const [layoutViewportWidth, setLayoutViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  )
  const sectionGap = sectionGapForViewport(layoutViewportWidth)

  const { flat, layoutSections, starts, width: trackWidth } = useMemo(
    () => buildTrack(category.sections, sectionGap),
    [category.sections, sectionGap],
  )
  const initialEdgeSources = useMemo(() => {
    const edgeImages = startsAtEnd
      ? flat.slice(-INITIAL_EDGE_COUNT)
      : flat.slice(0, INITIAL_EDGE_COUNT)
    return new Set(edgeImages.map((image) => image.src))
  }, [flat, startsAtEnd])
  const requestedSourcesRef = useRef(initialEdgeSources)
  const prioritySourcesRef = useRef(initialEdgeSources)

  const [translateX, setTranslateX] = useState(0)
  const [footerH, setFooterH] = useState(72)
  const [requestedSources, setRequestedSources] = useState(initialEdgeSources)
  const [activeSection, setActiveSection] = useState(
    startsAtEnd ? lastSectionId : firstSectionId,
  )

  const progress =
    maxScrollRef.current > 0 ? translateX / maxScrollRef.current : 0

  const requestNearby = useCallback((position) => {
    const viewportWidth = viewportRef.current?.clientWidth
    if (!viewportWidth) return

    const rangeStart = Math.max(0, position - viewportWidth)
    const rangeEnd = position + viewportWidth * 2
    let nextSources = null

    flat.forEach((image) => {
      const imageEnd = image.trackX + image.layoutWidth
      if (imageEnd < rangeStart || image.trackX > rangeEnd) return
      if (requestedSourcesRef.current.has(image.src)) return
      if (!nextSources) nextSources = new Set(requestedSourcesRef.current)
      nextSources.add(image.src)
    })

    if (!nextSources) return
    requestedSourcesRef.current = nextSources
    setRequestedSources(nextSources)
  }, [flat])

  const remeasure = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const footer = document.querySelector('footer')
    if (footer) setFooterH(footer.offsetHeight)

    const innerWidth = viewport.clientWidth
    const maxScroll = Math.max(0, trackWidth - innerWidth)
    const previousMax = maxScrollRef.current
    const keepAtEnd =
      initialEndPendingRef.current ||
      (previousMax > 0 &&
        Math.abs(targetRef.current - previousMax) < 0.5 &&
        Math.abs(translateRef.current - previousMax) < 0.5)

    maxScrollRef.current = maxScroll
    sectionStartsRef.current = starts

    if (keepAtEnd) {
      targetRef.current = maxScroll
      translateRef.current = maxScroll
      initialEndPendingRef.current = false
      setActiveSection(lastSectionId)
    } else {
      targetRef.current = Math.min(targetRef.current, maxScroll)
      translateRef.current = Math.min(translateRef.current, maxScroll)
    }

    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${-translateRef.current}px, 0, 0)`
    }
    setTranslateX(translateRef.current)
    requestNearby(translateRef.current)
  }, [lastSectionId, requestNearby, starts, trackWidth])

  useLayoutEffect(() => {
    remeasure()
  }, [remeasure])

  useEffect(() => {
    const adjacentImages = [
      { nav: category.previous, edge: 'end' },
      { nav: category.next, edge: 'start' },
    ].flatMap(({ nav, edge }) => {
      const adjacentId = nav?.to.split('/').pop()
      const adjacentCategory = getWorkCategoryPage(adjacentId)
      return categoryEdgeImages(adjacentCategory, edge)
    })

    adjacentImages.forEach(preloadImage)
  }, [category.next, category.previous])

  useEffect(() => {
    const onResize = () => {
      setLayoutViewportWidth(window.innerWidth)
      remeasure()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [remeasure])

  // Lock vertical scroll + pause Lenis for this route only.
  useEffect(() => {
    const lenis = lenisRef?.current
    lenis?.stop()

    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    return () => {
      lenis?.start()
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [lenisRef])

  // Smooth wheel → horizontal movement (single controller, no page scroll).
  useEffect(() => {
    const clamp = (v) =>
      Math.min(Math.max(v, 0), maxScrollRef.current)

    const tick = () => {
      if (document.documentElement.dataset.workLightboxOpen !== undefined) {
        targetRef.current = translateRef.current
        touchMomentumRef.current = false
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const cur = translateRef.current
      const tgt = targetRef.current
      const next = reduced ? tgt : cur + (tgt - cur) * SCROLL_LERP
      if (Math.abs(tgt - cur) > 0.05) {
        translateRef.current = next
        setTranslateX(next)
        requestNearby(next)
      } else if (cur !== tgt) {
        translateRef.current = tgt
        setTranslateX(tgt)
        requestNearby(tgt)
        touchMomentumRef.current = false
      }

      const viewport = viewportRef.current
      const innerWidth = viewport?.clientWidth ?? window.innerWidth
      const starts = sectionStartsRef.current
      let active = category.sections[0]?.id ?? null
      for (const section of category.sections) {
        const start = starts[section.id] ?? 0
        const activationPoint = Math.min(
          maxScrollRef.current,
          Math.max(0, start - innerWidth * ACTIVATION_RATIO),
        )
        if (translateRef.current >= activationPoint) active = section.id
      }
      setActiveSection(active)

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    const onWheel = (e) => {
      if (
        categoryTransitionRef.current ||
        document.documentElement.dataset.workCategoryTransition ||
        document.documentElement.dataset.workLightboxOpen !== undefined
      ) {
        e.preventDefault()
        return
      }
      if (maxScrollRef.current <= 0) return
      e.preventDefault()
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      if (touchMomentumRef.current) {
        targetRef.current = translateRef.current
        touchMomentumRef.current = false
      }
      targetRef.current = clamp(targetRef.current + delta * WHEEL_GAIN)
      requestNearby(targetRef.current)
    }

    const onKeyDown = (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
      if (
        shouldIgnoreGalleryKey(event) ||
        categoryTransitionRef.current ||
        document.documentElement.dataset.workCategoryTransition ||
        document.documentElement.dataset.workLightboxOpen !== undefined
      ) {
        return
      }
      const viewportWidth = viewportRef.current?.clientWidth
      if (!viewportWidth || maxScrollRef.current <= 0) return
      event.preventDefault()
      const direction = event.key === 'ArrowRight' ? 1 : -1
      if (touchMomentumRef.current) {
        targetRef.current = translateRef.current
        touchMomentumRef.current = false
      }
      targetRef.current = clamp(
        targetRef.current + direction * viewportWidth * KEYBOARD_SCROLL_RATIO,
      )
      requestNearby(targetRef.current)
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [category.sections, reduced, requestNearby])

  const handlePointerDown = useCallback((event) => {
    if (
      event.pointerType !== 'touch' ||
      touchDragRef.current ||
      categoryTransitionRef.current ||
      document.documentElement.dataset.workCategoryTransition ||
      document.documentElement.dataset.workLightboxOpen !== undefined ||
      (event.target instanceof Element &&
        event.target.closest('a, button, input, textarea, select'))
    ) {
      return
    }

    window.clearTimeout(suppressTouchClickTimerRef.current)
    suppressTouchClickRef.current = false
    targetRef.current = translateRef.current
    touchMomentumRef.current = false
    touchDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startProgress: translateRef.current,
      axis: null,
      samples: [{ x: event.clientX, time: event.timeStamp }],
    }
  }, [])

  const handlePointerMove = useCallback((event) => {
    const drag = touchDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (
      categoryTransitionRef.current ||
      document.documentElement.dataset.workCategoryTransition ||
      document.documentElement.dataset.workLightboxOpen !== undefined
    ) {
      touchDragRef.current = null
      return
    }

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY

    if (!drag.axis) {
      if (
        Math.max(Math.abs(deltaX), Math.abs(deltaY)) <
        TOUCH_DRAG_THRESHOLD
      ) {
        return
      }
      drag.axis = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
    }

    if (drag.axis !== 'horizontal') return

    drag.samples.push({ x: event.clientX, time: event.timeStamp })
    drag.samples = drag.samples.filter(
      (sample) => event.timeStamp - sample.time <= TOUCH_VELOCITY_WINDOW_MS,
    )

    const next = Math.min(
      Math.max(drag.startProgress - deltaX, 0),
      maxScrollRef.current,
    )
    targetRef.current = next
    translateRef.current = next
    setTranslateX(next)
    requestNearby(next)
  }, [requestNearby])

  const finishPointerDrag = useCallback((event) => {
    const drag = touchDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    touchDragRef.current = null
    if (event.type !== 'pointerup' || drag.axis !== 'horizontal') return

    drag.samples.push({ x: event.clientX, time: event.timeStamp })
    drag.samples = drag.samples.filter(
      (sample) => event.timeStamp - sample.time <= TOUCH_VELOCITY_WINDOW_MS,
    )
    const firstSample = drag.samples[0]
    const lastSample = drag.samples.at(-1)
    const elapsed = lastSample.time - firstSample.time
    const velocity =
      elapsed > 0 ? -(lastSample.x - firstSample.x) / elapsed : 0

    if (!reduced && Math.abs(velocity) >= TOUCH_MOMENTUM_MIN_VELOCITY) {
      const viewportWidth = viewportRef.current?.clientWidth ?? 0
      const maxProjection = Math.min(
        viewportWidth * TOUCH_MOMENTUM_MAX_RATIO,
        TOUCH_MOMENTUM_MAX_DISTANCE,
      )
      const projection = Math.min(
        Math.max(
          velocity * TOUCH_MOMENTUM_PROJECTION_MS,
          -maxProjection,
        ),
        maxProjection,
      )
      const projectedTarget = Math.min(
        Math.max(translateRef.current + projection, 0),
        maxScrollRef.current,
      )
      if (projectedTarget !== translateRef.current) {
        targetRef.current = projectedTarget
        touchMomentumRef.current = true
        requestNearby(projectedTarget)
      }
    }

    suppressTouchClickRef.current = true
    window.clearTimeout(suppressTouchClickTimerRef.current)
    suppressTouchClickTimerRef.current = window.setTimeout(() => {
      suppressTouchClickRef.current = false
    }, 400)
  }, [reduced, requestNearby])

  useEffect(
    () => () => window.clearTimeout(suppressTouchClickTimerRef.current),
    [],
  )

  const scrollToSection = useCallback((sectionId) => {
    const startX = sectionStartsRef.current[sectionId] ?? 0
    touchMomentumRef.current = false
    targetRef.current = Math.min(
      maxScrollRef.current,
      Math.max(0, startX),
    )
  }, [])

  const navigateCategory = useCallback((nav, dir) => {
    if (
      !nav ||
      categoryTransitionRef.current ||
      document.documentElement.dataset.workCategoryTransition
    ) {
      return
    }
    if (onExitToAbout(nav)) {
      categoryTransitionRef.current = true
      return
    }
    categoryTransitionRef.current = true

    const direction = dir === 'next' ? 'forward' : 'backward'
    const destinationId = nav.to.split('/').pop()
    const destination = getWorkCategoryPage(destinationId)
    categoryEdgeImages(
      destination,
      direction === 'forward' ? 'start' : 'end',
    ).forEach(preloadImage)
    const routeState = {
      categoryTransition: direction,
      initialGalleryPosition: direction === 'forward' ? 'start' : 'end',
    }
    const commitNavigation = () => {
      flushSync(() => navigate(nav.to, { state: routeState }))
    }

    if (
      prefersReducedMotion() ||
      typeof document.startViewTransition !== 'function'
    ) {
      commitNavigation()
      return
    }

    const root = document.documentElement
    root.dataset.workCategoryTransition = direction

    try {
      const transition = document.startViewTransition(commitNavigation)

      transition.finished
        .catch(() => {})
        .finally(() => {
          delete root.dataset.workCategoryTransition
          categoryTransitionRef.current = false
        })
    } catch {
      delete root.dataset.workCategoryTransition
      commitNavigation()
    }
  }, [navigate, onExitToAbout])

  const fitsViewport = maxScrollRef.current <= 0
  const showPrev =
    Boolean(category.previous) && (fitsViewport || progress <= BOUNDARY_START)
  const showNext =
    Boolean(category.next) && (fitsViewport || progress >= BOUNDARY_END)

  return (
    <section
      className={`work-gallery-chapter bg-canvas text-ink flex flex-col overflow-visible pt-14 md:pt-16${
        location.state?.categoryTransition ? ' is-category-arrival' : ''
      }`}
      style={{ height: `calc(100svh - ${footerH}px)` }}
      aria-label={`${category.title} gallery`}
    >
      <h1 className="work-gallery-title font-display text-center text-ink shrink-0 pt-4 md:pt-6 pb-4 md:pb-6">
        {category.title}
      </h1>

      <div
        ref={viewportRef}
        className="work-gallery-viewport relative flex flex-1 min-h-0 items-center overflow-visible py-2"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
        onClickCapture={(event) => {
          if (
            !suppressTouchClickRef.current ||
            !(event.target instanceof Element) ||
            !event.target.closest('.work-gallery-inspectable')
          ) {
            return
          }
          suppressTouchClickRef.current = false
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <div className="work-gallery-stage">
          <div
            ref={trackRef}
            className="work-gallery-track flex flex-col will-change-transform"
            style={{
              gap: ROW_GAP,
              paddingLeft: GAP,
              width: trackWidth,
              boxSizing: 'border-box',
              transform: `translate3d(${-translateX}px, 0, 0)`,
            }}
          >
            <div
              className="work-gallery-row flex items-end"
              style={{ gap: sectionGap }}
            >
              {layoutSections.map((section) => (
                <div
                  key={section.id}
                  className="flex shrink-0 items-end"
                  style={{ width: section.row1Width, gap: GAP }}
                >
                  {section.row1.map((img) => (
                    <GalleryImage
                      key={img.src}
                      image={img}
                      requested={requestedSources.has(img.src)}
                      priority={prioritySourcesRef.current.has(img.src)}
                      onInspect={onInspect}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div
              className="work-gallery-row flex items-start"
              style={{ gap: sectionGap, marginLeft: ROW2_OFFSET }}
            >
              {layoutSections.map((section) => (
                <div
                  key={section.id}
                  className="flex shrink-0 items-start"
                  style={{ width: section.row2Width, gap: GAP }}
                >
                  {section.row2.map((img) => (
                    <GalleryImage
                      key={img.src}
                      image={img}
                      requested={requestedSources.has(img.src)}
                      priority={prioritySourcesRef.current.has(img.src)}
                      onInspect={onInspect}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <CategoryNavArrow
          dir="prev"
          nav={category.previous}
          visible={showPrev}
          onNavigate={navigateCategory}
        />
        <CategoryNavArrow
          dir="next"
          nav={category.next}
          visible={showNext}
          onNavigate={navigateCategory}
        />
      </div>

      {category.sections.length > 0 && (
        <SubcategoryNav
          sections={category.sections}
          activeId={activeSection}
          onSelect={scrollToSection}
        />
      )}
    </section>
  )
}

function MobileCategoryLink({ nav, direction, onNavigate }) {
  if (!nav) return null
  const isPrevious = direction === 'previous'

  return (
    <Link
      to={nav.to}
      onClick={(event) => {
        event.preventDefault()
        onNavigate(nav, direction)
      }}
      aria-label={`${isPrevious ? 'Previous' : 'Next'} category: ${nav.label}`}
      className="featured-cta-link inline-flex flex-col items-center gap-1 font-mono font-light text-[13px] tracking-[0.08em] uppercase"
    >
      {isPrevious && <span aria-hidden="true">↑</span>}
      <BarrelRollLabel text={nav.label} />
      {!isPrevious && <span aria-hidden="true">↓</span>}
    </Link>
  )
}

function WorkCategoryGalleryMobile({ category, onInspect, onExitToAbout }) {
  const location = useLocation()
  const navigate = useNavigate()
  const lenisRef = useLenisRef()
  const scrollerRef = useRef(null)
  const sectionRefs = useRef({})
  const categoryTransitionRef = useRef(false)
  const startsAtEnd = location.state?.initialGalleryPosition === 'end'
  const firstSectionId = category.sections[0]?.id ?? null
  const lastSectionId = category.sections.at(-1)?.id ?? null
  const [activeSectionId, setActiveSectionId] = useState(
    startsAtEnd ? lastSectionId : firstSectionId,
  )
  const mobileColumns = useMemo(
    () =>
      buildMobileColumns(
        category.sections.flatMap((section) =>
          section.images.map((image, imageIndex) => ({
            ...image,
            mobileSectionId: section.id,
            mobileSectionStart: imageIndex === 0,
          })),
        ),
      ),
    [category.sections],
  )

  useLayoutEffect(() => {
    const reset = () => {
      scrollToTop(lenisRef?.current, { immediate: true })
      const scroller = scrollerRef.current
      if (!scroller) return
      scroller.scrollTop = startsAtEnd
        ? Math.max(0, scroller.scrollHeight - scroller.clientHeight)
        : 0
    }
    reset()
    const frame = requestAnimationFrame(reset)
    return () => cancelAnimationFrame(frame)
  }, [category.id, lenisRef, startsAtEnd])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const onKeyDown = (event) => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return
      if (
        shouldIgnoreGalleryKey(event) ||
        categoryTransitionRef.current ||
        document.documentElement.dataset.workCategoryTransition ||
        document.documentElement.dataset.workLightboxOpen !== undefined
      ) {
        return
      }
      const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      if (maxScroll <= 0) return
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      scroller.scrollBy({
        top: direction * scroller.clientHeight * KEYBOARD_SCROLL_RATIO,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [category.id])

  const syncActiveSection = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
    let active = firstSectionId
    category.sections.forEach((section) => {
      const sectionElement = sectionRefs.current[section.id]
      if (!sectionElement) return
      const activationPoint = Math.min(
        maxScroll,
        Math.max(0, sectionElement.offsetTop - scroller.clientHeight * 0.5),
      )
      if (scroller.scrollTop >= activationPoint) active = section.id
    })
    setActiveSectionId(active)
  }, [category.sections, firstSectionId])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(syncActiveSection)
    }
    const observer = new ResizeObserver(syncActiveSection)
    observer.observe(scroller)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    syncActiveSection()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      scroller.removeEventListener('scroll', onScroll)
    }
  }, [syncActiveSection])

  const scrollToMobileSection = useCallback((sectionId) => {
    const scroller = scrollerRef.current
    const sectionElement = sectionRefs.current[sectionId]
    if (!scroller || !sectionElement) return
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
    scroller.scrollTo({
      top: Math.min(maxScroll, Math.max(0, sectionElement.offsetTop)),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [])

  const navigateMobileCategory = useCallback((nav, direction) => {
    if (
      !nav ||
      categoryTransitionRef.current ||
      document.documentElement.dataset.workCategoryTransition
    ) {
      return
    }
    if (onExitToAbout(nav)) {
      categoryTransitionRef.current = true
      return
    }
    categoryTransitionRef.current = true

    const transitionDirection =
      direction === 'next' ? 'forward' : 'backward'
    const destinationId = nav.to.split('/').pop()
    const destination = getWorkCategoryPage(destinationId)
    categoryEdgeImages(
      destination,
      transitionDirection === 'forward' ? 'start' : 'end',
    ).forEach(preloadImage)

    const commitNavigation = () => {
      flushSync(() =>
        navigate(nav.to, {
          state: {
            categoryTransition: transitionDirection,
            initialGalleryPosition:
              transitionDirection === 'forward' ? 'start' : 'end',
          },
        }),
      )
    }

    if (
      prefersReducedMotion() ||
      typeof document.startViewTransition !== 'function'
    ) {
      commitNavigation()
      return
    }

    const root = document.documentElement
    root.dataset.workCategoryTransition = transitionDirection

    try {
      const transition = document.startViewTransition(commitNavigation)
      transition.finished
        .catch(() => {})
        .finally(() => {
          delete root.dataset.workCategoryTransition
          categoryTransitionRef.current = false
        })
    } catch {
      delete root.dataset.workCategoryTransition
      commitNavigation()
    }
  }, [navigate, onExitToAbout])

  return (
    <section
      className={`work-gallery-static work-gallery-mobile flex h-full min-h-0 flex-col overflow-hidden bg-canvas pt-[4.5rem] text-ink md:pt-20${
        location.state?.categoryTransition ? ' is-category-arrival' : ''
      }`}
      style={{ paddingInline: 'clamp(16px, 4vw, 28px)' }}
      aria-label={`${category.title} gallery`}
    >
      <h1 className="work-gallery-title shrink-0 pb-2 font-display text-center text-ink">
        {category.title}
      </h1>

      <div className="work-gallery-mobile-viewport relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          className="work-gallery-mobile-scroller h-full overflow-y-auto overflow-x-hidden"
          tabIndex="0"
          data-lenis-prevent
          aria-label={`${category.title} photographs`}
        >
          <div className="work-gallery-mobile-stream">
            {category.previous && (
              <div className="work-gallery-mobile-category-nav work-gallery-mobile-category-nav--previous flex justify-center text-center">
                <MobileCategoryLink
                  nav={category.previous}
                  direction="previous"
                  onNavigate={navigateMobileCategory}
                />
              </div>
            )}

            {mobileColumns.some((column) => column.length) ? (
              <div
                className="flex items-start"
                style={{ gap: 'clamp(12px, 2.5vw, 20px)' }}
              >
                {mobileColumns.map((column, columnIndex) => (
                  <ul
                    key={columnIndex}
                    className="flex min-w-0 flex-1 flex-col"
                    style={{
                      gap: 'clamp(12px, 2vw, 18px)',
                      paddingTop:
                        columnIndex === 1
                          ? 'clamp(28px, 4vh, 52px)'
                          : undefined,
                    }}
                  >
                    {column.map((img) => (
                      <li
                        key={img.src}
                        ref={
                          img.mobileSectionStart
                            ? (element) => {
                                sectionRefs.current[img.mobileSectionId] =
                                  element
                              }
                            : undefined
                        }
                        style={{
                          alignSelf:
                            img.mobileWidthScale === 1
                              ? 'stretch'
                              : columnIndex === 0
                                ? 'flex-end'
                                : 'flex-start',
                          width: `${img.mobileWidthScale * 100}%`,
                        }}
                      >
                        <ProtectedImage
                          src={img.src}
                          alt={img.alt}
                          width={img.width}
                          height={img.height}
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          role="button"
                          tabIndex="0"
                          aria-label={`Inspect photograph: ${img.alt}`}
                          aria-haspopup="dialog"
                          onClick={(event) =>
                            onInspect(img, event.currentTarget)
                          }
                          onKeyDown={(event) =>
                            openImageFromKeyboard(event, img, onInspect)
                          }
                          className="work-gallery-inspectable block h-auto w-full"
                          style={
                            img.width && img.height
                              ? {
                                  aspectRatio: `${img.width} / ${img.height}`,
                                }
                              : undefined
                          }
                          {...protectedGalleryHandlers}
                        />
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            ) : (
              <p className="text-center font-mono text-sm font-light text-ink/30">
                Coming soon
              </p>
            )}

            {category.next && (
              <div className="work-gallery-mobile-category-nav work-gallery-mobile-category-nav--next flex justify-center text-center">
                <MobileCategoryLink
                  nav={category.next}
                  direction="next"
                  onNavigate={navigateMobileCategory}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {category.sections.length > 0 && (
        <div className="work-gallery-mobile-subnav shrink-0 py-1">
          <SubcategoryNav
            sections={category.sections}
            activeId={activeSectionId}
            onSelect={scrollToMobileSection}
            flow
          />
        </div>
      )}
    </section>
  )
}

function WorkCategoryGalleryStatic({ category, onInspect, onExitToAbout }) {
  return (
    <section className="work-gallery-static bg-canvas text-ink min-h-screen section-pad pt-24 md:pt-28 pb-16">
      <h1 className="work-gallery-title font-display text-center text-ink mb-10 md:mb-14">
        {category.title}
      </h1>

      {category.sections.map((section) => (
        <div key={section.id} className="mb-12 md:mb-16 last:mb-0">
          <p className="font-mono font-light text-[11px] tracking-[0.14em] uppercase text-ink/50 mb-6 text-center">
            {section.label}
          </p>
          {section.images.length === 0 ? (
            <p className="text-center text-ink/30 text-sm font-mono font-light">
              Coming soon
            </p>
          ) : (
            <ul className="mx-auto flex max-w-lg flex-col gap-4">
              {section.images.map((img) => (
                <li key={img.src}>
                  <ProtectedImage
                    src={img.src}
                    alt={img.alt}
                    loading="lazy"
                    decoding="async"
                    role="button"
                    tabIndex="0"
                    aria-label={`Inspect photograph: ${img.alt}`}
                    aria-haspopup="dialog"
                    onClick={(event) => onInspect(img, event.currentTarget)}
                    onKeyDown={(event) =>
                      openImageFromKeyboard(event, img, onInspect)
                    }
                    className="work-gallery-inspectable block w-full h-auto object-cover"
                    {...protectedGalleryHandlers}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div className="mt-14 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
        {category.previous && (
          <BlindExitLink
            to={category.previous.to}
            className="featured-cta-link font-mono font-light text-[13px] tracking-[0.08em] uppercase"
          >
            <span className="featured-cta-arrow featured-cta-arrow--previous inline-block">
              ←
            </span>{' '}
            <BarrelRollLabel text={category.previous.label} />
          </BlindExitLink>
        )}
        {category.next &&
          (category.id === 'spaces' && category.next.to === '/about' ? (
            <a
              href={category.next.to}
              onClick={(event) => {
                event.preventDefault()
                onExitToAbout(category.next)
              }}
              className="featured-cta-link font-mono font-light text-[13px] tracking-[0.08em] uppercase"
            >
              <BarrelRollLabel text={category.next.label} />{' '}
              <span className="featured-cta-arrow">→</span>
            </a>
          ) : (
            <BlindExitLink
              to={category.next.to}
              className="featured-cta-link font-mono font-light text-[13px] tracking-[0.08em] uppercase"
            >
              <BarrelRollLabel text={category.next.label} />{' '}
              <span className="featured-cta-arrow">→</span>
            </BlindExitLink>
          ))}
      </div>
    </section>
  )
}

export default function WorkCategoryGallery({ category }) {
  const isMobile = useMatchMedia('(max-width: 768px)')
  const exitToAbout = useAboutBoundaryExit(category.id)
  const [inspectedImage, setInspectedImage] = useState(null)
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' ? prefersReducedMotion() : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const hasImages = category.sections.some((s) => s.images.length > 0)
  const inspectImage = useCallback((image, sourceElement) => {
    const scrollElement = sourceElement.closest('.work-gallery-mobile-scroller')
    document.documentElement.dataset.workLightboxOpen = ''
    preloadImage(image)
    setInspectedImage({
      image,
      sourceElement,
      scrollElement,
      scrollTop: scrollElement?.scrollTop,
    })
  }, [])
  const closeInspection = useCallback(() => setInspectedImage(null), [])

  let gallery

  if (isMobile) {
    gallery = (
      <WorkCategoryGalleryMobile
        category={category}
        onInspect={inspectImage}
        onExitToAbout={exitToAbout}
      />
    )
  } else if (!hasImages) {
    gallery = (
      <WorkCategoryGalleryStatic
        category={category}
        onInspect={inspectImage}
        onExitToAbout={exitToAbout}
      />
    )
  } else {
    gallery = (
      <WorkCategoryGalleryScroll
        category={category}
        reduced={reduced}
        onInspect={inspectImage}
        onExitToAbout={exitToAbout}
      />
    )
  }

  return (
    <>
      {gallery}
      {inspectedImage && (
        <WorkImageLightbox
          image={inspectedImage.image}
          sourceElement={inspectedImage.sourceElement}
          scrollElement={inspectedImage.scrollElement}
          scrollTop={inspectedImage.scrollTop}
          reduced={reduced}
          onClose={closeInspection}
        />
      )}
    </>
  )
}
