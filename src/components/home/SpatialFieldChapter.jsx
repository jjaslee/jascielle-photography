import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLenisRef } from '../../context/LenisContext'
import { homeSpatialField } from '../../data/galleries'
import ProtectedImage from '../ProtectedImage'
import { protectedGalleryHandlers } from '../../utils/imageProtection'
import { SMOOTH_SCROLL_STATE, useFooterNavClick } from '../../hooks/useScrollToTop'

/** Pinned scroll length for the spatial orbit (plus sticky viewport). */
const ORBIT_SVH = 250
const SETTLE_SVH = 130
/**
 * Sit under Work only for the late handoff — field waits until blinds are
 * mostly closed so it doesn’t rise through the slats.
 */
const HANDOFF_OVERLAP_SVH = 100
const CHAPTER_SVH = ORBIT_SVH + SETTLE_SVH + 100 + HANDOFF_OVERLAP_SVH

/** Slide up from below once blinds unlock — keep rise modest so the stage
 * doesn’t sit as a tall black void above the prints. */
const ENTRANCE_RISE_VH = 38
/** Blind progress where the field may start rising. */
const ENTRANCE_BLIND_START = 0.64
/** Scroll distance (svh) after unlock that completes the slide. */
const ENTRANCE_SCROLL_SVH = 40
/** Nudge the print cluster slightly downward in the frame. */
const FIELD_Y_LIFT = -28

/** Total museum-pace yaw before settle (radians). */
const TOTAL_YAW = Math.PI * 0.85

const EXPLORE_END = 0.82
const OUTWARD_START = 0.78
const DIM_START = 0.8
const YAW_STOP = 0.88
/** Final CTA dominance window (~last 14% of chapter progress). */
const FINAL_START = 0.86
/**
 * Share of chapter scroll reserved for the CTA ramp (progress FINAL_START→1).
 * Larger = slower scroll through the final settle.
 */
const CTA_SCROLL_SHARE = 0.32
/** After prints enter evenly lit, spotlight wakes across this progress band. */
const SPOT_WAKE_START = 0.14
const SPOT_WAKE_END = 0.38
/** Spotlight pulls from free pointer → CTA center through the final slide. */
const SPOT_CONVERGE_START = 0.82
const SPOT_CONVERGE_END = 0.97
/** After settle, hand control back so the CTA beam can be steered. */
const SPOT_FREE_START = 0.975
const SPOT_FREE_END = 1
/**
 * Mild lead only — large scale exhausted yaw mid-chapter and felt like a pause.
 */
const YAW_PROGRESS_SCALE = 1.06
const YAW_ENTRANCE_LEAD = 0.05

const PRIMARY_LERP = 0.16
const TRAIL_LERPS = [0.075, 0.04, 0.022]
const TRAIL_WEIGHTS = [0.45, 0.22, 0.1]
const TRAIL_CORE_MUL = [1.22, 1.45, 1.65]
const TRAIL_OUTER_MUL = [1.12, 1.28, 1.42]

/** Final remnant opacity for peripheral prints (before depth). */
const PERIPH_REMNANT = 0.02
const FINAL_PRINT_OPACITY_MIN = 0.01
const FINAL_PRINT_OPACITY_MAX = 0.025
/** Nav / meta opacity while CTA dominates. */
const CHROME_DIM = 0.68

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

/**
 * Stretch the final CTA window across more scroll so the settle feels slower
 * without changing the orbit pacing much.
 */
function remapChapterProgress(raw) {
  const t = clamp01(raw)
  const exploreShare = 1 - CTA_SCROLL_SHARE
  if (t <= exploreShare) {
    return (t / Math.max(exploreShare, 1e-6)) * FINAL_START
  }
  const u = (t - exploreShare) / Math.max(CTA_SCROLL_SHARE, 1e-6)
  return FINAL_START + u * (1 - FINAL_START)
}

/** Linear rise so translate tracks scroll 1:1 after unlock. */
function entranceRise(t) {
  return 1 - clamp01(t)
}

