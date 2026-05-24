const categoryLabels = {
  sports: 'Sports',
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

export const PORTRAIT_FILTER_MIN_COUNT = 18

const sessionLabels = {
  grad: 'Grad',
  creative: 'Creative',
}

export function showPortraitFilters(images) {
  return images.length >= PORTRAIT_FILTER_MIN_COUNT
}

/** All + session pills; Creative only appears once images use session: 'creative'. */
export function buildPortraitSessionFilters(images) {
  const sessions = [...new Set(images.map((img) => img.session).filter(Boolean))]
  return [
    { id: 'all', label: 'All' },
    ...sessions.map((id) => ({ id, label: sessionLabels[id] ?? id })),
  ]
}

export const portraitThemeFilters = [
  { id: 'all', label: 'All' },
  { id: 'moody', label: 'Moody' },
  { id: 'bright', label: 'Bright' },
]

export function filterPortraitImages(images, { session, theme }) {
  return images.filter((img) => {
    const sessionOk = session === 'all' || img.session === session
    const themeOk = theme === 'all' || img.theme === theme
    return sessionOk && themeOk
  })
}
