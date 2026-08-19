import path from 'node:path'
import { confirm, select } from '@inquirer/prompts'
import { metadataForClassification, placementLabel } from '../../src/data/photoSchema.js'
import { loadCatalogState } from './catalog.mjs'
import { formatBytes, heading } from './format.mjs'
import { inspectImage, optimizeImage, sourceDigest } from './images.mjs'
import { promptClassification } from './classify.mjs'
import { BACK, promptPlacement } from './prompts.mjs'
import { stageBatchInput } from './batch-input.mjs'
import {
  buildBatchProposal,
  commitBatchProposal,
  confidenceLabel,
  detectBatchDuplicates,
  validateVisualAnalysis,
} from './batch-proposal.mjs'
import {
  analyzeBatchWithCodex,
  DEFAULT_VISUAL_ANALYSIS_MODEL,
} from './visual-analysis.mjs'
import { validateCatalogState } from './validate.mjs'
import {
  appliedProposalWrite,
  assertImportSettingsFresh,
  assertPortfolioFresh,
  assertProposalItemMatches,
  assertSavedTargetsValid,
  createSavedBatchProposal,
  loadSavedBatchProposal,
  saveBatchProposal,
} from './saved-proposal.mjs'

function placementDescription(placement) {
  if (!placement) return 'manual review required'
  if (placement.type === 'relative') {
    return `${placement.position} ${path.posix.basename(placement.src)}`
  }
  return placement.type
}

function draftLabel(draft) {
  if (!draft.classification) return 'UNRESOLVED'
  const mapped = metadataForClassification(draft.classification)
  return placementLabel(mapped.catalog, mapped.metadata)
}

export function printBatchReview(drafts, proposal, dryRun) {
  heading(dryRun ? 'PROPOSED BATCH — DRY RUN' : 'PROPOSED BATCH')
  for (const [index, draft] of drafts.entries()) {
    const item = proposal?.items.find((candidate) => candidate.draft.token === draft.token)
    console.log(`${index + 1}. ${path.basename(draft.sourcePath)}`)
    console.log(`   ${draftLabel(draft)}`)
    console.log(`   placement: ${placementDescription(draft.placement)}`)
    console.log(
      `   confidence: ${confidenceLabel(draft.confidence)} (${Math.round(draft.confidence * 100)}%)${draft.needsReview && !draft.reviewed ? ' — REVIEW REQUIRED' : ''}`,
    )
    if (item?.renamed) console.log(`   output: ${item.outputFilename} (renamed to avoid collision)`)
    console.log(`\n   ${draft.reason}\n`)
  }

  const counts = { high: 0, medium: 0, low: 0 }
  for (const draft of drafts) counts[confidenceLabel(draft.confidence)] += 1
  const unresolved = drafts.filter((draft) => !draft.classification || !draft.placement).length
  const needsReview = drafts.filter((draft) => draft.needsReview && !draft.reviewed).length
  console.log('────────────────────────────────────────')
  console.log(`${drafts.length} photos`)
  console.log(`${counts.high} high-confidence`)
  console.log(`${counts.medium} medium-confidence`)
  console.log(`${counts.low} low-confidence`)
  console.log(`${unresolved} unresolved`)
  if (needsReview) console.log(`${needsReview} requiring manual review`)
  if (dryRun) console.log('\nDRY RUN — NO PORTFOLIO FILES WILL BE CHANGED')
}

async function editDraft(drafts, state) {
  const token = await select({
    message: 'Photograph to review',
    choices: [
      ...drafts.map((draft) => ({
        name: `${path.basename(draft.sourcePath)} — ${draftLabel(draft)}`,
        value: draft.token,
      })),
      { name: '← Back', value: BACK },
    ],
  })
  if (token === BACK) return
  const draft = drafts.find((candidate) => candidate.token === token)
  const action = await select({
    message: 'What do you want to revise?',
    choices: [
      { name: 'Classification and placement', value: 'both' },
      { name: 'Classification', value: 'classification' },
      ...(draft.classification ? [{ name: 'Placement', value: 'placement' }] : []),
      ...(draft.classification && draft.placement
        ? [{ name: 'Accept recommendation as shown', value: 'accept' }]
        : []),
      { name: '← Back', value: BACK },
    ],
  })
  if (action === BACK) return
  if (action === 'accept') {
    draft.reviewed = true
    draft.needsReview = false
    return
  }

  if (action === 'both' || action === 'classification') {
    const classification = await promptClassification()
    if (!classification) return
    draft.classification = classification
    if (action === 'classification' && draft.placement) {
      draft.placement = { type: 'end' }
    }
  }
  if (action === 'both' || action === 'placement' || !draft.placement) {
    const mapped = metadataForClassification(draft.classification)
    const placement = await promptPlacement(
      state.catalogs[mapped.catalog],
      placementLabel(mapped.catalog, mapped.metadata),
    )
    if (placement === BACK) return
    draft.placement = placement
  }
  if (draft.classification && draft.placement) {
    draft.reviewed = true
    draft.needsReview = false
    draft.reason = `Manual review: ${draft.reason}`
  }
}

