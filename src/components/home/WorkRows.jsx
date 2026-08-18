import { useEffect, useRef, useState } from 'react'
import ProtectedImage from '../ProtectedImage'
import { protectedGalleryHandlers } from '../../utils/imageProtection'
import { homeWorkCategories } from '../../data/galleries'
import {
  faceStyleFromRowProgress,
  rowBlindProgress,
  ruleStyleFromRowProgress,
} from './workBlind'
import {
  headingEnterStyle,
  rowEnterFaceStyle,
  rowEnterRuleStyle,
  topRuleEnterStyle,
} from './workEnter'

const PREVIEW_MS = 360
const LERP = 0.08
const OFFSET = 28
const PAD = 22

function canHoverPreview() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function clampPreviewOrigin(cursorX, cursorY, width, height) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let x = cursorX + OFFSET
  let y = cursorY + OFFSET

  if (x + width > vw - PAD) x = cursorX - OFFSET - width
  if (y + height > vh - PAD) y = cursorY - OFFSET - height

  x = Math.min(Math.max(x, PAD), Math.max(PAD, vw - width - PAD))
  y = Math.min(Math.max(y, PAD), Math.max(PAD, vh - height - PAD))

  return { x, y }
}

function preloadImage(src) {
  if (!src || typeof window === 'undefined') return
  const img = new window.Image()
  img.decoding = 'async'
  img.src = src
}

/**
 * Horizontal photography-category rows with cursor-following hover previews.
 * Blind close is driven by shared blindProgress (0 = open, 1 = fully closed).
 */
