import { useMemo, useState } from 'react'
import GalleryGrid from '../components/GalleryGrid'
import GalleryFilters from '../components/GalleryFilters'
import PageHeader from '../components/PageHeader'
import { placeFilterOptions, placeImages } from '../data/galleries'
import { filterByPlaceTheme } from '../utils/galleryFilters'

export default function Places() {
  const [active, setActive] = useState('all')

  const filtered = useMemo(() => filterByPlaceTheme(placeImages, active), [active])

  return (
    <>
      <PageHeader
        title="Places & light"
        subtitle="Night light, streets, water, and quieter frames. Work outside sessions that shapes how I see."
      >
        <GalleryFilters filters={placeFilterOptions} active={active} onChange={setActive} />
      </PageHeader>

      <section className="gallery-section">
        <GalleryGrid images={filtered} />
      </section>
    </>
  )
}
