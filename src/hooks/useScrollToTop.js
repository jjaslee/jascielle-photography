import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { scrollToTop, useLenisRef } from '../context/LenisContext'

export const SMOOTH_SCROLL_STATE = { scrollToTop: 'smooth' }

export function useScrollToTopOnNavigate() {
  const location = useLocation()
  const lenisRef = useLenisRef()

  useEffect(() => {
    const smooth = location.state?.scrollToTop === 'smooth'
    scrollToTop(lenisRef?.current, { immediate: !smooth })
  }, [location.pathname, location.key, location.state, lenisRef])
}

export function useScrollToTop() {
  const lenisRef = useLenisRef()
  return (options = { immediate: true }) => scrollToTop(lenisRef?.current, options)
}

export function useFooterNavClick() {
  const location = useLocation()
  const lenisRef = useLenisRef()

  return (to) => (e) => {
    if (location.pathname === to) {
      e.preventDefault()
      scrollToTop(lenisRef?.current, { immediate: false })
    }
  }
}