export default function WorkRows({
  categories = homeWorkCategories,
  id = 'work',
  fill = false,
  locked = false,
  presentational = false,
  selectedCategoryId = null,
  blindProgress = 0,
  /** 0 = pre-assemble (hidden/offset), 1 = fully assembled. */
  enterProgress = 1,
  onSelectCategory,
}) {
  const [hoverCapable, setHoverCapable] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [outgoing, setOutgoing] = useState(null)
  const [outgoingVisible, setOutgoingVisible] = useState(false)

  const leaveTimer = useRef(null)
  const clearOutTimer = useRef(null)
  const shellRef = useRef(null)
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef(0)
  const openRef = useRef(false)
  const indicesRef = useRef({})
  const currentSlotRef = useRef(null)
  const lockedRef = useRef(locked)
  /** Seed per-row pointer so we only open after a real move on that row. */
  const rowPointerRef = useRef(null)
  const shellPlacedRef = useRef(false)

  const interactionLocked = locked || presentational
  const hoverEnabled = hoverCapable && !interactionLocked
  const count = categories.length
  const headingP = rowBlindProgress(blindProgress, 0, false, count)

  lockedRef.current = interactionLocked

  useEffect(() => {
    currentSlotRef.current = current
  }, [current])

  useEffect(() => {
    const sync = () => setHoverCapable(canHoverPreview())
    sync()
    const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    hoverMq.addEventListener('change', sync)
    motionMq.addEventListener('change', sync)
    return () => {
      hoverMq.removeEventListener('change', sync)
      motionMq.removeEventListener('change', sync)
    }
  }, [])

  useEffect(() => {
    openRef.current = previewOpen
  }, [previewOpen])

  useEffect(() => {
    categories.forEach((cat) => {
      const images = cat.previewImages ?? []
      if (images[0]) preloadImage(images[0])
    })
  }, [categories])

  useEffect(
    () => () => {
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
      if (clearOutTimer.current) window.clearTimeout(clearOutTimer.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!interactionLocked) return
    rowPointerRef.current = null
    shellPlacedRef.current = false
    setPreviewOpen(false)
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => {
      setOutgoing(null)
      leaveTimer.current = null
    }, PREVIEW_MS)
  }, [interactionLocked])

  useEffect(() => {
    if (!hoverEnabled) return

    const tick = () => {
      const shell = shellRef.current
      if (!shell) {
        rafRef.current = 0
        return
      }

      const cur = currentRef.current
      const tgt = targetRef.current
      cur.x += (tgt.x - cur.x) * LERP
      cur.y += (tgt.y - cur.y) * LERP

      const w = shell.offsetWidth || 280
      const h = shell.offsetHeight || 200
      const { x, y } = clampPreviewOrigin(cur.x, cur.y, w, h)
      shell.style.transform = `translate3d(${x}px, ${y}px, 0)`
      shellPlacedRef.current = true

      const settled =
        Math.abs(tgt.x - cur.x) < 0.15 && Math.abs(tgt.y - cur.y) < 0.15
      if (!settled || openRef.current) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = 0
      }
    }

    const kick = () => {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick)
    }

    const onMove = (e) => {
      if (!openRef.current || lockedRef.current) return
      targetRef.current = { x: e.clientX, y: e.clientY }
      kick()
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [hoverEnabled])

  const placeShellAt = (cursorX, cursorY) => {
    const shell = shellRef.current
    targetRef.current = { x: cursorX, y: cursorY }
    currentRef.current = { x: cursorX, y: cursorY }
    if (!shell) return
    const w = shell.offsetWidth || 280
    const h = shell.offsetHeight || 200
    const { x, y } = clampPreviewOrigin(cursorX, cursorY, w, h)
    shell.style.transform = `translate3d(${x}px, ${y}px, 0)`
    shellPlacedRef.current = true
  }

  const showPreview = (rowId, event) => {
    if (!hoverEnabled || lockedRef.current) return
    // Salience is pointer-events-none, so rows can receive hover through the
    // iris before Work is meant to be live — ignore until hit-testing unlocks.
    const hit = document.querySelector('#work .work-hit')
    if (hit && !hit.classList.contains('is-live')) return
    const cat = categories.find((c) => c.id === rowId)
    const images = cat?.previewImages ?? []

    if (leaveTimer.current) {
      window.clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }

    if (!images.length) {
      setPreviewOpen(false)
      return
    }

    const x = event?.clientX
    const y = event?.clientY
    if (typeof x !== 'number' || typeof y !== 'number') return
    // Unpositioned shell defaults to fixed left/top — never open on 0,0.
    if (x === 0 && y === 0) return

    placeShellAt(x, y)

    const idx = indicesRef.current[rowId] ?? 0
    const src = images[idx % images.length]
    const nextIdx = (idx + 1) % images.length
    indicesRef.current[rowId] = nextIdx
    preloadImage(images[nextIdx])

    const prev = currentSlotRef.current
    if (prev && prev.src !== src) {
      setOutgoing(prev)
      setOutgoingVisible(true)
      if (clearOutTimer.current) window.clearTimeout(clearOutTimer.current)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOutgoingVisible(false))
      })
      clearOutTimer.current = window.setTimeout(() => {
        setOutgoing(null)
        clearOutTimer.current = null
      }, PREVIEW_MS)
    }

    setCurrent({ id: rowId, src, key: `${rowId}-${idx}` })
    setPreviewOpen(true)
  }

  const hidePreview = () => {
    if (lockedRef.current) return
    if (!hoverCapable) return
    rowPointerRef.current = null
    setPreviewOpen(false)
    shellPlacedRef.current = false
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => {
      setOutgoing(null)
      leaveTimer.current = null
    }, PREVIEW_MS)
  }

  const handleSelect = (categoryId) => {
    if (interactionLocked || !onSelectCategory) return
    setPreviewOpen(false)
    onSelectCategory(categoryId)
  }

  const shellVisible =
    previewOpen &&
    Boolean(current) &&
    !interactionLocked &&
    shellPlacedRef.current

  const previewRowIndex = current
    ? categories.findIndex((c) => c.id === current.id)
    : -1
  const previewRowP =
    previewRowIndex >= 0
      ? rowBlindProgress(
          blindProgress,
          previewRowIndex,
          selectedCategoryId === current.id,
          count,
        )
      : 0
  const previewFaceOpacity = faceStyleFromRowProgress(previewRowP).opacity
  const shellOpacity = shellVisible ? previewFaceOpacity : 0

  const blindsActive = blindProgress > 0.002
  const headingBlind = faceStyleFromRowProgress(headingP)
  const headingEnter = headingEnterStyle(enterProgress, count)
  const headingStyle = blindsActive
    ? headingBlind
    : {
        opacity: headingEnter.opacity * (headingBlind.opacity ?? 1),
        transform: headingEnter.transform,
      }
  const topRuleBlind = ruleStyleFromRowProgress(headingP)
  const topRuleEnter = topRuleEnterStyle(enterProgress, count)
  const topRuleStyle = blindsActive
    ? {
        borderColor: topRuleBlind.borderColor,
        opacity: topRuleBlind.opacity,
      }
    : {
        borderColor: 'rgb(var(--fg) / 0.3)',
        opacity: topRuleEnter.opacity,
      }

  return (
    <section
      id={id || undefined}
      className={`relative text-ink section-pad ${
        fill
          ? 'flex h-full min-h-0 flex-col justify-center pt-16 md:pt-20 pb-8 md:pb-10'
          : 'bg-canvas pt-20 md:pt-28 pb-8 md:pb-12'
      } ${interactionLocked ? 'work-rows--locked' : ''} ${
        presentational ? 'pointer-events-none' : ''
      }`}
      onMouseLeave={hidePreview}
      aria-hidden={presentational ? true : undefined}
      inert={presentational ? true : undefined}
    >
      <h2
        className="work-blind-heading font-sans text-[13px] md:text-[14px] font-semibold tracking-[0.22em] uppercase text-ink mb-8 md:mb-10"
        style={headingStyle}
      >
        Selected Work
      </h2>

      <ul
        className="relative z-10 border-t border-ink/30"
        style={topRuleStyle}
      >
        {categories.map((cat, index) => {
          const isSelected = selectedCategoryId === cat.id
          const rowP = rowBlindProgress(
            blindProgress,
            index,
            isSelected,
            count,
          )
          const faceBlind = faceStyleFromRowProgress(rowP)
          const ruleBlind = ruleStyleFromRowProgress(rowP)
          const faceEnter = rowEnterFaceStyle(enterProgress, index, count)
          const ruleEnter = rowEnterRuleStyle(enterProgress, index, count)

          const face = blindsActive
            ? faceBlind
            : {
                opacity: faceEnter.opacity,
                transform: faceEnter.transform,
              }
          const rule = blindsActive
            ? ruleBlind
            : {
                borderColor: 'rgb(var(--fg) / 0.3)',
                opacity: ruleEnter.opacity,
              }

          return (
            <li
              key={cat.id}
              className={`work-blind-slat group border-b ${
                isSelected ? 'work-blind-slat--selected' : ''
              }`}
              style={rule}
            >
              <div className="work-blind-face" style={face}>
                <button
                  type="button"
                  className="grid h-24 md:h-[6.5rem] w-full grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-0 gap-y-1 text-left sm:grid-cols-[2.75rem_minmax(0,calc(32%-2.75rem))_minmax(0,1fr)] sm:gap-x-0"
                  aria-label={`${cat.title}. Opens ${cat.title} work.`}
                  aria-disabled={interactionLocked ? true : undefined}
                  tabIndex={presentational || interactionLocked ? -1 : undefined}
                  onClick={() => handleSelect(cat.id)}
                  onMouseEnter={(e) => {
                    rowPointerRef.current = {
                      id: cat.id,
                      x: e.clientX,
                      y: e.clientY,
                    }
                    // Once a preview is active, switch rows immediately on enter.
                    if (openRef.current) showPreview(cat.id, e)
                  }}
                  onMouseMove={(e) => {
                    if (!hoverEnabled || interactionLocked) return
                    const seed = rowPointerRef.current
                    if (!seed || seed.id !== cat.id) {
                      rowPointerRef.current = {
                        id: cat.id,
                        x: e.clientX,
                        y: e.clientY,
                      }
                      if (openRef.current) showPreview(cat.id, e)
                      return
                    }
                    if (!openRef.current) {
                      const dx = e.clientX - seed.x
                      const dy = e.clientY - seed.y
                      // First open still needs a real move (iris-under-cursor guard).
                      if (dx * dx + dy * dy < 36) return
                      showPreview(cat.id, e)
                      return
                    }
                    if (currentSlotRef.current?.id !== cat.id) {
                      showPreview(cat.id, e)
                      return
                    }
                    targetRef.current = { x: e.clientX, y: e.clientY }
                  }}
                  onMouseLeave={() => {
                    if (rowPointerRef.current?.id === cat.id) {
                      rowPointerRef.current = null
                    }
                  }}
                >
                  <span
                    className="work-row-index col-start-1 row-start-1 self-center font-sans text-[11px] md:text-[12px] font-normal tracking-[0.14em] uppercase text-ink leading-none opacity-45 will-change-transform group-hover:translate-x-2.5 group-hover:opacity-80 group-focus-visible:translate-x-2.5 group-focus-visible:opacity-80"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="work-row-spring work-row-title col-start-2 row-start-1 font-serif text-[28px] md:text-[32px] font-semibold tracking-tight text-ink leading-none will-change-transform group-hover:translate-x-5 group-hover:text-salience-warm group-focus-visible:translate-x-5 group-focus-visible:text-salience-warm">
                    {cat.title}
                  </span>
                  <span className="work-row-spring col-start-2 row-start-2 sm:col-start-3 sm:row-start-1 font-sans text-[11px] sm:text-xs font-medium tracking-editorial uppercase text-ink/70 will-change-transform group-hover:translate-x-3 group-focus-visible:translate-x-3">
                    {cat.sublabels.join(' · ')}
                  </span>
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {hoverCapable && !presentational && (
        <div
          ref={shellRef}
          className={`pointer-events-none fixed left-0 top-0 z-50 w-[clamp(220px,20vw,330px)] max-h-[38vh] transition-[opacity,scale] ease-elegant ${
            shellVisible && shellOpacity > 0.02
              ? 'scale-100'
              : 'scale-[0.97]'
          }`}
          style={{
            opacity: shellOpacity,
            // Track blind scrub immediately; keep soft timing only for hover open/close.
            transitionDuration:
              blindProgress > 0.002 ? '0ms' : `${PREVIEW_MS}ms`,
            willChange: 'transform, opacity',
          }}
          aria-hidden="true"
          {...protectedGalleryHandlers}
        >
          <div className="relative">
            {outgoing && (
              <ProtectedImage
                key={`out-${outgoing.key}`}
                src={outgoing.src}
                alt=""
                loading="eager"
                decoding="async"
                className={`absolute inset-0 h-auto w-full max-h-[38vh] object-contain object-left-top transition-[opacity,transform] ease-elegant ${
                  outgoingVisible
                    ? 'opacity-100 scale-100'
                    : 'opacity-0 scale-[0.97]'
                }`}
                style={{ transitionDuration: `${PREVIEW_MS}ms` }}
              />
            )}
            {current && (
              <ProtectedImage
                key={`cur-${current.key}`}
                src={current.src}
                alt=""
                loading="eager"
                decoding="async"
                className="relative h-auto w-full max-h-[38vh] object-contain object-left-top opacity-100 scale-100"
              />
            )}
          </div>
        </div>
      )}
    </section>
  )
}
