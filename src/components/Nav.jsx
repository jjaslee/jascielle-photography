import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import Logo from './Logo'

const links = [
  { to: '/portraits', label: 'Portraits' },
  { to: '/events', label: 'Events' },
  { to: '/places', label: 'Places' },
  { to: '/about', label: 'About' },
]

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-canvas/75 backdrop-blur-md border-b border-line">
      <nav className="section-pad flex items-center justify-between h-16 md:h-20">
        <Link to="/" className="block shrink-0" aria-label="Jascielle Photography, home">
          <Logo className="h-9 md:h-11 w-auto" />
        </Link>

        <div className="hidden md:flex items-center gap-8 lg:gap-10">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `link-underline text-sm tracking-wide ${
                  isActive ? 'text-ink after:w-full' : ''
                }`
              }
            >
              {label}
            </NavLink>
          ))}
          <ThemeToggle />
          <Link to="/book" className="btn-primary text-xs uppercase tracking-widest">
            Book
          </Link>
        </div>

        <div className="flex md:hidden items-center gap-4">
          <ThemeToggle />
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="text-ink p-1"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="block w-6 h-px bg-ink mb-1.5 transition-transform" />
            <span className="block w-6 h-px bg-ink mb-1.5" />
            <span className="block w-4 h-px bg-ink ml-auto" />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="md:hidden border-t border-line bg-canvas/95 backdrop-blur-md section-pad py-8 flex flex-col gap-6">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className="font-serif text-2xl font-light text-ink"
            >
              {label}
            </NavLink>
          ))}
          <Link to="/book" className="btn-primary w-fit mt-2">
            Book
          </Link>
        </div>
      )}
    </header>
  )
}
