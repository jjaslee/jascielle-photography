import path from 'node:path'
import { select } from '@inquirer/prompts'
import {
  applyClassification,
  placementLabel,
} from '../../src/data/photoSchema.js'
import {
  applyOptionalPlacements,
  cloneState,
  currentOptionalPlacements,
  insertPhoto,
  loadCatalogState,
  manifestWrites,
  removePhoto,
  replacePhoto,
} from './catalog.mjs'
import { promptClassification } from './classify.mjs'
import { heading, valueLabel } from './format.mjs'
import { previewPhoto } from './preview.mjs'
import {
  BACK,
  promptAlt,
  promptLocation,
  promptOptionalPlacements,
  promptPhotoSearch,
  promptPlacement,
  promptYear,
} from './prompts.mjs'
import { commitFiles } from './transaction.mjs'
import { validateCatalogState } from './validate.mjs'

export function buildEditDiff(current, nextCatalog, nextPhoto) {
  const before = {
    placement: placementLabel(current.catalog, current.photo),
    ...current.photo,
  }
  const after = {
    placement: placementLabel(nextCatalog, nextPhoto),
    ...nextPhoto,
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  return keys
    .filter((key) => !Object.is(before[key], after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }))
}

export async function buildEditProposal({
  state,
  config,
  current,
  updates = {},
  allowExistingErrors = false,
}) {
  let nextCatalog = current.catalog
  let nextPhoto = { ...current.photo }

  for (const field of ['alt', 'location', 'year']) {
    if (!Object.hasOwn(updates, field)) continue
    if (updates[field] === undefined) delete nextPhoto[field]
    else nextPhoto[field] = updates[field]
  }

  if (updates.classification) {
    const classified = applyClassification(nextPhoto, updates.classification)
    nextCatalog = classified.catalog
    nextPhoto = classified.photo
  }

  const nextState = cloneState(state)
  const shouldRelocate = nextCatalog !== current.catalog || Boolean(updates.placement)
  if (shouldRelocate) {
    removePhoto(nextState, current.catalog, current.photo.src)
    insertPhoto(nextState, nextCatalog, nextPhoto, updates.placement ?? { type: 'end' })
  } else {
    replacePhoto(nextState, current.catalog, current.photo.src, nextPhoto)
  }
  applyOptionalPlacements(
    nextState,
    nextCatalog,
    nextPhoto,
    updates.optionalPlacements,
    { replacePreview: Object.hasOwn(updates, 'optionalPlacements') },
  )

  const validation = await validateCatalogState(nextState, config)
  if (!validation.valid) {
    let acceptableCorrection = false
    if (allowExistingErrors) {
      const beforeValidation = await validateCatalogState(state, config)
      const beforeIssues = new Set(
        beforeValidation.errors.map((issue) => `${issue.code}:${issue.subject}:${issue.message}`),
      )
      acceptableCorrection = validation.errors.every((issue) =>
        beforeIssues.has(`${issue.code}:${issue.subject}:${issue.message}`),
      )
    }
    if (!acceptableCorrection) {
      throw new Error(`Proposed catalog is invalid:\n${validation.errors.map((issue) => `${issue.subject}: ${issue.message}`).join('\n')}`)
    }
  }

  return {
    current,
    nextCatalog,
    nextPhoto,
    nextState,
    validation,
    diff: buildEditDiff(current, nextCatalog, nextPhoto),
    pathPolicy: 'preserve',
  }
}

export async function commitEditProposal(proposal, state, config, options = {}) {
  await commitFiles(manifestWrites(config, state, proposal.nextState), options)
}

function printCurrent(entry) {
  heading(path.posix.basename(entry.photo.src))
  console.log(`Current placement\n${placementLabel(entry.catalog, entry.photo)}\n`)
  console.log('Current metadata\n')
  for (const field of ['src', 'alt', 'width', 'height', 'session', 'category', 'theme', 'habitat', 'section', 'location', 'year']) {
    if (Object.hasOwn(entry.photo, field) || ['location', 'year'].includes(field)) {
      console.log(`${field.padEnd(10)} ${valueLabel(entry.photo[field])}`)
    }
  }
}

function printDiff(proposal, dryRun) {
  heading(dryRun ? 'REVIEW CHANGES — DRY RUN' : 'REVIEW CHANGES')
  console.log(`${path.posix.basename(proposal.current.photo.src)}\n`)
  console.log('BEFORE')
  console.log(proposal.current ? placementLabel(proposal.current.catalog, proposal.current.photo) : '—')
  for (const change of proposal.diff) {
    if (change.key !== 'placement') {
      console.log(`${change.key}: ${valueLabel(change.before, '—absent—')}`)
    }
  }
  console.log('\nAFTER')
  console.log(placementLabel(proposal.nextCatalog, proposal.nextPhoto))
  for (const change of proposal.diff) {
    if (change.key !== 'placement') {
      console.log(`${change.key}: ${valueLabel(change.after, '—absent—')}`)
    }
  }
  console.log('\nPhysical image path: preserved')
  console.log('Secondary references: remain valid because src is unchanged')
  console.log('Catalog validation and duplicate checks will run before writing.')
  if (dryRun) console.log('\nDRY RUN — NO FILES WERE CHANGED')
}

