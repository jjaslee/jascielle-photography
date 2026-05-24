import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import ProtectedImage from '../components/ProtectedImage'
import ScrollReveal from '../components/ScrollReveal'
import { protectedGalleryHandlers } from '../utils/imageProtection'
import { services, sessionAddons } from '../data/galleries'

export default function Book() {
  const [submitted, setSubmitted] = useState(false)
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

  const onSubmit = (e) => {
    e.preventDefault()
    const subject = encodeURIComponent(`Jascielle Photography: ${form.session}`)
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nSession: ${form.session}\nPreferred date: ${form.date || 'Flexible'}\n\n${form.message}`
    )
    window.location.href = `mailto:jascielle.photos@gmail.com?subject=${subject}&body=${body}`
    setSubmitted(true)
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
                  Your email client should have opened with your message. If it didn&apos;t, email{' '}
                  <a href="mailto:jascielle.photos@gmail.com" className="text-ink underline">
                    jascielle.photos@gmail.com
                  </a>{' '}
                  directly.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-8">
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
                <button type="submit" className="btn-primary w-full md:w-auto">
                  Send inquiry
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
