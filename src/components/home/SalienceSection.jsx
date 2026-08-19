import { useEffect, useMemo, useRef, useState } from 'react'
import { useLenisRef } from '../../context/LenisContext'
import { useSalienceHandoff } from '../../context/SalienceHandoffContext'
import {
  APERTURE_CLOSE_END,
  apertureCloseFromChapter,
} from './ApertureIris'
import { BLACK_HOLD_SVH } from './workEnter'

const DEFINITION =
  'Perceptual salience modulation describes how the brain dynamically shifts attention toward sensory stimuli based on context, memory, and internal state.'

const RULE_BOTTOM = [0.55, 1]
const QUOTE_LIFT = [0.42, 0.88]
const QUOTE_LIFT_VH = 8

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

function scaleFromProgress(p, start, end) {
  return clamp01((p - start) / Math.max(end - start, 1e-6))
}

function DefWord({ i, last, animated, warm = false, children }) {
  if (!animated) {
    return (
      <span className={warm ? 'text-salience-warm' : undefined}>{children}</span>
    )
  }
  return (
    <span
      className={`salience-word${warm ? ' salience-word--warm' : ''}`.trim()}
      style={{ '--t': i / last }}
    >
      {children}
    </span>
  )
}

function MonoRun({ words, from, to, last, animated }) {
  const slice = words.slice(from, to + 1)
  return slice.map((word, k) => {
    const i = from + k
    return (
      <span key={`${word}-${i}`}>
        {k > 0 ? ' ' : ''}
        <DefWord i={i} last={last} animated={animated}>
          {word}
        </DefWord>
      </span>
    )
  })
}

function SalienceQuote({ animated }) {
  const words = useMemo(() => DEFINITION.trim().split(/\s+/), [])
  const last = Math.max(words.length - 1, 1)

  return (
    <div className="salience-quote">
      <h2 id="salience-heading" className="salience-quote__title">
        Perceptual salience modulation
      </h2>
      <p className="salience-quote__body">
        <MonoRun words={words} from={3} to={8} last={last} animated={animated} />{' '}
        <span className="salience-quote__script">
          <DefWord i={9} last={last} animated={animated} warm>
            attention
          </DefWord>
        </span>{' '}
        <br className="hidden md:block" />
        <MonoRun
          words={words}
          from={10}
          to={10}
          last={last}
          animated={animated}
        />{' '}
        <span className="salience-quote__script">
          <DefWord i={11} last={last} animated={animated} warm>
            sensory
          </DefWord>{' '}
          <DefWord i={12} last={last} animated={animated} warm>
            stimuli
          </DefWord>
        </span>{' '}
        <MonoRun
          words={words}
          from={13}
          to={15}
          last={last}
          animated={animated}
        />
        <br className="hidden md:block" />
        <span className="salience-quote__script">
          <DefWord i={16} last={last} animated={animated} warm>
            memory,
          </DefWord>
        </span>{' '}
        <MonoRun
          words={words}
          from={17}
          to={19}
          last={last}
          animated={animated}
        />
      </p>
    </div>
  )
}

function QuoteFrame({
  animated,
  topRuleRef,
  bottomRuleRef,
  staticRules = false,
}) {
  const ruleClass = staticRules
    ? 'salience-rule salience-rule--static'
    : 'salience-rule'

  const ruleStyle = staticRules
    ? undefined
    : { transform: 'scaleY(0)', transformOrigin: 'top center' }

  return (
    <div className="flex h-full w-full flex-col items-center pt-16 md:pt-20 pb-8">
      <div className="flex min-h-0 w-full flex-1 justify-center">
        <div
          ref={topRuleRef}
          className={ruleClass}
          style={ruleStyle}
          aria-hidden
        />
      </div>
      <div className="salience-quote__frame w-full max-w-[58rem] shrink-0">
        <SalienceQuote animated={animated} />
      </div>
      <div className="flex min-h-0 w-full flex-1 justify-center">
        <div
          ref={bottomRuleRef}
          className={staticRules ? ruleClass : 'salience-rule salience-rule--drop'}
          style={staticRules ? undefined : ruleStyle}
          aria-hidden
        />
      </div>
    </div>
  )
}

