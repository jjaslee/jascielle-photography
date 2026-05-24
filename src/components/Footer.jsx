import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo'
import { SMOOTH_SCROLL_STATE, useFooterNavClick } from '../hooks/useScrollToTop'

const workLinks = [
  { to: '/portraits', label: 'Portraits' },
  { to: '/events', label: 'Events' },
  { to: '/places', label: 'Places' },
  { to: '/about', label: 'About' },
]

export default function Footer() {
  const onFooterNavClick = useFooterNavClick()

  return (
    <footer className="section-pad border-t border-line mt-8">
      <div className="max-w-7xl mx-auto py-16 md:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">
          <div className="lg:col-span-5">
            <Link
              to="/"
              state={SMOOTH_SCROLL_STATE}
              onClick={onFooterNavClick('/')}
              className="inline-block"
              aria-label="Jascielle Photography, home"
            >
              <Logo className="h-12 md:h-14 w-auto max-w-[200px]" />
            </Link>
            <p className="text-muted text-sm mt-5 leading-relaxed max-w-xs">
              Grad, portrait, and event photography by Jasmine C. Lee.
            </p>
          </div>

          <div className="lg:col-span-3">
            <p className="text-xs tracking-[0.2em] uppercase text-muted mb-5">Work</p>
            <ul className="space-y-3">
              {workLinks.map(({ to, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    state={SMOOTH_SCROLL_STATE}
                    onClick={onFooterNavClick(to)}
                    className={({ isActive }) =>
                      `text-sm transition-colors duration-300 ${
                        isActive ? 'text-ink' : 'text-muted hover:text-ink'
                      }`
                    }
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-4">
            <p className="text-xs tracking-[0.2em] uppercase text-muted mb-5">Connect</p>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  to="/book"
                  state={SMOOTH_SCROLL_STATE}
                  onClick={onFooterNavClick('/book')}
                  className="text-muted hover:text-ink transition-colors duration-300"
                >
                  Book a session
                </Link>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/jascielle_photos/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted hover:text-ink transition-colors duration-300"
                >
                  Instagram{' '}
                  <span className="text-ink/80">@jascielle_photos</span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:jascielle.photos@gmail.com"
                  className="text-muted hover:text-ink transition-colors duration-300"
                >
                  jascielle.photos@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs text-muted">
          <p className="tracking-wide">
            © {new Date().getFullYear()} Jascielle Photography
          </p>
          <a
            href="https://jasmineclee.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="link-underline text-muted hover:text-ink"
          >
            Design & engineering
          </a>
        </div>
      </div>
    </footer>
  )
}
