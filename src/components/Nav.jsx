import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import BlindExitLink from './BlindExitLink'

const links = [
  { to: '/work', label: 'Work' },
  { to: '/about', label: 'About' },
  { to: '/book', label: 'Book' },
]

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <header
      data-site-nav
      className="fixed top-0 left-0 right-0 z-50 bg-canvas border-b border-line"
    >
      <nav className="section-pad flex items-center justify-between h-14 md:h-16">
        <BlindExitLink
          to="/"
          className="font-display text-lg md:text-xl tracking-nav text-ink shrink-0"
          aria-label="Jascielle Photography, home"
        >
          Jascielle
        </BlindExitLink>

        <div className="hidden md:flex items-center gap-8 lg:gap-10">
          {links.map(({ to, label }) => (
            <BlindExitLink
              key={to}
              to={to}
              className="font-mono text-[11px] md:text-xs font-light tracking-nav uppercase transition-colors text-ink/90 hover:text-salience-warm"
            >
              {label}
            </BlindExitLink>
          ))}
          <ThemeToggle />
        </div>

        <div className="flex md:hidden items-center gap-4">
          <ThemeToggle />
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="text-ink p-1"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="block w-5 h-px bg-ink mb-1.5" />
            <span className="block w-5 h-px bg-ink mb-1.5" />
            <span className="block w-3.5 h-px bg-ink ml-auto" />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="md:hidden border-t border-line bg-canvas section-pad py-8 flex flex-col gap-6">
          {links.map(({ to, label }) => (
            <BlindExitLink
              key={to}
              to={to}
              className="font-mono text-sm font-light tracking-nav uppercase text-ink transition-colors hover:text-salience-warm"
            >
              {label}
            </BlindExitLink>
          ))}
        </div>
      )}
    </header>
  )
}
