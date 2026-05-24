import { useScrollToTop } from '../hooks/useScrollToTop'

export default function GalleryFilters({
  filters,
  active,
  onChange,
  className = 'mt-10',
}) {
  const scrollToTop = useScrollToTop()

  if (!filters?.length) return null

  return (
    <div className={`flex flex-wrap gap-3 ${className}`.trim()}>
      {filters.map((f) => (
        <button
          key={f.id}
          type="button"
            onClick={() => {
            onChange(f.id)
            scrollToTop({ immediate: true })
          }}
          className={`filter-pill ${active === f.id ? 'filter-pill-active' : ''}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
