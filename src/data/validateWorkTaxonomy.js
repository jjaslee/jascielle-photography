/**
 * Dev/build guard — Work gallery sections must not share the same image src.
 */
export function validateWorkTaxonomy(pages) {
  const errors = []

  const landscape =
    pages.places?.sections.find((s) => s.id === 'landscape')?.images ?? []
  const habitat =
    pages.wildlife?.sections.find((s) => s.id === 'habitat')?.images ?? []
  const animals =
    pages.wildlife?.sections.find((s) => s.id === 'animals')?.images ?? []

  const landscapeSrcs = new Set(landscape.map((img) => img.src))
  const habitatSrcs = new Set(habitat.map((img) => img.src))
  const animalSrcs = new Set(animals.map((img) => img.src))

  for (const src of landscapeSrcs) {
    if (habitatSrcs.has(src)) {
      errors.push(`${src} appears in both Places/Landscape and Wildlife/Habitat`)
    }
  }

  for (const src of animalSrcs) {
    if (habitatSrcs.has(src)) {
      errors.push(`${src} appears in both Wildlife/Animals and Wildlife/Habitat`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`Work taxonomy validation failed:\n${errors.join('\n')}`)
  }
}
