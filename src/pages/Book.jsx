import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProtectedImage from '../components/ProtectedImage'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { protectedGalleryHandlers } from '../utils/imageProtection'
import { services, sessionAddons } from '../data/galleries'
import { useBlindExit } from '../context/BlindExitContext'
import {
  blindCloseTotalMs,
  faceStyleFromRowProgress,
  rowBlindProgress,
} from '../components/home/workBlind'

const SLAT_COUNT = 4

function BookReveal({ children, className = '', delay = 0, blindStyle }) {
  const { ref, visible } = useScrollReveal()
  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-700 ease-elegant ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      } ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      <div className="origin-top will-change-transform" style={blindStyle}>
        {children}
      </div>
    </div>
  )
}

const fieldLabelClass =
  'block font-mono font-light text-[10px] leading-none tracking-[0.14em] uppercase text-muted mb-2'
const fieldInputClass =
  'w-full bg-transparent border-b border-line py-3 font-mono font-light text-[13px] md:text-[14px] tracking-[0.02em] text-ink focus:outline-none focus:border-ink transition-colors'

const FORMSPREE_ENDPOINT = import.meta.env.VITE_FORMSPREE_ENDPOINT
const BOOKING_EMAIL = 'jascielle.photos@gmail.com'

const sessionLabels = {
  grad: 'Grad Portrait ($140)',
  portrait: 'Portrait / Creative Session ($100)',
  event: 'Event Coverage ($250)',
}

export default function Book() {
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

  const slat = (i) => {
    if (blindProgress <= 0) return undefined
    const p = rowBlindProgress(blindProgress, i, false, SLAT_COUNT)
    return faceStyleFromRowProgress(p)
  }

  const [submitted, setSubmitted] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState(null)
  const [honeypot, setHoneypot] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    session: 'grad',
    date: '',
    message: '',
  })

  const onChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (honeypot) {
      setSubmitted(true)
      return
    }

    if (!FORMSPREE_ENDPOINT) {
      setError('Booking form is not configured yet. Please email us directly.')
      return
    }

    setIsSending(true)
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          session: sessionLabels[form.session] ?? form.session,
          preferred_date: form.date || 'Flexible',
          message: form.message.trim(),
          _subject: `Jascielle Photography: ${form.session}`,
        }),
      })

      if (!res.ok) throw new Error('Request failed')

      setSubmitted(true)
    } catch {
      setError('Could not send your inquiry. Please try again or email us directly.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      <section className="section-pad pt-32 md:pt-40 pb-16 md:pb-24">
        <BookReveal blindStyle={slat(0)}>
          <div className="mx-auto flex max-w-full flex-col items-center text-center">
            <h1 className="font-display font-normal leading-[1.1] text-ink text-[clamp(4rem,6vw,6.5rem)]">
              Book
            </h1>
            <p className="mt-6 md:mt-8 max-w-[42rem] font-mono font-light text-pretty text-ink/80 tracking-[0.05em] text-[clamp(0.9rem,1.15vw,1.1rem)] leading-[1.55]">
              Tell me about your vision! I&apos;ll get back to you within 48 hours with
              availability and next steps.
            </p>
          </div>
        </BookReveal>
      </section>

      <section className="section-pad pb-24 md:pb-32 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div className="space-y-8 font-mono font-light">
            {services.map((s, i) => (
              <BookReveal key={s.id} delay={i * 80} blindStyle={slat(1)}>
                <div className="border border-line p-6 md:p-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="text-[15px] md:text-[16px] text-ink">{s.title}</h2>
                    <p className="text-[11px] text-muted tracking-[0.04em]">
                      Starting at ${s.price}
                    </p>
                  </div>
                  <p className="text-muted text-[11px] md:text-[12px] mt-3 leading-relaxed">
                    {s.description}
                  </p>
                </div>
              </BookReveal>
            ))}
            <BookReveal delay={services.length * 80} blindStyle={slat(1)}>
              <div className="border border-line p-6 md:p-8">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-[15px] md:text-[16px] text-ink">{sessionAddons.title}</h2>
                  <p className="text-[11px] text-muted tracking-[0.04em]">
                    {sessionAddons.priceLabel}
                  </p>
                </div>
                <p className="text-muted text-[11px] md:text-[12px] mt-3 leading-relaxed">
                  {sessionAddons.description}
                </p>
              </div>
            </BookReveal>
          </div>

          <BookReveal delay={100} className="lg:-mt-4" blindStyle={slat(2)}>
            {submitted ? (
              <div className="border border-line p-8 md:p-10 font-mono font-light">
                <p className="text-[16px] text-ink">Thank you.</p>
                <p className="text-muted mt-4 text-[13px] leading-relaxed">
                  Your inquiry was sent to{' '}
                  <a href={`mailto:${BOOKING_EMAIL}`} className="text-ink underline">
                    {BOOKING_EMAIL}
                  </a>
                  . I&apos;ll reply within 48 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-8 font-mono font-light">
                <input
                  type="text"
                  name="_gotcha"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  className="sr-only"
                  aria-hidden
                />
                <div>
                  <label htmlFor="name" className={fieldLabelClass}>
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    required
                    value={form.name}
                    onChange={onChange}
                    className={fieldInputClass}
                  />
                </div>
                <div>
                  <label htmlFor="email" className={fieldLabelClass}>
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={onChange}
                    className={fieldInputClass}
                  />
                </div>
                <div>
                  <label htmlFor="session" className={fieldLabelClass}>
                    Session type
                  </label>
                  <select
                    id="session"
                    name="session"
                    value={form.session}
                    onChange={onChange}
                    className={fieldInputClass}
                  >
                    <option value="grad">Grad Portrait ($140)</option>
                    <option value="portrait">Portrait / Creative Session ($100)</option>
                    <option value="event">Event Coverage ($250)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="date" className={fieldLabelClass}>
                    Preferred date (optional)
                  </label>
                  <input
                    id="date"
                    name="date"
                    type="date"
                    value={form.date}
                    onChange={onChange}
                    className={fieldInputClass}
                  />
                </div>
                <div>
                  <label htmlFor="message" className={fieldLabelClass}>
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    required
                    value={form.message}
                    onChange={onChange}
                    className={`${fieldInputClass} resize-none`}
                  />
                </div>
                {error ? (
                  <p className="text-[13px] text-ink/80 leading-relaxed" role="alert">
                    {error}{' '}
                    <a href={`mailto:${BOOKING_EMAIL}`} className="underline">
                      {BOOKING_EMAIL}
                    </a>
                  </p>
                ) : null}
                <p className="text-[10px] md:text-[11px] text-muted leading-relaxed tracking-[0.04em]">
                  Inquiries go to{' '}
                  <a href={`mailto:${BOOKING_EMAIL}`} className="text-ink underline">
                    {BOOKING_EMAIL}
                  </a>
                  .
                </p>
                <button
                  type="submit"
                  className="btn-primary w-full md:w-auto font-mono font-light text-[13px] md:text-[14px] tracking-[0.04em]"
                  disabled={isSending}
                >
                  {isSending ? 'Sending…' : 'Send inquiry'}
                </button>
              </form>
            )}
          </BookReveal>
        </div>

        <BookReveal delay={120} blindStyle={slat(3)}>
          <div className="mt-20 md:mt-28 flex justify-center">
            <div
              className="w-full max-w-2xl aspect-[3/2] overflow-hidden gallery-protected"
              {...protectedGalleryHandlers}
            >
              <ProtectedImage
                src="/images/book/IMG_4672.jpg"
                alt="Graduation bouquet with red and white roses"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </BookReveal>
      </section>
    </>
  )
}