async function collectUpdates(field, current, state) {
  const updates = {}
  const all = field === 'everything'

  if (field === 'classification' || field === 'section' || all) {
    updates.classification = await promptClassification()
    if (!updates.classification) return null
  }
  if (field === 'alt' || all) {
    updates.alt = await promptAlt(current.photo.alt)
    if (updates.alt === BACK) return null
  }
  if (field === 'location' || all) {
    updates.location = await promptLocation(current.photo.location, { allowUnreviewed: true })
    if (updates.location === BACK) return null
  }
  if (field === 'year' || all) {
    updates.year = await promptYear(current.photo.year, { allowUnreviewed: true })
    if (updates.year === BACK) return null
  }

  let destinationCatalog = current.catalog
  let previewPhoto = { ...current.photo }
  if (updates.classification) {
    const classified = applyClassification(previewPhoto, updates.classification)
    destinationCatalog = classified.catalog
    previewPhoto = classified.photo
  }

  if (field === 'order' || all || destinationCatalog !== current.catalog) {
    updates.placement = await promptPlacement(
      state.catalogs[destinationCatalog],
      placementLabel(destinationCatalog, previewPhoto),
      current.photo.src,
    )
    if (updates.placement === BACK) return null
  }
  if (field === 'optional' || all) {
    updates.optionalPlacements = await promptOptionalPlacements(destinationCatalog, previewPhoto, {
      checked: currentOptionalPlacements(state, destinationCatalog, previewPhoto).filter(
        (placement) => placement === 'preview',
      ),
    })
    if (updates.optionalPlacements === BACK) return null
  }
  return updates
}

export async function runEditWorkflow(initialQuery, config, options = {}) {
  const state = await loadCatalogState(config)
  const current = await promptPhotoSearch(state, initialQuery)
  if (!current) return { status: 'cancelled' }

  while (true) {
    printCurrent(current)
    const action = await select({
      message: 'Photograph action',
      choices: [
        { name: 'Preview', value: 'preview' },
        { name: 'Edit', value: 'edit' },
        { name: 'Back / cancel', value: 'cancel' },
      ],
    })
    if (action === 'cancel') return { status: 'cancelled' }
    if (action === 'preview') {
      const result = previewPhoto(config, current.photo.src)
      console.log(result.opened ? `Opened ${result.filePath}` : `Preview path: ${result.filePath}`)
      continue
    }

    const field = await select({
      message: 'What do you want to edit?',
      choices: [
        { name: 'Classification', value: 'classification' },
        { name: 'Alt text', value: 'alt' },
        { name: 'Location', value: 'location' },
        { name: 'Year', value: 'year' },
        { name: 'Section-specific metadata', value: 'section' },
        { name: 'Display order', value: 'order' },
        { name: 'Optional site placements', value: 'optional' },
        { name: 'Everything', value: 'everything' },
        { name: 'Cancel', value: 'cancel' },
      ],
    })
    if (field === 'cancel') continue
    const updates = await collectUpdates(field, current, state)
    if (!updates) continue
    const proposal = await buildEditProposal({ state, config, current, updates })
    printDiff(proposal, options.dryRun)
    if (proposal.diff.length === 0 && !updates.placement && !updates.optionalPlacements?.length) {
      console.log('\nNo changes were proposed.')
      continue
    }
    const review = await select({
      message: options.dryRun ? 'Dry-run review' : 'Review changes',
      choices: [
        { name: options.dryRun ? 'Finish dry run' : 'Apply', value: 'apply' },
        { name: 'Back', value: 'back' },
        { name: 'Cancel', value: 'cancel' },
      ],
    })
    if (review === 'back') continue
    if (review === 'cancel') return { status: 'cancelled' }
    if (options.dryRun) {
      console.log('\nDRY RUN — NO FILES WERE CHANGED')
      return { status: 'dry-run', proposal }
    }
    await commitEditProposal(proposal, state, config)
    heading('DONE')
    console.log(`${placementLabel(proposal.nextCatalog, proposal.nextPhoto)}\n${proposal.nextPhoto.src}`)
    console.log('\n✓ catalog updated atomically\n✓ taxonomy validation passed')
    return { status: 'edited', proposal }
  }
}
