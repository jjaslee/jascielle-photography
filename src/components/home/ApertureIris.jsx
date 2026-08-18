import { useEffect, useRef } from 'react'

/**
 * Camera Aperture V2 (CodePen: rcneil/poXXwRL) — six-blade SVG states.
 * Scroll maps irisProgress across f-stop states 1→7 via path interpolation.
 * Ring omitted; no custom radial spoke geometry.
 */
const VIEW = 620.24
const CX = 310.12
const CY = 310.12
/** Slight overscale so closed blades reach past a square crop; keep open blades on-screen. */
const COVER_SCALE = 1.12
const BLADE_COUNT = 6
const BLADE_BASE = '#080808'
const BLADE_EDGE = '#151515'
/** Safety matte only at exact full close — blades must seal first. */
export const APERTURE_BLACK_START = 1
/** f-stop states 1 (open) → 7 (closed), each with 6 blade paths. */
const APERTURE_STATES = [
  [
    'm434.26 46.499c-50.39-7.1228-161.71-34.834-281.38 21.914l283.59-3.0561z',
    'm586.26 296.18 10.286-18.474c-10.937-96.148-69.368-180.4-155.58-224.34',
    'm460.26 542.3 20.854-0.324c88.287-63.979 120.87-148.18 116.69-246.73',
    'm184.1 556.22 10.625 17.76c88.768 39.172 190.88 30.822 272.28-22.172',
    'm33.975 324.04-10.285 18.48c10.942 96.148 69.368 180.4 155.58 224.34z',
    'm159.98 77.932-20.853 0.328c-76.011 47.786-120.37 136.87-116.69 246.72z',
  ],
  [
    'm332.26 22.791c-60.832 1.133-172.62 17.549-253.98 114.75l320.75-5z',
    'm507.83 297.4 62.102-111.55c-47.826-107.92-170.9-163.06-225.73-161.93',
    'm419.94 474.96 127.84-1.994c72.104-103.9 59.909-215.72 27.218-276.51',
    'm222.35 487.66 65.593 109.62c153.5 9.5035 226-83.421 252.95-114.6',
    'm112.5 322.81-62.16 111.65c44.117 98.575 140.19 153.05 225.86 161.93z',
    'm200.3 145.27-127.84 1.995c-35.553 33.703-77.351 162.85-27.275 276.61z',
  ],
  [
    'm274.9 24.22c-77.492 6.3646-182.14 65.476-225.75 163.76l320.75-5z',
    'm450.19 298.31 89.992-161.65c-69.95-95.714-166.36-124.76-254.75-113.71',
    'm390.38 425.46 184.88-2.885c49.98-112.46 10.04-234.59-28.754-277.54',
    'm250.41 437.27 95.05 158.85c164.18-23.682 214.81-135.89 225.74-163.86',
    'm170.2 321.92-89.992 161.64c61.919 90.484 170.2 120.5 254.76 113.73z',
    'm229.9 194.78-184.82 2.886c-36.668 64.721-36.668 203.17 28.707 277.55z',
  ],
  [
    'm240 30.77c-96.372 24.166-173.52 96.232-204.18 190.74l315.37-4.921z',
    'm405.94 289.38 104.13-187.02c-58.415-62.248-169.85-95.556-260.36-74.096',
    'm359.45 392.62 227.94-3.557c36.494-137.94-22.424-233.5-70.389-279.42',
    'm269.04 403.65 111.15 185.77c155.03-43.517 193.08-162.72 204.01-190.69',
    'm208.6 321.31-105.38 189.29c85.949 87.935 193.94 98.07 267.28 81.321z',
    'm249.7 227.78-216.66 3.38c-32.4 99.193 2.8606 212.17 63.332 272.05z',
  ],
  [
    'm215.3 38.153c-93.863 32.734-164.25 111.5-186.28 208.43l308.11-4.807z',
    'm382.8 299.35 115.46-207.39c-82.064-70.278-177.92-86.263-273.76-57.175',
    'm355.82 367.69 237.25-3.699c27.28-149.27-38.319-221.62-87.363-265.51',
    'm283.07 378.45 121.88 203.7c141.29-44.279 176.55-175.16 186.25-208.5',
    'm237.4 320.86-115.45 207.39c93.96 83.739 210.57 77.818 273.8 57.255z',
    'm264.5 252.53-237.52 3.709c-27.912 120.51 30.986 221.66 87.643 265.5z',
  ],
  [
    'm199.4 44.058c-91.836 38.234-157.49 121.09-173.7 219.23l302.06-4.715z',
    'm363.57 299.66 121.63-218.47c-83.59-64.175-184.75-75.259-276.78-40.83',
    'm345.95 351.19 249.86-3.896c17.33-155.2-64.354-221.9-102.91-260.07',
    'm286.46 361.75 134.39 214.55c132.66-43.302 168.59-186 173.74-219.35',
    'm256.6 320.57-121.63 218.47c106.74 79.734 218.56 63.471 276.64 40.619z',
    'm274.3 269.04-249.82 3.901c-16.469 122.04 52.795 228.06 102.86 260.05z',
  ],
  [
    'm180.4 52.622c-88.863 44.868-148.3 132.39-157.25 231.54l293.06-4.567z',
    'm339.63 300.03 128.62-231.04c-85.116-60.361-210.26-57.81-279.02-20.33',
    'm333.62 330.57 264.14-4.12c6.811-156.82-99.282-241.96-121.65-251.8',
    'm304.16 340.65 135.66 226.74c110.54-45.591 154.52-171.63 157.38-231.3',
    'm280.7 320.2-128.62 231.02c118.61 72.182 210.16 47.311 279.03 20.354z',
    'm286.7 289.67-264.14 4.12c-9.726 130.4 75.371 221.69 121.66 251.8z',
  ],
]

