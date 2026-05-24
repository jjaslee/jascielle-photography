import { useMemo, useState } from 'react'
import GalleryGrid from '../components/GalleryGrid'
import GalleryFilters from '../components/GalleryFilters'
import PageHeader from '../components/PageHeader'
import { Link } from 'react-router-dom'
import { portraitImages } from '../data/galleries'

const portraitFilters = [
  { id: 'all', label: 'All' },
  { id: 'bright', label: 'Bright' },
  { id: 'moody', label: 'Moody' },
]

export default function Portraits() {
  const [active, setActive] = useState('all')

  const filtered = useMemo(() => {
    if (active === 'all') return portraitImages
    return portraitImages.filter((img) => img.mood === active)
  }, [active])

  return (
    <>
      <PageHeader
        title="Portraits"
        subtitle="Grad sessions, headshots, and personal portraits, vibrant or moody, always true to you."
      >
        <GalleryFilters filters={portraitFilters} active={active} onChange={setActive} />
      </PageHeader>

      <section className="gallery-section">
        <GalleryGrid images={filtered} />
        <p className="text-center text-muted text-sm mt-16">
          <Link to="/book" className="link-underline">
            Inquire about packages →
          </Link>
        </p>
      </section>
    </>
  )
}
