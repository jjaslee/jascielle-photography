import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { flattenCatalogs } from './catalog.mjs'
import { placementLabel } from '../../src/data/photoSchema.js'
import { publicPathForSrc } from './preview.mjs'

const sheetColumns = 4
const sheetRows = 5
const tileWidth = 240
const tileHeight = 190

export const DEFAULT_VISUAL_ANALYSIS_MODEL = 'gpt-5.6-terra'

function chunk(values, size) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function visualAnalysisSchema(tokens) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: ['photos'],
    properties: {
      photos: {
        type: 'array',
        minItems: tokens.length,
        maxItems: tokens.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'source',
            'status',
            'category',
            'subcategory',
            'session',
            'portraitTheme',
            'eventCategory',
            'environment',
            'alt',
            'placement',
            'batchOrder',
            'confidence',
            'reason',
          ],
          properties: {
            source: { type: 'string', enum: tokens },
            status: { type: 'string', enum: ['resolved', 'unresolved'] },
            category: {
              type: ['string', 'null'],
              enum: ['people', 'places', 'wildlife', 'objects', 'spaces', null],
            },
            subcategory: {
              type: ['string', 'null'],
              enum: [
                'portraits',
                'events',
                'street',
                'landscape',
                'light',
                'animals',
                'habitat',
                'product',
                'still-life',
                'real-estate',
                'interiors',
                null,
              ],
            },
            session: { type: ['string', 'null'] },
            portraitTheme: {
              type: ['string', 'null'],
              enum: ['bright', 'moody', null],
            },
            eventCategory: { type: ['string', 'null'] },
            environment: {
              type: ['string', 'null'],
              enum: ['green', 'water', 'other', null],
            },
            alt: { type: 'string', minLength: 1 },
            placement: {
              type: 'object',
              additionalProperties: false,
              required: ['position', 'referenceSrc'],
              properties: {
                position: {
                  type: ['string', 'null'],
                  enum: ['beginning', 'end', 'before', 'after', null],
                },
                referenceSrc: { type: ['string', 'null'] },
              },
            },
            batchOrder: { type: 'integer', minimum: 1 },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            reason: { type: 'string', minLength: 1 },
          },
        },
      },
    },
  }
}

async function createIncomingPreviews(batchPhotos, analysisDir) {
  const directory = path.join(analysisDir, 'incoming')
  await mkdir(directory, { recursive: true })
  const paths = []
  for (const photo of batchPhotos) {
    const outputPath = path.join(directory, `${photo.token}.jpg`)
    await sharp(photo.sourcePath, { failOn: 'error' })
      .autoOrient()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toFile(outputPath)
    paths.push(outputPath)
  }
  return paths
}

async function createContactSheet(entries, outputPath) {
  const rows = Math.ceil(entries.length / sheetColumns)
  const width = sheetColumns * tileWidth
  const height = rows * tileHeight
  const composites = []
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const left = (index % sheetColumns) * tileWidth
    const top = Math.floor(index / sheetColumns) * tileHeight
    const thumbnail = await sharp(entry.filePath, { failOn: 'error' })
      .autoOrient()
      .resize({ width: 220, height: 150, fit: 'contain', background: '#111111' })
      .jpeg({ quality: 72 })
      .toBuffer()
    const label = Buffer.from(
      `<svg width="220" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="220" height="24" fill="#111"/><text x="4" y="17" fill="#fff" font-family="monospace" font-size="14">${escapeXml(entry.token)}</text></svg>`,
    )
    composites.push({ input: thumbnail, left: left + 10, top: top + 8 })
    composites.push({ input: label, left: left + 10, top: top + 160 })
  }
  await sharp({
    create: { width, height, channels: 3, background: '#000000' },
  })
    .composite(composites)
    .jpeg({ quality: 78 })
    .toFile(outputPath)
}

async function createPortfolioReferences(state, config, analysisDir) {
  const references = flattenCatalogs(state).map((entry, index) => ({
    ...entry,
    token: `R${String(index + 1).padStart(3, '0')}`,
    filePath: publicPathForSrc(config, entry.photo.src),
    label: placementLabel(entry.catalog, entry.photo),
  }))
  const grouped = new Map()
  for (const reference of references) {
    const values = grouped.get(reference.label) ?? []
    values.push(reference)
    grouped.set(reference.label, values)
  }

  const directory = path.join(analysisDir, 'portfolio')
  await mkdir(directory, { recursive: true })
  const sheets = []
  let sheetNumber = 0
  for (const entries of grouped.values()) {
    for (const page of chunk(entries, sheetColumns * sheetRows)) {
      sheetNumber += 1
      const outputPath = path.join(
        directory,
        `reference-sheet-${String(sheetNumber).padStart(2, '0')}.jpg`,
      )
      await createContactSheet(page, outputPath)
      sheets.push(outputPath)
    }
  }
  return { references, sheets }
}

