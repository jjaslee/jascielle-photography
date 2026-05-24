import { useEffect, useMemo, useState } from 'react'
import GalleryGrid from '../components/GalleryGrid'
import GalleryFilters from '../components/GalleryFilters'
import PageHeader from '../components/PageHeader'
import { Link } from 'react-router-dom'
import { portraitImages } from '../data/galleries'
import {
  buildPortraitSessionFilters,
  filterPortraitImages,
  portraitThemeFilters,
  showPortraitFilters,
} from '../utils/galleryFilters'

export default function Portraits() {
  const [session, setSession] = useState('all')
  const [theme, setTheme] = useState('all')

  const filtersVisible = showPortraitFilters(portraitImages)

  const sessionFilters = useMemo(
    () => buildPortraitSessionFilters(portraitImages),
    [],
  )

  useEffect(() => {
    if (session !== 'all' && !sessionFilters.some((f) => f.id === session)) {
      setSession('all')
    }
  }, [session, sessionFilters])

  const filtered = useMemo(
    () =>
      filtersVisible
        ? filterPortraitImages(portraitImages, { session, theme })
        : portraitImages,
    [filtersVisible, session, theme],
  )

  return (
    <>
      <PageHeader
        title="Portraits"
        subtitle={
          filtersVisible
            ? 'Grad and creative sessions. Filter by type, then by bright or moody light.'
            : 'Grad portraits in bright and moody light.'
        }
      >
        {filtersVisible && (
          <div className="mt-10 space-y-6">
            <div>
              <p className="text-xs tracking-widest uppercase text-muted mb-3">Session</p>
              <GalleryFilters
                filters={sessionFilters}
                active={session}
                onChange={setSession}
                className="mt-0"
              />
            </div>
            <div>
              <p className="text-xs tracking-widest uppercase text-muted mb-3">Theme</p>
              <GalleryFilters
                filters={portraitThemeFilters}
                active={theme}
                onChange={setTheme}
                className="mt-0"
              />
            </div>
          </div>
        )}
      </PageHeader>

      <section className="gallery-section">
        {filtered.length > 0 ? (
          <GalleryGrid images={filtered} />
        ) : (
          <p className="text-center text-muted text-sm py-16">
            No portraits in this combination yet.
          </p>
        )}
        <p className="text-center text-muted text-sm mt-16">
          <Link to="/book" className="link-underline">
            Inquire about packages →
          </Link>
        </p>
      </section>
    </>
  )
}
