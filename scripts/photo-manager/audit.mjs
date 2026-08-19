import path from 'node:path'
import { input, select } from '@inquirer/prompts'
import { fieldsNeedingReview, photoFields, placementLabel } from '../../src/data/photoSchema.js'
import {
  cloneState,
  findPhotoBySrc,
  flattenCatalogs,
  loadCatalogState,
  manifestWrites,
  replacePhoto,
} from './catalog.mjs'
import { promptClassification } from './classify.mjs'
import { buildEditProposal, commitEditProposal } from './edit.mjs'
import { heading, valueLabel } from './format.mjs'
import { intrinsicImageInfo } from './images.mjs'
import { previewPhoto, publicPathForSrc } from './preview.mjs'
import { commitFiles } from './transaction.mjs'
import { validateCatalogState } from './validate.mjs'

export async function buildAuditReport(state, config) {
  const validation = await validateCatalogState(state, config)
  const entries = flattenCatalogs(state)
  const required = Object.fromEntries(
    Object.entries(photoFields)
      .filter(([, definition]) => definition.tier === 'required')
      .map(([field]) => [
        field,
        entries.filter(({ photo }) => !Object.hasOwn(photo, field) || !photoFields[field].validate(photo[field])),
      ]),
  )
  const recommended = Object.fromEntries(
    Object.entries(photoFields)
      .filter(([, definition]) => definition.tier === 'recommended')
      .map(([field]) => [
        field,
        entries.filter(({ photo }) => fieldsNeedingReview(photo).includes(field)),
      ]),
  )
  const classification = validation.errors.filter(
    (issue) =>
      issue.code === 'invalid-record' &&
      /(placement|theme|habitat|session|category|section|catalog)/i.test(issue.message),
  )
  const fileProblems = [...validation.errors, ...validation.warnings].filter((issue) =>
    [
      'missing-file',
      'unreadable-file',
      'unsupported-file-format',
      'format-mismatch',
      'dimension-mismatch',
      'oversized-dimensions',
      'large-file',
      'orphan-file',
    ].includes(issue.code),
  )
  return { entries, validation, required, recommended, classification, fileProblems }
}

function printAuditSummary(report) {
  heading('PHOTO METADATA AUDIT')
  console.log(`${report.entries.length} photographs scanned\n`)
  console.log('REQUIRED')
  const missingDimensions = new Set([
    ...report.required.width.map((entry) => entry.photo.src),
    ...report.required.height.map((entry) => entry.photo.src),
  ]).size
  console.log(`${missingDimensions} photographs with missing/invalid dimensions`)
  console.log(`${report.required.alt.length} missing/invalid alt text fields\n`)
  console.log('RECOMMENDED')
  for (const [field, entries] of Object.entries(report.recommended)) {
    console.log(`${entries.length} ${field} fields never reviewed`)
  }
  console.log('\nCLASSIFICATION')
  console.log(`${report.classification.length} invalid taxonomy records\n`)
  console.log('FILES')
  const count = (code) => report.fileProblems.filter((issue) => issue.code === code).length
  console.log(`${count('missing-file')} missing files`)
  console.log(`${count('oversized-dimensions')} oversized images`)
  console.log(`${count('large-file')} unusually large optimized files`)
  console.log(`${count('orphan-file')} orphaned image files`)
  console.log(`${count('dimension-mismatch')} dimension mismatches`)
}

async function savePhotoPatch(state, config, entry, patch) {
  const nextState = cloneState(state)
  const nextPhoto = { ...entry.photo }
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) delete nextPhoto[field]
    else nextPhoto[field] = value
  }
  replacePhoto(nextState, entry.catalog, entry.photo.src, nextPhoto)
  const [before, after] = await Promise.all([
    validateCatalogState(state, config),
    validateCatalogState(nextState, config),
  ])
  if (after.errors.length > before.errors.length) {
    throw new Error('Correction introduced a new catalog validation error.')
  }
  await commitFiles(manifestWrites(config, state, nextState))
  state.catalogs = nextState.catalogs
  state.placements = nextState.placements
  return nextPhoto
}