/** Inner pivots pulled to center; outer movetos preserved to avoid blade slide. */
const APERTURE_SEALED = [
  'm180.4 52.622c-88.863 44.868-148.3 132.39-157.25 231.54l286.97 25.958z',
  'm310.12 310.12 128.62-231.04c-85.116-60.361-210.26-57.81-279.02-20.33',
  'm310.12 310.12 264.14-4.12c6.811-156.82-99.282-241.96-121.65-251.8',
  'm310.12 310.12 135.66 226.74c110.54-45.591 154.52-171.63 157.38-231.3',
  'm310.12 310.12-128.62 231.02c118.61 72.182 210.16 47.311 279.03 20.354z',
  'm310.12 310.12-264.14 4.12c-9.726 130.4 75.371 221.69 121.66 251.8z',
]

/** Iris progress where the final center seal begins (within close 0→1). */
const SEAL_START = 0.88
const OPEN_STATE_END = APERTURE_STATES.length - 1

/** Scroll progress where blades begin closing. */
export const APERTURE_CLOSE_START = 0.65
/** Scroll progress where blades reach full closure (and stay closed). */
export const APERTURE_CLOSE_END = 0.86

/**
 * Map Salience chapter progress → aperture close amount.
 * Closes 0→1 over [CLOSE_START, CLOSE_END], then stays fully closed.
 * Does not reopen — Work assembles after a black hold instead.
 */
