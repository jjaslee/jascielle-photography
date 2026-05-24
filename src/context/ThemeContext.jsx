import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

const STORAGE_KEY = 'jascielle-theme'
const VEIL_MS = 580
const THEME_SWAP_MS = Math.round(VEIL_MS * 0.38)

const ThemeContext = createContext(null)

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function ThemeTransitionOverlay({ variant, onSwap, onComplete }) {
  useEffect(() => {
    const swapTimer = window.setTimeout(onSwap, THEME_SWAP_MS)
    const endTimer = window.setTimeout(onComplete, VEIL_MS)

    return () => {
      window.clearTimeout(swapTimer)
      window.clearTimeout(endTimer)
    }
  }, [onSwap, onComplete])

  return createPortal(
    <div
      className={`theme-transition-overlay theme-transition-overlay--${variant}`}
      aria-hidden="true"
    />,
    document.body,
  )
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })
  const [transition, setTransition] = useState(null)
  const pendingThemeRef = useRef(null)
  const transitioningRef = useRef(false)
  const transitionIdRef = useRef(0)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const finishTransition = useCallback(() => {
    pendingThemeRef.current = null
    transitioningRef.current = false
    setTransition(null)
  }, [])

  const applyTheme = useCallback(
    (next) => {
      if (next === theme) return
      if (transitioningRef.current) return

      if (prefersReducedMotion()) {
        setThemeState(next)
        return
      }

      transitioningRef.current = true
      pendingThemeRef.current = next
      transitionIdRef.current += 1
      setTransition({
        id: transitionIdRef.current,
        variant: next === 'dark' ? 'dim' : 'lighten',
      })
    },
    [theme],
  )

  const handleSwap = useCallback(() => {
    const next = pendingThemeRef.current
    if (next) setThemeState(next)
  }, [])

  const handleComplete = useCallback(() => {
    finishTransition()
  }, [finishTransition])

  const setTheme = useCallback((next) => applyTheme(next), [applyTheme])
  const toggleTheme = useCallback(
    () => applyTheme(theme === 'light' ? 'dark' : 'light'),
    [applyTheme, theme],
  )

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
      {transition && (
        <ThemeTransitionOverlay
          key={transition.id}
          variant={transition.variant}
          onSwap={handleSwap}
          onComplete={handleComplete}
        />
      )}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
