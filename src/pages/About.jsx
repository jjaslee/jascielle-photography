import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BlindExitLink from '../components/BlindExitLink'
import BarrelRollLabel from '../components/BarrelRollLabel'
import ProtectedImage from '../components/ProtectedImage'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { protectedGalleryHandlers } from '../utils/imageProtection'
import { useBlindExit } from '../context/BlindExitContext'
import {
  blindCloseTotalMs,
  faceStyleFromRowProgress,
  rowBlindProgress,
} from '../components/home/workBlind'

// Number of "slats" on the About page (title, portrait, p1, p2, intro1, intro2, closing, cta)
const SLAT_COUNT = 8

const PORTRAITS = [
  {
    src: '/images/about/IMG_3898.jpg',
    alt: 'Jasmine C. Lee holding her graduation cap at Sather Gate',
  },
  {
    src: '/images/about/about-me-goals.jpg',
    alt: 'Jasmine C. Lee photographing a city from a rocky overlook',
  },
]

function AboutReveal({ children, className = '', delay = 0, lift = false }) {
  const { ref, visible } = useScrollReveal()

  return (
    <div
      ref={ref}
      className={`ease-elegant ${
        lift ? 'transition-[opacity,transform] duration-700' : 'transition-opacity duration-700'
      } ${visible ? 'opacity-100 translate-y-0' : `opacity-0 ${lift ? 'translate-y-3' : ''}`} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}

function AboutPortrait({ blindStyle }) {
  const [index, setIndex] = useState(0)
  const [fineHover, setFineHover] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const sync = () => setFineHover(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const toggle = () => setIndex((current) => 1 - current)

  return (
    <div className="origin-top will-change-transform" style={blindStyle}>
      <button
        type="button"
        aria-label="Show other portrait"
        onMouseEnter={() => {
          if (fineHover) toggle()
        }}
        onClick={(e) => {
          if (!fineHover || e.detail === 0) toggle()
        }}
        className="relative mx-auto block aspect-square w-[74vw] max-w-[320px] cursor-pointer overflow-hidden border-0 bg-transparent p-0 gallery-protected focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ink/40"
        {...protectedGalleryHandlers}
      >
        {PORTRAITS.map((photo, i) => (
          <ProtectedImage
            key={photo.src}
            src={photo.src}
            alt={i === index ? photo.alt : ''}
            aria-hidden={i === index ? undefined : true}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ease-elegant ${
              i === index ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
      </button>
    </div>
  )
}

/** Compute the blind style for a given slat index (bottom-up: high index = bottom). */
function slatStyle(blindProgress, slatIndex) {
  if (blindProgress <= 0) return undefined
  const p = rowBlindProgress(blindProgress, slatIndex, false, SLAT_COUNT)
  return faceStyleFromRowProgress(p)
}

export default function About() {
  const navigate = useNavigate()
  const ctx = useBlindExit()
  const [blindProgress, setBlindProgress] = useState(0)
  const blindRafRef = useRef(0)
  const navTimerRef = useRef(0)
  const drivingRef = useRef(false)

  const runBlindClose = useCallback((to) => {
    if (drivingRef.current) return
    drivingRef.current = true

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduceMotion ? 0 : blindCloseTotalMs(SLAT_COUNT)

    const finish = () => {
      cancelAnimationFrame(blindRafRef.current)
      clearTimeout(navTimerRef.current)
      setBlindProgress(1)
      navigate(to)
    }

    if (duration < 16) { finish(); return }

    navTimerRef.current = setTimeout(finish, duration)
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      setBlindProgress(1 - (1 - t) ** 3)
      if (t < 1) blindRafRef.current = requestAnimationFrame(tick)
    }
    blindRafRef.current = requestAnimationFrame(tick)
  }, [navigate])

  useEffect(() => {
    if (!ctx) return
    return ctx.register(runBlindClose)
  }, [ctx, runBlindClose])

  useEffect(() => () => {
    cancelAnimationFrame(blindRafRef.current)
    clearTimeout(navTimerRef.current)
  }, [])

  // Slat order top→bottom: 0=title 1=portrait 2=p1 3=p2 4=intro1 5=intro2 6=closing 7=cta
  // rowBlindProgress collapses from bottom (high index) to top (low index)
  const s = (i) => slatStyle(blindProgress, i)

  return (
    <section className="section-pad text-ink pt-32 md:pt-40 pb-28 md:pb-40">
      <div className="mx-auto flex max-w-full flex-col items-center text-center">

        <AboutReveal>
          <div className="origin-top will-change-transform" style={s(0)}>
            <h1 className="font-display font-normal leading-[1.1] text-ink text-[clamp(4rem,6vw,6.5rem)]">
              About
            </h1>
          </div>
        </AboutReveal>

        <AboutReveal delay={90} lift className="mt-8 md:mt-12">
          <AboutPortrait blindStyle={s(1)} />
        </AboutReveal>

        <div className="mt-16 md:mt-20 w-[88vw] max-w-[720px] font-mono font-light text-pretty text-ink/80 tracking-[0.03em] md:tracking-[0.045em] text-[clamp(0.95rem,1.25vw,1.15rem)] leading-[1.85]">
          <div className="flex flex-col gap-8">
            <AboutReveal delay={0}>
              <div className="origin-top will-change-transform" style={s(2)}>
                <p>
                  We remember moments before we understand their{' '}
                  <span className="text-salience-warm">semantics</span>. In a world where life
                  continues with or without you, I've come to derive meaning from moments
                  that would otherwise dissipate within seconds.
                </p>
              </div>
            </AboutReveal>
            <AboutReveal delay={80}>
              <div className="origin-top will-change-transform" style={s(3)}>
                <p>
                  Through photography, I've stopped passively moving through my surroundings. Whether
                  positive or negative, I find it a blessing for any emotion to{' '}
                  <span className="text-salience-warm">linger</span> just a little while longer. At
                  its core, who are we if told our{' '}
                  <span className="text-salience-warm">memories</span> are not uniquely ours?
                </p>
              </div>
            </AboutReveal>
          </div>

          <AboutReveal delay={160} className="mt-16 md:mt-[5.5rem]">
            <div className="origin-top will-change-transform" style={s(4)}>
              <p>Uhm anyways, I'm Jasmine C. Lee ("J-C-L").</p>
            </div>
          </AboutReveal>
          <AboutReveal delay={240}>
            <div className="origin-top will-change-transform" style={s(5)}>
              <p>Thank you for coming to my yap session!</p>
            </div>
          </AboutReveal>

          <AboutReveal delay={320} className="mx-auto mt-10 md:mt-12 max-w-[34rem] text-ink">
            <div className="origin-top will-change-transform" style={s(6)}>
              <p>
                I hope to help you preserve not only how a moment looks, but what it comes to{' '}
                <span className="text-salience-warm">mean</span>.
              </p>
            </div>
          </AboutReveal>

          <AboutReveal delay={400} className="mt-12 md:mt-16">
            <div className="origin-top will-change-transform" style={s(7)}>
              <BlindExitLink
                to="/book"
                aria-label="Let's talk"
                className="featured-cta-link font-mono font-light text-[13px] md:text-[14px] tracking-[0.08em] uppercase whitespace-nowrap"
              >
                <BarrelRollLabel text="Let's talk" />{' '}
                <span className="featured-cta-arrow">→</span>
              </BlindExitLink>
            </div>
          </AboutReveal>
        </div>
      </div>
    </section>
  )
}
