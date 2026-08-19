import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { photoManagerConfig } from './config.mjs'

const baseline = JSON.parse(
  await readFile(new URL('./migration-baseline.json', import.meta.url), 'utf8'),
)
let valid = true

for (const [name, expected] of Object.entries(baseline)) {
  const photos = JSON.parse(await readFile(photoManagerConfig.catalogFiles[name], 'utf8'))
  const hash = createHash('sha256')
    .update(photos.map((photo) => photo.src).join('\n'))
    .digest('hex')
  const matches = photos.length === expected.count && hash === expected.orderedSrcSha256
  console.log(`${name}: before ${expected.count} / after ${photos.length} — order ${matches ? 'preserved' : 'CHANGED'}`)
  if (!matches) valid = false
}

process.exitCode = valid ? 0 : 1
