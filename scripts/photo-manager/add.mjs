import { access } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { confirm, input, select } from '@inquirer/prompts'
import {
  catalogDefinitions,
  metadataForClassification,
  placementLabel,
  validatePhotoRecord,
} from '../../src/data/photoSchema.js'
import {
  applyOptionalPlacements,
  cloneState,
  insertPhoto,
  loadCatalogState,
  manifestWrites,
} from './catalog.mjs'
import { promptClassification } from './classify.mjs'
import { formatBytes, heading, valueLabel } from './format.mjs'
import { inspectImage, optimizeImage } from './images.mjs'
import {
  BACK,
  promptAlt,
  promptLocation,
  promptOptionalPlacements,
  promptPlacement,
  promptYear,
} from './prompts.mjs'
import { commitFiles } from './transaction.mjs'
import { validateCatalogState } from './validate.mjs'

function expandHome(filePath) {
  return filePath.startsWith('~/') ? path.join(os.homedir(), filePath.slice(2)) : filePath
}

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export function normalizedOutputFilename(sourcePath, requestedName) {
  const sourceName = requestedName || path.basename(sourcePath)
  const stem = path.parse(sourceName).name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-|-$/g, '')
  if (!stem || stem === '.' || stem === '..') throw new Error('Output filename is invalid.')
  return `${stem}.jpg`
}

export function outputTarget(config, catalog, filename) {
  const folder = catalogDefinitions[catalog]?.folder
  if (!folder) throw new Error(`Unknown destination catalog: ${catalog}`)
  const outputPath = path.join(config.rootDir, 'public/images', folder, filename)
  return {
    outputPath,
    src: `/images/${folder}/${filename}`,
  }
}

export async function outputCollision(state, outputPath, src) {
  const registered = Object.values(state.catalogs).some((photos) =>
    photos.some((photo) => photo.src === src),
  )
  return registered || (await exists(outputPath))
}

export async function buildAddProposal({
  state,
  config,
  sourcePath,
  inspection,
  classification,
  alt,
  location,
  year,
  placement,
  optionalPlacements = [],
  outputFilename,
  allowFlatten = false,
}) {
  const mapped = metadataForClassification(classification)
  const filename = normalizedOutputFilename(sourcePath, outputFilename)
  const target = outputTarget(config, mapped.catalog, filename)
  if (await outputCollision(state, target.outputPath, target.src)) {
    throw Object.assign(new Error(`${filename} already exists.`), { code: 'OUTPUT_COLLISION' })
  }

  const optimized = await optimizeImage(sourcePath, config, { inspection, allowFlatten })
  const photo = {
    src: target.src,
    alt: alt.trim(),
    width: optimized.width,
    height: optimized.height,
    location,
    year,
    ...mapped.metadata,
  }
  const recordErrors = validatePhotoRecord(mapped.catalog, photo)
  if (recordErrors.length) throw new Error(recordErrors.join('; '))

  const nextState = cloneState(state)
  insertPhoto(nextState, mapped.catalog, photo, placement)
  applyOptionalPlacements(nextState, mapped.catalog, photo, optionalPlacements)
  const validation = await validateCatalogState(nextState, config, {
    fileOverrides: new Map([[photo.src, optimized.buffer]]),
  })
  if (!validation.valid) {
    throw new Error(`Proposed catalog is invalid:\n${validation.errors.map((issue) => `${issue.subject}: ${issue.message}`).join('\n')}`)
  }

  return {
    sourcePath,
    inspection,
    classification,
    catalog: mapped.catalog,
    photo,
    placement,
    optionalPlacements,
    outputPath: target.outputPath,
    optimized,
    nextState,
    validation,
  }
}

export async function commitAddProposal(proposal, currentState, config, options = {}) {
  const writes = manifestWrites(config, currentState, proposal.nextState)
  await commitFiles(
    [
      {
        targetPath: proposal.outputPath,
        content: proposal.optimized.buffer,
        mustNotExist: true,
      },
      ...writes,
    ],
    options,
  )
}

