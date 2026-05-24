import { Outlet } from 'react-router-dom'
import Nav from './Nav'
import Footer from './Footer'
import CursorSpotlight from './CursorSpotlight'
import { useScrollToTopOnNavigate } from '../hooks/useScrollToTop'

export default function Layout() {
  useScrollToTopOnNavigate()

  return (
    <>
      <CursorSpotlight />
      <div className="relative z-30 min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </>
  )
}