async function promptReviewAction({ drafts, proposal, dryRun, state }) {
  printBatchReview(drafts, proposal, dryRun)
  const blocked = drafts.some(
    (draft) => !draft.classification || !draft.placement || (draft.needsReview && !draft.reviewed),
  )
  const action = await select({
    message: blocked
      ? 'Review required before approval'
      : dryRun
        ? 'Dry-run review'
        : 'Apply this batch?',
    choices: [
      ...(!blocked
        ? [{ name: dryRun ? 'Finish dry run' : 'Apply batch', value: 'apply' }]
        : []),
      { name: 'Review or edit a photograph', value: 'edit' },
      { name: 'Cancel', value: 'cancel' },
    ],
  })
  if (action === 'edit') await editDraft(drafts, state)
  return action
}

async function prepareIncomingPhotos(sourceEntries, config, allowFlatten, signal) {
  const inspected = []
  for (const [index, entry] of sourceEntries.entries()) {
    signal?.throwIfAborted()
    const sourcePath = typeof entry === 'string' ? entry : entry.sourcePath
    inspected.push({
      token: `I${String(index + 1).padStart(3, '0')}`,
      sourcePath,
      relativePath: typeof entry === 'string' ? path.basename(entry) : entry.relativePath,
      inspection: await inspectImage(sourcePath, config),
    })
  }
  const transparent = inspected.filter((photo) => photo.inspection.hasAlpha)
  if (transparent.length && !allowFlatten) return { inspected, transparent }
  for (const photo of inspected) {
    signal?.throwIfAborted()
    photo.optimized = await optimizeImage(photo.sourcePath, config, {
      inspection: photo.inspection,
      allowFlatten,
    })
  }
  return { inspected, transparent }
}

function printDuplicateReport(report) {
  if (report.duplicates.length) {
    heading('DUPLICATES SKIPPED')
    for (const duplicate of report.duplicates) {
      console.log(`${path.basename(duplicate.photo.sourcePath)}\nexact match: ${duplicate.duplicateOf}\n`)
    }
  }
  if (report.filenameWarnings.length) {
    heading('FILENAME WARNINGS')
    for (const warning of report.filenameWarnings) {
      console.log(`${path.basename(warning.photo.sourcePath)}\nexisting: ${warning.matches.join(', ')}\nA unique output filename will be proposed.\n`)
    }
  }
}

