import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  isValidSlug,
  metadataForClassification,
  placementLabel,
  primaryPlacement,
} from '../../src/data/photoSchema.js'
import {
  cloneState,
  findPhotoBySrc,
  flattenCatalogs,
  insertPhoto,
  manifestWrites,
} from './catalog.mjs'
import {
  normalizedOutputFilename,
  outputCollision,
  outputTarget,
  preparePhotoImport,
} from './add.mjs'
import { sourceDigest } from './images.mjs'
import { publicPathForSrc } from './preview.mjs'
import { commitFiles } from './transaction.mjs'
import { validateCatalogState } from './validate.mjs'

function digestBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

export function confidenceLabel(confidence) {
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.55) return 'medium'
  return 'low'
}

export function classificationFromAnalysis(photo) {
  const category = photo.category
  const subcategory = photo.subcategory
  const classification = { major: category, section: subcategory }

  if (category === 'people' && subcategory === 'portraits') {
    if (!isValidSlug(photo.session)) throw new Error('portrait session must be a lowercase slug')
    if (!['bright', 'moody'].includes(photo.portraitTheme)) {
      throw new Error('portrait theme must be bright or moody')
    }
    classification.session = photo.session
    classification.theme = photo.portraitTheme
  } else if (category === 'people' && subcategory === 'events') {
    if (!isValidSlug(photo.eventCategory)) {
      throw new Error('event category must be a lowercase slug')
    }
    classification.category = photo.eventCategory
  } else if (category === 'places' && subcategory === 'landscape') {
    if (!['green', 'water'].includes(photo.environment)) {
      throw new Error('landscape environment must be green or water')
    }
    classification.environment = photo.environment
  } else if (category === 'wildlife' && subcategory === 'habitat') {
    if (!['green', 'water', 'other'].includes(photo.environment)) {
      throw new Error('habitat environment must be green, water, or other')
    }
    classification.environment = photo.environment
  }
  try {
    metadataForClassification(classification)
  } catch {
    throw new Error(`unsupported category/subcategory ${category ?? 'null'}/${subcategory ?? 'null'}`)
  }
  return classification
}

function placementFromAnalysis(modelPlacement) {
  if (modelPlacement.position === 'beginning' || modelPlacement.position === 'end') {
    return { type: modelPlacement.position }
  }
  return {
    type: 'relative',
    position: modelPlacement.position,
    src: modelPlacement.referenceSrc,
  }
}

function samePrimaryPlacement(catalog, photo, target) {
  const left = primaryPlacement(catalog, photo)
  const right = primaryPlacement(target.catalog, target.photo)
  return left?.major === right?.major && left?.section === right?.section
}

