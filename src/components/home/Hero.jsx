import { useRef } from 'react'
import { protectedGalleryHandlers } from '../../utils/imageProtection'
import { useLenisRef } from '../../context/LenisContext'
import HeroParallax from './HeroParallax'

function ScrollLinkLabel({ text }) {
  const chars = Array.from(text)
  return (
    <span className="hero-scroll-link__label" aria-hidden="true">
      {chars.map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className={`hero-scroll-link__char${ch === ' ' ? ' is-space' : ''}`}
          style={{ '--i': i }}
        >
          <span className="hero-scroll-link__char-roll">
            <span className="hero-scroll-link__char-glyph">
              {ch === ' ' ? '\u00a0' : ch}
            </span>
            <span className="hero-scroll-link__char-glyph" aria-hidden="true">
              {ch === ' ' ? '\u00a0' : ch}
            </span>
          </span>
        </span>
      ))}
    </span>
  )
}

export default function Hero() {
  const stageRef = useRef(null)
  const textRef = useRef(null)
  const lenisRef = useLenisRef()

  const scrollToSalience = (e) => {
    e.preventDefault()
    const target = document.getElementById('salience')
    if (!target) return

    const lenis = lenisRef?.current
    if (lenis) {
      lenis.scrollTo(target, { offset: 0, duration: 1.55 })
      return
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section
      ref={stageRef}
      className="relative h-[100svh] min-h-[28rem] w-full overflow-hidden bg-black gallery-protected"
      aria-label="Jascielle Photography"
      {...protectedGalleryHandlers}
    >
      <HeroParallax stageRef={stageRef} textRef={textRef} />

      <div
        ref={textRef}
        className="relative z-10 flex h-full flex-col justify-end section-pad pb-10 md:pb-14 pt-16 will-change-transform"
      >
        <div className="flex items-start justify-between gap-6 w-full">
          <h1 className="font-sans text-[18px] md:text-[20px] font-bold tracking-editorial uppercase text-white max-w-[12rem] sm:max-w-none leading-snug">
            Jascielle Photography
          </h1>

          <div className="text-right shrink-0">
            <p className="font-sans text-[16px] md:text-[18px] font-semibold tracking-editorial uppercase text-white">
              Bay Area · 2026
            </p>
            <a
              href="#salience"
              onClick={scrollToSalience}
              className="hero-scroll-link font-sans text-[12px] md:text-[14px] font-semibold tracking-editorial uppercase"
              aria-label="Scroll"
            >
              <ScrollLinkLabel text="SCROLL ↓" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
