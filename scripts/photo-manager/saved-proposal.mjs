import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { metadataForClassification, primaryPlacement } from '../../src/data/photoSchema.js'
import { findPhotoBySrc, serializeJson } from './catalog.mjs'
import { sourceDigest } from './images.mjs'
import { resolveUserPath } from './paths.mjs'
import { commitFiles } from './transaction.mjs'

export const BATCH_PROPOSAL_VERSION = 1

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function catalogOrder(state) {
  return Object.fromEntries(
    Object.entries(state.catalogs).map(([catalog, photos]) => [
      catalog,
      photos.map((photo) => photo.src),
    ]),
  )
}

export function portfolioFingerprint(state) {
  return sha256(JSON.stringify(state.catalogs))
}

function importSettings(config) {
  return {
    maxLongEdge: config.maxLongEdge,
    jpegQuality: config.jpegQuality,
    supportedExtensions: config.supportedExtensions,
  }
}

function createProposalId(now = new Date()) {
  const timestamp = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '')
  return `${timestamp}-${randomBytes(3).toString('hex')}`
}

function expectedItem(item) {
  return {
    catalog: item.catalog,
    photo: item.photo,
    placement: item.placement,
    appliedPlacement: item.appliedPlacement,
    outputFilename: item.outputFilename,
  }
}

export async function createSavedBatchProposal({
  analysisModel,
  allowFlatten,
  drafts,
  proposal,
  staged,
  state,
  config,
  now,
  proposalId,
}) {
  const id = proposalId ?? createProposalId(now)
  const photos = []
  for (const draft of drafts) {
    const item = proposal.items.find((candidate) => candidate.draft.token === draft.token)
    if (!item) throw new Error(`Cannot persist incomplete batch item ${draft.token}.`)
    photos.push({
      token: draft.token,
      source: {
        relativePath: draft.relativePath,
        name: path.basename(draft.sourcePath),
        path:
          staged.sourceType === 'folder'
            ? draft.sourcePath
            : `${staged.sourcePath}#${draft.relativePath}`,
        sha256: await sourceDigest(draft.sourcePath),
      },
      classification: draft.classification,
      placement: draft.placement,
      batchOrder: draft.batchOrder,
      alt: draft.alt,
      confidence: draft.confidence,
      reason: draft.reason,
      reviewed: draft.reviewed,
      needsReview: draft.needsReview,
      outputFilename: item.outputFilename,
      expected: expectedItem(item),
    })
  }

  return {
    version: BATCH_PROPOSAL_VERSION,
    id,
    status: 'ready',
    createdAt: (now ?? new Date()).toISOString(),
    analysisModel,
    input: {
      sourcePath: staged.sourcePath,
      sourceType: staged.sourceType,
      allowFlatten,
    },
    importSettings: importSettings(config),
    portfolio: {
      fingerprint: portfolioFingerprint(state),
      catalogOrder: catalogOrder(state),
    },
    photos,
  }
}

export async function saveBatchProposal(savedProposal, config) {
  const proposalPath = path.join(config.proposalDir, `${savedProposal.id}.json`)
  await commitFiles([
    {
      targetPath: proposalPath,
      content: serializeJson(savedProposal),
      mustNotExist: true,
    },
  ])
  return proposalPath
}

function proposalPathForReference(reference, config) {
  const value = reference?.trim()
  if (!value) throw new Error('Provide a saved proposal ID or path.')
  if (/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    return path.join(config.proposalDir, value.endsWith('.json') ? value : `${value}.json`)
  }
  return resolveUserPath(value, { currentDirectory: config.rootDir })
}

