import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildAuditReport } from '../audit.mjs'
import { buildEditProposal } from '../edit.mjs'
import { commitFiles } from '../transaction.mjs'
import { previewPhoto } from '../preview.mjs'
import { createFixture, validPhoto } from './helpers.mjs'

test('reclassification proposes the correct Animals to Habitat diff and preserves src', async () => {
  const photo = validPhoto({ theme: 'wildlife' })
  const fixture = await createFixture({ places: [photo] })
  const current = { catalog: 'places', index: 0, photo }
  const proposal = await buildEditProposal({
    state: fixture.state,
    config: fixture.config,
    current,
    updates: {
      classification: { major: 'wildlife', section: 'habitat', environment: 'water' },
    },
  })
  assert.equal(proposal.nextPhoto.src, photo.src)
  assert.equal(proposal.nextPhoto.theme, 'water')
  assert.equal(proposal.nextPhoto.habitat, true)
  assert.ok(
    proposal.diff.some(
      (change) =>
        change.key === 'placement' &&
        change.before === 'Wildlife → Animals' &&
        change.after === 'Wildlife → Habitat',
    ),
  )
})

test('audit flags absent recommended fields but ignores intentional null', async () => {
  const fixture = await createFixture({
    places: [
      validPhoto({ src: '/images/places/unreviewed.jpg' }),
      validPhoto({ src: '/images/places/reviewed.jpg', location: null, year: null }),
    ],
  })
  const report = await buildAuditReport(fixture.state, fixture.config)
  assert.deepEqual(report.recommended.location.map((entry) => entry.photo.src), [
    '/images/places/unreviewed.jpg',
  ])
  assert.deepEqual(report.recommended.year.map((entry) => entry.photo.src), [
    '/images/places/unreviewed.jpg',
  ])
})

test('transaction rollback restores every target after a simulated commit failure', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'jascielle-rollback-test-'))
  const first = path.join(rootDir, 'first.json')
  const second = path.join(rootDir, 'second.json')
  await writeFile(first, 'old-first')
  await writeFile(second, 'old-second')
  await assert.rejects(
    commitFiles(
      [
        { targetPath: first, content: 'new-first' },
        { targetPath: second, content: 'new-second' },
      ],
      { failAfter: 1 },
    ),
    /Simulated transaction failure/,
  )
  assert.equal(await readFile(first, 'utf8'), 'old-first')
  assert.equal(await readFile(second, 'utf8'), 'old-second')
  assert.deepEqual((await readdir(rootDir)).sort(), ['first.json', 'second.json'])
})

test('preview has a safe path-only fallback', async () => {
  const fixture = await createFixture({ places: [validPhoto()] })
  const result = previewPhoto(fixture.config, '/images/places/base.jpg', { open: false })
  assert.equal(result.opened, false)
  assert.equal(result.filePath, path.join(fixture.rootDir, 'public/images/places/base.jpg'))
})
