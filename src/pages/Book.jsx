import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import ProtectedImage from '../components/ProtectedImage'
import ScrollReveal from '../components/ScrollReveal'
import { protectedGalleryHandlers } from '../utils/imageProtection'
import { services, sessionAddons } from '../data/galleries'

const FORMSPREE_ENDPOINT = import.meta.env.VITE_FORMSPREE_ENDPOINT
const BOOKING_EMAIL = 'jascielle.photos@gmail.com'

const sessionLabels = {
  grad: 'Grad Portrait ($140)',
  portrait: 'Portrait / Creative Session ($100)',
  event: 'Event Coverage ($250)',
}

export default function Book() {
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
      <PageHeader
        title="Book"
        subtitle="Tell me about your session. I'll reply within 48 hours with availability and next steps."
      />

      <section className="section-pad pb-24 md:pb-32 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div className="space-y-8">
            {services.map((s, i) => (
              <ScrollReveal key={s.id} delay={i * 80}>
                <div className="border border-line p-6 md:p-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="font-serif text-xl md:text-2xl font-light text-ink">{s.title}</h2>
                    <p className="text-sm text-ink tracking-wide">
                      Starting at <span className="font-medium">${s.price}</span>
                    </p>
                  </div>
                  <p className="text-muted text-sm mt-3 leading-relaxed">{s.description}</p>
                </div>
              </ScrollReveal>
            ))}
            <ScrollReveal delay={services.length * 80}>
              <div className="border border-line p-6 md:p-8">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-serif text-xl md:text-2xl font-light text-ink">
                    {sessionAddons.title}
                  </h2>
                  <p className="text-sm text-ink tracking-wide font-medium">
                    {sessionAddons.priceLabel}
                  </p>
                </div>
                <p className="text-muted text-sm mt-3 leading-relaxed">{sessionAddons.description}</p>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={100}>
            {submitted ? (
              <div className="border border-line p-8 md:p-10">
                <p className="font-serif text-2xl font-light text-ink">Thank you.</p>
                <p className="text-muted mt-4 text-sm leading-relaxed">
                  Your inquiry was sent to{' '}
                  <a href={`mailto:${BOOKING_EMAIL}`} className="text-ink underline">
                    {BOOKING_EMAIL}
                  </a>
                  . I&apos;ll reply within 48 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-8">
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
                  <label htmlFor="name" className="block text-xs tracking-widest uppercase text-muted mb-2">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    required
                    value={form.name}
                    onChange={onChange}
                    className="w-full bg-transparent border-b border-line py-3 text-ink focus:outline-none focus:border-ink transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs tracking-widest uppercase text-muted mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={onChange}
                    className="w-full bg-transparent border-b border-line py-3 text-ink focus:outline-none focus:border-ink transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="session" className="block text-xs tracking-widest uppercase text-muted mb-2">
                    Session type
                  </label>
                  <select
                    id="session"
                    name="session"
                    value={form.session}
                    onChange={onChange}
                    className="w-full bg-transparent border-b border-line py-3 text-ink focus:outline-none focus:border-ink transition-colors"
                  >
                    <option value="grad">Grad Portrait ($140)</option>
                    <option value="portrait">Portrait / Creative Session ($100)</option>
                    <option value="event">Event Coverage ($250)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="date" className="block text-xs tracking-widest uppercase text-muted mb-2">
                    Preferred date (optional)
                  </label>
                  <input
                    id="date"
                    name="date"
                    type="date"
                    value={form.date}
                    onChange={onChange}
                    className="w-full bg-transparent border-b border-line py-3 text-ink focus:outline-none focus:border-ink transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-xs tracking-widest uppercase text-muted mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    required
                    value={form.message}
                    onChange={onChange}
                    className="w-full bg-transparent border-b border-line py-3 text-ink focus:outline-none focus:border-ink resize-none transition-colors"
                  />
                </div>
                {error ? (
                  <p className="text-sm text-ink/80 leading-relaxed" role="alert">
                    {error}{' '}
                    <a href={`mailto:${BOOKING_EMAIL}`} className="underline">
                      {BOOKING_EMAIL}
                    </a>
                  </p>
                ) : null}
                <p className="text-xs text-muted leading-relaxed">
                  Inquiries go to{' '}
                  <a href={`mailto:${BOOKING_EMAIL}`} className="text-ink underline">
                    {BOOKING_EMAIL}
                  </a>
                  .
                </p>
                <button
                  type="submit"
                  className="btn-primary w-full md:w-auto"
                  disabled={isSending}
                >
                  {isSending ? 'Sending…' : 'Send inquiry'}
                </button>
              </form>
            )}
          </ScrollReveal>
        </div>

        <ScrollReveal delay={120}>
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
        </ScrollReveal>
      </section>
    </>
  )
}
