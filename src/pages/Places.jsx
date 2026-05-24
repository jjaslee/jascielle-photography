import { useMemo, useState } from 'react'
import GalleryGrid from '../components/GalleryGrid'
import GalleryFilters from '../components/GalleryFilters'
import PageHeader from '../components/PageHeader'
import { placeFilterOptions, placeImages } from '../data/galleries'
import { filterByCategory } from '../utils/galleryFilters'

export default function Places() {
  const [active, setActive] = useState('all')

  const filtered = useMemo(() => filterByCategory(placeImages, active), [active])

  return (
    <>
      <PageHeader
        title="Places & light"
        subtitle="Street, nature, and quieter frames. Work that sits outside sessions, but shapes how I see."
      >
        <GalleryFilters filters={placeFilterOptions} active={active} onChange={setActive} />
      </PageHeader>

      <section className="gallery-section">
        <GalleryGrid images={filtered} />
      </section>
    </>
  )
}
