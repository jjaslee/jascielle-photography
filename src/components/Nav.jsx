import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { scrollToWork, useLenisRef } from '../context/LenisContext'
import ThemeToggle from './ThemeToggle'

const links = [
  { to: '/#work', label: 'Work', hash: 'work' },
  { to: '/about', label: 'About' },
  { to: '/book', label: 'Book' },
]

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const lenisRef = useLenisRef()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.hash])

  const onWorkClick = (e) => {
    e.preventDefault()
    if (location.pathname !== '/') {
      navigate('/#work')
      return
    }
    if (location.hash !== '#work') {
      window.history.replaceState(null, '', '/#work')
    }
    scrollToWork(lenisRef?.current)
  }

  return (
    <header
      data-site-nav
      className="fixed top-0 left-0 right-0 z-50 bg-canvas border-b border-line"
    >
      <nav className="section-pad flex items-center justify-between h-14 md:h-16">
        <Link
          to="/"
          className="font-serif text-lg md:text-xl font-bold tracking-nav text-ink shrink-0"
          aria-label="Jascielle Photography, home"
        >
          Jascielle
        </Link>

        <div className="hidden md:flex items-center gap-8 lg:gap-10">
          {links.map(({ to, label, hash }) =>
            hash ? (
              <a
                key={to}
                href={to}
                onClick={onWorkClick}
                className="text-[11px] md:text-xs font-semibold tracking-nav uppercase text-ink/90 hover:text-ink transition-colors"
              >
                {label}
              </a>
            ) : (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `text-[11px] md:text-xs font-semibold tracking-nav uppercase transition-colors ${
                    isActive ? 'text-ink' : 'text-ink/90 hover:text-ink'
                  }`
                }
              >
                {label}
              </NavLink>
            ),
          )}
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
          {links.map(({ to, label, hash }) =>
            hash ? (
              <a
                key={to}
                href={to}
                onClick={(e) => {
                  onWorkClick(e)
                  setMenuOpen(false)
                }}
                className="text-sm font-semibold tracking-nav uppercase text-ink"
              >
                {label}
              </a>
            ) : (
              <NavLink
                key={to}
                to={to}
                className="text-sm font-semibold tracking-nav uppercase text-ink"
              >
                {label}
              </NavLink>
            ),
          )}
        </div>
      )}
    </header>
  )
}
