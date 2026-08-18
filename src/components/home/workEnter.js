/** Entrance choreography for Selected Work after aperture black hold. */

/**
 * Brief black beat after full close, in svh of scroll (not time).
 * Keeps reverse/forward scrub fully scroll-linked.
 */
export const BLACK_HOLD_SVH = 12

/** @deprecated time hold — scroll hold is authoritative */
export const BLACK_HOLD_MS = 200

/**
 * Scroll distance (svh) that scrubs enterProgress 0→1 after the black beat.
 * Long enough to feel intentional; short enough to avoid a dead black gap.
 */
export const ENTER_SCROLL_SVH = 180

/** Horizontal travel before settle (px). */
export const ENTER_OFFSET_PX = 96

/** No spring overshoot — settle lands at rest. */
export const ENTER_OVERSHOOT_PX = 0

/** Each row’s slide window (relative timing within enter scrub). */
export const ENTER_ROW_DURATION_MS = 1600
/** Wide stagger so rows move nearly one-at-a-time. */
export const ENTER_ROW_STAGGER_MS = 340

/** Label fades before the first row. */
export const ENTER_LABEL_DURATION_MS = 900
export const ENTER_LABEL_LEAD_MS = 0
export const ENTER_LABEL_Y_PX = 6

/** Top rule draws in just before row 01. */
export const ENTER_RULE_DURATION_MS = 800
export const ENTER_RULE_LEAD_MS = 160

/** Rows begin after label has a head start. */
export const ENTER_ROWS_LEAD_MS = 360

/** Unlock hover when the last row is nearly settled. */
export const ENTER_INTERACT_AT = 0.92

import { APERTURE_CLOSE_END } from './ApertureIris'

/**
 * Layout-stable scrolledIntoWork (px) where aperture reaches full close.
 * Same every pass — no one-shot origin capture.
 */
export function closeIntoWorkPx(salienceEl, overlapSvh, vh) {
  if (!salienceEl) return 0
  const salRange = Math.max(salienceEl.offsetHeight - vh, 0)
  const overlapPx = (overlapSvh / 100) * vh
  return APERTURE_CLOSE_END * salRange - salienceEl.offsetHeight + overlapPx
}

/** scrolledIntoWork where Selected Work assemble scrub begins. */
export function enterStartIntoWorkPx(salienceEl, overlapSvh, vh) {
  const holdPx = (BLACK_HOLD_SVH / 100) * vh
  return closeIntoWorkPx(salienceEl, overlapSvh, vh) + holdPx
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

/** Soft ease-in-out (quint) — slow start and finish, no snap. */
function easeInOutQuint(t) {
  const x = clamp01(t)
  return x < 0.5
    ? 16 * x * x * x * x * x
    : 1 - Math.pow(-2 * x + 2, 5) / 2
}

/** Position factor 0→1 — pure ease to rest, no overshoot. */
function settleFactor(t) {
  return easeInOutQuint(t)
}

/** Total ms from assemble start until the last row finishes. */
export function enterTotalMs(categoryCount) {
  const n = Math.max(categoryCount, 1)
  return (
    ENTER_ROWS_LEAD_MS +
    (n - 1) * ENTER_ROW_STAGGER_MS +
    ENTER_ROW_DURATION_MS
  )
}

/** Global 0..1 from elapsed ms. */
export function enterProgressFromElapsed(elapsedMs, categoryCount) {
  const total = Math.max(enterTotalMs(categoryCount), 1)
  return clamp01(elapsedMs / total)
}

function localProgress(globalP, startMs, durationMs, totalMs) {
  const start = startMs / totalMs
  const end = (startMs + durationMs) / totalMs
  if (globalP <= start) return 0
  if (globalP >= end) return 1
  return (globalP - start) / Math.max(end - start, 1e-6)
}

/** Odd indices (0-based even) enter from the left. */
export function rowEnterFromLeft(index) {
  return index % 2 === 0
}

/**
 * Map global enter progress → heading opacity / translateY.
 */
export function headingEnterStyle(globalP, categoryCount) {
  const total = enterTotalMs(categoryCount)
  const local = localProgress(
    globalP,
    ENTER_LABEL_LEAD_MS,
    ENTER_LABEL_DURATION_MS,
    total,
  )
  const t = easeInOutQuint(local)
  return {
    opacity: t,
    transform: `translate3d(0, ${(1 - t) * ENTER_LABEL_Y_PX}px, 0)`,
  }
}

/**
 * Top rule under Selected Work — fade only (no scaleX on the list wrapper).
 */
export function topRuleEnterStyle(globalP, categoryCount) {
  const total = enterTotalMs(categoryCount)
  const local = localProgress(
    globalP,
    ENTER_RULE_LEAD_MS,
    ENTER_RULE_DURATION_MS,
    total,
  )
  const t = easeInOutQuint(local)
  return {
    opacity: t,
  }
}

/**
 * Per-row face: slide in from the side as a rigid unit (no scale squeeze).
 */
export function rowEnterFaceStyle(globalP, index, categoryCount) {
  const total = enterTotalMs(categoryCount)
  const startMs = ENTER_ROWS_LEAD_MS + index * ENTER_ROW_STAGGER_MS
  const local = localProgress(
    globalP,
    startMs,
    ENTER_ROW_DURATION_MS,
    total,
  )
  const settled = settleFactor(local)
  const fromLeft = rowEnterFromLeft(index)
  const dir = fromLeft ? -1 : 1
  const x = dir * ENTER_OFFSET_PX * (1 - settled)

  return {
    opacity: easeInOutQuint(local),
    transform: `translate3d(${x}px, 0, 0)`,
  }
}

/**
 * Row separator fades with the row — opacity only so the slat never scaleX-squeezes.
 */
export function rowEnterRuleStyle(globalP, index, categoryCount) {
  const total = enterTotalMs(categoryCount)
  const startMs = ENTER_ROWS_LEAD_MS + index * ENTER_ROW_STAGGER_MS
  const local = localProgress(
    globalP,
    startMs,
    ENTER_ROW_DURATION_MS,
    total,
  )
  const t = easeInOutQuint(local)
  return {
    opacity: t,
  }
}

/** True when entrance is far enough along for hit-testing. */
export function enterAllowsInteraction(globalP) {
  return globalP >= ENTER_INTERACT_AT
}
