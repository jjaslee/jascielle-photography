import { checkbox, confirm, input, select } from '@inquirer/prompts'
import path from 'node:path'
import { placementLabel } from '../../src/data/photoSchema.js'
import { placementTargetsFor, searchPhotos } from './catalog.mjs'
import { heading, valueLabel } from './format.mjs'

export const BACK = '__back__'
export const CANCEL = '__cancel__'
export const NO_SECONDARY_PLACEMENT = '__no_secondary_placement__'

function selectionValues(selections) {
  return selections.map((selection) =>
    typeof selection === 'string' ? selection : selection.value,
  )
}

export function validateOptionalPlacementSelection(selections) {
  const values = selectionValues(selections)
  const hasNoSecondary = values.includes(NO_SECONDARY_PLACEMENT)
  const hasRealPlacement = values.some((value) =>
    ['preview', 'featured', 'cover'].includes(value),
  )
  return hasNoSecondary && hasRealPlacement
    ? 'Choose either "No secondary placement" or one or more placements.'
    : true
}

export function resolveOptionalPlacementSelection(selections) {
  const values = selectionValues(selections)
  if (values.includes(BACK)) return BACK
  return values.filter((value) => value !== NO_SECONDARY_PLACEMENT)
}

export async function promptAlt(current = '') {
  heading(`ACCESSIBILITY DESCRIPTION

Describe what is visibly happening in the photograph.
Keep it concise and factual.

Example:
Graduate wearing a blue-and-gold stole standing among roses.`)
  const value = await input({
    message: 'Alt text (type “back” to return)',
    default: current || undefined,
    validate: (answer) =>
      answer.trim().toLowerCase() === 'back' ||
      answer.trim().length > 0 ||
      'Alt text is required.',
  })
  return value.trim().toLowerCase() === 'back' ? BACK : value.trim()
}

export async function promptLocation(current, { allowUnreviewed = false } = {}) {
  while (true) {
    heading(`LOCATION

This may appear as the small lightbox caption.
Examples: Hong Kong · Pigeon Point Lighthouse · UC Berkeley · Osaka, Japan

GPS EXIF is never used to publish a location.`)
    const value = await input({
      message: 'Location (blank for options; type “back” to return)',
      default: typeof current === 'string' ? current : undefined,
    })
    if (value.trim().toLowerCase() === 'back') return BACK
    if (value.trim()) return value.trim()

    const choices = [
      { name: 'Mark location as intentionally blank', value: null },
      { name: 'Enter a location', value: 'retry' },
    ]
    if (allowUnreviewed) choices.push({ name: 'Leave unreviewed', value: undefined })
    choices.push({ name: '← Back', value: BACK })
    const decision = await select({ message: 'Blank location', choices })
    if (decision === 'retry') continue
    return decision
  }
}

export async function promptYear(current, { defaultToCurrent = false, allowUnreviewed = false } = {}) {
  const currentYear = new Date().getFullYear()
  while (true) {
    const value = await input({
      message: `Year taken (four digits, “none”, or “back”)`,
      default:
        Number.isInteger(current) ? String(current) : defaultToCurrent ? String(currentYear) : undefined,
      validate: (answer) => {
        const normalized = answer.trim().toLowerCase()
        if (normalized === 'back' || normalized === 'none') return true
        if (!normalized && allowUnreviewed) return true
        const year = Number(normalized)
        return (
          (Number.isInteger(year) && year >= 1800 && year <= currentYear + 1) ||
          `Enter a year from 1800–${currentYear + 1}, “none”, or “back”.`
        )
      },
    })
    const normalized = value.trim().toLowerCase()
    if (normalized === 'back') return BACK
    if (normalized === 'none') return null
    if (!normalized && allowUnreviewed) return undefined
    return Number(normalized)
  }
}

