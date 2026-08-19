import { Outlet, useLocation } from 'react-router-dom'
import Nav from './Nav'
import Footer from './Footer'
import CursorSpotlight from './CursorSpotlight'
import { useScrollToTopOnNavigate } from '../hooks/useScrollToTop'

export default function Layout() {
  useScrollToTopOnNavigate()
  const { pathname } = useLocation()
  // Home concludes inside Featured (hover label + quiet meta). Avoid a second footer.
  const showFooter = pathname !== '/'
  const isWorkCategory = pathname.startsWith('/work/')

  return (
    <>
      {!isWorkCategory ? <CursorSpotlight /> : null}
      <Nav />
      <div
        className={`relative z-30 min-h-screen flex flex-col${
          isWorkCategory ? ' work-category-layout' : ''
        }`}
      >
        <main className="flex-1">
          <Outlet />
        </main>
        {showFooter ? <Footer /> : null}
      </div>
    </>
  )
}
