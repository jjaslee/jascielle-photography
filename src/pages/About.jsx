import ScrollReveal from '../components/ScrollReveal'
import ProtectedImage from '../components/ProtectedImage'
import { protectedGalleryHandlers } from '../utils/imageProtection'
import PageHeader from '../components/PageHeader'
import { Link } from 'react-router-dom'
export default function About() {
  return (
    <>
      <PageHeader
        title="About"
        subtitle="Jascielle Photography is the portrait and event work of Jasmine C. Lee."
        subtitleOneLine
      />

      <section className="section-pad pb-24 md:pb-32 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-start">
          <ScrollReveal>
            <div
              className="aspect-[3/4] max-w-md border border-line overflow-hidden gallery-protected"
              {...protectedGalleryHandlers}
            >
              <ProtectedImage
                src="/images/portraits/IMG_9437.jpg"
                alt="Jasmine C. Lee"
                className="w-full h-full object-cover"
              />
            </div>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <div className="space-y-6 text-muted leading-relaxed">
              <p className="text-ink font-serif text-xl md:text-2xl font-light leading-snug">
                I photograph people at milestones and in motion: grad portraits, headshots, and
                the energy of campus events.
              </p>
              <p>
                Sessions are relaxed and collaborative. I guide when you want direction and step
                back when you want candid moments. Edited galleries are delivered with care and a
                consistent eye.
              </p>
              <p>
                When I&apos;m not shooting clients, I&apos;m often chasing light on the street or
                in nature. That work lives under Places & light and informs how I compose
                portraits too.
              </p>
              <ul className="text-sm space-y-2 pt-4 border-t border-line">
                <li>Based in the Bay Area. Open to travel for events</li>
                <li>Typical turnaround: 1 to 2 weeks for portraits</li>
                <li>
                  Also: design & engineering at{' '}
                  <a
                    href="https://jasmineclee.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink underline underline-offset-2"
                  >
                    jasmineclee.vercel.app
                  </a>
                </li>
              </ul>
            </div>
            <div className="flex flex-wrap gap-6 mt-10 text-sm">
              <Link to="/book" className="btn-primary">
                Book a session
              </Link>
              <a
                href="mailto:jascielle.photos@gmail.com"
                className="link-underline self-center"
              >
                jascielle.photos@gmail.com
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  )
}