function canFinePointer() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  )
}

/**
 * Scroll → yaw. Linear for most of the chapter so orbit stays continuous;
 * final window unwinds rotation to zero as the CTA takes over.
 */
function yawFromProgress(p) {
  const t = clamp01(p)
  if (t <= EXPLORE_END) {
    return (t / EXPLORE_END) * TOTAL_YAW * 0.94
  }
  if (t < FINAL_START) {
    const u = (t - EXPLORE_END) / Math.max(FINAL_START - EXPLORE_END, 1e-6)
    return TOTAL_YAW * (0.94 + 0.06 * u)
  }
  const unwind = smoothstep(FINAL_START, YAW_STOP + 0.1, t)
  return TOTAL_YAW * (1 - unwind)
}

/**
 * Photo presence across chapter progress (dim to remnants late).
 */
function photoEnvelope(p) {
  const t = clamp01(p)
  if (t < DIM_START) return 1
  const dim = smoothstep(DIM_START, 0.98, t)
  return 1 - dim * (1 - PERIPH_REMNANT)
}

/** Fade prints in with the slide-up — 0 off-frame → ambient once settled. */
function entranceFade(enter) {
  const t = clamp01(enter)
  // Ease-in-out across the full rise so opacity arrives with the motion.
  return t * t * (3 - 2 * t)
}

/**
 * Spotlight authority: off while the field scrolls in evenly lit,
 * then eases on so the beam takes over without a hard dim snap.
 */
function spotlightWake(p, enter) {
  const scrollWake = smoothstep(SPOT_WAKE_START, SPOT_WAKE_END, clamp01(p))
  // Softer than a late cliff — entrance can still be settling.
  const enterReady = smoothstep(0.45, 0.92, clamp01(enter))
  // Ease-out so the last of the ambient hangs a beat longer.
  const t = scrollWake * enterReady
  return t * t * (3 - 2 * t)
}

function beamWeight(distPx, corePx, outerPx) {
  if (distPx <= corePx) {
    const u = distPx / Math.max(corePx, 1)
    // Flat plateau in the core — avoids a hot point.
    return 0.92 + (1 - u * u) * 0.08
  }
  if (distPx >= outerPx) return 0.018
  const u = (distPx - corePx) / Math.max(outerPx - corePx, 1)
  // Gentler falloff than a sharp beam edge.
  return 0.018 + (1 - u) ** 2.2 * 0.9
}

function EndingMeta() {
  const onFooterNavClick = useFooterNavClick()
  const year = new Date().getFullYear()

  return (
    <>
      <p className="spatial-field-meta__brand">Jascielle Photography</p>
      <nav className="spatial-field-meta__nav" aria-label="Footer">
        <a
          href="https://www.instagram.com/jascielle_photos/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Instagram
        </a>
        <span aria-hidden="true">·</span>
        <a href="mailto:jascielle.photos@gmail.com">Email</a>
        <span aria-hidden="true">·</span>
        <Link
          to="/book"
          state={SMOOTH_SCROLL_STATE}
          onClick={onFooterNavClick('/book')}
        >
          Book
        </Link>
      </nav>
      <p className="spatial-field-meta__copy">© {year}</p>
    </>
  )
}

function SpatialCtaLinkLabel({ text }) {
  const chars = Array.from(text)
  return (
    <span className="spatial-field-cta__link-label" aria-hidden="true">
      {chars.map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className={`spatial-field-cta__link-char${ch === ' ' ? ' is-space' : ''}`}
          style={{ '--i': i }}
        >
          <span className="spatial-field-cta__link-char-roll">
            <span className="spatial-field-cta__link-char-glyph">
              {ch === ' ' ? '\u00a0' : ch}
            </span>
            <span className="spatial-field-cta__link-char-glyph" aria-hidden="true">
              {ch === ' ' ? '\u00a0' : ch}
            </span>
          </span>
        </span>
      ))}
    </span>
  )
}

