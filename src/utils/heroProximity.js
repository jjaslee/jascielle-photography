export const HERO_PROXIMITY_RADIUS = 325

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

/** Shortest distance from a point to a rectangle (0 when inside). */
export function distanceToRect(px, py, rect) {
  const closestX = Math.max(rect.left, Math.min(px, rect.right))
  const closestY = Math.max(rect.top, Math.min(py, rect.bottom))
  return Math.hypot(px - closestX, py - closestY)
}

/** 1 at the photograph edge, 0 at or beyond the influence radius. */
export function proximityInfluence(distance, radius = HERO_PROXIMITY_RADIUS) {
  if (distance >= radius) return 0
  return smoothstep(1 - distance / radius)
}

/** Direction from photograph center, scaled by proximity falloff. */
export function computeHeroPointer(clientX, clientY, rect) {
  const distance = distanceToRect(clientX, clientY, rect)
  const influence = proximityInfluence(distance)
  const cx = rect.left + rect.width * 0.5
  const cy = rect.top + rect.height * 0.5
  const halfW = Math.max(rect.width * 0.5, 1)
  const halfH = Math.max(rect.height * 0.5, 1)
  const nx = Math.max(-1, Math.min(1, (clientX - cx) / halfW))
  const ny = Math.max(-1, Math.min(1, (clientY - cy) / halfH))
  return { nx, ny, influence }
}
