import { execFile } from 'node:child_process'
import test from 'node:test'
import assert from 'node:assert/strict'
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { runApplyProposalWorkflow, runBatchWorkflow } from '../add-batch.mjs'
import { stageBatchInput } from '../batch-input.mjs'
import {
  detectBatchDuplicates,
  validateVisualAnalysis,
} from '../batch-proposal.mjs'
import { loadCatalogState, serializeJson } from '../catalog.mjs'
import { inspectImage, sourceDigest } from '../images.mjs'
import {
  analyzeBatchWithCodex,
  DEFAULT_VISUAL_ANALYSIS_MODEL,
} from '../visual-analysis.mjs'
import { jpegBuffer, createFixture, snapshotTree, validPhoto } from './helpers.mjs'

const execFileAsync = promisify(execFile)

function modelPhoto(source = 'I001', overrides = {}) {
  return {
    source,
    status: 'resolved',
    category: 'places',
    subcategory: 'street',
    session: null,
    portraitTheme: null,
    eventCategory: null,
    environment: null,
    alt: 'A street photograph prepared by the batch fixture',
    placement: { position: 'end', referenceSrc: null },
    batchOrder: Number(source.slice(1)),
    confidence: 0.92,
    reason: 'The documentary composition continues the existing street sequence.',
    ...overrides,
  }
}

async function muted(action) {
  const originalLog = console.log
  const originalWarn = console.warn
  console.log = () => {}
  console.warn = () => {}
  try {
    return await action()
  } finally {
    console.log = originalLog
    console.warn = originalWarn
  }
}

async function assertMissing(filePath) {
  await assert.rejects(access(filePath))
}

function withoutSavedProposals(snapshot) {
  return Object.fromEntries(
    Object.entries(snapshot).filter(([relativePath]) => !relativePath.startsWith('.photo-manager/')),
  )
}

async function createDryRun(fixture, options = {}) {
  return muted(() =>
    runBatchWorkflow(path.dirname(fixture.sourcePath), fixture.config, {
      dryRun: true,
      analyze: async () => ({ photos: [modelPhoto()] }),
      reviewAction: async () => 'apply',
      ...options,
    }),
  )
}

async function makeZip(sourceDir, archivePath) {
  await execFileAsync('zip', ['-qr', archivePath, '.'], { cwd: sourceDir })
}

test('folder input discovers supported photos recursively and ignores macOS junk', async () => {
  const fixture = await createFixture()
  const folder = path.join(fixture.rootDir, 'folder-batch')
  await mkdir(path.join(folder, 'nested'), { recursive: true })
  await writeFile(path.join(folder, 'nested', 'photo.jpg'), await jpegBuffer())
  await writeFile(path.join(folder, 'nested', '.DS_Store'), 'junk')
  await writeFile(path.join(folder, 'nested', '._photo.jpg'), 'junk')
  await writeFile(path.join(folder, 'notes.txt'), 'not a photo')

  const staged = await stageBatchInput(folder, fixture.config)
  try {
    assert.equal(staged.sourceType, 'folder')
    assert.deepEqual(staged.photos, [path.join(folder, 'nested', 'photo.jpg')])
    assert.deepEqual(staged.photoEntries, [
      {
        sourcePath: path.join(folder, 'nested', 'photo.jpg'),
        relativePath: 'nested/photo.jpg',
      },
    ])
  } finally {
    await staged.cleanup()
  }
})

test('ZIP input extracts supported photos and ignores macOS archive artifacts', async () => {
  const fixture = await createFixture()
  const zipSource = await mkdtemp(path.join(os.tmpdir(), 'jascielle-zip-source-'))
  const archive = path.join(fixture.rootDir, 'photos.zip')
  await mkdir(path.join(zipSource, 'nested'), { recursive: true })
  await mkdir(path.join(zipSource, '__MACOSX'), { recursive: true })
  await writeFile(path.join(zipSource, 'nested', 'photo.jpg'), await jpegBuffer())
  await writeFile(path.join(zipSource, '__MACOSX', '._photo.jpg'), 'junk')
  await writeFile(path.join(zipSource, '.DS_Store'), 'junk')
  await makeZip(zipSource, archive)

  const staged = await stageBatchInput(archive, fixture.config)
  try {
    assert.equal(staged.sourceType, 'zip')
    assert.equal(staged.photos.length, 1)
    assert.equal(path.basename(staged.photos[0]), 'photo.jpg')
    assert.equal(staged.photoEntries[0].relativePath, 'nested/photo.jpg')
    assert.ok((await readFile(staged.photos[0])).byteLength > 0)
  } finally {
    await staged.cleanup()
  }
})

