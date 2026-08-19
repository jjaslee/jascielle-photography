import { Link, useLocation } from 'react-router-dom'
import { SMOOTH_SCROLL_STATE, useFooterNavClick } from '../hooks/useScrollToTop'
import BlindExitLink from './BlindExitLink'

/** Site footer for non-home routes — quiet metadata, no hard rule. */
export default function Footer() {
  const { pathname } = useLocation()
  const onFooterNavClick = useFooterNavClick()
  const showPrivacyLink = pathname === '/book'

  return (
    <footer className="section-pad font-mono font-light">
      <div className="max-w-7xl mx-auto py-8 md:py-10 flex flex-col-reverse items-center gap-2 text-center md:flex-row md:justify-between md:gap-6 md:text-left">
        <p className="text-[11px] tracking-nav uppercase text-muted leading-relaxed max-w-md">
          © {new Date().getFullYear()} Jascielle Photography
        </p>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-[0.55rem] gap-y-[0.45rem] text-[11px] tracking-nav uppercase"
          aria-label="Footer"
        >
          <BlindExitLink
            to="/book"
            onClick={onFooterNavClick('/book')}
            className="text-muted hover:text-salience-warm transition-colors"
          >
            Book
          </BlindExitLink>
          <span className="text-muted" aria-hidden="true">
            ·
          </span>
          <a
            href="https://www.instagram.com/jascielle_photos/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-salience-warm transition-colors"
          >
            Instagram
          </a>
          <span className="text-muted" aria-hidden="true">
            ·
          </span>
          <a
            href="mailto:jascielle.photos@gmail.com"
            className="text-muted hover:text-salience-warm transition-colors"
          >
            Email
          </a>
          {showPrivacyLink ? (
            <>
              <span className="text-muted" aria-hidden="true">
                ·
              </span>
              <Link
                to="/privacy"
                state={SMOOTH_SCROLL_STATE}
                onClick={onFooterNavClick('/privacy')}
                className="text-muted hover:text-salience-warm transition-colors"
              >
                Privacy
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </footer>
  )
}
