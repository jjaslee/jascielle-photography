import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProtectedImage from '../components/ProtectedImage'
import BarrelRollLabel from '../components/BarrelRollLabel'
import BlindExitLink from '../components/BlindExitLink'
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

function sessionCardClass(isSelected) {
  return [
    'group w-full text-left border p-6 md:p-8 transition-colors duration-300 ease-elegant cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-salience-warm/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
    isSelected
      ? 'border-salience-warm/70'
      : 'border-line hover:border-salience-warm/45 focus-visible:border-salience-warm/45',
  ].join(' ')
}

const FORMSPREE_ENDPOINT = import.meta.env.VITE_FORMSPREE_ENDPOINT
const BOOKING_EMAIL = 'jascielle.photos@gmail.com'

const sessionLabels = {
  grad: 'Grad Portrait ($140)',
  portrait: 'Portrait / Creative Session ($100)',
  event: 'Event Coverage ($250)',
}

const validatedFieldOrder = ['name', 'email', 'session', 'date']
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/

function localDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isNormalizedDateString(value) {
  const match = datePattern.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [
    31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ]
  return (
    year > 0 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1]
  )
}

function bookingFieldError(name, value, today = localDateString()) {
  const trimmed = value.trim()
  if (name === 'name' && !trimmed) return 'Please enter your name.'
  if (name === 'email') {
    if (!trimmed) return 'Please enter your email address.'
    if (!emailPattern.test(trimmed)) return 'Please enter a valid email address.'
  }
  if (name === 'session' && !sessionLabels[value]) {
    return 'Please select a session type.'
  }
  if (name === 'date' && trimmed) {
    if (trimmed !== value || !isNormalizedDateString(trimmed)) {
      return 'Please choose a valid date.'
    }
    if (trimmed < today) return 'Please choose today or a future date.'
  }
  return null
}

function validateBookingForm(form, today = localDateString()) {
  return Object.fromEntries(
    validatedFieldOrder
      .map((name) => [name, bookingFieldError(name, form[name], today)])
      .filter(([, message]) => message),
  )
}

function updateFieldError(errors, name, message) {
  if (message) {
    return errors[name] === message ? errors : { ...errors, [name]: message }
  }
  if (!errors[name]) return errors
  const next = { ...errors }
  delete next[name]
  return next
}

