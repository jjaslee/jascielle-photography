export const PHOTO_SCHEMA_VERSION = 1

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const imagePathPattern = /^\/images\/[A-Za-z0-9._/-]+$/

export const photoFields = {
  src: {
    tier: 'required',
    description: 'Public image path',
    validate: (value) =>
      typeof value === 'string' &&
      imagePathPattern.test(value) &&
      !value.split('/').includes('..'),
  },
  alt: {
    tier: 'required',
    description: 'Concise accessibility description',
    validate: (value) => typeof value === 'string' && value.trim().length > 0,
  },
  width: {
    tier: 'required',
    derived: true,
    description: 'Intrinsic pixel width',
    validate: (value) => Number.isInteger(value) && value > 0,
  },
  height: {
    tier: 'required',
    derived: true,
    description: 'Intrinsic pixel height',
    validate: (value) => Number.isInteger(value) && value > 0,
  },
  location: {
    tier: 'recommended',
    nullable: true,
    description: 'Optional visible lightbox location',
    validate: (value) => value === null || (typeof value === 'string' && value.trim().length > 0),
  },
  year: {
    tier: 'recommended',
    nullable: true,
    description: 'Four-digit year taken',
    validate: (value) => {
      const maximum = new Date().getFullYear() + 1
      return value === null || (Number.isInteger(value) && value >= 1800 && value <= maximum)
    },
  },
}

export const catalogDefinitions = {
  portraits: {
    exportName: 'portraitImages',
    folder: 'portraits',
    major: 'People',
    sections: ['portraits'],
  },
  events: {
    exportName: 'eventImages',
    folder: 'events',
    major: 'People',
    sections: ['events'],
  },
  places: {
    exportName: 'placeImages',
    folder: 'places',
    major: 'Places / Wildlife',
    sections: ['street', 'landscape', 'light', 'animals', 'habitat'],
  },
  objects: {
    exportName: 'objectImages',
    folder: 'objects',
    major: 'Objects',
    sections: ['product', 'still-life'],
  },
  spaces: {
    exportName: 'spaceImages',
    folder: 'spaces',
    major: 'Spaces',
    sections: ['real-estate', 'interiors'],
  },
}

export const portraitThemes = ['bright', 'moody']
export const placeThemes = ['street', 'night', 'green', 'water', 'wildlife']
export const objectSections = ['product', 'still-life']
export const spaceSections = ['real-estate', 'interiors']

export const classificationFieldNames = [
  'session',
  'category',
  'theme',
  'habitat',
  'section',
]

export function isValidSlug(value) {
  return typeof value === 'string' && slugPattern.test(value)
}

export function metadataForClassification(classification) {
  const { major, section } = classification

  if (major === 'people' && section === 'portraits') {
    return {
      catalog: 'portraits',
      metadata: { session: classification.session, theme: classification.theme },
    }
  }

  if (major === 'people' && section === 'events') {
    return { catalog: 'events', metadata: { category: classification.category } }
  }

  if (major === 'places') {
    if (section === 'street') return { catalog: 'places', metadata: { theme: 'street' } }
    if (section === 'light') return { catalog: 'places', metadata: { theme: 'night' } }
    if (section === 'landscape') {
      return { catalog: 'places', metadata: { theme: classification.environment } }
    }
  }

  if (major === 'wildlife') {
    if (section === 'animals') {
      return { catalog: 'places', metadata: { theme: 'wildlife' } }
    }
    if (section === 'habitat') {
      return {
        catalog: 'places',
        metadata: {
          theme: classification.environment === 'other' ? 'wildlife' : classification.environment,
          habitat: true,
        },
      }
    }
  }

  if (major === 'objects' && objectSections.includes(section)) {
    return { catalog: 'objects', metadata: { section } }
  }

  if (major === 'spaces' && spaceSections.includes(section)) {
    return { catalog: 'spaces', metadata: { section } }
  }

  throw new Error('Classification does not map to a supported catalog section.')
}

export function primaryPlacement(catalog, photo) {
  if (catalog === 'portraits') return { major: 'People', section: 'Portraits' }
  if (catalog === 'events') return { major: 'People', section: 'Events' }

  if (catalog === 'places') {
    if (photo.habitat === true && ['green', 'water', 'wildlife'].includes(photo.theme)) {
      return { major: 'Wildlife', section: 'Habitat' }
    }
    if (photo.habitat === true) return null
    if (photo.theme === 'street') return { major: 'Places', section: 'Street' }
    if (photo.theme === 'night') return { major: 'Places', section: 'Light' }
    if (photo.theme === 'green' || photo.theme === 'water') {
      return { major: 'Places', section: 'Landscape' }
    }
    if (photo.theme === 'wildlife') return { major: 'Wildlife', section: 'Animals' }
    return null
  }

  if (catalog === 'objects' && objectSections.includes(photo.section)) {
    return {
      major: 'Objects',
      section: photo.section === 'still-life' ? 'Still Life' : 'Product',
    }
  }

  if (catalog === 'spaces' && spaceSections.includes(photo.section)) {
    return {
      major: 'Spaces',
      section: photo.section === 'real-estate' ? 'Real Estate' : 'Interiors',
    }
  }

  return null
}

export function placementLabel(catalog, photo) {
  const placement = primaryPlacement(catalog, photo)
  return placement ? `${placement.major} → ${placement.section}` : 'Invalid classification'
}

export function validatePhotoRecord(catalog, photo) {
  const errors = []

  if (!photo || typeof photo !== 'object' || Array.isArray(photo)) {
    return ['record must be an object']
  }

  for (const [field, definition] of Object.entries(photoFields)) {
    if (definition.tier === 'required' && !Object.hasOwn(photo, field)) {
      errors.push(`${field} is required`)
    } else if (Object.hasOwn(photo, field) && !definition.validate(photo[field])) {
      errors.push(`${field} has an invalid value`)
    }
  }

  if (!catalogDefinitions[catalog]) errors.push(`unknown catalog ${catalog}`)
  if (catalog === 'portraits') {
    if (!isValidSlug(photo.session)) errors.push('session must be a lowercase slug')
    if (!portraitThemes.includes(photo.theme)) errors.push('theme must be bright or moody')
  }
  if (catalog === 'events' && !isValidSlug(photo.category)) {
    errors.push('category must be a lowercase slug')
  }
  if (catalog === 'places') {
    if (!placeThemes.includes(photo.theme)) errors.push('theme is not valid for Places/Wildlife')
    if (Object.hasOwn(photo, 'habitat') && typeof photo.habitat !== 'boolean') {
      errors.push('habitat must be a boolean when present')
    }
  }
  if (catalog === 'objects' && !objectSections.includes(photo.section)) {
    errors.push('section must be product or still-life')
  }
  if (catalog === 'spaces' && !spaceSections.includes(photo.section)) {
    errors.push('section must be real-estate or interiors')
  }
  if (!primaryPlacement(catalog, photo)) errors.push('record has no valid primary Work placement')

  return [...new Set(errors)]
}

export function fieldsNeedingReview(photo, tier = 'recommended') {
  return Object.entries(photoFields)
    .filter(([, definition]) => definition.tier === tier)
    .filter(([field]) => !Object.hasOwn(photo, field))
    .map(([field]) => field)
}

export function applyClassification(photo, classification) {
  const { catalog, metadata } = metadataForClassification(classification)
  const next = { ...photo }
  for (const field of classificationFieldNames) delete next[field]
  return { catalog, photo: { ...next, ...metadata } }
}
