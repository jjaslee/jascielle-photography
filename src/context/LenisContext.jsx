import { createContext, useContext, useEffect, useRef } from 'react'
import Lenis from 'lenis'

const ScrollContext = createContext(null)

export function scrollToTop(lenis, options = { immediate: true }) {
  if (lenis) {
    lenis.scrollTo(0, { immediate: options.immediate })
  } else {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: options.immediate ? 'auto' : 'smooth',
    })
  }
}

/** Scroll to #work, past the iris overlap so Selected Work is on screen. */
export function scrollToWork(lenis, { immediate = false } = {}) {
  const target = document.getElementById('work')
  if (!target) return

  const offsetSvh = Number(target.dataset.navScrollOffsetSvh || 0)
  const offset = (offsetSvh / 100) * window.innerHeight

  if (lenis) {
    lenis.scrollTo(target, {
      offset,
      // Ease-out: paced travel, then a long decelerating settle onto Selected Work.
      duration: immediate ? 0 : 10000.5,
      easing: immediate
        ? undefined
        : (t) => 1 - Math.pow(1 - t, 5),
      immediate,
    })
    return
  }

  const top =
    target.getBoundingClientRect().top + window.scrollY + offset
  window.scrollTo({
    top,
    behavior: immediate ? 'auto' : 'smooth',
  })
}

export function LenisProvider({ children }) {
  const lenisRef = useRef(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const lenis = new Lenis({
      duration: 1.55,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      autoRaf: true,
    })

    lenisRef.current = lenis
    document.documentElement.classList.add('lenis')

    return () => {
      lenis.destroy()
      lenisRef.current = null
      document.documentElement.classList.remove('lenis')
    }
  }, [])

  return (
    <ScrollContext.Provider value={{ lenisRef }}>
      {children}
    </ScrollContext.Provider>
  )
}

export function useLenisRef() {
  const ctx = useContext(ScrollContext)
  return ctx?.lenisRef ?? null
}
