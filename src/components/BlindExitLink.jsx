import { useLocation, useNavigate } from 'react-router-dom'
import { useBlindExit } from '../context/BlindExitContext'
import { scrollToTop, useLenisRef } from '../context/LenisContext'

/**
 * Drop-in replacement for react-router <Link> that plays the blind-close
 * animation before navigating, if WorkRows has registered a handler.
 * Falls back to immediate navigation when no handler is registered.
 * Same-page clicks smooth-scroll to top instead of re-navigating.
 */
export default function BlindExitLink({ to, onClick, children, className, ...rest }) {
  const location = useLocation()
  const navigate = useNavigate()
  const ctx = useBlindExit()
  const lenisRef = useLenisRef()

  const handleClick = (e) => {
    e.preventDefault()
    if (onClick) onClick(e)
    if (location.pathname === to) {
      scrollToTop(lenisRef?.current, { immediate: false })
      return
    }
    if (ctx && ctx.triggerBlindExit(to)) return
    navigate(to)
  }

  return (
    <a href={to} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