export function validateVisualAnalysis(rawResult, batchPhotos, state) {
  if (!rawResult || typeof rawResult !== 'object' || !Array.isArray(rawResult.photos)) {
    throw new Error('Visual analysis did not return a photos array.')
  }
  const inputsByToken = new Map(batchPhotos.map((photo) => [photo.token, photo]))
  const seenTokens = new Set()
  const seenOrders = new Set()
  const errors = []
  const drafts = []

  for (const result of rawResult.photos) {
    const subject = typeof result?.source === 'string' ? result.source : '(missing source)'
    if (!inputsByToken.has(subject)) {
      errors.push(`${subject}: source is not part of this batch`)
      continue
    }
    if (seenTokens.has(subject)) {
      errors.push(`${subject}: source appears more than once`)
      continue
    }
    seenTokens.add(subject)
    if (!Number.isInteger(result.batchOrder) || result.batchOrder < 1) {
      errors.push(`${subject}: batchOrder must be a positive integer`)
    } else if (seenOrders.has(result.batchOrder)) {
      errors.push(`${subject}: batchOrder ${result.batchOrder} is duplicated`)
    } else {
      seenOrders.add(result.batchOrder)
    }
    if (typeof result.alt !== 'string' || !result.alt.trim()) {
      errors.push(`${subject}: alt must be non-empty`)
    }
    if (typeof result.reason !== 'string' || !result.reason.trim()) {
      errors.push(`${subject}: reason must be non-empty`)
    }
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      errors.push(`${subject}: confidence must be between 0 and 1`)
    }

    const unresolved = result.status === 'unresolved'
    if (!['resolved', 'unresolved'].includes(result.status)) {
      errors.push(`${subject}: status must be resolved or unresolved`)
    }
    if (unresolved) {
      if (result.category !== null || result.subcategory !== null) {
        errors.push(`${subject}: unresolved results must not guess a category or subcategory`)
      }
      drafts.push({
        ...inputsByToken.get(subject),
        classification: null,
        placement: null,
        alt: result.alt?.trim() ?? '',
        confidence: result.confidence,
        reason: result.reason?.trim() ?? '',
        batchOrder: result.batchOrder,
        needsReview: true,
        reviewed: false,
      })
      continue
    }

    let classification
    let mapped
    try {
      classification = classificationFromAnalysis(result)
      mapped = metadataForClassification(classification)
    } catch (error) {
      errors.push(`${subject}: ${error.message}`)
      continue
    }

    const modelPlacement = result.placement
    if (!modelPlacement || !['beginning', 'end', 'before', 'after'].includes(modelPlacement.position)) {
      errors.push(`${subject}: placement position is invalid`)
      continue
    }
    if (['before', 'after'].includes(modelPlacement.position)) {
      const target = findPhotoBySrc(state, modelPlacement.referenceSrc)
      if (!target) {
        errors.push(`${subject}: placement target ${modelPlacement.referenceSrc ?? 'null'} was not found`)
        continue
      }
      if (!samePrimaryPlacement(mapped.catalog, mapped.metadata, target)) {
        errors.push(`${subject}: placement target is outside the proposed gallery section`)
        continue
      }
    } else if (modelPlacement.referenceSrc !== null) {
      errors.push(`${subject}: ${modelPlacement.position} placement must not include a target`)
      continue
    }

    drafts.push({
      ...inputsByToken.get(subject),
      classification,
      placement: placementFromAnalysis(modelPlacement),
      alt: result.alt.trim(),
      confidence: result.confidence,
      reason: result.reason.trim(),
      batchOrder: result.batchOrder,
      needsReview: result.confidence < 0.55,
      reviewed: false,
    })
  }

  for (const token of inputsByToken.keys()) {
    if (!seenTokens.has(token)) errors.push(`${token}: source is missing from visual analysis`)
  }
  if (errors.length) throw new Error(`Invalid visual analysis:\n${errors.join('\n')}`)
  return drafts.sort((left, right) => left.batchOrder - right.batchOrder)
}

export async function detectBatchDuplicates(batchPhotos, state, config) {
  const existingDigestToSrc = new Map()
  const existingNames = new Map()
  for (const entry of flattenCatalogs(state)) {
    const basename = path.posix.basename(entry.photo.src).toLowerCase()
    const names = existingNames.get(basename) ?? []
    names.push(entry.photo.src)
    existingNames.set(basename, names)
    const filePath = publicPathForSrc(config, entry.photo.src)
    const digest = digestBuffer(await readFile(filePath))
    existingDigestToSrc.set(digest, entry.photo.src)
  }

  const incomingDigests = new Map()
  const accepted = []
  const duplicates = []
  const filenameWarnings = []
  for (const photo of batchPhotos) {
    const rawDigest = await sourceDigest(photo.sourcePath)
    const optimizedDigest = digestBuffer(photo.optimized.buffer)
    const existingMatch =
      existingDigestToSrc.get(rawDigest) ?? existingDigestToSrc.get(optimizedDigest)
    const incomingMatch = incomingDigests.get(rawDigest) ?? incomingDigests.get(optimizedDigest)
    if (existingMatch || incomingMatch) {
      duplicates.push({
        photo,
        duplicateOf: existingMatch ?? incomingMatch.sourcePath,
      })
      continue
    }
    incomingDigests.set(rawDigest, photo)
    incomingDigests.set(optimizedDigest, photo)
    const matchingNames = existingNames.get(
      normalizedOutputFilename(photo.sourcePath).toLowerCase(),
    )
    if (matchingNames) filenameWarnings.push({ photo, matches: matchingNames })
    accepted.push(photo)
  }
  return { accepted, duplicates, filenameWarnings }
}

