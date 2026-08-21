import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  dimensionsForLongEdge,
  responsiveImageSrcSet,
  responsiveVariantSrc,
  responsiveVariantsForPhoto,
} from '../../../src/data/responsiveImages.js'
import { loadCatalogState } from '../catalog.mjs'
import { runResponsiveGeneration } from '../generate-responsive.mjs'
import { sourceDigest } from '../images.mjs'
import { validateCatalogState } from '../validate.mjs'
import { createFixture, jpegBuffer, validPhoto } from './helpers.mjs'

test('responsive paths are derived deterministically beside the catalog source', () => {
  assert.equal(
    responsiveVariantSrc('/images/places/IMG_1234.jpg', 960),
    '/images/places/responsive/IMG_1234-960.jpg',
  )
})

test('long-edge dimensions preserve portrait, landscape, and square aspect ratios', () => {
  assert.deepEqual(dimensionsForLongEdge(1066, 1600, 640), {
    width: 426,
    height: 640,
  })
  assert.deepEqual(dimensionsForLongEdge(1600, 1066, 640), {
    width: 640,
    height: 426,
  })
  assert.deepEqual(dimensionsForLongEdge(1600, 1600, 640), {
    width: 640,
    height: 640,
  })
})

test('responsive variants never upscale smaller catalog images', () => {
  const photo = validPhoto({ width: 500, height: 400 })
  assert.deepEqual(responsiveVariantsForPhoto(photo), [])
  assert.equal(responsiveImageSrcSet(photo), '/images/places/base.jpg 500w')
})

test('generated srcset candidates use actual pixel widths and retain the full source', () => {
  const photo = validPhoto({ width: 1066, height: 1600 })
  assert.equal(
    responsiveImageSrcSet(photo),
    [
      '/images/places/responsive/base-640.jpg 426w',
      '/images/places/responsive/base-960.jpg 640w',
      '/images/places/responsive/base-1400.jpg 933w',
      '/images/places/base.jpg 1066w',
    ].join(', '),
  )
})

test('catalog validation reports missing responsive variants', async () => {
  const photo = validPhoto({ width: 800, height: 1200 })
  const fixture = await createFixture({ places: [photo] })
  const result = await validateCatalogState(fixture.state, fixture.config)
  const missing = result.errors.filter(
    (issue) => issue.code === 'missing-responsive-variant',
  )
  assert.deepEqual(
    missing.map((issue) => issue.subject),
    [
      '/images/places/responsive/base-640.jpg',
      '/images/places/responsive/base-960.jpg',
    ],
  )
})

test('responsive generation is idempotent and leaves the full source untouched', async () => {
  const photo = validPhoto({ width: 800, height: 1200 })
  const fixture = await createFixture({ places: [photo] })
  const sourcePath = path.join(fixture.config.publicDir, photo.src.slice(1))
  await writeFile(sourcePath, await jpegBuffer(photo.width, photo.height))
  const before = await sourceDigest(sourcePath)

  assert.equal(await runResponsiveGeneration(fixture.config), 0)
  assert.equal(await runResponsiveGeneration(fixture.config), 0)
  assert.equal(await sourceDigest(sourcePath), before)
  for (const variant of responsiveVariantsForPhoto(photo)) {
    await access(path.join(fixture.config.publicDir, variant.src.slice(1)))
  }

  const state = await loadCatalogState(fixture.config)
  assert.equal((await validateCatalogState(state, fixture.config)).valid, true)
})

test('Work lightbox continues to render the full catalog source without srcset', async () => {
  const source = await readFile(
    new URL('../../../src/components/work/WorkImageLightbox.jsx', import.meta.url),
    'utf8',
  )
  assert.match(source, /<ProtectedImage[\s\S]*?src=\{image\.src\}/)
  assert.doesNotMatch(source, /srcSet=/)
})