export async function promptPlacement(photos, sectionLabel, currentSrc) {
  heading(`PLACEMENT WITHIN ${sectionLabel.toUpperCase()}`)
  const action = await select({
    message: 'Display order',
    default: 'end',
    choices: [
      { name: 'Add to end', value: 'end' },
      { name: 'Add to beginning', value: 'beginning' },
      ...(photos.length > 0
        ? [{ name: 'Insert relative to an existing photograph', value: 'relative' }]
        : []),
      { name: '← Back', value: BACK },
    ],
  })
  if (action === BACK) return BACK
  if (action !== 'relative') return { type: action }

  while (true) {
    const query = await input({ message: 'Search filename or alt text (blank lists all; “back” returns)' })
    if (query.trim().toLowerCase() === 'back') return promptPlacement(photos, sectionLabel, currentSrc)
    const normalized = query.trim().toLowerCase()
    const matches = photos.filter((photo) =>
      [path.posix.basename(photo.src), photo.alt, photo.location]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    )
    const candidates = matches.filter((photo) => photo.src !== currentSrc)
    if (candidates.length === 0) {
      console.log('No matching photographs. Try another search.')
      continue
    }
    const src = await select({
      message: 'Reference photograph',
      choices: [
        ...candidates.map((photo) => ({
          name: `${path.posix.basename(photo.src)} — ${photo.alt}`,
          value: photo.src,
        })),
        { name: '← Back', value: BACK },
      ],
    })
    if (src === BACK) continue
    const position = await select({
      message: `Place relative to ${path.posix.basename(src)}`,
      choices: [
        { name: 'Before', value: 'before' },
        { name: 'After', value: 'after' },
        { name: '← Back', value: BACK },
      ],
    })
    if (position === BACK) continue
    return { type: 'relative', src, position }
  }
}

export async function promptOptionalPlacements(catalog, photo, options = {}) {
  const targets = placementTargetsFor(catalog, photo)
  const choices = []
  if (targets.preview) {
    choices.push({ name: `Work index hover preview (${targets.preview})`, value: 'preview' })
  }
  if (targets.featured) {
    choices.push({ name: `Replace Homepage Featured image (${targets.featured})`, value: 'featured' })
  }
  if (targets.cover) {
    choices.push({ name: `Replace legacy category cover (${targets.cover})`, value: 'cover' })
  }
  if (choices.length === 0) return []
  heading(`OPTIONAL SITE PLACEMENT

The main gallery import never adds secondary placements automatically.
All choices default to off.`)
  const selections = await checkbox({
    message: 'Also use this photograph elsewhere?',
    choices: [
      ...(options.includeNoSecondary
        ? [{ name: 'No secondary placement', value: NO_SECONDARY_PLACEMENT }]
        : []),
      ...choices.map((choice) => ({
        ...choice,
        checked: options.checked?.includes(choice.value) ?? false,
      })),
      { name: '← Back', value: BACK },
    ],
    validate: validateOptionalPlacementSelection,
  })
  return resolveOptionalPlacementSelection(selections)
}

export async function promptPhotoSearch(state, initialQuery = '') {
  let query = initialQuery
  while (true) {
    if (!query) query = await input({ message: 'Search filename, src, alt, location, or category' })
    const matches = searchPhotos(state, query)
    if (matches.length === 0) {
      console.log('No matching photographs.')
      query = ''
      continue
    }
    if (matches.length === 1) return matches[0]
    const selected = await select({
      message: 'Select a photograph',
      choices: [
        ...matches.map((entry) => ({
          name: `${path.posix.basename(entry.photo.src)} — ${placementLabel(entry.catalog, entry.photo)} — ${valueLabel(entry.photo.location, '—')}`,
          value: `${entry.catalog}:${entry.index}`,
        })),
        { name: 'Search again', value: BACK },
        { name: 'Cancel', value: CANCEL },
      ],
    })
    if (selected === CANCEL) return null
    if (selected === BACK) {
      query = ''
      continue
    }
    const [catalog, index] = selected.split(':')
    return { catalog, index: Number(index), photo: state.catalogs[catalog][Number(index)] }
  }
}

export async function confirmBuild() {
  return confirm({ message: 'Run production build now?', default: false })
}
