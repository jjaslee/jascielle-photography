import { useMemo, useState } from 'react'
import GalleryGrid from '../components/GalleryGrid'
import GalleryFilters from '../components/GalleryFilters'
import PageHeader from '../components/PageHeader'
import { Link } from 'react-router-dom'
import { eventImages } from '../data/galleries'
import { buildCategoryFilters, filterByCategory } from '../utils/galleryFilters'

export default function Events() {
  const [active, setActive] = useState('all')

  const eventFilters = useMemo(() => buildCategoryFilters(eventImages), [])
  const filtered = useMemo(() => filterByCategory(eventImages, active), [active])

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Sports, clubs, and campus moments, with candid coverage and an editorial eye."
      >
        <GalleryFilters filters={eventFilters} active={active} onChange={setActive} />
      </PageHeader>

      <section className="gallery-section">
        <GalleryGrid images={filtered} />
        <p className="text-center text-muted text-sm mt-16">
          <Link to="/book" className="link-underline">
            Book event coverage →
          </Link>
        </p>
      </section>
    </>
  )
}
