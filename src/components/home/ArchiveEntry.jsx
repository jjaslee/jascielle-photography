import { Link } from 'react-router-dom'
import { homeWorkCategories } from '../../data/galleries'

/**
 * Conventional archive / contact-sheet entry below the Work chapter.
 * Supports multiple archiveLinks per category.
 */
export default function ArchiveEntry({ categories = homeWorkCategories }) {
  return (
    <section
      id="archive"
      className="bg-canvas text-ink section-pad pb-20 md:pb-28"
      aria-label="Full archive"
    >
      <div className="border-t border-ink pt-8 md:pt-10">
        <p className="text-[10px] tracking-editorial uppercase text-muted mb-6">
          View all
        </p>
        <ul className="flex flex-col gap-4">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-2"
            >
              <span className="font-sans text-xs font-semibold tracking-nav uppercase text-ink min-w-[5.5rem]">
                {cat.title}
              </span>
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                {cat.archiveLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="font-sans text-xs font-medium tracking-nav uppercase text-ink/70 hover:text-ink transition-colors"
                  >
                    {link.label}
                    <span aria-hidden="true"> →</span>
                  </Link>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