async function reviewManualField(state, config, entries, field) {
  let index = 0
  while (index < entries.length) {
    const original = entries[index]
    const entry = findPhotoBySrc(state, original.photo.src)
    if (!entry || Object.hasOwn(entry.photo, field)) {
      index += 1
      continue
    }
    heading(`${index + 1} / ${entries.length}\n${path.posix.basename(entry.photo.src)}\n${placementLabel(entry.catalog, entry.photo)}`)
    console.log(`Current ${field}: ${valueLabel(entry.photo[field])}\n`)
    const nullable = photoFields[field]?.nullable === true
    const action = await select({
      message: `Review ${field}`,
      choices: [
        { name: 'Enter a value and save', value: 'save' },
        ...(nullable ? [{ name: 'Intentionally no value', value: 'null' }] : []),
        { name: 'Preview', value: 'preview' },
        { name: 'Skip for now', value: 'skip' },
        ...(index > 0 ? [{ name: '← Back', value: 'back' }] : []),
        { name: 'Quit audit', value: 'quit' },
      ],
    })
    if (action === 'quit') return
    if (action === 'back') {
      index -= 1
      continue
    }
    if (action === 'preview') {
      const result = previewPhoto(config, entry.photo.src)
      console.log(result.opened ? `Opened ${result.filePath}` : `Preview path: ${result.filePath}`)
      continue
    }
    if (action === 'skip') {
      index += 1
      continue
    }
    let value = null
    if (action === 'save') {
      if (field === 'year') {
        const currentYear = new Date().getFullYear()
        const answer = await input({
          message: 'Year',
          validate: (candidate) => {
            const year = Number(candidate)
            return (
              (Number.isInteger(year) && year >= 1800 && year <= currentYear + 1) ||
              `Enter a year from 1800–${currentYear + 1}.`
            )
          },
        })
        value = Number(answer)
      } else {
        value = await input({
          message: field === 'alt' ? 'Alt text' : `${field[0].toUpperCase()}${field.slice(1)}`,
          validate: (candidate) => candidate.trim().length > 0 || 'A value is required.',
        })
        value = value.trim()
      }
    }
    await savePhotoPatch(state, config, entry, { [field]: value })
    console.log('Saved.')
    index += 1
  }
}

async function reviewDimensions(state, config, entries) {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = findPhotoBySrc(state, entries[index].photo.src)
    if (!entry) continue
    let actual
    try {
      actual = await intrinsicImageInfo(publicPathForSrc(config, entry.photo.src))
    } catch (error) {
      console.log(`Cannot derive dimensions for ${entry.photo.src}: ${error.message}`)
      continue
    }
    if (entry.photo.width === actual.width && entry.photo.height === actual.height) continue
    heading(`${index + 1} / ${entries.length}\n${path.posix.basename(entry.photo.src)}\nAUTO-REPAIR DIMENSIONS`)
    console.log(`Stored: ${entry.photo.width ?? 'missing'} × ${entry.photo.height ?? 'missing'}`)
    console.log(`Actual: ${actual.width} × ${actual.height}`)
    const action = await select({
      message: 'Dimension repair',
      choices: [
        { name: 'Apply intrinsic dimensions', value: 'fix' },
        { name: 'Preview', value: 'preview' },
        { name: 'Skip', value: 'skip' },
        { name: 'Quit audit', value: 'quit' },
      ],
    })
    if (action === 'quit') return
    if (action === 'preview') {
      previewPhoto(config, entry.photo.src)
      index -= 1
    } else if (action === 'fix') {
      await savePhotoPatch(state, config, entry, { width: actual.width, height: actual.height })
      console.log('Saved.')
    }
  }
}

