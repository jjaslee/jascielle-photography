import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { photoManagerConfig } from '../config.mjs'

const baseline = JSON.parse(
  await readFile(new URL('../migration-baseline.json', import.meta.url), 'utf8'),
)

test('JSON migration preserves every catalog count and ordered src list', async () => {
  for (const [name, expected] of Object.entries(baseline)) {
    const photos = JSON.parse(await readFile(photoManagerConfig.catalogFiles[name], 'utf8'))
    const hash = createHash('sha256')
      .update(photos.map((photo) => photo.src).join('\n'))
      .digest('hex')
    assert.equal(photos.length, expected.count, `${name} count`)
    assert.equal(hash, expected.orderedSrcSha256, `${name} ordered src hash`)
  }
})
