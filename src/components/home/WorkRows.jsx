import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProtectedImage from '../ProtectedImage'
import { protectedGalleryHandlers } from '../../utils/imageProtection'
import { homeWorkCategories } from '../../data/galleries'
import {
  blindCloseTotalMs,
  faceStyleFromRowProgress,
  rowBlindProgress,
  ruleStyleFromRowProgress,
} from './workBlind'
import { useBlindExit } from '../../context/BlindExitContext'

const PREVIEW_MS = 360
const LERP = 0.08
const OFFSET = 28
const PAD = 22

function canHoverPreview() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
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
 */
export default function WorkRows({ categories = homeWorkCategories }) {
  const navigate = useNavigate()
  const { register } = useBlindExit()
  const [hoverCapable, setHoverCapable] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [outgoing, setOutgoing] = useState(null)
  const [outgoingVisible, setOutgoingVisible] = useState(false)
  const [clickDriving, setClickDriving] = useState(false)
  const [blindProgress, setBlindProgress] = useState(0)
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)

  const leaveTimer = useRef(null)
  const clearOutTimer = useRef(null)
  const navTimerRef = useRef(0)
  const blindRafRef = useRef(0)
  const shellRef = useRef(null)
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef(0)
  const openRef = useRef(false)
  const indicesRef = useRef({})
  const currentSlotRef = useRef(null)
  const rowPointerRef = useRef(null)
  const shellPlacedRef = useRef(false)

  useEffect(() => {
    currentSlotRef.current = current
  }, [current])

  useEffect(() => {
    const sync = () => setHoverCapable(canHoverPreview())
    sync()
    const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)')
    hoverMq.addEventListener('change', sync)
    return () => hoverMq.removeEventListener('change', sync)
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
      if (navTimerRef.current) window.clearTimeout(navTimerRef.current)
      if (blindRafRef.current) cancelAnimationFrame(blindRafRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!hoverCapable) return

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
      if (!openRef.current) return
      targetRef.current = { x: e.clientX, y: e.clientY }
      kick()
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [hoverCapable])

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
    if (!hoverCapable || clickDriving) return
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
    if (!hoverCapable || clickDriving) return
    rowPointerRef.current = null
    setPreviewOpen(false)
    shellPlacedRef.current = false
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => {
      setOutgoing(null)
      leaveTimer.current = null
    }, PREVIEW_MS)
  }

  const clickDrivingRef = useRef(false)

  const runBlindClose = (destination, categoryId = null) => {
    if (clickDrivingRef.current) return
    clickDrivingRef.current = true

    setPreviewOpen(false)
    if (categoryId) setSelectedCategoryId(categoryId)
    setClickDriving(true)

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduceMotion ? 0 : blindCloseTotalMs(categories.length)

    const finish = () => {
      if (blindRafRef.current) {
        cancelAnimationFrame(blindRafRef.current)
        blindRafRef.current = 0
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
      const t = Math.min(Math.max((now - start) / duration, 0), 1)
      const eased = 1 - (1 - t) ** 3
      setBlindProgress(eased)
      if (t < 1) {
        blindRafRef.current = requestAnimationFrame(tick)
      } else {
        blindRafRef.current = 0
      }
    }

    blindRafRef.current = requestAnimationFrame(tick)
  }

  // Register blind-close handler with the context so Nav/Footer links can trigger it.
  useEffect(() => {
    return register(runBlindClose)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register])

  const handleSelect = (categoryId) => {
    if (clickDrivingRef.current) return
    const cat = categories.find((c) => c.id === categoryId)
    if (!cat?.destination) return
    runBlindClose(cat.destination, categoryId)
  }

  const shellVisible = previewOpen && Boolean(current) && shellPlacedRef.current
  const count = categories.length
  const headingP = rowBlindProgress(blindProgress, 0, false, count)
  const headingStyle =
    blindProgress > 0
      ? faceStyleFromRowProgress(headingP)
      : undefined
  const topRuleStyle =
    blindProgress > 0
      ? ruleStyleFromRowProgress(headingP)
      : undefined
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
  const shellOpacity =
    shellVisible && blindProgress > 0
      ? faceStyleFromRowProgress(previewRowP).opacity
      : shellVisible
        ? 1
        : 0

  return (
    <section
      className="relative text-ink section-pad bg-canvas pt-32 md:pt-40 pb-10 md:pb-14"
      onMouseLeave={hidePreview}
      aria-labelledby="all-work-heading"
    >
      <h1
        id="all-work-heading"
        className="work-index-title font-display font-normal text-center text-ink leading-[1.18] mb-10 md:mb-14 text-[clamp(3.5rem,5.5vw,6rem)]"
        style={headingStyle}
      >
        All Work
      </h1>

      <ul
        className="relative z-10 border-t border-ink/30"
        style={topRuleStyle}
      >
        {categories.map((cat, index) => {
          const fromLeft = index % 2 === 0
          const isSelected = selectedCategoryId === cat.id
          const rowP = rowBlindProgress(
            blindProgress,
            index,
            isSelected,
            count,
          )
          const rowFaceStyle =
            blindProgress > 0
              ? faceStyleFromRowProgress(rowP)
              : undefined
          const rowRuleStyle =
            blindProgress > 0
              ? ruleStyleFromRowProgress(rowP)
              : { borderColor: 'rgb(var(--fg) / 0.3)', opacity: 1 }
          return (
            <li
              key={cat.id}
              className={`work-index-row group relative ${
                fromLeft ? 'work-index-row--left' : 'work-index-row--right'
              }`}
              style={{ '--i': index }}
            >
              <div
                className="origin-top will-change-transform"
                style={rowFaceStyle}
              >
                <button
                  type="button"
                  className="grid h-24 md:h-[6.5rem] w-full grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-0 gap-y-1 text-left sm:grid-cols-[2.75rem_minmax(0,calc(32%-2.75rem))_minmax(0,1fr)] sm:gap-x-0"
                  aria-label={`${cat.title}. Opens ${cat.title} work.`}
                  aria-disabled={clickDriving ? true : undefined}
                  tabIndex={clickDriving ? -1 : undefined}
                  onClick={() => handleSelect(cat.id)}
                  onMouseEnter={(e) => {
                    rowPointerRef.current = {
                      id: cat.id,
                      x: e.clientX,
                      y: e.clientY,
                    }
                    showPreview(cat.id, e)
                  }}
                  onMouseMove={(e) => {
                    if (!hoverCapable || clickDriving) return
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
                    className="work-row-index col-start-1 row-start-1 self-center font-mono font-light text-[11px] md:text-[12px] tracking-[0.14em] uppercase text-ink leading-none opacity-45 will-change-transform group-hover:translate-x-2.5 group-hover:opacity-80 group-focus-visible:translate-x-2.5 group-focus-visible:opacity-80"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="work-row-spring work-row-title col-start-2 row-start-1 font-serif text-[28px] md:text-[32px] font-semibold tracking-tight text-ink leading-none will-change-transform group-hover:translate-x-5 group-hover:text-salience-warm group-focus-visible:translate-x-5 group-focus-visible:text-salience-warm">
                    {cat.title}
                  </span>
                  <span className="work-row-spring col-start-2 row-start-2 sm:col-start-3 sm:row-start-1 font-mono font-light text-[11px] sm:text-xs tracking-editorial uppercase text-ink/70 will-change-transform group-hover:translate-x-3 group-focus-visible:translate-x-3">
                    {cat.sublabels.join(' · ')}
                  </span>
                </button>
              </div>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px"
                style={{
                  backgroundColor:
                    rowRuleStyle.borderColor ?? 'rgb(var(--fg) / 0.3)',
                  opacity: rowRuleStyle.opacity ?? 1,
                }}
                aria-hidden="true"
              />
            </li>
          )
        })}
      </ul>

      {hoverCapable && (
        <div
          ref={shellRef}
          className={`pointer-events-none fixed left-0 top-0 z-50 w-[clamp(220px,20vw,330px)] max-h-[38vh] transition-[opacity,scale] ease-elegant ${
            shellVisible && shellOpacity > 0.02 ? 'scale-100' : 'scale-[0.97]'
          }`}
          style={{
            opacity: shellOpacity,
            transitionDuration: blindProgress > 0 ? '0ms' : `${PREVIEW_MS}ms`,
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