function printInspection(inspection, config) {
  heading('ADD PHOTOGRAPH')
  console.log(`${inspection.filename}\n`)
  console.log('Original')
  console.log(`${inspection.width} × ${inspection.height}`)
  console.log(formatBytes(inspection.bytes))
  console.log(orientationLabelForInspection(inspection))
  console.log(inspection.format)
  console.log('\nPlanned output')
  console.log(`${inspection.planned.width} × ${inspection.planned.height}`)
  console.log(`JPEG quality ${config.jpegQuality}`)
  console.log(`\nEXIF orientation: ${inspection.orientationWillNormalize ? 'will normalize' : 'already normalized'}`)
  console.log('GPS/private EXIF: will remove')
  console.log('Original source: will NOT be modified')
}

function orientationLabelForInspection(inspection) {
  if (inspection.width === inspection.height) return 'Square'
  return inspection.width > inspection.height ? 'Landscape' : 'Portrait'
}

function placementDescription(placement) {
  if (placement.type === 'beginning') return 'Beginning'
  if (placement.type === 'relative') {
    return `${placement.position === 'before' ? 'Before' : 'After'} ${path.posix.basename(placement.src)}`
  }
  return 'End'
}

function printReview(proposal, dryRun) {
  heading(dryRun ? 'REVIEW PHOTOGRAPH — DRY RUN' : 'REVIEW PHOTOGRAPH')
  const { inspection, photo, optimized } = proposal
  console.log(`Source\n${proposal.sourcePath}\n${inspection.width} × ${inspection.height}\n${formatBytes(inspection.bytes)}\n`)
  console.log(`Classification\n${placementLabel(proposal.catalog, photo)}\n`)
  console.log('Generated metadata')
  for (const [key, value] of Object.entries(photo)) {
    if (!['src', 'alt', 'width', 'height', 'location', 'year'].includes(key)) {
      console.log(`${key}: ${value}`)
    }
  }
  console.log(`\nAccessibility\n“${photo.alt}”\n`)
  console.log(`Lightbox\nLocation: ${valueLabel(photo.location)}\nYear: ${valueLabel(photo.year)}\n`)
  console.log(`Placement\n${placementDescription(proposal.placement)}\n`)
  console.log(`Output\n${path.relative(process.cwd(), proposal.outputPath)}\n${optimized.width} × ${optimized.height}\n${formatBytes(optimized.bytes)}\n`)
  console.log(`Catalog\n${proposal.catalog}.json\n`)
  console.log(`Additional placement\n${proposal.optionalPlacements.length ? proposal.optionalPlacements.join(', ') : 'None'}\n`)
  console.log('The original source will NOT be modified.')
  if (dryRun) console.log('\nDRY RUN — NO FILES WERE CHANGED')
}

async function chooseOutputFilename(state, config, catalog, sourcePath, currentName) {
  let requested = currentName
  while (true) {
    const filename = normalizedOutputFilename(sourcePath, requested)
    const target = outputTarget(config, catalog, filename)
    if (!(await outputCollision(state, target.outputPath, target.src))) return filename
    console.log(`\n${filename} already exists.`)
    const action = await select({
      message: 'File collision',
      choices: [
        { name: 'Choose another filename', value: 'rename' },
        { name: 'Cancel', value: 'cancel' },
      ],
    })
    if (action === 'cancel') return null
    requested = await input({
      message: 'New filename',
      validate: (value) => value.trim().length > 0 || 'Enter a filename.',
    })
  }
}