test('batch folder input reuses leading-home path expansion', async () => {
  const fixture = await createFixture()
  const folder = path.join(fixture.rootDir, 'home-batch')
  await mkdir(folder)
  await writeFile(path.join(folder, 'photo.jpg'), await jpegBuffer())
  const staged = await stageBatchInput('~/home-batch', fixture.config, {
    pathOptions: { homeDirectory: fixture.rootDir, currentDirectory: '/tmp' },
  })
  try {
    assert.equal(staged.sourcePath, folder)
  } finally {
    await staged.cleanup()
  }
})

test('invalid batch paths fail before creating staging', async () => {
  const fixture = await createFixture()
  let stagingPath
  await assert.rejects(
    stageBatchInput(path.join(fixture.rootDir, 'missing'), fixture.config, {
      onStagingCreated: (value) => { stagingPath = value },
    }),
    /does not exist/,
  )
  assert.equal(stagingPath, undefined)
})

test('empty directories fail and clean temporary staging', async () => {
  const fixture = await createFixture()
  const folder = path.join(fixture.rootDir, 'empty')
  await mkdir(folder)
  let stagingPath
  await assert.rejects(
    stageBatchInput(folder, fixture.config, {
      onStagingCreated: (value) => { stagingPath = value },
    }),
    /folder is empty/,
  )
  await assertMissing(stagingPath)
})

test('interrupted discovery cleans temporary staging', async () => {
  const fixture = await createFixture()
  const controller = new AbortController()
  controller.abort(new DOMException('Interrupted', 'AbortError'))
  let stagingPath
  await assert.rejects(
    stageBatchInput(path.dirname(fixture.sourcePath), fixture.config, {
      signal: controller.signal,
      onStagingCreated: (value) => { stagingPath = value },
    }),
    { name: 'AbortError' },
  )
  await assertMissing(stagingPath)
})

test('archives with no supported photos fail and clean temporary staging', async () => {
  const fixture = await createFixture()
  const zipSource = await mkdtemp(path.join(os.tmpdir(), 'jascielle-empty-zip-'))
  const archive = path.join(fixture.rootDir, 'notes.zip')
  await writeFile(path.join(zipSource, 'notes.txt'), 'not a photo')
  await makeZip(zipSource, archive)
  let stagingPath
  await assert.rejects(
    stageBatchInput(archive, fixture.config, {
      onStagingCreated: (value) => { stagingPath = value },
    }),
    /contains no supported photos/,
  )
  await assertMissing(stagingPath)
})

test('ZIP path traversal entries are rejected without escaping staging', async () => {
  const fixture = await createFixture()
  const zipRoot = await mkdtemp(path.join(os.tmpdir(), 'jascielle-slip-zip-'))
  const child = path.join(zipRoot, 'child')
  const outside = path.join(zipRoot, 'outside.jpg')
  const archive = path.join(fixture.rootDir, 'unsafe.zip')
  await mkdir(child)
  await writeFile(outside, await jpegBuffer())
  await execFileAsync('zip', ['-q', archive, '../outside.jpg'], { cwd: child })
  await assert.rejects(stageBatchInput(archive, fixture.config), /Unsafe ZIP entry/)
})

test('invalid model categories and subcategories are rejected', async () => {
  const fixture = await createFixture()
  const batchPhotos = [{ token: 'I001', sourcePath: fixture.sourcePath }]
  assert.throws(
    () => validateVisualAnalysis(
      { photos: [modelPhoto('I001', { category: 'fashion' })] },
      batchPhotos,
      fixture.state,
    ),
    /unsupported category\/subcategory/,
  )
  assert.throws(
    () => validateVisualAnalysis(
      { photos: [modelPhoto('I001', { subcategory: 'interiors' })] },
      batchPhotos,
      fixture.state,
    ),
    /unsupported category\/subcategory/,
  )
})

test('model placement targets must exist in the proposed gallery section', async () => {
  const fixture = await createFixture({ places: [validPhoto()] })
  const batchPhotos = [{ token: 'I001', sourcePath: fixture.sourcePath }]
  assert.throws(
    () => validateVisualAnalysis(
      {
        photos: [
          modelPhoto('I001', {
            placement: { position: 'after', referenceSrc: '/images/places/missing.jpg' },
          }),
        ],
      },
      batchPhotos,
      fixture.state,
    ),
    /placement target .* was not found/,
  )
})