async function allocateFilename(draft, state, config, reservedTargets) {
  const { catalog } = metadataForClassification(draft.classification)
  if (draft.outputFilename) {
    const filename = normalizedOutputFilename(draft.sourcePath, draft.outputFilename)
    const target = outputTarget(config, catalog, filename)
    const key = target.outputPath.toLowerCase()
    if (reservedTargets.has(key) || (await outputCollision(state, target.outputPath, target.src))) {
      throw new Error(`Saved output ${filename} is no longer available; run a new dry run.`)
    }
    reservedTargets.add(key)
    return filename
  }
  const initial = normalizedOutputFilename(draft.sourcePath)
  const parsed = path.parse(initial)
  let attempt = 1
  while (true) {
    const filename = attempt === 1 ? initial : `${parsed.name}-${attempt}${parsed.ext}`
    const target = outputTarget(config, catalog, filename)
    const key = target.outputPath.toLowerCase()
    if (!reservedTargets.has(key) && !(await outputCollision(state, target.outputPath, target.src))) {
      reservedTargets.add(key)
      return filename
    }
    attempt += 1
  }
}

function placementGroupKey(item) {
  const placement = item.draft.placement
  const reference = placement.type === 'relative' ? placement.src : ''
  return `${item.catalog}:${placementLabel(item.catalog, item.photo)}:${placement.type}:${placement.position ?? ''}:${reference}`
}

export async function buildBatchProposal({ drafts, state, config }) {
  const unresolved = drafts.filter((draft) => !draft.classification || !draft.placement)
  if (unresolved.length) {
    throw new Error(`Manual review is required for: ${unresolved.map((draft) => draft.token).join(', ')}`)
  }

  const reservedTargets = new Set()
  const preparedItems = []
  for (const draft of [...drafts].sort((left, right) => left.batchOrder - right.batchOrder)) {
    const outputFilename = await allocateFilename(draft, state, config, reservedTargets)
    const prepared = await preparePhotoImport({
      state,
      config,
      sourcePath: draft.sourcePath,
      inspection: draft.inspection,
      classification: draft.classification,
      alt: draft.alt,
      placement: draft.placement,
      outputFilename,
      optimized: draft.optimized,
    })
    preparedItems.push({
      ...prepared,
      draft,
      outputFilename,
      renamed: outputFilename !== normalizedOutputFilename(draft.sourcePath),
    })
  }

  const nextState = cloneState(state)
  const previousInGroup = new Map()
  for (const item of preparedItems) {
    const key = placementGroupKey(item)
    const previous = previousInGroup.get(key)
    let appliedPlacement = item.placement
    if (previous && ['beginning', 'relative'].includes(item.placement.type)) {
      if (item.placement.type === 'beginning' || item.placement.position === 'after') {
        appliedPlacement = { type: 'relative', position: 'after', src: previous.photo.src }
      }
    }
    insertPhoto(nextState, item.catalog, item.photo, appliedPlacement)
    previousInGroup.set(key, item)
    item.appliedPlacement = appliedPlacement
  }

  const fileOverrides = new Map(
    preparedItems.map((item) => [item.photo.src, item.optimized.buffer]),
  )
  const validation = await validateCatalogState(nextState, config, { fileOverrides })
  if (!validation.valid) {
    throw new Error(
      `Proposed batch is invalid:\n${validation.errors.map((issue) => `${issue.subject}: ${issue.message}`).join('\n')}`,
    )
  }
  return { drafts, items: preparedItems, nextState, validation }
}

export async function commitBatchProposal(proposal, currentState, config, options = {}) {
  const { additionalWrites = [], ...transactionOptions } = options
  await commitFiles(
    [
      ...proposal.items.map((item) => ({
        targetPath: item.outputPath,
        content: item.optimized.buffer,
        mustNotExist: true,
      })),
      ...manifestWrites(config, currentState, proposal.nextState),
      ...additionalWrites,
    ],
    transactionOptions,
  )
}
