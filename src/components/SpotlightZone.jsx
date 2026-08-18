import { useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useSpotlightMove } from '../hooks/useSpotlightMove'

/** Dark-background block: spotlight in light mode only (global spotlight covers dark theme). */
export default function SpotlightZone({ children, className = '' }) {
  const { theme } = useTheme()
  const zoneRef = useRef(null)
  const glowRef = useRef(null)
  const [active, setActive] = useState(false)

  useSpotlightMove(theme === 'light', (e) => {
    const zone = zoneRef.current
    const glow = glowRef.current
    if (!zone || !glow) return

    const rect = zone.getBoundingClientRect()
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom

    setActive(inside)
    if (!inside) return

    glow.style.setProperty('--spotlight-x', `${e.clientX - rect.left}px`)
    glow.style.setProperty('--spotlight-y', `${e.clientY - rect.top}px`)
    glow.style.removeProperty('opacity')
  })

  return (
    <section ref={zoneRef} className={`relative overflow-hidden ${className}`}>
      {theme === 'light' && (
        <div
          ref={glowRef}
          className={`spotlight-zone__glow transition-opacity duration-300 ${
            active ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ opacity: 0 }}
          aria-hidden="true"
        />
      )}
      <div className="relative z-10">{children}</div>
    </section>
  )
}
