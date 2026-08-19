import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  catalogDefinitions,
  placementLabel,
  primaryPlacement,
} from '../../src/data/photoSchema.js'

export function cloneState(state) {
  return structuredClone(state)
}

export async function readJson(filePath) {
  const source = await readFile(filePath, 'utf8')
  return JSON.parse(source)
}

export async function loadCatalogState(config) {
  const catalogs = {}
  for (const [name, filePath] of Object.entries(config.catalogFiles)) {
    const value = await readJson(filePath)
    if (!Array.isArray(value)) throw new Error(`${path.relative(config.rootDir, filePath)} must contain a JSON array.`)
    catalogs[name] = value
  }

  const placements = await readJson(config.placementsPath)
  return { catalogs, placements }
}

export function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function flattenCatalogs(state) {
  return Object.entries(state.catalogs).flatMap(([catalog, photos]) =>
    photos.map((photo, index) => ({ catalog, index, photo })),
  )
}

export function findPhotoBySrc(state, src) {
  return flattenCatalogs(state).find((entry) => entry.photo.src === src) ?? null
}

export function searchPhotos(state, query) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return flattenCatalogs(state)

  return flattenCatalogs(state).filter(({ catalog, photo }) => {
    const placement = primaryPlacement(catalog, photo)
    return [
      path.posix.basename(photo.src),
      photo.src,
      photo.alt,
      photo.location,
      placement?.major,
      placement?.section,
    ]
      .filter((value) => value !== null && value !== undefined)
      .some((value) => String(value).toLowerCase().includes(normalized))
  })
}

export function insertionIndex(photos, placement = { type: 'end' }) {
  if (placement.type === 'beginning') return 0
  if (placement.type === 'relative') {
    const index = photos.findIndex((photo) => photo.src === placement.src)
    if (index < 0) throw new Error(`Placement reference ${placement.src} was not found.`)
    return placement.position === 'before' ? index : index + 1
  }
  return photos.length
}

export function insertPhoto(state, catalog, photo, placement) {
  const photos = state.catalogs[catalog]
  if (!photos) throw new Error(`Unknown catalog: ${catalog}`)
  const index = insertionIndex(photos, placement)
  photos.splice(index, 0, photo)
  return index
}

export function removePhoto(state, catalog, src) {
  const photos = state.catalogs[catalog]
  const index = photos.findIndex((photo) => photo.src === src)
  if (index < 0) throw new Error(`${src} was not found in ${catalog}.`)
  return { photo: photos.splice(index, 1)[0], index }
}

export function replacePhoto(state, catalog, src, nextPhoto) {
  const photos = state.catalogs[catalog]
  const index = photos.findIndex((photo) => photo.src === src)
  if (index < 0) throw new Error(`${src} was not found in ${catalog}.`)
  photos[index] = nextPhoto
  return index
}

export function relocatePhoto(state, current, nextCatalog, nextPhoto, placement) {
  removePhoto(state, current.catalog, current.photo.src)
  return insertPhoto(state, nextCatalog, nextPhoto, placement)
}

export function placementTargetsFor(catalog, photo) {
  const primary = primaryPlacement(catalog, photo)
  if (!primary) return { preview: null, cover: null, featured: null }
  const major = primary.major.toLowerCase()
  const cover =
    catalog === 'portraits' || catalog === 'events'
      ? catalog
      : primary.major === 'Places'
        ? 'places'
        : null
  return {
    preview: major,
    cover,
    featured: ['people', 'places', 'wildlife'].includes(major) ? major : null,
  }
}

export function applyOptionalPlacements(
  state,
  catalog,
  photo,
  selections = [],
  options = {},
) {
  const targets = placementTargetsFor(catalog, photo)
  if (options.replacePreview) {
    for (const values of Object.values(state.placements.workPreviews)) {
      const index = values.indexOf(photo.src)
      if (index >= 0) values.splice(index, 1)
    }
  }
  if (selections.includes('preview') && targets.preview) {
    const values = state.placements.workPreviews[targets.preview]
    if (!values.includes(photo.src)) values.push(photo.src)
  }
  if (selections.includes('cover') && targets.cover) {
    state.placements.categoryCovers[targets.cover] = photo.src
  }
  if (selections.includes('featured') && targets.featured) {
    state.placements.featured[targets.featured] = photo.src
  }
}

export function currentOptionalPlacements(state, catalog, photo) {
  const targets = placementTargetsFor(catalog, photo)
  const selections = []
  if (targets.preview && state.placements.workPreviews[targets.preview]?.includes(photo.src)) {
    selections.push('preview')
  }
  if (targets.cover && state.placements.categoryCovers[targets.cover] === photo.src) {
    selections.push('cover')
  }
  if (targets.featured && state.placements.featured[targets.featured] === photo.src) {
    selections.push('featured')
  }
  return selections
}

export function allSecondaryReferences(placements) {
  const references = []
  for (const [category, values] of Object.entries(placements.workPreviews ?? {})) {
    for (const src of values) references.push({ type: `Work preview (${category})`, src })
  }
  for (const [category, src] of Object.entries(placements.categoryCovers ?? {})) {
    references.push({ type: `Category cover (${category})`, src })
  }
  for (const [category, src] of Object.entries(placements.featured ?? {})) {
    references.push({ type: `Featured (${category})`, src })
  }
  return references
}

export function manifestWrites(config, before, after) {
  const writes = []
  for (const catalog of Object.keys(catalogDefinitions)) {
    if (JSON.stringify(before.catalogs[catalog]) !== JSON.stringify(after.catalogs[catalog])) {
      writes.push({
        targetPath: config.catalogFiles[catalog],
        content: serializeJson(after.catalogs[catalog]),
      })
    }
  }
  if (JSON.stringify(before.placements) !== JSON.stringify(after.placements)) {
    writes.push({ targetPath: config.placementsPath, content: serializeJson(after.placements) })
  }
  return writes
}

export function catalogSummary(state) {
  return Object.fromEntries(
    Object.entries(state.catalogs).map(([name, photos]) => [name, photos.length]),
  )
}

export function describeEntry(entry) {
  return `${path.posix.basename(entry.photo.src)} — ${placementLabel(entry.catalog, entry.photo)}`
}