export async function runBatchWorkflow(sourceArgument, config, options = {}) {
  const interruptController = new AbortController()
  const handleInterrupt = () => interruptController.abort(new DOMException('Interrupted', 'AbortError'))
  process.once('SIGINT', handleInterrupt)
  let staged
  try {
    staged = await stageBatchInput(sourceArgument, config, {
      pathOptions: options.pathOptions,
      onStagingCreated: options.onStagingCreated,
      signal: interruptController.signal,
    })
    console.log(`Found ${staged.photos.length} photographs.`)
    const state = await loadCatalogState(config)
    const currentValidation = await validateCatalogState(state, config)
    if (!currentValidation.valid) {
      throw new Error(
        'The existing photo catalog is invalid. Run npm run photo:validate before importing.',
      )
    }

    let allowFlatten = false
    let prepared = await prepareIncomingPhotos(
      staged.photoEntries,
      config,
      allowFlatten,
      interruptController.signal,
    )
    if (prepared.transparent.length) {
      const approveFlatten =
        options.confirmFlatten ??
        ((count) =>
          confirm({
            message: `${count} photograph(s) contain transparency. Flatten them onto white for JPEG output?`,
            default: false,
          }))
      if (!(await approveFlatten(prepared.transparent.length))) {
        console.log('Cancelled. No portfolio files were changed.')
        return { status: 'cancelled' }
      }
      allowFlatten = true
      prepared = await prepareIncomingPhotos(
        staged.photoEntries,
        config,
        allowFlatten,
        interruptController.signal,
      )
    }

    const duplicateReport = await detectBatchDuplicates(prepared.inspected, state, config)
    printDuplicateReport(duplicateReport)
    if (duplicateReport.accepted.length === 0) {
      console.log('No new photographs remain after duplicate detection.')
      return { status: 'duplicates-only', duplicateReport }
    }

    console.log('\nAnalyzing portfolio relationships...')
    const analyzer = options.analyze ?? analyzeBatchWithCodex
    const rawAnalysis = await analyzer(
      {
        batchPhotos: duplicateReport.accepted,
        state,
        config,
        temporaryRoot: staged.temporaryRoot,
      },
      { ...options.analysisOptions, signal: interruptController.signal },
    )
    const drafts = validateVisualAnalysis(rawAnalysis, duplicateReport.accepted, state)
    const reviewAction = options.reviewAction ?? promptReviewAction

    while (true) {
      const ready = drafts.every((draft) => draft.classification && draft.placement)
      const proposal = ready ? await buildBatchProposal({ drafts, state, config }) : null
      const action = await reviewAction({
        drafts,
        proposal,
        dryRun: Boolean(options.dryRun),
        state,
        config,
      })
      if (action === 'cancel') {
        console.log('Cancelled. No portfolio files were changed.')
        return { status: 'cancelled', drafts, proposal }
      }
      if (action === 'edit') continue
      if (action !== 'apply') throw new Error(`Unknown batch review action: ${action}`)
      const blocked = drafts.filter(
        (draft) => !draft.classification || !draft.placement || (draft.needsReview && !draft.reviewed),
      )
      if (blocked.length) {
        throw new Error(`Manual review is required for: ${blocked.map((draft) => draft.token).join(', ')}`)
      }
      if (!proposal) throw new Error('The batch proposal could not be built.')
      if (options.dryRun) {
        const analysisModel =
          options.analysisOptions?.model ?? DEFAULT_VISUAL_ANALYSIS_MODEL
        const savedProposal = await createSavedBatchProposal({
          analysisModel,
          allowFlatten,
          drafts,
          proposal,
          staged,
          state,
          config,
          ...options.proposalOptions,
        })
        const proposalPath = await saveBatchProposal(savedProposal, config)
        console.log('\nDry run complete. No portfolio files were changed.')
        console.log(`\nProposal saved:\n${path.relative(config.rootDir, proposalPath)}`)
        console.log(
          `\nApply without re-running visual analysis:\n\nnpm run photo:add-batch -- --apply-proposal ${savedProposal.id}`,
        )
        return {
          status: 'dry-run',
          drafts,
          proposal,
          proposalPath,
          savedProposal,
          duplicateReport,
        }
      }

      await commitBatchProposal(proposal, state, config, options.transactionOptions)
      const committedState = await loadCatalogState(config)
      const finalValidation = await validateCatalogState(committedState, config)
      if (!finalValidation.valid) {
        throw new Error('Batch files were written, but post-write catalog validation failed.')
      }
      heading('BATCH COMPLETE')
      const outputBytes = proposal.items.reduce(
        (total, item) => total + item.optimized.bytes,
        0,
      )
      console.log(`${proposal.items.length} photographs imported`)
      console.log(`${formatBytes(outputBytes)} optimized output`)
      console.log('✓ images optimized and metadata stripped')
      console.log('✓ manifests updated transactionally')
      console.log('✓ taxonomy validation passed')
      return { status: 'batch-added', drafts, proposal, duplicateReport, finalValidation }
    }
  } finally {
    process.removeListener('SIGINT', handleInterrupt)
    if (staged) await staged.cleanup()
  }
}