export async function runAddWorkflow(sourceArgument, config, options = {}) {
  if (!sourceArgument) throw new Error('Provide a source image: npm run photo:add -- /path/to/photo.jpg')
  const sourcePath = path.resolve(expandHome(sourceArgument))
  const state = await loadCatalogState(config)
  const inspection = await inspectImage(sourcePath, config)
  printInspection(inspection, config)

  let allowFlatten = false
  if (inspection.hasAlpha) {
    allowFlatten = await confirm({
      message: 'Transparency detected. Flatten transparent pixels onto white and publish as JPEG?',
      default: false,
    })
    if (!allowFlatten) {
      console.log('Cancelled. The source image was not changed.')
      return { status: 'cancelled' }
    }
  }

  const draft = {}
  const collectAll = async () => {
    let stage = 'classification'
    while (true) {
      if (stage === 'classification') {
        const value = await promptClassification()
        if (!value) return false
        draft.classification = value
        stage = 'alt'
      } else if (stage === 'alt') {
        const value = await promptAlt(draft.alt)
        if (value === BACK) stage = 'classification'
        else {
          draft.alt = value
          stage = 'location'
        }
      } else if (stage === 'location') {
        const value = await promptLocation(draft.location)
        if (value === BACK) stage = 'alt'
        else {
          draft.location = value
          stage = 'year'
        }
      } else if (stage === 'year') {
        const value = await promptYear(draft.year, { defaultToCurrent: true })
        if (value === BACK) stage = 'location'
        else {
          draft.year = value
          stage = 'output'
        }
      } else if (stage === 'output') {
        const mapped = metadataForClassification(draft.classification)
        draft.outputFilename = await chooseOutputFilename(
          state,
          config,
          mapped.catalog,
          sourcePath,
          draft.outputFilename,
        )
        if (!draft.outputFilename) return false
        stage = 'placement'
      } else if (stage === 'placement') {
        const mapped = metadataForClassification(draft.classification)
        const value = await promptPlacement(
          state.catalogs[mapped.catalog],
          placementLabel(mapped.catalog, mapped.metadata),
        )
        if (value === BACK) stage = 'year'
        else {
          draft.placement = value
          stage = 'optional'
        }
      } else if (stage === 'optional') {
        const mapped = metadataForClassification(draft.classification)
        const value = await promptOptionalPlacements(mapped.catalog, mapped.metadata)
        if (value === BACK) stage = 'placement'
        else {
          draft.optionalPlacements = value
          return true
        }
      }
    }
  }

  if (!(await collectAll())) return { status: 'cancelled' }

  while (true) {
    const proposal = await buildAddProposal({
      state,
      config,
      sourcePath,
      inspection,
      ...draft,
      allowFlatten,
    })
    printReview(proposal, options.dryRun)
    const action = await select({
      message: options.dryRun ? 'Dry-run review' : 'Ready to write',
      choices: [
        { name: options.dryRun ? 'Finish dry run' : 'Add photograph', value: 'apply' },
        { name: 'Back and edit', value: 'back' },
        { name: 'Cancel', value: 'cancel' },
      ],
    })
    if (action === 'cancel') return { status: 'cancelled' }
    if (action === 'back') {
      const field = await select({
        message: 'What do you want to revise?',
        choices: [
          { name: 'Classification', value: 'classification' },
          { name: 'Alt text', value: 'alt' },
          { name: 'Location', value: 'location' },
          { name: 'Year', value: 'year' },
          { name: 'Display order', value: 'placement' },
          { name: 'Optional site placements', value: 'optional' },
          { name: 'Everything', value: 'everything' },
        ],
      })
      if (field === 'everything') {
        if (!(await collectAll())) return { status: 'cancelled' }
      } else if (field === 'classification') {
        if (!(await collectAll())) return { status: 'cancelled' }
      } else if (field === 'alt') {
        const value = await promptAlt(draft.alt)
        if (value !== BACK) draft.alt = value
      } else if (field === 'location') {
        const value = await promptLocation(draft.location)
        if (value !== BACK) draft.location = value
      } else if (field === 'year') {
        const value = await promptYear(draft.year)
        if (value !== BACK) draft.year = value
      }
      else if (field === 'placement') {
        const mapped = metadataForClassification(draft.classification)
        const value = await promptPlacement(
          state.catalogs[mapped.catalog],
          placementLabel(mapped.catalog, mapped.metadata),
        )
        if (value !== BACK) draft.placement = value
      } else if (field === 'optional') {
        const mapped = metadataForClassification(draft.classification)
        const value = await promptOptionalPlacements(mapped.catalog, mapped.metadata)
        if (value !== BACK) draft.optionalPlacements = value
      }
      continue
    }

    if (options.dryRun) {
      console.log('\nDRY RUN — NO FILES WERE CHANGED')
      return { status: 'dry-run', proposal }
    }
    await commitAddProposal(proposal, state, config)
    heading('DONE')
    console.log(`${placementLabel(proposal.catalog, proposal.photo)}\n\n${proposal.photo.src}\n`)
    console.log(`Optimization\n${inspection.width}×${inspection.height} → ${proposal.optimized.width}×${proposal.optimized.height}`)
    console.log(`${formatBytes(inspection.bytes)} → ${formatBytes(proposal.optimized.bytes)}\n`)
    console.log('✓ orientation normalized')
    console.log('✓ optimized')
    console.log('✓ private/GPS EXIF removed')
    console.log('✓ catalog updated')
    console.log('✓ taxonomy validation passed')
    return { status: 'added', proposal }
  }
}
