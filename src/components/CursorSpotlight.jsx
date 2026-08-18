import { useRef } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useSpotlightMove } from '../hooks/useSpotlightMove'

export default function CursorSpotlight() {
  const { theme } = useTheme()
  const layerRef = useRef(null)
  const activeRef = useRef(false)

  useSpotlightMove(theme === 'dark', (e) => {
    const layer = layerRef.current
    if (!layer) return
    layer.style.setProperty('--spotlight-x', `${e.clientX}px`)
    layer.style.setProperty('--spotlight-y', `${e.clientY}px`)
    if (!activeRef.current) {
      activeRef.current = true
      layer.style.opacity = '1'
    }
  })

  if (theme !== 'dark') return null

  return (
    <div
      ref={layerRef}
      className="cursor-spotlight"
      style={{ opacity: 0 }}
      aria-hidden="true"
    />
  )
}
