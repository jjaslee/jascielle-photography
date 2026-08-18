import { Link, useParams } from 'react-router-dom'
import { homeWorkCategories } from '../data/galleries'

/**
 * Minimal category destination placeholder.
 * Full category experience is deferred; archives stay on existing routes.
 */
export default function WorkCategory() {
  const { categoryId } = useParams()
  const category =
    homeWorkCategories.find((c) => c.id === categoryId) ?? null

  return (
    <section className="section-pad min-h-[70svh] pt-24 md:pt-28 pb-20 bg-canvas text-ink">
      <p className="font-sans text-[11px] tracking-editorial uppercase text-muted mb-4">
        Work
      </p>
      <h1 className="font-sans text-3xl md:text-4xl font-semibold tracking-tight uppercase text-ink">
        {category?.title ?? categoryId}
      </h1>
      <p className="mt-4 max-w-md text-sm text-muted leading-relaxed">
        Category experience coming soon. Archive routes remain available from
        the homepage for now.
      </p>
      <Link
        to="/work"
        className="mt-10 inline-block font-sans text-xs font-semibold tracking-editorial uppercase text-ink/70 hover:text-ink transition-colors"
      >
        ← Work
      </Link>
    </section>
  )
}
