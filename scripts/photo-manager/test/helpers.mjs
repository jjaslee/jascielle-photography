import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { createConfig } from '../config.mjs'
import { loadCatalogState, serializeJson } from '../catalog.mjs'

export function validPhoto(overrides = {}) {
  return {
    src: '/images/places/base.jpg',
    alt: 'A valid fixture photograph',
    width: 40,
    height: 30,
    theme: 'street',
    ...overrides,
  }
}

export function emptyPlacements() {
  return {
    workPreviews: { people: [], places: [], wildlife: [], objects: [], spaces: [] },
    categoryCovers: {},
    featured: {},
  }
}

export async function jpegBuffer(width = 40, height = 30, color = '#336699') {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .jpeg({ quality: 90 })
    .toBuffer()
}

export async function createFixture(catalogs = {}, options = {}) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'jascielle-photo-test-'))
  const config = createConfig(rootDir)
  const completeCatalogs = {
    portraits: [],
    events: [],
    places: [],
    objects: [],
    spaces: [],
    ...catalogs,
  }
  await mkdir(config.manifestDir, { recursive: true })
  for (const [name, photos] of Object.entries(completeCatalogs)) {
    await writeFile(config.catalogFiles[name], serializeJson(photos), 'utf8')
  }
  await writeFile(
    config.placementsPath,
    serializeJson(options.placements ?? emptyPlacements()),
    'utf8',
  )
  if (options.createImages !== false) {
    for (const photo of Object.values(completeCatalogs).flat()) {
      const filePath = path.join(config.publicDir, photo.src.replace(/^\//, ''))
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, await jpegBuffer(photo.width || 40, photo.height || 30))
    }
  }
  const incomingDir = path.join(rootDir, 'incoming')
  await mkdir(incomingDir, { recursive: true })
  const sourcePath = path.join(incomingDir, 'source.jpg')
  await writeFile(sourcePath, await jpegBuffer(80, 60, '#884422'))
  return {
    rootDir,
    config,
    sourcePath,
    state: await loadCatalogState(config),
  }
}

async function walkFiles(rootDir, current = rootDir) {
  const entries = await readdir(current, { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name)
    if (entry.isDirectory()) results.push(...(await walkFiles(rootDir, fullPath)))
    else results.push(path.relative(rootDir, fullPath))
  }
  return results.sort()
}

export async function snapshotTree(rootDir) {
  const snapshot = {}
  for (const relative of await walkFiles(rootDir)) {
    const data = await readFile(path.join(rootDir, relative))
    snapshot[relative] = createHash('sha256').update(data).digest('hex')
  }
  return snapshot
}