test('low-confidence and unresolved recommendations are flagged for manual review', async () => {
  const fixture = await createFixture()
  const batchPhotos = [
    { token: 'I001', sourcePath: fixture.sourcePath },
    { token: 'I002', sourcePath: fixture.sourcePath },
  ]
  const drafts = validateVisualAnalysis(
    {
      photos: [
        modelPhoto('I001', { confidence: 0.4 }),
        modelPhoto('I002', {
          status: 'unresolved',
          category: null,
          subcategory: null,
          placement: { position: null, referenceSrc: null },
          confidence: 0.2,
        }),
      ],
    },
    batchPhotos,
    fixture.state,
  )
  assert.equal(drafts[0].needsReview, true)
  assert.equal(drafts[1].needsReview, true)
  assert.equal(drafts[1].classification, null)
  assert.equal(drafts[1].placement, null)
})

test('exact duplicate photos are detected before visual analysis', async () => {
  const existing = validPhoto()
  const fixture = await createFixture({ places: [existing] })
  const existingPath = path.join(fixture.config.publicDir, existing.src.replace(/^\//, ''))
  const buffer = await readFile(existingPath)
  const report = await detectBatchDuplicates(
    [{ token: 'I001', sourcePath: existingPath, optimized: { buffer } }],
    fixture.state,
    fixture.config,
  )
  assert.equal(report.accepted.length, 0)
  assert.equal(report.duplicates.length, 1)
  assert.equal(report.duplicates[0].duplicateOf, existing.src)
})

test('Codex adapter uses authenticated read-only structured image analysis without a live call', async () => {
  const fixture = await createFixture()
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'jascielle-codex-mock-'))
  const codexBin = path.join(temporaryRoot, 'mock-codex.cjs')
  const argsPath = path.join(temporaryRoot, 'args.json')
  const result = { photos: [modelPhoto()] }
  await writeFile(
    codexBin,
    `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
if (args[0] === 'login') process.exit(0)
fs.writeFileSync(process.env.PHOTO_MANAGER_MOCK_ARGS, JSON.stringify(args))
const outputIndex = args.indexOf('--output-last-message')
fs.writeFileSync(args[outputIndex + 1], process.env.PHOTO_MANAGER_MOCK_RESULT)
`,
  )
  await chmod(codexBin, 0o755)
  const previousArgsPath = process.env.PHOTO_MANAGER_MOCK_ARGS
  const previousResult = process.env.PHOTO_MANAGER_MOCK_RESULT
  process.env.PHOTO_MANAGER_MOCK_ARGS = argsPath
  process.env.PHOTO_MANAGER_MOCK_RESULT = JSON.stringify(result)
  try {
    const inspection = await inspectImage(fixture.sourcePath, fixture.config)
    assert.deepEqual(
      await analyzeBatchWithCodex(
        {
          batchPhotos: [{ token: 'I001', sourcePath: fixture.sourcePath, inspection }],
          state: fixture.state,
          config: fixture.config,
          temporaryRoot,
        },
        { codexBin },
      ),
      result,
    )
    const args = JSON.parse(await readFile(argsPath, 'utf8'))
    assert.deepEqual(args.slice(0, 3), ['exec', '--model', DEFAULT_VISUAL_ANALYSIS_MODEL])
    assert.ok(args.includes('--ephemeral'))
    assert.deepEqual(args.slice(args.indexOf('--sandbox'), args.indexOf('--sandbox') + 2), [
      '--sandbox',
      'read-only',
    ])
    assert.ok(args.includes('--output-schema'))
    assert.ok(args.includes('--image'))

    await analyzeBatchWithCodex(
      {
        batchPhotos: [{ token: 'I001', sourcePath: fixture.sourcePath, inspection }],
        state: fixture.state,
        config: fixture.config,
        temporaryRoot,
      },
      { codexBin, model: 'gpt-5.6-sol' },
    )
    const overrideArgs = JSON.parse(await readFile(argsPath, 'utf8'))
    assert.deepEqual(overrideArgs.slice(0, 3), ['exec', '--model', 'gpt-5.6-sol'])
  } finally {
    if (previousArgsPath === undefined) delete process.env.PHOTO_MANAGER_MOCK_ARGS
    else process.env.PHOTO_MANAGER_MOCK_ARGS = previousArgsPath
    if (previousResult === undefined) delete process.env.PHOTO_MANAGER_MOCK_RESULT
    else process.env.PHOTO_MANAGER_MOCK_RESULT = previousResult
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

test('dry run validates a proposal without mutating portfolio files and omits location/year', async () => {
  const fixture = await createFixture()
  const before = await snapshotTree(fixture.rootDir)
  let stagingPath
  const result = await muted(() => runBatchWorkflow(path.dirname(fixture.sourcePath), fixture.config, {
    dryRun: true,
    analyze: async () => ({ photos: [modelPhoto()] }),
    reviewAction: async () => 'apply',
    onStagingCreated: (value) => { stagingPath = value },
  }))
  assert.equal(result.status, 'dry-run')
  assert.equal(Object.hasOwn(result.proposal.items[0].photo, 'location'), false)
  assert.equal(Object.hasOwn(result.proposal.items[0].photo, 'year'), false)
  assert.equal(result.savedProposal.analysisModel, DEFAULT_VISUAL_ANALYSIS_MODEL)
  assert.equal(
    result.savedProposal.photos[0].source.sha256,
    await sourceDigest(fixture.sourcePath),
  )
  assert.deepEqual(withoutSavedProposals(await snapshotTree(fixture.rootDir)), before)
  assert.equal(JSON.parse(await readFile(result.proposalPath, 'utf8')).status, 'ready')
  await assertMissing(stagingPath)
})

test('approval cancellation performs no portfolio mutations', async () => {
  const fixture = await createFixture()
  const before = await snapshotTree(fixture.rootDir)
  const result = await muted(() => runBatchWorkflow(path.dirname(fixture.sourcePath), fixture.config, {
    analyze: async () => ({ photos: [modelPhoto()] }),
    reviewAction: async () => 'cancel',
  }))
  assert.equal(result.status, 'cancelled')
  assert.deepEqual(await snapshotTree(fixture.rootDir), before)
})

test('visual-analysis failure performs no mutations and cleans staging', async () => {
  const fixture = await createFixture()
  const before = await snapshotTree(fixture.rootDir)
  let stagingPath
  await assert.rejects(
    muted(() => runBatchWorkflow(path.dirname(fixture.sourcePath), fixture.config, {
      analyze: async () => { throw new Error('simulated analysis failure') },
      reviewAction: async () => 'apply',
      onStagingCreated: (value) => { stagingPath = value },
    })),
    /simulated analysis failure/,
  )
  assert.deepEqual(await snapshotTree(fixture.rootDir), before)
  await assertMissing(stagingPath)
})

test('partial batch write failure rolls back images and manifests', async () => {
  const fixture = await createFixture()
  const before = await snapshotTree(fixture.rootDir)
  let stagingPath
  await assert.rejects(
    muted(() => runBatchWorkflow(path.dirname(fixture.sourcePath), fixture.config, {
      analyze: async () => ({ photos: [modelPhoto()] }),
      reviewAction: async () => 'apply',
      transactionOptions: { failAfter: 1 },
      onStagingCreated: (value) => { stagingPath = value },
    })),
    /Simulated transaction failure/,
  )
  assert.deepEqual(await snapshotTree(fixture.rootDir), before)
  await assertMissing(stagingPath)
})

test('batchOrder preserves the model-recommended order for shared placement', async () => {
  const fixture = await createFixture()
  const secondPath = path.join(path.dirname(fixture.sourcePath), 'second.jpg')
  await writeFile(secondPath, await jpegBuffer(60, 80, '#225544'))
  const result = await muted(() => runBatchWorkflow(path.dirname(fixture.sourcePath), fixture.config, {
    dryRun: true,
    analyze: async () => ({
      photos: [modelPhoto('I001', { batchOrder: 2 }), modelPhoto('I002', { batchOrder: 1 })],
    }),
    reviewAction: async () => 'apply',
  }))
  assert.deepEqual(
    result.proposal.nextState.catalogs.places.map((photo) => path.posix.basename(photo.src)),
    ['source.jpg', 'second.jpg'],
  )
})

test('saved proposal applies without another model call and cannot be applied twice', async () => {
  const fixture = await createFixture()
  let modelCalls = 0
  const dryRun = await createDryRun(fixture, {
    analyze: async () => {
      modelCalls += 1
      return { photos: [modelPhoto()] }
    },
  })

  const applied = await muted(() =>
    runApplyProposalWorkflow(dryRun.savedProposal.id, fixture.config, {
      approveProposal: async () => true,
    }),
  )
  assert.equal(applied.status, 'batch-added')
  assert.equal(modelCalls, 1)
  const state = await loadCatalogState(fixture.config)
  assert.equal(state.catalogs.places.length, 1)
  assert.equal(state.catalogs.places[0].alt, modelPhoto().alt)
  assert.equal(JSON.parse(await readFile(dryRun.proposalPath, 'utf8')).status, 'applied')

  await assert.rejects(
    muted(() =>
      runApplyProposalWorkflow(dryRun.savedProposal.id, fixture.config, {
        approveProposal: async () => true,
      }),
    ),
    /already been applied/,
  )
  assert.equal(modelCalls, 1)
})

test('final manual overrides survive proposal save and apply', async () => {
  const fixture = await createFixture()
  let reviewed = false
  const dryRun = await createDryRun(fixture, {
    reviewAction: async ({ drafts }) => {
      if (reviewed) return 'apply'
      drafts[0].classification = {
        major: 'places',
        section: 'landscape',
        environment: 'water',
      }
      drafts[0].placement = { type: 'beginning' }
      drafts[0].reason = `Manual review: ${drafts[0].reason}`
      drafts[0].reviewed = true
      drafts[0].needsReview = false
      reviewed = true
      return 'edit'
    },
  })
  assert.equal(dryRun.savedProposal.photos[0].classification.section, 'landscape')
  assert.equal(dryRun.savedProposal.photos[0].placement.type, 'beginning')

  await muted(() =>
    runApplyProposalWorkflow(dryRun.proposalPath, fixture.config, {
      approveProposal: async () => true,
    }),
  )
  const state = await loadCatalogState(fixture.config)
  assert.equal(state.catalogs.places[0].theme, 'water')
})

test('saved proposal rejects a source photograph whose content changed', async () => {
  const fixture = await createFixture()
  const dryRun = await createDryRun(fixture)
  await writeFile(fixture.sourcePath, await jpegBuffer(80, 60, '#112233'))
  await assert.rejects(
    muted(() =>
      runApplyProposalWorkflow(dryRun.savedProposal.id, fixture.config, {
        approveProposal: async () => true,
      }),
    ),
    /source changed.*Run a new dry run/,
  )
})

test('saved proposal rejects a missing relative placement target', async () => {
  const target = validPhoto()
  const fixture = await createFixture({ places: [target] })
  const dryRun = await createDryRun(fixture, {
    analyze: async () => ({
      photos: [
        modelPhoto('I001', {
          placement: { position: 'after', referenceSrc: target.src },
        }),
      ],
    }),
  })
  await writeFile(fixture.config.catalogFiles.places, serializeJson([]), 'utf8')
  await assert.rejects(
    muted(() =>
      runApplyProposalWorkflow(dryRun.savedProposal.id, fixture.config, {
        approveProposal: async () => true,
      }),
    ),
    /placement target .* is missing.*new dry run/,
  )
})

test('saved proposal rejects stale gallery ordering', async () => {
  const first = validPhoto({ src: '/images/places/first.jpg' })
  const second = validPhoto({ src: '/images/places/second.jpg' })
  const fixture = await createFixture({ places: [first, second] })
  const dryRun = await createDryRun(fixture)
  await writeFile(
    fixture.config.catalogFiles.places,
    serializeJson([second, first]),
    'utf8',
  )
  await assert.rejects(
    muted(() =>
      runApplyProposalWorkflow(dryRun.savedProposal.id, fixture.config, {
        approveProposal: async () => true,
      }),
    ),
    /gallery ordering has changed.*new batch dry run/,
  )
})

test('saved proposal rechecks duplicates introduced after its dry run', async () => {
  const fixture = await createFixture()
  const dryRun = await createDryRun(fixture)
  const duplicate = validPhoto({
    src: '/images/places/imported-elsewhere.jpg',
    width: 80,
    height: 60,
  })
  const duplicatePath = path.join(
    fixture.config.publicDir,
    duplicate.src.replace(/^\//, ''),
  )
  await mkdir(path.dirname(duplicatePath), { recursive: true })
  await writeFile(duplicatePath, await readFile(fixture.sourcePath))
  await writeFile(
    fixture.config.catalogFiles.places,
    serializeJson([duplicate]),
    'utf8',
  )

  await assert.rejects(
    muted(() =>
      runApplyProposalWorkflow(dryRun.savedProposal.id, fixture.config, {
        approveProposal: async () => true,
      }),
    ),
    /now already present.*imported-elsewhere\.jpg/s,
  )
})

test('saved-proposal partial write failure rolls back portfolio and proposal status', async () => {
  const fixture = await createFixture()
  const dryRun = await createDryRun(fixture)
  const before = await snapshotTree(fixture.rootDir)
  await assert.rejects(
    muted(() =>
      runApplyProposalWorkflow(dryRun.savedProposal.id, fixture.config, {
        approveProposal: async () => true,
        transactionOptions: { failAfter: 1 },
      }),
    ),
    /Simulated transaction failure/,
  )
  assert.deepEqual(await snapshotTree(fixture.rootDir), before)
  assert.equal(JSON.parse(await readFile(dryRun.proposalPath, 'utf8')).status, 'ready')
})
