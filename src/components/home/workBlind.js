/** Shared blind timing + progress mapping for click-driven close animations. */

/** Wide stagger so each row reads individually before the next closes. */
export const BLIND_STAGGER_MS = 260
export const BLIND_SELECTED_EXTRA_MS = 100
/** Shorter per-row window so the shut feels crisp. */
export const BLIND_DURATION_MS = 480

/** Total ms for a full close, including the stagger tail. */
export function blindCloseTotalMs(categoryCount, leadingSlats = 0) {
  const lastIndex = Math.max(categoryCount - 1, 0) + leadingSlats
  return (
    lastIndex * BLIND_STAGGER_MS +
    BLIND_SELECTED_EXTRA_MS +
    BLIND_DURATION_MS
  )
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

/** Ease-in cubic for a clean shut with no rebound. */
function easeBlind(t) {
  const x = clamp01(t)
  return x * x * x
}

/**
 * Map global blindProgress (0..1) to per-row progress with bottom-up stagger.
 * The selected row lags slightly so the clicked choice stays legible longer.
 */
export function rowBlindProgress(
  globalP,
  index,
  isSelected,
  categoryCount,
  leadingSlats = 0,
) {
  const total = blindCloseTotalMs(categoryCount, leadingSlats)
  const fromBottom = Math.max(categoryCount - 1, 0) - index
  const delay =
    leadingSlats * BLIND_STAGGER_MS +
    fromBottom * BLIND_STAGGER_MS +
    (isSelected ? BLIND_SELECTED_EXTRA_MS : 0)
  const start = delay / total
  const end = (delay + BLIND_DURATION_MS) / total
  if (globalP <= start) return 0
  if (globalP >= end) return 1
  return (globalP - start) / (end - start)
}

/**
 * Leading slats before the row list (e.g. Work page CTA) — first index closes first.
 */
export function leadingBlindProgress(
  globalP,
  leadingIndex,
  leadingCount,
  categoryCount,
) {
  const total = blindCloseTotalMs(categoryCount, leadingCount)
  const fromFirst = Math.max(leadingCount - 1, 0) - leadingIndex
  const delay = fromFirst * BLIND_STAGGER_MS
  const start = delay / total
  const end = (delay + BLIND_DURATION_MS) / total
  if (globalP <= start) return 0
  if (globalP >= end) return 1
  return (globalP - start) / (end - start)
}

/** Face transform/opacity for the slat close. */
export function faceStyleFromRowProgress(rowP) {
  const t = easeBlind(rowP)
  return {
    transform: `scaleY(${Math.max(1 - t, 0.0001)})`,
    opacity: 1 - t,
  }
}

/** Hairline border fade driven by the same row progress. */
export function ruleStyleFromRowProgress(rowP) {
  const t = easeBlind(rowP)
  if (t < 0.55) {
    return { borderColor: 'rgb(var(--fg) / 0.3)', opacity: 1 }
  }
  const u = (t - 0.55) / 0.45
  return {
    borderColor: `rgb(var(--fg) / ${0.3 * (1 - u)})`,
    opacity: 1 - u,
  }
}