async function reviewClassifications(state, config, issues) {
  const sources = [...new Set(issues.map((issue) => issue.subject))]
  for (const src of sources) {
    const entry = findPhotoBySrc(state, src)
    if (!entry) continue
    heading(`${path.posix.basename(src)}\n${placementLabel(entry.catalog, entry.photo)}`)
    const action = await select({
      message: 'Classification problem',
      choices: [
        { name: 'Reclassify', value: 'fix' },
        { name: 'Preview', value: 'preview' },
        { name: 'Skip', value: 'skip' },
        { name: 'Quit audit', value: 'quit' },
      ],
    })
    if (action === 'quit') return
    if (action === 'preview') {
      previewPhoto(config, src)
      continue
    }
    if (action !== 'fix') continue
    const classification = await promptClassification()
    if (!classification) continue
    const proposal = await buildEditProposal({
      state,
      config,
      current: entry,
      updates: { classification, placement: { type: 'end' } },
      allowExistingErrors: true,
    })
    await commitEditProposal(proposal, state, config)
    state.catalogs = proposal.nextState.catalogs
    state.placements = proposal.nextState.placements
    console.log('Saved.')
  }
}

async function reviewFileProblems(state, config, problems) {
  for (const problem of problems) {
    heading(`FILE PROBLEM\n${problem.subject}`)
    console.log(`${problem.message}\n`)
    const entry = findPhotoBySrc(state, problem.subject)
    const action = await select({
      message: 'File problem',
      choices: [
        ...(entry ? [{ name: 'Preview', value: 'preview' }] : []),
        { name: 'Continue', value: 'continue' },
        { name: 'Quit audit', value: 'quit' },
      ],
    })
    if (action === 'quit') return
    if (action === 'preview') previewPhoto(config, problem.subject)
  }
}

export async function runAuditWorkflow(config) {
  const state = await loadCatalogState(config)
  while (true) {
    const report = await buildAuditReport(state, config)
    printAuditSummary(report)
    const recommendedChoices = Object.entries(report.recommended).map(([field, entries]) => ({
      name: `Missing ${field} (${entries.length})`,
      value: `recommended:${field}`,
      disabled: entries.length === 0 ? 'none' : false,
    }))
    const action = await select({
      message: 'What would you like to review?',
      choices: [
        { name: `Missing alt text (${report.required.alt.length})`, value: 'required:alt', disabled: report.required.alt.length === 0 ? 'none' : false },
        ...recommendedChoices,
        { name: `Missing or incorrect dimensions (${[...new Set([...report.required.width, ...report.required.height].map((entry) => entry.photo.src))].length})`, value: 'dimensions' },
        { name: `Classification problems (${report.classification.length})`, value: 'classification' },
        { name: `File problems (${report.fileProblems.length})`, value: 'files' },
        { name: 'Review everything', value: 'everything' },
        { name: 'Exit', value: 'exit' },
      ],
    })
    if (action === 'exit') return { status: 'complete', report }
    if (action === 'required:alt' || action === 'everything') {
      await reviewManualField(state, config, report.required.alt, 'alt')
    }
    if (action.startsWith('recommended:')) {
      const field = action.split(':')[1]
      await reviewManualField(state, config, report.recommended[field], field)
    }
    if (action === 'everything') {
      for (const [field, entries] of Object.entries(report.recommended)) {
        if (entries.length) await reviewManualField(state, config, entries, field)
      }
    }
    if (action === 'dimensions' || action === 'everything') {
      const sources = new Set([
        ...report.required.width.map((entry) => entry.photo.src),
        ...report.required.height.map((entry) => entry.photo.src),
        ...report.fileProblems.filter((issue) => issue.code === 'dimension-mismatch').map((issue) => issue.subject),
      ])
      await reviewDimensions(
        state,
        config,
        [...sources].map((src) => findPhotoBySrc(state, src)).filter(Boolean),
      )
    }
    if (action === 'classification' || action === 'everything') {
      await reviewClassifications(state, config, report.classification)
    }
    if (action === 'files' || action === 'everything') {
      await reviewFileProblems(state, config, report.fileProblems)
    }
  }
}