function FieldError({ id, message }) {
  if (!message) return null
  return (
    <p
      id={id}
      role="alert"
      className="validation-error mt-2 font-mono font-light text-[11px] leading-relaxed tracking-[0.02em]"
    >
      {message}
    </p>
  )
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
  const [fieldErrors, setFieldErrors] = useState({})
  const [honeypot, setHoneypot] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    session: 'grad',
    date: '',
    message: '',
  })

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    setFieldErrors((current) => {
      if (!current[name]) return current
      return updateFieldError(current, name, bookingFieldError(name, value))
    })
  }

  const onFieldBlur = (e) => {
    const { name, value } = e.target
    setFieldErrors((current) =>
      updateFieldError(current, name, bookingFieldError(name, value)),
    )
  }

  const selectSession = (sessionId) => {
    setForm((f) => ({ ...f, session: sessionId }))
    setFieldErrors((current) => updateFieldError(current, 'session', null))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (honeypot) {
      setSubmitted(true)
      return
    }

    const validationErrors = validateBookingForm(form)
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      const firstInvalidField = validatedFieldOrder.find(
        (name) => validationErrors[name],
      )
      e.currentTarget.elements.namedItem(firstInvalidField)?.focus()
      return
    }
    setFieldErrors({})

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

  const localToday = localDateString()

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
            {services.map((s, i) => {
              const isSelected = form.session === s.id
              return (
              <BookReveal key={s.id} delay={i * 80} blindStyle={slat(1)}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectSession(s.id)}
                  className={sessionCardClass(isSelected)}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2
                      className={`text-[15px] md:text-[16px] transition-colors duration-300 ${
                        isSelected
                          ? 'text-salience-warm'
                          : 'text-ink group-hover:text-salience-warm/80 group-focus-visible:text-salience-warm/80'
                      }`}
                    >
                      {s.title}
                    </h2>
                    <p className="text-[11px] text-muted tracking-[0.04em]">
                      Starting at ${s.price}
                    </p>
                  </div>
                  <p className="text-muted text-[11px] md:text-[12px] mt-3 leading-relaxed">
                    {s.description}
                  </p>
                </button>
              </BookReveal>
              )
            })}
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

          <BookReveal delay={100} blindStyle={slat(2)}>
            {submitted ? (
              <div className="font-mono font-light pt-4 md:pt-8 lg:pt-12">
                <p className="text-[14px] md:text-[15px] tracking-[0.1em] uppercase text-salience-warm">
                  Thank you.
                </p>
                <div className="mt-6 md:mt-8 space-y-1 text-[13px] md:text-[14px] text-ink/80 leading-relaxed tracking-[0.02em]">
                  <p>Your inquiry is in.</p>
                  <p>I&apos;ll get back to you within 48 hours.</p>
                </div>
                <div className="mt-8 md:mt-10">
                  <p className="text-[10px] tracking-[0.1em] uppercase text-muted leading-none">
                    Inquiry submitted with
                  </p>
                  <p className="mt-2 text-[13px] md:text-[14px] text-ink leading-relaxed tracking-[0.02em]">
                    {form.email}
                  </p>
                </div>
                <BlindExitLink
                  to="/work"
                  aria-label="Back to gallery"
                  className="featured-cta-link mt-10 md:mt-12 font-mono font-light text-[13px] md:text-[14px] tracking-[0.08em] uppercase whitespace-nowrap text-ink/90"
                >
                  <BarrelRollLabel text="Back to gallery" />{' '}
                  <span className="featured-cta-arrow" aria-hidden="true">
                    →
                  </span>
                </BlindExitLink>
              </div>
            ) : (
              <form
                noValidate
                onSubmit={onSubmit}
                className="space-y-8 font-mono font-light"
              >
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
                    onBlur={onFieldBlur}
                    aria-invalid={fieldErrors.name ? 'true' : undefined}
                    aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                    className={fieldInputClass}
                  />
                  <FieldError id="name-error" message={fieldErrors.name} />
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
                    onBlur={onFieldBlur}
                    aria-invalid={fieldErrors.email ? 'true' : undefined}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                    className={fieldInputClass}
                  />
                  <FieldError id="email-error" message={fieldErrors.email} />
                </div>
                <div>
                  <label
                    htmlFor="session"
                    className={fieldLabelClass.replace('text-muted', 'text-salience-warm')}
                  >
                    Session type
                  </label>
                  <div className="book-session-select-wrap">
                    <select
                      id="session"
                      name="session"
                      value={form.session}
                      onChange={onChange}
                      onBlur={onFieldBlur}
                      aria-invalid={fieldErrors.session ? 'true' : undefined}
                      aria-describedby={fieldErrors.session ? 'session-error' : undefined}
                      className={`${fieldInputClass} book-session-select`}
                    >
                      <option value="grad">Grad Portrait ($140)</option>
                      <option value="portrait">Portrait / Creative Session ($100)</option>
                      <option value="event">Event Coverage ($250)</option>
                    </select>
                  </div>
                  <FieldError id="session-error" message={fieldErrors.session} />
                </div>
                <div>
                  <label htmlFor="date" className={fieldLabelClass}>
                    Preferred date (optional)
                  </label>
                  <input
                    id="date"
                    name="date"
                    type="date"
                    min={localToday}
                    value={form.date}
                    onChange={onChange}
                    onBlur={onFieldBlur}
                    aria-invalid={fieldErrors.date ? 'true' : undefined}
                    aria-describedby={
                      fieldErrors.date ? 'preferred-date-error' : undefined
                    }
                    className={fieldInputClass}
                  />
                  <FieldError id="preferred-date-error" message={fieldErrors.date} />
                </div>
                <div>
                  <label htmlFor="message" className={fieldLabelClass}>
                    Message (optional)
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    value={form.message}
                    onChange={onChange}
                    placeholder="Tell me anything you'd like me to know..."
                    className={`${fieldInputClass} resize-none placeholder:text-muted/75 dark:placeholder:text-muted/60`}
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
                <button
                  type="submit"
                  aria-label="Send inquiry"
                  className="book-submit-cta featured-cta-link mt-2 font-mono font-light text-[13px] md:text-[14px] tracking-[0.08em] uppercase whitespace-nowrap border-0 bg-transparent p-0 py-2 cursor-pointer text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSending}
                >
                  {isSending ? (
                    'Sending…'
                  ) : (
                    <>
                      <BarrelRollLabel text="Send inquiry" />{' '}
                      <span className="featured-cta-arrow" aria-hidden="true">
                        →
                      </span>
                    </>
                  )}
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
