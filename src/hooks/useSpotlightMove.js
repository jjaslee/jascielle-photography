import { useEffect, useRef } from 'react'

export function useSpotlightMove(enabled, onMove) {
  const rafRef = useRef(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  useEffect(() => {
    if (!enabled) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (prefersReduced || !finePointer) return

    const handleMove = (e) => {
      if (rafRef.current != null) return
      rafRef.current = requestAnimationFrame(() => {
        onMoveRef.current(e)
        rafRef.current = null
      })
    }

    window.addEventListener('mousemove', handleMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMove)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [enabled])
}
