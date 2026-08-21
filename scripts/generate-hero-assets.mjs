import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Build Hero-only responsive layers plus the neutral flattened startup poster.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const heroDirectory = resolve(projectRoot, 'public/images/hero')
const widths = [640, 960, 1400, 1536]
const sourceSize = { width: 1536, height: 1024 }
const layerNames = [
  'hero-background',
  'hero-midground',
  'hero-foreground',
  'stream-background',
  'stream-foreground',
  'stream-canopy',
  'jaguar-canopy',
  'jaguar-foreground',
  'jaguar-reflection',
]
const webpOptions = {
  quality: 84,
  alphaQuality: 100,
  effort: 6,
  smartSubsample: true,
}

async function assertSourceSize(filePath) {
  const metadata = await sharp(filePath).metadata()
  if (metadata.width !== sourceSize.width || metadata.height !== sourceSize.height) {
    throw new Error(
      `Expected ${filePath} to be ${sourceSize.width}x${sourceSize.height}; received ${metadata.width}x${metadata.height}.`,
    )
  }
}

async function writeVariants(name, input) {
  await Promise.all(
    widths.map((width) =>
      sharp(input)
        .resize({ width, withoutEnlargement: true })
        .webp(webpOptions)
        .toFile(resolve(heroDirectory, `${name}-${width}.webp`)),
    ),
  )
}

await mkdir(heroDirectory, { recursive: true })

for (const name of layerNames) {
  const sourcePath = resolve(heroDirectory, `${name}.png`)
  await assertSourceSize(sourcePath)
  await writeVariants(name, sourcePath)
}

const posterLayers = [
  resolve(heroDirectory, 'hero-midground.png'),
  resolve(heroDirectory, 'hero-foreground.png'),
]
const posterBuffer = await sharp(resolve(heroDirectory, 'hero-background.png'))
  .composite(posterLayers.map((input) => ({ input })))
  .png()
  .toBuffer()

await writeVariants('hero-poster', posterBuffer)

console.log(
  `Generated ${widths.length} responsive WebP variants for ${layerNames.length} Hero layers and the flattened poster.`,
)