async function hydrateSavedDrafts(savedProposal, staged, config, signal) {
  const entriesByRelativePath = new Map(
    staged.photoEntries.map((entry) => [entry.relativePath, entry]),
  )
  const drafts = []
  for (const savedPhoto of [...savedProposal.photos].sort(
    (left, right) => left.batchOrder - right.batchOrder,
  )) {
    signal?.throwIfAborted()
    const entry = entriesByRelativePath.get(savedPhoto.source.relativePath)
    if (!entry) {
      throw new Error(
        `Saved proposal source is missing: ${savedPhoto.source.relativePath}. Run a new dry run.`,
      )
    }
    if ((await sourceDigest(entry.sourcePath)) !== savedPhoto.source.sha256) {
      throw new Error(
        `Saved proposal source changed: ${savedPhoto.source.relativePath}. Run a new dry run.`,
      )
    }
    const inspection = await inspectImage(entry.sourcePath, config)
    const optimized = await optimizeImage(entry.sourcePath, config, {
      inspection,
      allowFlatten: savedProposal.input.allowFlatten,
    })
    drafts.push({
      token: savedPhoto.token,
      sourcePath: entry.sourcePath,
      relativePath: entry.relativePath,
      inspection,
      optimized,
      classification: savedPhoto.classification,
      placement: savedPhoto.placement,
      batchOrder: savedPhoto.batchOrder,
      alt: savedPhoto.alt,
      confidence: savedPhoto.confidence,
      reason: savedPhoto.reason,
      reviewed: savedPhoto.reviewed,
      needsReview: savedPhoto.needsReview,
      outputFilename: savedPhoto.outputFilename,
    })
  }
  return drafts
}

export async function runApplyProposalWorkflow(proposalReference, config, options = {}) {
  const interruptController = new AbortController()
  const handleInterrupt = () => interruptController.abort(new DOMException('Interrupted', 'AbortError'))
  process.once('SIGINT', handleInterrupt)
  let staged
  try {
    const { proposalPath, savedProposal } = await loadSavedBatchProposal(
      proposalReference,
      config,
    )
    if (savedProposal.status === 'applied') {
      throw new Error(`Proposal ${savedProposal.id} has already been applied.`)
    }

    const state = await loadCatalogState(config)
    const currentValidation = await validateCatalogState(state, config)
    if (!currentValidation.valid) {
      throw new Error(
        'The existing photo catalog is invalid. Run npm run photo:validate before importing.',
      )
    }
    assertSavedTargetsValid(savedProposal, state)
    assertImportSettingsFresh(savedProposal, config)

    staged = await stageBatchInput(savedProposal.input.sourcePath, config, {
      onStagingCreated: options.onStagingCreated,
      signal: interruptController.signal,
    })
    if (staged.sourceType !== savedProposal.input.sourceType) {
      throw new Error('Saved proposal input type changed; run a new dry run.')
    }
    const drafts = await hydrateSavedDrafts(
      savedProposal,
      staged,
      config,
      interruptController.signal,
    )

    const duplicateReport = await detectBatchDuplicates(drafts, state, config)
    if (duplicateReport.duplicates.length) {
      const details = duplicateReport.duplicates
        .map(
          (duplicate) =>
            `${path.basename(duplicate.photo.sourcePath)} now matches ${duplicate.duplicateOf}`,
        )
        .join('\n')
      throw new Error(`Saved proposal contains a photograph that is now already present:\n${details}`)
    }
    assertPortfolioFresh(savedProposal, state)

    const proposal = await buildBatchProposal({ drafts, state, config })
    for (const item of proposal.items) {
      const savedPhoto = savedProposal.photos.find(
        (photo) => photo.token === item.draft.token,
      )
      assertProposalItemMatches(savedPhoto, item)
    }

    console.log(`Reusing ${savedProposal.analysisModel} analysis from ${savedProposal.createdAt}.`)
    printBatchReview(drafts, proposal, false)
    const approve =
      options.approveProposal ??
      (() =>
        confirm({
          message: 'Apply this saved batch proposal?',
          default: false,
        }))
    if (!(await approve({ savedProposal, drafts, proposal }))) {
      console.log('Cancelled. No portfolio files were changed.')
      return { status: 'cancelled', savedProposal, drafts, proposal }
    }

    await commitBatchProposal(proposal, state, config, {
      ...options.transactionOptions,
      additionalWrites: [appliedProposalWrite(savedProposal, proposalPath)],
    })
    const committedState = await loadCatalogState(config)
    const finalValidation = await validateCatalogState(committedState, config)
    if (!finalValidation.valid) {
      throw new Error('Batch files were written, but post-write catalog validation failed.')
    }
    heading('BATCH COMPLETE')
    console.log(`${proposal.items.length} photographs imported from saved proposal`)
    console.log('✓ no visual-analysis call was made')
    console.log('✓ proposal marked as applied')
    console.log('✓ manifests updated transactionally')
    return {
      status: 'batch-added',
      savedProposal,
      drafts,
      proposal,
      duplicateReport,
      finalValidation,
    }
  } finally {
    process.removeListener('SIGINT', handleInterrupt)
    if (staged) await staged.cleanup()
  }
}
