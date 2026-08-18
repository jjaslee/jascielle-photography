import { Link } from 'react-router-dom'
import { SMOOTH_SCROLL_STATE, useFooterNavClick } from '../hooks/useScrollToTop'

/** Site footer for non-home routes — quiet metadata, no hard rule. */
export default function Footer() {
  const onFooterNavClick = useFooterNavClick()

  return (
    <footer className="section-pad">
      <div className="max-w-7xl mx-auto py-8 md:py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <p className="text-[11px] tracking-nav uppercase text-muted leading-relaxed max-w-md">
          © {new Date().getFullYear()} Jascielle Photography
        </p>
        <div className="flex flex-wrap items-center gap-6 text-[11px] tracking-nav uppercase">
          <Link
            to="/book"
            state={SMOOTH_SCROLL_STATE}
            onClick={onFooterNavClick('/book')}
            className="text-muted hover:text-ink transition-colors"
          >
            Book
          </Link>
          <a
            href="https://www.instagram.com/jascielle_photos/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-ink transition-colors"
          >
            Instagram
          </a>
          <a
            href="mailto:jascielle.photos@gmail.com"
            className="text-muted hover:text-ink transition-colors"
          >
            Email
          </a>
        </div>
      </div>
    </footer>
  )
}
