import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import {
  fieldsNeedingReview,
  metadataForClassification,
  validatePhotoRecord,
} from '../../../src/data/photoSchema.js'
import { insertPhoto, searchPhotos } from '../catalog.mjs'
import { runValidationCommand, validateCatalogState } from '../validate.mjs'
import { createFixture, validPhoto } from './helpers.mjs'

test('classification mappings are deterministic', () => {
  assert.deepEqual(
    metadataForClassification({ major: 'places', section: 'street' }),
    { catalog: 'places', metadata: { theme: 'street' } },
  )
  assert.deepEqual(
    metadataForClassification({ major: 'places', section: 'landscape', environment: 'green' }),
    { catalog: 'places', metadata: { theme: 'green' } },
  )
  assert.deepEqual(
    metadataForClassification({ major: 'places', section: 'landscape', environment: 'water' }),
    { catalog: 'places', metadata: { theme: 'water' } },
  )
  assert.deepEqual(
    metadataForClassification({ major: 'places', section: 'light' }),
    { catalog: 'places', metadata: { theme: 'night' } },
  )
  assert.deepEqual(
    metadataForClassification({ major: 'wildlife', section: 'animals' }),
    { catalog: 'places', metadata: { theme: 'wildlife' } },
  )
  assert.deepEqual(
    metadataForClassification({ major: 'wildlife', section: 'habitat', environment: 'water' }),
    { catalog: 'places', metadata: { theme: 'water', habitat: true } },
  )
})

test('recommended metadata distinguishes missing, null, and reviewed values', () => {
  assert.deepEqual(fieldsNeedingReview({}), ['location', 'year'])
  assert.deepEqual(fieldsNeedingReview({ location: null, year: null }), [])
  assert.deepEqual(fieldsNeedingReview({ location: 'Osaka, Japan', year: 2026 }), [])
})

test('duplicate src values fail catalog validation', async () => {
  const fixture = await createFixture({}, { createImages: false })
  fixture.state.catalogs.places = [validPhoto(), validPhoto({ alt: 'Duplicate record' })]
  const result = await validateCatalogState(fixture.state, fixture.config, {
    checkFiles: false,
    checkOrphans: false,
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((issue) => issue.code === 'duplicate-src'))
})

test('invalid habitat taxonomy combinations are rejected', () => {
  const errors = validatePhotoRecord(
    'places',
    validPhoto({ theme: 'night', habitat: true }),
  )
  assert.ok(errors.some((message) => message.includes('primary Work placement')))
})

test('catalog insertion preserves existing JSON order', () => {
  const state = {
    catalogs: {
      places: [
        validPhoto({ src: '/images/places/a.jpg' }),
        validPhoto({ src: '/images/places/c.jpg' }),
      ],
    },
  }
  insertPhoto(
    state,
    'places',
    validPhoto({ src: '/images/places/b.jpg' }),
    { type: 'relative', src: '/images/places/c.jpg', position: 'before' },
  )
  assert.deepEqual(
    state.catalogs.places.map((photo) => photo.src),
    ['/images/places/a.jpg', '/images/places/b.jpg', '/images/places/c.jpg'],
  )
})

test('edit search matches filename, alt, location, major category, and subsection', () => {
  const photo = validPhoto({
    src: '/images/places/IMG_Search.jpg',
    alt: 'Bird crossing a coastal sky',
    theme: 'water',
    habitat: true,
    location: 'Half Moon Bay, California',
  })
  const state = { catalogs: { places: [photo] } }
  for (const query of ['search', 'coastal sky', 'half moon', 'wildlife', 'habitat']) {
    assert.equal(searchPhotos(state, query).length, 1, query)
  }
})

test('CI validation fails with an actionable missing-file error', async () => {
  const fixture = await createFixture(
    { places: [validPhoto({ src: '/images/places/missing.jpg' })] },
    { createImages: false },
  )
  const messages = []
  const originalError = console.error
  const originalWarn = console.warn
  const originalLog = console.log
  console.error = (...args) => messages.push(args.join(' '))
  console.warn = (...args) => messages.push(args.join(' '))
  console.log = (...args) => messages.push(args.join(' '))
  try {
    assert.equal(await runValidationCommand(fixture.config), 1)
  } finally {
    console.error = originalError
    console.warn = originalWarn
    console.log = originalLog
  }
  const output = messages.join('\n')
  assert.match(output, /\/images\/places\/missing\.jpg/)
  assert.match(output, /catalog file does not exist/)
})

test('CI validation fails cleanly when a manifest does not parse', async () => {
  const fixture = await createFixture()
  await writeFile(fixture.config.catalogFiles.places, '{ invalid json', 'utf8')
  const messages = []
  const originalError = console.error
  console.error = (...args) => messages.push(args.join(' '))
  try {
    assert.equal(await runValidationCommand(fixture.config), 1)
  } finally {
    console.error = originalError
  }
  assert.match(messages.join('\n'), /Catalog could not be loaded/)
})