function validateSavedProposal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Saved batch proposal must be a JSON object.')
  }
  if (value.version !== BATCH_PROPOSAL_VERSION) {
    throw new Error(`Unsupported batch proposal version: ${value.version ?? 'missing'}.`)
  }
  if (!['ready', 'applied'].includes(value.status)) {
    throw new Error('Saved batch proposal has an invalid status.')
  }
  if (typeof value.analysisModel !== 'string' || !value.analysisModel.trim()) {
    throw new Error('Saved batch proposal is missing its analysis model.')
  }
  if (
    !value.input ||
    typeof value.input.sourcePath !== 'string' ||
    !['folder', 'zip'].includes(value.input.sourceType)
  ) {
    throw new Error('Saved batch proposal has invalid input information.')
  }
  if (!value.portfolio || typeof value.portfolio.fingerprint !== 'string') {
    throw new Error('Saved batch proposal is missing its portfolio fingerprint.')
  }
  if (!Array.isArray(value.photos) || value.photos.length === 0) {
    throw new Error('Saved batch proposal contains no photographs.')
  }

  const seenTokens = new Set()
  const seenOrders = new Set()
  for (const photo of value.photos) {
    if (typeof photo?.token !== 'string' || seenTokens.has(photo.token)) {
      throw new Error('Saved batch proposal contains invalid source tokens.')
    }
    seenTokens.add(photo.token)
    if (!Number.isInteger(photo.batchOrder) || photo.batchOrder < 1 || seenOrders.has(photo.batchOrder)) {
      throw new Error('Saved batch proposal contains invalid batch ordering.')
    }
    seenOrders.add(photo.batchOrder)
    if (
      typeof photo.source?.relativePath !== 'string' ||
      !photo.source.relativePath ||
      typeof photo.source?.name !== 'string' ||
      !/^[a-f0-9]{64}$/.test(photo.source?.sha256 ?? '')
    ) {
      throw new Error(`Saved batch proposal has invalid source information for ${photo.token}.`)
    }
    if (
      typeof photo.alt !== 'string' ||
      !photo.alt.trim() ||
      typeof photo.reason !== 'string' ||
      !photo.reason.trim() ||
      typeof photo.confidence !== 'number' ||
      photo.confidence < 0 ||
      photo.confidence > 1 ||
      typeof photo.outputFilename !== 'string' ||
      !photo.expected
    ) {
      throw new Error(`Saved batch proposal has invalid review data for ${photo.token}.`)
    }
    try {
      metadataForClassification(photo.classification)
    } catch {
      throw new Error(`Saved batch proposal has invalid classification for ${photo.token}.`)
    }
  }
  return value
}

export async function loadSavedBatchProposal(reference, config) {
  const proposalPath = proposalPathForReference(reference, config)
  let value
  try {
    value = JSON.parse(await readFile(proposalPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Saved proposal was not found: ${proposalPath}`)
    if (error instanceof SyntaxError) throw new Error(`Saved proposal is invalid JSON: ${error.message}`)
    throw error
  }
  return { proposalPath, savedProposal: validateSavedProposal(value) }
}

function samePrimaryPlacement(catalog, photo, target) {
  const proposed = primaryPlacement(catalog, photo)
  const existing = primaryPlacement(target.catalog, target.photo)
  return proposed?.major === existing?.major && proposed?.section === existing?.section
}

export function assertSavedTargetsValid(savedProposal, state) {
  for (const photo of savedProposal.photos) {
    const mapped = metadataForClassification(photo.classification)
    if (mapped.catalog !== photo.expected.catalog) {
      throw new Error(`Saved proposal classification for ${photo.token} is stale; run a new dry run.`)
    }
    if (photo.placement?.type === 'relative') {
      const target = findPhotoBySrc(state, photo.placement.src)
      if (!target) {
        throw new Error(
          `Saved proposal placement target ${photo.placement.src} is missing; run a new dry run.`,
        )
      }
      if (!samePrimaryPlacement(mapped.catalog, mapped.metadata, target)) {
        throw new Error(
          `Saved proposal placement target ${photo.placement.src} is no longer in the proposed gallery; run a new dry run.`,
        )
      }
    } else if (!['beginning', 'end'].includes(photo.placement?.type)) {
      throw new Error(`Saved proposal placement for ${photo.token} is invalid.`)
    }
  }
}

export function assertPortfolioFresh(savedProposal, state) {
  if (JSON.stringify(savedProposal.portfolio.catalogOrder) !== JSON.stringify(catalogOrder(state))) {
    throw new Error('Portfolio gallery ordering has changed; run a new batch dry run.')
  }
  if (savedProposal.portfolio.fingerprint !== portfolioFingerprint(state)) {
    throw new Error('Portfolio catalog has changed; run a new batch dry run.')
  }
}

export function assertImportSettingsFresh(savedProposal, config) {
  if (JSON.stringify(savedProposal.importSettings) !== JSON.stringify(importSettings(config))) {
    throw new Error('Photo optimization settings have changed; run a new batch dry run.')
  }
}

export function assertProposalItemMatches(savedPhoto, item) {
  if (JSON.stringify(savedPhoto.expected) !== JSON.stringify(expectedItem(item))) {
    throw new Error(`Saved proposal plan for ${savedPhoto.token} is stale; run a new dry run.`)
  }
}

export function appliedProposalWrite(savedProposal, proposalPath, now = new Date()) {
  return {
    targetPath: proposalPath,
    content: serializeJson({
      ...savedProposal,
      status: 'applied',
      appliedAt: now.toISOString(),
    }),
  }
}
