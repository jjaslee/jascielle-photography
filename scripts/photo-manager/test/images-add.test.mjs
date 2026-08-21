import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { buildAddProposal, commitAddProposal, outputTarget } from '../add.mjs'
import { loadCatalogState } from '../catalog.mjs'
import { inspectImage, intrinsicImageInfo, optimizeImage, sourceDigest } from '../images.mjs'
import { responsiveVariantsForPhoto } from '../../../src/data/responsiveImages.js'
import { createFixture, snapshotTree } from './helpers.mjs'

const classification = { major: 'places', section: 'street' }

test('a dry-run proposal performs zero filesystem writes', async () => {
  const fixture = await createFixture()
  const before = await snapshotTree(fixture.rootDir)
  const inspection = await inspectImage(fixture.sourcePath, fixture.config)
  const proposal = await buildAddProposal({
    ...fixture,
    sourcePath: fixture.sourcePath,
    inspection,
    classification,
    alt: 'Fixture street photograph',
    location: null,
    year: null,
    placement: { type: 'end' },
  })
  const after = await snapshotTree(fixture.rootDir)
  assert.deepEqual(after, before)
  assert.equal(proposal.photo.src, '/images/places/source.jpg')
})

test('image optimization never modifies the source file', async () => {
  const fixture = await createFixture()
  const before = await sourceDigest(fixture.sourcePath)
  await optimizeImage(fixture.sourcePath, fixture.config)
  const after = await sourceDigest(fixture.sourcePath)
  assert.equal(after, before)
})

test('optimized output strips source EXIF metadata', async () => {
  const fixture = await createFixture()
  await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#663399' },
  })
    .withExif({ IFD0: { Artist: 'Private fixture metadata' } })
    .jpeg()
    .toFile(fixture.sourcePath)
  const sourceMetadata = await sharp(fixture.sourcePath).metadata()
  assert.ok(sourceMetadata.exif)
  const optimized = await optimizeImage(fixture.sourcePath, fixture.config)
  const outputMetadata = await sharp(optimized.buffer).metadata()
  assert.equal(outputMetadata.exif, undefined)
})

test('a confirmed fixture import writes an optimized image and ordered manifest safely', async () => {
  const fixture = await createFixture()
  const sourceBefore = await sourceDigest(fixture.sourcePath)
  const proposal = await buildAddProposal({
    ...fixture,
    sourcePath: fixture.sourcePath,
    classification,
    alt: 'Fixture street photograph',
    location: null,
    year: 2026,
    placement: { type: 'end' },
  })
  await commitAddProposal(proposal, fixture.state, fixture.config)
  const committed = await loadCatalogState(fixture.config)
  const output = await intrinsicImageInfo(proposal.outputPath)
  assert.equal(committed.catalogs.places.at(-1).src, proposal.photo.src)
  assert.deepEqual(
    { width: output.width, height: output.height, format: output.format },
    { width: 80, height: 60, format: 'jpeg' },
  )
  assert.equal(await sourceDigest(fixture.sourcePath), sourceBefore)
})

test('a future single-photo import writes its responsive gallery variants', async () => {
  const fixture = await createFixture()
  await writeFile(fixture.sourcePath, await sharp({
    create: { width: 800, height: 1200, channels: 3, background: '#557799' },
  }).jpeg().toBuffer())
  const inspection = await inspectImage(fixture.sourcePath, fixture.config)
  const proposal = await buildAddProposal({
    ...fixture,
    sourcePath: fixture.sourcePath,
    inspection,
    classification,
    alt: 'Large fixture street photograph',
    location: null,
    year: null,
    placement: { type: 'end' },
  })

  await commitAddProposal(proposal, fixture.state, fixture.config)
  assert.deepEqual(
    proposal.responsiveVariants.map(({ width, height }) => ({ width, height })),
    [
      { width: 427, height: 640 },
      { width: 640, height: 960 },
    ],
  )
  for (const variant of responsiveVariantsForPhoto(proposal.photo)) {
    const output = await intrinsicImageInfo(
      path.join(fixture.config.publicDir, variant.src.slice(1)),
    )
    assert.deepEqual(
      { width: output.width, height: output.height, format: output.format },
      { width: variant.width, height: variant.height, format: 'jpeg' },
    )
  }
})

test('an output collision never overwrites an existing file', async () => {
  const fixture = await createFixture()
  const target = outputTarget(fixture.config, 'places', 'source.jpg')
  await mkdir(path.dirname(target.outputPath), { recursive: true })
  await writeFile(target.outputPath, 'sentinel')
  await assert.rejects(
    buildAddProposal({
      ...fixture,
      sourcePath: fixture.sourcePath,
      classification,
      alt: 'Fixture street photograph',
      location: null,
      year: null,
      placement: { type: 'end' },
    }),
    /already exists/,
  )
  assert.equal(await readFile(target.outputPath, 'utf8'), 'sentinel')
})

test('missing dimensions can be derived from the actual image', async () => {
  const fixture = await createFixture()
  const info = await intrinsicImageInfo(fixture.sourcePath)
  assert.deepEqual({ width: info.width, height: info.height }, { width: 80, height: 60 })
})
