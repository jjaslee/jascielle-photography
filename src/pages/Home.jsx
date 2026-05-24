import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import ProtectedImage from '../components/ProtectedImage'
import { protectedGalleryHandlers } from '../utils/imageProtection'
import ScrollReveal from '../components/ScrollReveal'
import SpotlightZone from '../components/SpotlightZone'
import HeroRotator from '../components/HeroRotator'
import { portfolioCategories, portraitImages } from '../data/galleries'

const heroMoodyGradImages = portraitImages.filter(
  (img) =>
    img.session === 'grad' &&
    img.theme === 'moody' &&
    img.src !== '/images/portraits/IMG_4262.jpg',
)

export default function Home() {
  return (
    <>
      <section className="relative min-h-[100svh] flex flex-col justify-center section-pad pt-28 pb-20 lg:pt-24 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-1/4 -right-1/4 w-[70vw] h-[70vw] rounded-full bg-ink/[0.03] dark:bg-ink/10 blur-3xl" />
        </div>
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[72%] w-px h-24 bg-line"
          aria-hidden
        />

        <div className="relative z-10 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-7xl mx-auto w-full">
          <ScrollReveal className="order-1 flex flex-col items-center text-center pt-8 lg:pt-0 lg:items-start lg:text-left">
            <h1 className="sr-only">Jascielle Photography</h1>
            <Logo className="h-28 sm:h-32 md:h-40 w-auto max-w-[min(100%,320px)]" />
            <p className="text-muted text-sm md:text-base mt-8 tracking-wide">
              Grad · Portrait · Event
            </p>
            <div className="flex flex-wrap gap-4 mt-10 justify-center lg:justify-start">
              <Link to="/portraits" className="btn-outline">
                View work
              </Link>
              <Link to="/book" className="btn-primary">
                Book a session
              </Link>
            </div>
          </ScrollReveal>

          <div className="order-2 flex justify-center lg:justify-end">
            <div
              className="gallery-protected w-full max-w-md aspect-[4/5] border border-line overflow-hidden"
              {...protectedGalleryHandlers}
            >
              <HeroRotator images={heroMoodyGradImages} />
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad py-24 md:py-32 border-t border-line">
        <ScrollReveal>
          <p className="text-muted text-xs tracking-[0.25em] uppercase mb-12">Selected work</p>
        </ScrollReveal>
        <div
          className="grid md:grid-cols-3 gap-8 md:gap-10 max-w-7xl mx-auto gallery-protected"
          {...protectedGalleryHandlers}
        >
          {portfolioCategories.map((cat, i) => (
            <ScrollReveal key={cat.slug} delay={i * 120}>
              <Link to={cat.to} className="group block">
                <div className="aspect-[4/5] overflow-hidden border border-line mb-5">
                  <ProtectedImage
                    src={cat.cover}
                    alt={cat.title}
                    className="h-full w-full object-cover scale-100 transition-transform duration-slow ease-elegant group-hover:scale-[1.06]"
                  />
                </div>
                <h2 className="font-serif text-2xl md:text-3xl font-light text-ink">{cat.title}</h2>
                <p className="text-muted text-sm mt-2">{cat.description}</p>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="section-pad py-24 md:py-32 border-t border-line">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <ScrollReveal>
            <div
              className="aspect-[3/4] max-w-sm border border-line overflow-hidden gallery-protected"
              {...protectedGalleryHandlers}
            >
              <ProtectedImage
                src="/images/portraits/IMG_4262.jpg"
                alt="Grad portrait on campus seal"
                className="w-full h-full object-cover"
              />
            </div>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <p className="text-muted text-xs tracking-[0.25em] uppercase mb-4">About</p>
            <h2 className="heading-serif text-3xl md:text-5xl leading-tight">
              Photographing people at milestones and in motion.
            </h2>
            <p className="text-muted mt-6 leading-relaxed max-w-md">
              From grad portraits to club events: relaxed sessions, thoughtful edits, and
              images that feel like you.
            </p>
            <Link
              to="/about"
              className="link-underline group inline-flex items-center gap-1.5 mt-8 text-sm tracking-wide"
            >
              <span>Meet Jasmine</span>
              <span
                className="text-xs transition-transform duration-500 ease-elegant group-hover:translate-x-0.5"
                aria-hidden="true"
              >
                →
              </span>
            </Link>
          </ScrollReveal>
        </div>
      </section>

      <SpotlightZone className="section-pad py-24 md:py-32 bg-ink text-canvas">
        <ScrollReveal>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-serif text-3xl md:text-5xl font-light">Ready to book?</h2>
            <p className="text-canvas/70 mt-4 text-sm md:text-base">
              Grad, portrait, and event inquiries. I usually reply within 48 hours.
            </p>
            <Link
              to="/book"
              className="btn-outline-light mt-10 px-8 text-xs uppercase tracking-widest"
            >
              Get in touch
            </Link>
          </div>
        </ScrollReveal>
      </SpotlightZone>
    </>
  )
}