export function apertureCloseFromChapter(p) {
  if (p < APERTURE_CLOSE_START) return 0
  if (p < APERTURE_CLOSE_END) {
    return (p - APERTURE_CLOSE_START) / (APERTURE_CLOSE_END - APERTURE_CLOSE_START)
  }
  return 1
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function easeInQuad(value) {
  const t = clamp01(value)
  return t * t
}

/** Scroll-close easing: slow 0–70%, accelerate 70–85%, snap last 15%. */
function closeEase(t) {
  const x = clamp01(t)
  if (x <= 0.7) return (x / 0.7) * 0.62
  if (x <= 0.85) {
    const u = (x - 0.7) / 0.15
    return 0.62 + 0.22 * u * u
  }
  const u = (x - 0.85) / 0.15
  return 0.84 + 0.16 * u * u
}

const NUM_RE = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi

/** Linearly interpolate matching SVG path number tokens (states share structure). */
function lerpPath(fromD, toD, t) {
  if (t <= 0) return fromD
  if (t >= 1) return toD
  const toNums = toD.match(NUM_RE)
  if (!toNums) return fromD
  let i = 0
  return fromD.replace(NUM_RE, (n) => {
    const a = parseFloat(n)
    const b = parseFloat(toNums[i++] ?? n)
    return (a + (b - a) * t).toFixed(3)
  })
}

/** Lerp open→sealed; moveto snaps late so blades don't slide across the frame. */
function lerpSealPath(fromD, toD, t, bladeIndex) {
  if (t <= 0) return fromD
  if (t >= 1) return toD
  const fromNums = fromD.match(NUM_RE)
  const toNums = toD.match(NUM_RE)
  if (!fromNums || !toNums) return fromD

  const pivotSnap = easeInQuad(clamp01((t - 0.82) / 0.18))
  let i = 0
  return fromD.replace(NUM_RE, (n) => {
    const idx = i++
    const a = parseFloat(n)
    const b = parseFloat(toNums[idx] ?? n)
    if (idx < 2 && bladeIndex !== 0) {
      return (a + (b - a) * pivotSnap).toFixed(3)
    }
    return (a + (b - a) * t).toFixed(3)
  })
}

function bladePathsAtClose(close) {
  const t = clamp01(close)

  if (t < SEAL_START) {
    const u = closeEase(t / SEAL_START) * OPEN_STATE_END
    const i0 = Math.min(Math.floor(u), OPEN_STATE_END)
    const i1 = Math.min(i0 + 1, OPEN_STATE_END)
    const localT = u - i0
    const a = APERTURE_STATES[i0]
    const b = APERTURE_STATES[i1]
    return a.map((d, blade) => lerpPath(d, b[blade], localT))
  }

  const openPaths = APERTURE_STATES[OPEN_STATE_END]
  const sealT = easeInQuad((t - SEAL_START) / (1 - SEAL_START))
  return openPaths.map((d, blade) => lerpSealPath(d, APERTURE_SEALED[blade], sealT, blade))
}

export function applyApertureClose(rootEl, close) {
  if (!rootEl) return
  const svg = rootEl.ownerSVGElement
  const t = clamp01(close)

  if (t <= 0.002) {
    if (svg) {
      svg.style.visibility = 'hidden'
      svg.setAttribute('aria-hidden', 'true')
    }
    const black = rootEl.querySelector('[data-iris-black]')
    if (black) {
      black.style.visibility = 'hidden'
      black.style.opacity = '0'
    }
    const scaleGroup = rootEl.querySelector('[data-iris-scale]')
    if (scaleGroup) {
      scaleGroup.setAttribute(
        'transform',
        `translate(${CX} ${CY}) scale(${COVER_SCALE}) translate(${-CX} ${-CY})`,
      )
    }
    rootEl.dataset.irisProgress = '0'
    return
  }

  if (svg) {
    svg.style.visibility = 'visible'
    svg.setAttribute('aria-hidden', 'true')
  }

  const paths = bladePathsAtClose(t)
  rootEl.querySelectorAll('[data-iris-blade]').forEach((blade, index) => {
    if (paths[index]) blade.setAttribute('d', paths[index])
  })

  const scaleGroup = rootEl.querySelector('[data-iris-scale]')
  if (scaleGroup) {
    const seal = t >= SEAL_START ? easeInQuad((t - SEAL_START) / (1 - SEAL_START)) : 0
    const scale = COVER_SCALE + seal * 0.08
    scaleGroup.setAttribute(
      'transform',
      `translate(${CX} ${CY}) scale(${scale}) translate(${-CX} ${-CY})`,
    )
  }

  const black = rootEl.querySelector('[data-iris-black]')
  if (black) {
    const blackProgress = clamp01(
      (t - APERTURE_BLACK_START) / (1 - APERTURE_BLACK_START),
    )
    black.style.visibility = blackProgress > 0 ? 'visible' : 'hidden'
    black.style.opacity = blackProgress.toFixed(4)
  }

  rootEl.dataset.irisProgress = t.toFixed(4)
}

export default function ApertureIris({ pathRef }) {
  const localRef = useRef(null)

  useEffect(() => {
    const el = localRef.current
    if (pathRef) pathRef.current = el
    applyApertureClose(el, 0)
  }, [pathRef])

  const openPaths = APERTURE_STATES[0]

  return (
    <svg
      className="aperture-iris pointer-events-none absolute inset-0 z-20 h-full w-full overflow-hidden"
      viewBox={`0 0 ${VIEW} 620.22`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        {/* Narrow one-sided lift on the leading edge only. */}
        {Array.from({ length: BLADE_COUNT }, (_, index) => (
          <linearGradient
            key={index}
            id={`aperture-blade-fill-${index}`}
            gradientUnits="objectBoundingBox"
            x1="0"
            y1="1"
            x2="0"
            y2="0"
            gradientTransform={`rotate(${index * 60} 0.5 0.5)`}
          >
            <stop offset="0%" stopColor={BLADE_EDGE} />
            <stop offset="8%" stopColor={BLADE_EDGE} />
            <stop offset="12%" stopColor={BLADE_BASE} />
            <stop offset="100%" stopColor={BLADE_BASE} />
          </linearGradient>
        ))}
      </defs>

      <g ref={localRef}>
        <g
          data-iris-scale=""
          transform={`translate(${CX} ${CY}) scale(${COVER_SCALE}) translate(${-CX} ${-CY})`}
        >
          {openPaths.map((d, index) => (
            <path
              key={index}
              data-iris-blade=""
              d={d}
              fill={`url(#aperture-blade-fill-${index})`}
              stroke="none"
            />
          ))}
        </g>
        <rect
          data-iris-black=""
          x={-VIEW}
          y={-VIEW}
          width={VIEW * 3}
          height={VIEW * 3}
          fill="#000000"
          opacity="0"
          style={{ visibility: 'hidden', pointerEvents: 'none' }}
        />
      </g>
    </svg>
  )
}
