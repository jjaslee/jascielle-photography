import { Outlet, useLocation } from 'react-router-dom'
import Nav from './Nav'
import Footer from './Footer'
import CursorSpotlight from './CursorSpotlight'
import { useScrollToTopOnNavigate } from '../hooks/useScrollToTop'

export default function Layout() {
  useScrollToTopOnNavigate()
  const { pathname } = useLocation()
  // Home concludes inside SpatialFieldChapter (CTA + quiet meta). Avoid a second footer.
  const showFooter = pathname !== '/'

  return (
    <>
      <CursorSpotlight />
      <div className="relative z-30 min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">
          <Outlet />
        </main>
        {showFooter ? <Footer /> : null}
      </div>
    </>
  )
}