export function buildVisualAnalysisPrompt(batchPhotos, references) {
  const incomingMap = batchPhotos
    .map(
      (photo) =>
        `${photo.token} | ${path.basename(photo.sourcePath)} | ${photo.inspection.width}x${photo.inspection.height}`,
    )
    .join('\n')
  const referenceMap = references
    .map(
      (reference) =>
        `${reference.token} | ${reference.photo.src} | ${reference.label} | current catalog index ${reference.index}`,
    )
    .join('\n')

  return `You are the visual curator for the Jascielle Photography portfolio. Analyze the incoming photographs as one set and return only the JSON required by the supplied schema. Do not modify files or use tools.

Each incoming preview is named by its I-token. Portfolio contact sheets show existing photographs in their current order and label each thumbnail with an R-token. The maps below are authoritative.

INCOMING
${incomingMap}

EXISTING PORTFOLIO REFERENCES
${referenceMap || '(portfolio is empty)'}

AUTHORITATIVE TAXONOMY
- people / portraits: a directed or planned portrait. session is a concise lowercase slug; portraitTheme is bright or moody.
- people / events: activity or context matters more than posing. eventCategory is a concise lowercase slug.
- places / street: built environment, transit, storefronts, alleys, cars, signage, or observational documentary work.
- places / landscape: environment is primary. environment must be green for land/vegetation or water for water/coast.
- places / light: night, twilight, blue hour, neon, lamps, or darkness is central.
- wildlife / animals: an animal is the primary subject.
- wildlife / habitat: wildlife and its environment are both essential. environment is green, water, or other.
- objects / product or still-life.
- spaces / real-estate or interiors.

For every incoming photograph provide concise factual alt text, classification, confidence, a short placement reason, and placement relative to an EXISTING photograph in the SAME category/subcategory. Use beginning or end with a null reference when appropriate. For before/after, referenceSrc must be the exact /images/... src from the reference map, never an R-token or filename.

Curate the combined sequence. Consider subject, dominant palette, lighting, exposure, composition, orientation, focal distance, mood, negative space, visual weight, texture, geometry, transitions, and gallery rhythm. Analyze incoming photos together: batchOrder must be globally unique and express their intended internal rhythm, especially when several share a placement anchor. Avoid simply clustering near-identical subjects when a stronger visual progression is available.

Use status unresolved with null category, subcategory, and placement fields when the image cannot be classified responsibly. Do not guess. Confidence below 0.55 will require manual review. Include every incoming token exactly once. Do not provide location or year.`
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(options.signal.reason)
      return
    }
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let settled = false
    let stdout = ''
    let stderr = ''
    const finish = (action, value) => {
      if (settled) return
      settled = true
      options.signal?.removeEventListener('abort', abort)
      action(value)
    }
    const abort = () => {
      child.kill('SIGTERM')
      finish(reject, options.signal.reason)
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (value) => { stdout += value })
    child.stderr.on('data', (value) => { stderr += value })
    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') finish(reject, error)
    })
    child.on('error', (error) => finish(reject, error))
    child.on('close', (code, signal) => {
      if (code === 0) finish(resolve, { stdout, stderr })
      else finish(
        reject,
        new Error(
          `${command} exited ${signal ? `after ${signal}` : `with status ${code}`}\n${stderr.trim() || stdout.trim()}`,
        ),
      )
    })
    options.signal?.addEventListener('abort', abort, { once: true })
    child.stdin.end(options.input ?? '')
  })
}

export async function analyzeBatchWithCodex({ batchPhotos, state, config, temporaryRoot }, options = {}) {
  const codexBin = options.codexBin ?? process.env.PHOTO_MANAGER_CODEX_BIN ?? 'codex'
  const model = options.model ?? DEFAULT_VISUAL_ANALYSIS_MODEL
  try {
    await runProcess(codexBin, ['login', 'status'], {
      cwd: config.rootDir,
      signal: options.signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    if (error.code === 'ENOENT') {
      throw new Error('Codex CLI was not found. Install Codex and run `codex login`.')
    }
    throw new Error(`Codex authentication is required. Run \`codex login\`.\n${error.message}`)
  }

  const analysisDir = path.join(temporaryRoot, 'analysis')
  await mkdir(analysisDir, { recursive: true })
  const [incomingPreviews, portfolio] = await Promise.all([
    createIncomingPreviews(batchPhotos, analysisDir),
    createPortfolioReferences(state, config, analysisDir),
  ])
  const schemaPath = path.join(analysisDir, 'response-schema.json')
  const outputPath = path.join(analysisDir, 'response.json')
  await writeFile(
    schemaPath,
    `${JSON.stringify(visualAnalysisSchema(batchPhotos.map((photo) => photo.token)), null, 2)}\n`,
    'utf8',
  )

  const args = ['exec', '--model', model]
  for (const imagePath of [...incomingPreviews, ...portfolio.sheets]) {
    args.push('--image', imagePath)
  }
  args.push(
    '--ephemeral',
    '--sandbox',
    'read-only',
    '--output-schema',
    schemaPath,
    '--output-last-message',
    outputPath,
    '-C',
    config.rootDir,
    '-',
  )

  try {
    await runProcess(codexBin, args, {
      cwd: config.rootDir,
      input: buildVisualAnalysisPrompt(batchPhotos, portfolio.references),
      signal: options.signal,
    })
    return JSON.parse(await readFile(outputPath, 'utf8'))
  } catch (error) {
    if (error.name === 'AbortError') throw error
    if (error instanceof SyntaxError) {
      throw new Error(`Codex returned invalid JSON: ${error.message}`)
    }
    throw new Error(`Visual analysis failed: ${error.message}`)
  }
}
