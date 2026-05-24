const categoryLabels = {
  sports: 'Sports',
  animals: 'Animals',
  nature: 'Nature',
  travel: 'Travel',
}

export function labelForCategory(id) {
  return categoryLabels[id] ?? id.charAt(0).toUpperCase() + id.slice(1)
}

/** Build All + category pills; omit UI when only one category exists (Events). */
export function buildCategoryFilters(images) {
  const categories = [...new Set(images.map((img) => img.category).filter(Boolean))]
  if (categories.length <= 1) return []

  return [
    { id: 'all', label: 'All' },
    ...categories.map((id) => ({ id, label: labelForCategory(id) })),
  ]
}

export function filterByCategory(images, active) {
  if (active === 'all') return images
  return images.filter((img) => img.category === active)
}