function SpatialCtaBlock({
  ctaRef,
  beamRef,
  eyebrowRef,
  titleRef,
  linkWrapRef,
  staticAppear = false,
  includeBeam = true,
}) {
  return (
    <div
      ref={ctaRef}
      className={`spatial-field-cta${staticAppear ? ' spatial-field-cta--static' : ''}`}
      style={{ pointerEvents: staticAppear ? 'auto' : 'none' }}
      aria-labelledby="closing-cta-heading"
    >
      {includeBeam ? (
        <div
          ref={beamRef}
          className="spatial-field-cta__beam"
          style={staticAppear ? undefined : { opacity: 0 }}
          aria-hidden
        />
      ) : null}
      <p
        ref={eyebrowRef}
        className="spatial-field-cta__eyebrow"
        style={staticAppear ? undefined : { opacity: 0 }}
      >
        Attention is selective.
      </p>
      <h2
        ref={titleRef}
        id="closing-cta-heading"
        className="spatial-field-cta__title"
        style={
          staticAppear
            ? undefined
            : {
                opacity: 0,
                transform: 'translate3d(0, 14px, 0)',
              }
        }
      >
        Let&apos;s capture what&apos;s worth
        <br />
        <span className="spatial-field-cta__accent">noticing.</span>
      </h2>
      <div
        ref={linkWrapRef}
        className="spatial-field-cta__link-wrap"
        style={
          staticAppear
            ? undefined
            : { opacity: 0, transform: 'translate3d(0, 12px, 0)' }
        }
      >
        <Link
          to="/book"
          className="spatial-field-cta__link"
          aria-label="Begin an inquiry"
        >
          <SpatialCtaLinkLabel text="Begin an inquiry" />
          <span className="spatial-field-cta__link-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </div>
  )
}

/**
 * CSS 3D cylindrical / helical photography field.
 * Scroll orbits; pointer + trail control salience; CTA concludes in-stage.
 */