/** Salience chapter: editorial quote + scroll-scrubbed rules. Work handoff timing is unchanged. */
export default function SalienceSection() {
  const chapterRef = useRef(null)
  const stageRef = useRef(null)
  const textRef = useRef(null)
  const topRuleRef = useRef(null)
  const bottomRuleRef = useRef(null)
  const lenisRef = useLenisRef()
  const { setHandoff } = useSalienceHandoff()
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window === 'undefined' ? false : prefersReducedMotion(),
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      setHandoff({ progress: 1, apertureClose: 0, irisReleased: true })
      return
    }

    const chapter = chapterRef.current
    const stage = stageRef.current
    const text = textRef.current
    const topRule = topRuleRef.current
    const bottomRule = bottomRuleRef.current
    if (!chapter || !stage) return

    const updateProgress = () => {
      const rect = chapter.getBoundingClientRect()
      const vh = window.innerHeight
      const range = Math.max(rect.height - vh, 0)
      const p = range <= 0 ? 1 : Math.min(1, Math.max(0, -rect.top / range))
      const highlight = Math.min(1, p / 0.55)
      const close = apertureCloseFromChapter(p)
      const past = rect.bottom <= 0
      const holdSpan = range > 0 ? ((BLACK_HOLD_SVH / 100) * vh) / range : 0
      const releaseAt = APERTURE_CLOSE_END + holdSpan

      stage.style.setProperty('--salience-p', String(highlight))

      // Top rule starts at the first hero scroll and finishes as the quote takes the screen.
      const hero = chapter.previousElementSibling
      const heroTop = hero
        ? hero.getBoundingClientRect().top
        : rect.top - vh
      const topScale = clamp01(-heroTop / Math.max(vh, 1))

      if (topRule) {
        topRule.style.transform = `scaleY(${topScale})`
      }

      const lift = scaleFromProgress(p, QUOTE_LIFT[0], QUOTE_LIFT[1])
      if (text) {
        text.style.transform = `translate3d(0, ${-lift * QUOTE_LIFT_VH}vh, 0)`
      }

      if (bottomRule) {
        const GAP = 24
        const grow = scaleFromProgress(p, RULE_BOTTOM[0], RULE_BOTTOM[1])
        const start = bottomRule.getBoundingClientRect().top
        const heading = document.getElementById('featured-heading')
        const featuredTop = heading
          ? heading.getBoundingClientRect().top
          : Number.POSITIVE_INFINITY
        const target = Math.min(featuredTop, vh) - GAP
        const available = Math.max(target - start, 0)
        bottomRule.style.transform = 'none'
        bottomRule.style.height = `${past ? 0 : Math.round(available * grow)}px`
      }

      if (past) {
        setHandoff({ progress: 1, apertureClose: 1, irisReleased: true })
        return
      }

      if (close >= 0.999) {
        setHandoff({
          progress: p,
          apertureClose: 1,
          irisReleased: p >= releaseAt,
        })
        return
      }

      setHandoff({
        progress: p,
        apertureClose: close,
        irisReleased: false,
      })
    }

    updateProgress()

    let detachLenis = () => {}
    const attachLenis = () => {
      const lenis = lenisRef?.current
      if (!lenis) return false
      lenis.on('scroll', updateProgress)
      detachLenis = () => lenis.off('scroll', updateProgress)
      return true
    }

    const raf = requestAnimationFrame(() => {
      if (!attachLenis()) {
        window.addEventListener('scroll', updateProgress, { passive: true })
        detachLenis = () =>
          window.removeEventListener('scroll', updateProgress)
      }
      updateProgress()
    })

    const onResize = updateProgress
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      detachLenis()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', updateProgress)
    }
  }, [reducedMotion, lenisRef, setHandoff])

  if (reducedMotion) {
    return (
      <section
        id="salience"
        className="relative z-40 flex min-h-[100svh] bg-canvas text-salience section-pad"
        aria-labelledby="salience-heading"
      >
        <QuoteFrame animated={false} staticRules />
      </section>
    )
  }

  return (
    <section
      id="salience"
      ref={chapterRef}
      className="relative z-40 h-[220svh] bg-canvas text-salience pointer-events-none"
      aria-labelledby="salience-heading"
    >
      <div
        ref={stageRef}
        className="salience-stage pointer-events-none sticky top-0 z-40 h-[100svh] bg-canvas"
      >
        <div
          ref={textRef}
          className="absolute inset-0 z-10 flex items-center section-pad bg-canvas pointer-events-none will-change-transform"
        >
          <QuoteFrame
            animated
            topRuleRef={topRuleRef}
            bottomRuleRef={bottomRuleRef}
          />
        </div>
      </div>
    </section>
  )
}
