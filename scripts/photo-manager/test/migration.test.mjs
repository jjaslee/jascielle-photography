import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { photoManagerConfig } from '../config.mjs'

const baseline = JSON.parse(
  await readFile(new URL('../migration-baseline.json', import.meta.url), 'utf8'),
)

test('JSON migration preserves every original catalog record in order', async () => {
  for (const [name, expected] of Object.entries(baseline)) {
    const photos = JSON.parse(await readFile(photoManagerConfig.catalogFiles[name], 'utf8'))
    const currentSrcs = photos.map((photo) => photo.src)
    const hash = createHash('sha256')
      .update(expected.orderedSrcs.join('\n'))
      .digest('hex')
    assert.equal(expected.orderedSrcs.length, expected.count, `${name} baseline count`)
    assert.equal(hash, expected.orderedSrcSha256, `${name} baseline hash`)

    let cursor = -1
    for (const src of expected.orderedSrcs) {
      cursor = currentSrcs.indexOf(src, cursor + 1)
      assert.notEqual(cursor, -1, `${name} retains ${src} in its original order`)
    }
  }
})