export default function SpatialFieldChapter({
  prints = homeSpatialField,
}) {
  const chapterRef = useRef(null)
  const stageRef = useRef(null)
  const entranceRef = useRef(null)
  const fieldSpotRef = useRef(null)
  const worldRef = useRef(null)
  const ctaRef = useRef(null)
  const ctaBeamRef = useRef(null)
  const eyebrowRef = useRef(null)
  const titleRef = useRef(null)
  const linkWrapRef = useRef(null)
  const metaRef = useRef(null)
  const itemRefs = useRef([])
  const lenisRef = useLenisRef()

  const progressRef = useRef(0)
  const entranceTRef = useRef(0)
  const pointerTarget = useRef({ x: 0, y: 0 })
  const pointerPrimary = useRef({ x: 0, y: 0 })
  const pointerTrails = useRef([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ])
  const finePointerRef = useRef(false)
  const pointerInsideRef = useRef(true)
  const rafRef = useRef(0)

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
    if (reducedMotion) return

    const chapter = chapterRef.current
    const world = worldRef.current
    const entrance = entranceRef.current
    if (!chapter || !world || !entrance) return

    const centerPointer = () => ({
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.46,
    })

    finePointerRef.current = canFinePointer()
    pointerInsideRef.current = true
    const origin = centerPointer()
    pointerTarget.current = { ...origin }
    pointerPrimary.current = { ...origin }
    pointerTrails.current = [{ ...origin }, { ...origin }, { ...origin }]
    entranceTRef.current = 0
    entrance.style.opacity = '1'
    entrance.style.transform = `translate3d(0, ${ENTRANCE_RISE_VH}vh, 0)`
    /** Document scrollY when blinds unlock the entrance. */
    let entranceOriginY = null

    const readScrollY = () => {
      const lenis = lenisRef?.current
      if (lenis && typeof lenis.scroll === 'number') return lenis.scroll
      return window.scrollY || document.documentElement.scrollTop || 0
    }

    const readProgress = () => {
      const rect = chapter.getBoundingClientRect()
      const vh = window.innerHeight
      const range = rect.height - vh
      const raw = range <= 0 ? 1 : clamp01(-rect.top / range)
      return remapChapterProgress(raw)
    }

    /**
     * Blinds unlock late (avoid slat overlap); after that the rise is
     * scrubbed directly by scroll distance.
     */
    const readEntranceT = () => {
      const work = document.getElementById('work')
      if (work?.dataset.workHandoff === 'hold') {
        entranceOriginY = null
        entranceTRef.current = 0
        return 0
      }
      const workBlind = parseFloat(work?.dataset.blindProgress || '0')
      if (workBlind < ENTRANCE_BLIND_START) {
        entranceOriginY = null
        entranceTRef.current = 0
        return 0
      }

      const y = readScrollY()
      if (entranceOriginY == null) entranceOriginY = y

      const vh = window.innerHeight
      const span = Math.max((ENTRANCE_SCROLL_SVH / 100) * vh, 1)
      const enter = clamp01((y - entranceOriginY) / span)
      entranceTRef.current = enter
      return enter
    }

    const paint = () => {
      const chapterRect = chapter.getBoundingClientRect()
      const vh = window.innerHeight
      const vw = window.innerWidth

      // Fresh geometry every frame so orbit never waits on a missed scroll event.
      progressRef.current = readProgress()

      const enter = readEntranceT()
      entrance.style.opacity = '1'
      entrance.style.transform = `translate3d(0, ${entranceRise(enter) * ENTRANCE_RISE_VH}vh, 0)`

      if (chapterRect.bottom < -80 || chapterRect.top > vh + 80) {
        const siteNav = document.querySelector('[data-site-nav]')
        if (siteNav) siteNav.style.opacity = ''
        return
      }

      const p = progressRef.current
      const yawP = clamp01(p * YAW_PROGRESS_SCALE + enter * YAW_ENTRANCE_LEAD)
      const yaw = yawFromProgress(yawP)
      const envelope = photoEnvelope(p)
      const yawDeg = (yaw * 180) / Math.PI
      const narrow = vw < 768
      const radiusScale = narrow ? 0.62 : 1

      const outward = smoothstep(OUTWARD_START, 0.88, p)
      const finalT = smoothstep(FINAL_START, 0.99, p)
      const flatten = smoothstep(FINAL_START, 1, p)
      const convergeT = smoothstep(SPOT_CONVERGE_START, SPOT_CONVERGE_END, p)
      const freeT = smoothstep(SPOT_FREE_START, SPOT_FREE_END, p)
      // Lock to CTA during converge, then release pointer once settled.
      const lockT = convergeT * (1 - freeT)
      // Prints stay quiet after converge; freeT only restores CTA beam steering.
      const spotInfluence = 1 - convergeT
      const spotWake = spotlightWake(p, enter)
      const ambientMix = 1 - spotWake
      const ctaSpotT = smoothstep(FINAL_START - 0.02, 0.96, p)
      const chromeT = smoothstep(FINAL_START, 0.97, p)
      const chromeOp = 1 - chromeT * (1 - CHROME_DIM)

      // Eyebrow stays present for the whole spatial stage once the field enters.
      const eyebrowT = smoothstep(0.1, 0.42, enter)
      const titleT = smoothstep(FINAL_START, 0.97, p)
      const linkT = smoothstep(FINAL_START + 0.04, 1, p)
      const metaReveal = smoothstep(0.92, 1, p)

      world.style.transform = `translate3d(0, 0, ${-200 * (1 - flatten * 0.72)}px) rotateY(${yawDeg}deg)`

      const eyebrow = eyebrowRef.current
      const title = titleRef.current
      const linkWrap = linkWrapRef.current
      const cta = ctaRef.current
      const ctaBeam = ctaBeamRef.current
      const meta = metaRef.current
      const fieldSpot = fieldSpotRef.current
      const siteNav = document.querySelector('[data-site-nav]')

      const primary = pointerPrimary.current

      // Spotlight: free pointer → CTA center (lock) → free again after settle.
      let beamX = primary.x
      let beamY = primary.y
      let ctaCx = vw * 0.5
      let ctaCy = vh * 0.48
      if (cta) {
        const cr = cta.getBoundingClientRect()
        ctaCx = cr.left + cr.width * 0.5
        ctaCy = cr.top + cr.height * 0.48
      }
      if (lockT > 0.001) {
        beamX = primary.x + (ctaCx - primary.x) * lockT
        beamY = primary.y + (ctaCy - primary.y) * lockT
        if (lockT > 0.08) {
          const pull = 0.06 + lockT * 0.22
          pointerTarget.current.x += (ctaCx - pointerTarget.current.x) * pull
          pointerTarget.current.y += (ctaCy - pointerTarget.current.y) * pull
        }
      }

      if (cta) {
        cta.style.setProperty('--spot-on', String(ctaSpotT))
        cta.style.pointerEvents = titleT > 0.35 ? 'auto' : 'none'
      }
      if (ctaBeam) {
        const stageRect = stageRef.current?.getBoundingClientRect()
        const sw = Math.max(stageRect?.width ?? vw, 1)
        const sh = Math.max(stageRect?.height ?? vh, 1)
        const ox = stageRect?.left ?? 0
        const oy = stageRect?.top ?? 0
        ctaBeam.style.setProperty(
          '--spot-x',
          `${((beamX - ox) / sw) * 100}%`,
        )
        ctaBeam.style.setProperty(
          '--spot-y',
          `${((beamY - oy) / sh) * 100}%`,
        )
        // Soft radial only — no hard edge; peaks as field beam yields.
        ctaBeam.style.opacity = String(
          clamp01(ctaSpotT * (0.45 + Math.max(convergeT, freeT) * 0.55)),
        )
      }

      if (eyebrow) {
        eyebrow.style.opacity = String(eyebrowT * (0.78 + 0.22 * ctaSpotT))
      }
      if (title) {
        title.style.opacity = String(titleT)
        title.style.transform = `translate3d(0, ${(1 - titleT) * 14}px, 0)`
      }
      if (linkWrap) {
        linkWrap.style.opacity = String(linkT)
        linkWrap.style.transform = `translate3d(0, ${(1 - linkT) * 10}px, 0)`
      }
      if (meta) {
        meta.style.opacity = String(metaReveal * chromeOp)
        meta.style.pointerEvents = metaReveal > 0.55 ? 'auto' : 'none'
      }
      if (siteNav) {
        siteNav.style.opacity = String(chromeOp)
      }

      const fine = finePointerRef.current
      const diag = Math.hypot(vw, vh)
      const shrink = 1 - convergeT * 0.62
      const corePx =
        (fine
          ? Math.min(190, Math.max(130, diag * 0.125))
          : Math.min(250, Math.max(185, diag * 0.175))) * shrink
      const outerPx =
        (fine
          ? Math.min(400, Math.max(290, diag * 0.26))
          : Math.min(520, Math.max(380, diag * 0.36))) * shrink

      if (fieldSpot) {
        const stageRect = stageRef.current?.getBoundingClientRect()
        const sx = beamX - (stageRect?.left ?? 0)
        const sy = beamY - (stageRect?.top ?? 0)
        const spotOn =
          spotWake * (1 - convergeT * 0.88) * (1 - finalT * 0.35)
        fieldSpot.style.opacity = String(spotOn)
        fieldSpot.style.setProperty('--spot-x', `${sx}px`)
        fieldSpot.style.setProperty('--spot-y', `${sy}px`)
        fieldSpot.style.setProperty(
          '--spot-r',
          `${Math.max(outerPx * (1.05 + (1 - convergeT) * 0.2), 120)}px`,
        )
      }

      const trails = pointerTrails.current

      for (let i = 0; i < prints.length; i += 1) {
        const el = itemRefs.current[i]
        const print = prints[i]
        if (!el || !print) continue

        const angle = print.angle
        let r = (print.radius + print.depthOffset) * radiusScale
        // Open central negative space — restrained outward drift.
        r *= 1 + outward * 0.32
        r *= 1 - flatten * 0.12
        let x = Math.cos(angle) * r
        let z = Math.sin(angle) * r
        z *= 1 - flatten * 0.92
        let y = print.y * (narrow ? 0.7 : 1) - FIELD_Y_LIFT
        y *= 1 + outward * 0.16
        y *= 1 - flatten * 0.08

        const scaleMul = (print.scale || 1) * (1 - outward * 0.08) * (1 - flatten * 0.04)
        el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateY(${-yawDeg}deg) translate(-50%, -50%) scale(${scaleMul})`

        const rect = el.getBoundingClientRect()
        const cx = rect.left + rect.width * 0.5
        const cy = rect.top + rect.height * 0.5

        let salience
        if (fine) {
          const primaryW = beamWeight(
            Math.hypot(cx - beamX, cy - beamY),
            corePx,
            outerPx,
          )
          let trailMax = 0
          for (let t = 0; t < trails.length; t += 1) {
            const tw = beamWeight(
              Math.hypot(cx - trails[t].x, cy - trails[t].y),
              corePx * TRAIL_CORE_MUL[t],
              outerPx * TRAIL_OUTER_MUL[t],
            )
            trailMax = Math.max(trailMax, tw * TRAIL_WEIGHTS[t])
          }
          // During converge, trails matter less — one focused beam.
          const trailMix = 1 - convergeT * 0.92
          salience = Math.min(
            1,
            Math.max(primaryW, trailMax * trailMix),
          )
        } else {
          salience = Math.min(
            1,
            beamWeight(
              Math.hypot(cx - beamX, cy - beamY),
              corePx,
              outerPx,
            ) * 1.2,
          )
        }

        // Low even floor on entry; beam contrast eases in after wake.
        const quietBase =
          0.28 * ambientMix + (0.2 + convergeT * 0.06) * spotWake
        const beamAuthority = Math.max(
          spotInfluence * spotWake,
          ambientMix * 0.04,
        )
        salience = quietBase + (salience - quietBase) * beamAuthority

        const zCam = -x * Math.sin(yaw) + z * Math.cos(yaw)
        const depthVis =
          0.28 + 0.72 * clamp01((zCam + r * 0.55) / (r * 1.55 + 1e-6))

        // Ambient: already low when prints enter, then spotlight takes over.
        const ambientVis = 0.28 + depthVis * 0.14
        const spotVis = depthVis * salience
        const fadeIn = entranceFade(enter)
        let opacity = clamp01(
          fadeIn *
            envelope *
            (ambientVis * ambientMix + spotVis * spotWake),
        )

        // Prefer edge remnants; suppress anything still near viewport center.
        if (outward > 0.2) {
          const nx = (cx - vw * 0.5) / (vw * 0.5)
          const ny = (cy - vh * 0.5) / (vh * 0.5)
          const radial = Math.hypot(nx, ny)
          const centerProx = 1 - clamp01(radial / 0.62)
          const centerCut = centerProx * outward
          opacity *= 1 - centerCut * 0.85
        }

        // Final CTA window: peripheral prints drop to a bare remnant.
        if (finalT > 0.001) {
          const nx = (cx - vw * 0.5) / (vw * 0.5)
          const ny = (cy - vh * 0.5) / (vh * 0.5)
          const radial = Math.hypot(nx, ny)
          const remnant =
            FINAL_PRINT_OPACITY_MIN +
            clamp01((radial - 0.2) / 0.9) *
              (FINAL_PRINT_OPACITY_MAX - FINAL_PRINT_OPACITY_MIN)
          opacity = opacity * (1 - finalT) + remnant * finalT
          if (radial < 0.45) {
            opacity = Math.min(
              opacity,
              FINAL_PRINT_OPACITY_MIN * (1 + (1 - finalT)),
            )
          }
        }

        el.style.opacity = String(Math.min(opacity, 0.99))

        const glowAmt = salience * spotWake * Math.max(spotInfluence, 0.12)
        const lift = 0.9 + glowAmt * 0.22
        el.style.filter =
          glowAmt > 0.32 && depthVis > 0.28
            ? [
                `brightness(${lift})`,
                `contrast(${1 + glowAmt * 0.08})`,
                `saturate(${1 + glowAmt * 0.04})`,
                `drop-shadow(0 0 ${6 + glowAmt * 14}px rgb(255 248 235 / ${0.04 + glowAmt * 0.1}))`,
              ].join(' ')
            : 'none'

        el.style.zIndex = String(
          Math.round(
            10 +
              depthVis * 50 +
              salience * 45 * Math.max(spotInfluence * spotWake, 0.1),
          ),
        )
      }
    }

    const tick = () => {
      const tgt = pointerTarget.current
      if (!pointerInsideRef.current || !finePointerRef.current) {
        const c = {
          x: window.innerWidth * 0.5,
          y: window.innerHeight * 0.46,
        }
        tgt.x += (c.x - tgt.x) * 0.04
        tgt.y += (c.y - tgt.y) * 0.04
      }

      const pri = pointerPrimary.current
      pri.x += (tgt.x - pri.x) * PRIMARY_LERP
      pri.y += (tgt.y - pri.y) * PRIMARY_LERP

      if (finePointerRef.current) {
        const trails = pointerTrails.current
        let followX = pri.x
        let followY = pri.y
        for (let i = 0; i < trails.length; i += 1) {
          const lerp = TRAIL_LERPS[i]
          trails[i].x += (followX - trails[i].x) * lerp
          trails[i].y += (followY - trails[i].y) * lerp
          followX = trails[i].x
          followY = trails[i].y
        }
      }

      paint()
      rafRef.current = requestAnimationFrame(tick)
    }

    const onScroll = () => {
      progressRef.current = readProgress()
    }

    const onPointer = (e) => {
      if (!finePointerRef.current) return
      pointerInsideRef.current = true
      const convergeT = smoothstep(
        SPOT_CONVERGE_START,
        SPOT_CONVERGE_END,
        progressRef.current,
      )
      const freeT = smoothstep(
        SPOT_FREE_START,
        SPOT_FREE_END,
        progressRef.current,
      )
      const lockT = convergeT * (1 - freeT)
      const influence = 1 - lockT
      if (influence < 0.04) return
      // Full tracking once free; damped only while locked to the CTA.
      const follow = freeT > 0.5 ? 1 : Math.max(influence, 0.08)
      pointerTarget.current.x += (e.clientX - pointerTarget.current.x) * follow
      pointerTarget.current.y += (e.clientY - pointerTarget.current.y) * follow
    }

    const onPointerLeave = () => {
      pointerInsideRef.current = false
    }

    const onPointerEnter = () => {
      pointerInsideRef.current = true
    }

    const onResize = () => {
      finePointerRef.current = canFinePointer()
      if (!finePointerRef.current) {
        const c = centerPointer()
        pointerTarget.current = { ...c }
        pointerPrimary.current = { ...c }
        pointerTrails.current = [{ ...c }, { ...c }, { ...c }]
      }
      onScroll()
    }

    progressRef.current = readProgress()
    rafRef.current = requestAnimationFrame(tick)

    let detachLenis = () => {}
    const attachLenis = () => {
      const lenis = lenisRef?.current
      if (!lenis) return false
      lenis.on('scroll', onScroll)
      detachLenis = () => lenis.off('scroll', onScroll)
      return true
    }

    const rafAttach = requestAnimationFrame(() => {
      if (!attachLenis()) {
        window.addEventListener('scroll', onScroll, { passive: true })
        detachLenis = () =>
          window.removeEventListener('scroll', onScroll)
      }
      onScroll()
    })

    window.addEventListener('pointermove', onPointer, { passive: true })
    document.documentElement.addEventListener('mouseleave', onPointerLeave)
    document.documentElement.addEventListener('mouseenter', onPointerEnter)
    window.addEventListener('blur', onPointerLeave)
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafRef.current)
      cancelAnimationFrame(rafAttach)
      detachLenis()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onPointer)
      document.documentElement.removeEventListener('mouseleave', onPointerLeave)
      document.documentElement.removeEventListener('mouseenter', onPointerEnter)
      window.removeEventListener('blur', onPointerLeave)
      window.removeEventListener('resize', onResize)
      const siteNav = document.querySelector('[data-site-nav]')
      if (siteNav) siteNav.style.opacity = ''
    }
  }, [reducedMotion, lenisRef, prints])

  if (reducedMotion) {
    return (
      <section
        id="spatial-field"
        className="relative z-10 bg-canvas text-ink"
        aria-label="Selected photographs"
      >
        <div
          className="spatial-field-reduced gallery-protected section-pad py-20 md:py-28"
          {...protectedGalleryHandlers}
        >
          <div className="spatial-field-reduced__grid">
            {prints.slice(0, 12).map((print) => (
              <figure key={print.src} className="spatial-field-reduced__item">
                <ProtectedImage
                  src={print.src}
                  alt={print.alt}
                  loading="lazy"
                  decoding="async"
                  className="spatial-field-reduced__img"
                  style={{ width: Math.min(print.width, 120) }}
                />
              </figure>
            ))}
          </div>
          <div className="spatial-field-reduced__cta">
            <SpatialCtaBlock staticAppear />
          </div>
          <div className="spatial-field-meta spatial-field-meta--static">
            <EndingMeta />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      id="spatial-field"
      ref={chapterRef}
      className="relative z-20 bg-canvas text-ink"
      style={{
        marginTop: `-${HANDOFF_OVERLAP_SVH}svh`,
        height: `${CHAPTER_SVH}svh`,
      }}
      aria-label="Spatial photography field"
    >
      <div
        ref={stageRef}
        className="spatial-field-stage sticky top-0 z-10 h-[100svh] overflow-hidden"
      >
        <div
          ref={entranceRef}
          className="spatial-field-entrance absolute inset-0 bg-canvas"
          style={{
            opacity: 1,
            transform: `translate3d(0, ${ENTRANCE_RISE_VH}vh, 0)`,
            willChange: 'transform',
          }}
        >
        <div className="spatial-field-perspective">
          <div
            ref={worldRef}
            className="spatial-field-world gallery-protected"
            {...protectedGalleryHandlers}
          >
            {prints.map((print, index) => (
              <figure
                key={print.src}
                ref={(node) => {
                  itemRefs.current[index] = node
                }}
                className={`spatial-field-print spatial-field-print--${print.orient}`}
                style={{
                  width: print.width,
                  opacity: 0,
                }}
              >
                <ProtectedImage
                  src={print.src}
                  alt={print.alt}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="spatial-field-print__img"
                />
              </figure>
            ))}
          </div>
        </div>

        <div
          ref={fieldSpotRef}
          className="spatial-field-spot"
          style={{ opacity: 0 }}
          aria-hidden
        />

        <div
          ref={ctaBeamRef}
          className="spatial-field-cta__beam"
          style={{ opacity: 0 }}
          aria-hidden
        />

        <SpatialCtaBlock
          ctaRef={ctaRef}
          eyebrowRef={eyebrowRef}
          titleRef={titleRef}
          linkWrapRef={linkWrapRef}
          includeBeam={false}
        />

        <div
          ref={metaRef}
          className="spatial-field-meta"
          style={{ opacity: 0, pointerEvents: 'none' }}
        >
          <EndingMeta />
        </div>
        </div>
      </div>
    </section>
  )
}
