import { useEffect, useRef } from 'react'
import { heroImages } from '../../data/heroImages'
import { protectedGalleryHandlers } from '../../utils/imageProtection'
import { useLenisRef } from '../../context/LenisContext'
import HeroFlipGallery from './HeroFlipGallery'
import BarrelRollLabel from '../BarrelRollLabel'

export default function Hero() {
  const lenisRef = useLenisRef()
  const scrollLinkRefs = useRef([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const INTERVAL = 10_000
    const HOLD = 700 // ms to hold the rolled state before resetting

    const play = () => {
      scrollLinkRefs.current.forEach((el) => {
        if (!el) return
        el.classList.add('is-playing')
        setTimeout(() => el.classList.remove('is-playing'), HOLD)
      })
    }

    const id = setInterval(play, INTERVAL)
    return () => clearInterval(id)
  }, [])

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
      className="relative flex min-h-[100svh] w-full flex-col items-center justify-start overflow-hidden bg-canvas text-ink gallery-protected pt-16 pb-12 md:justify-center md:pt-20 md:pb-16"
      aria-label="Jascielle Photography"
      {...protectedGalleryHandlers}
    >
      <div className="relative mx-auto flex w-[72vw] max-w-[560px] flex-col items-center md:block md:w-[38vw] md:max-w-[560px]">
        <div className="pointer-events-none z-10 mb-6 text-center md:absolute md:top-1/2 md:mb-0 md:-translate-y-[42%] md:right-[calc(100%-3.25rem)] md:text-left">
          <h1 className="font-display text-[clamp(2.75rem,12vw,4.5rem)] md:text-[clamp(4.5rem,7vw,8rem)] leading-[0.92] text-ink whitespace-nowrap">
            Jascielle
          </h1>
          <p className="mt-2 md:mt-3 font-mono text-[14px] md:text-[15px] font-light tracking-[0.14em] uppercase text-ink/90">
            Photography
          </p>
        </div>

        <HeroFlipGallery images={heroImages} />

        <div className="pointer-events-none absolute z-10 top-1/2 -translate-y-[42%] left-[calc(100%+1.25rem)] hidden text-right md:block">
          <p className="font-mono text-[15px] font-light tracking-[0.14em] uppercase text-ink whitespace-nowrap">
            Bay Area · 2026
          </p>
          <a
            href="#salience"
            onClick={scrollToSalience}
            ref={(el) => { scrollLinkRefs.current[0] = el }}
            className="hero-scroll-link pointer-events-auto mt-3 inline-flex font-mono text-[15px] font-light tracking-[0.14em] uppercase"
            aria-label="Scroll"
          >
            <BarrelRollLabel text="SCROLL ↓" />
          </a>
        </div>

        <div className="pointer-events-none mt-8 flex flex-col items-center gap-3 text-center md:hidden">
          <p className="font-mono text-[14px] font-light tracking-[0.14em] uppercase text-ink whitespace-nowrap">
            Bay Area · 2026
          </p>
          <a
            href="#salience"
            onClick={scrollToSalience}
            ref={(el) => { scrollLinkRefs.current[1] = el }}
            className="hero-scroll-link pointer-events-auto inline-flex font-mono text-[14px] font-light tracking-[0.14em] uppercase"
            aria-label="Scroll"
          >
            <BarrelRollLabel text="SCROLL ↓" />
          </a>
        </div>
      </div>
    </section>
  )
}
