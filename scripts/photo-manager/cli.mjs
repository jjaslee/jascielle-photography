#!/usr/bin/env node
import { input, select } from '@inquirer/prompts'
import { spawnSync } from 'node:child_process'
import { runAddWorkflow } from './add.mjs'
import { runApplyProposalWorkflow, runBatchWorkflow } from './add-batch.mjs'
import { runAuditWorkflow } from './audit.mjs'
import { runEditWorkflow } from './edit.mjs'
import { photoManagerConfig } from './config.mjs'
import { heading } from './format.mjs'
import { confirmBuild } from './prompts.mjs'
import { runValidationCommand } from './validate.mjs'
import { runResponsiveGeneration } from './generate-responsive.mjs'

function parseArguments(argv) {
  const dryRun = argv.includes('--dry-run')
  const positional = argv.filter((argument) => argument !== '--dry-run')
  return { dryRun, positional }
}

function parseBatchArguments(argv) {
  const options = { dryRun: false, model: undefined, applyProposal: undefined }
  const positional = []
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (argument === '--model' || argument === '--apply-proposal') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value.`)
      if (argument === '--model') options.model = value
      else options.applyProposal = value
      index += 1
      continue
    }
    positional.push(argument)
  }
  return { ...options, positional }
}

function runBuild() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(npm, ['run', 'build'], {
    cwd: photoManagerConfig.rootDir,
    stdio: 'inherit',
    shell: false,
  })
  if (result.status !== 0) throw new Error('Production build failed.')
}

async function maybeBuild(result) {
  if (!['added', 'batch-added', 'edited'].includes(result?.status)) return
  if (await confirmBuild()) runBuild()
}

async function runManager() {
  while (true) {
    heading('JASCIELLE PHOTO MANAGER')
    const action = await select({
      message: 'Choose a workflow',
      choices: [
        { name: 'Add a new photograph', value: 'add' },
        { name: 'Add photographs from a folder or ZIP', value: 'add-batch' },
        { name: 'Edit an existing photograph', value: 'edit' },
        { name: 'Review missing / outdated metadata', value: 'audit' },
        { name: 'Validate photo catalog', value: 'validate' },
        { name: 'Exit', value: 'exit' },
      ],
    })
    if (action === 'exit') return 0
    if (action === 'add') {
      const sourcePath = await input({
        message: 'Source image path',
        validate: (value) => value.trim().length > 0 || 'Enter an image path.',
      })
      await maybeBuild(await runAddWorkflow(sourcePath.trim(), photoManagerConfig))
    } else if (action === 'add-batch') {
      const sourcePath = await input({
        message: 'Source folder or ZIP path',
        validate: (value) => value.trim().length > 0 || 'Enter a folder or ZIP path.',
      })
      await maybeBuild(await runBatchWorkflow(sourcePath.trim(), photoManagerConfig))
    } else if (action === 'edit') {
      await maybeBuild(await runEditWorkflow('', photoManagerConfig))
    } else if (action === 'audit') {
      await runAuditWorkflow(photoManagerConfig)
    } else if (action === 'validate') {
      await runValidationCommand(photoManagerConfig)
    }
  }
}

async function main() {
  const [command = 'manage', ...rawArguments] = process.argv.slice(2)
  const { dryRun, positional } = parseArguments(rawArguments)
  if (command === 'manage') return runManager()
  if (command === 'add') {
    const result = await runAddWorkflow(positional[0], photoManagerConfig, { dryRun })
    await maybeBuild(result)
    return 0
  }
  if (command === 'add-batch') {
    const batchArguments = parseBatchArguments(rawArguments)
    if (batchArguments.applyProposal) {
      if (batchArguments.dryRun || batchArguments.model || batchArguments.positional.length) {
        throw new Error('--apply-proposal cannot be combined with a source path, --dry-run, or --model.')
      }
      const result = await runApplyProposalWorkflow(
        batchArguments.applyProposal,
        photoManagerConfig,
      )
      await maybeBuild(result)
      return 0
    }
    const result = await runBatchWorkflow(batchArguments.positional[0], photoManagerConfig, {
      dryRun: batchArguments.dryRun,
      analysisOptions: batchArguments.model ? { model: batchArguments.model } : undefined,
    })
    await maybeBuild(result)
    return 0
  }
  if (command === 'edit') {
    const result = await runEditWorkflow(positional.join(' '), photoManagerConfig, { dryRun })
    await maybeBuild(result)
    return 0
  }
  if (command === 'audit') {
    await runAuditWorkflow(photoManagerConfig)
    return 0
  }
  if (command === 'validate') return runValidationCommand(photoManagerConfig)
  if (command === 'generate-responsive') {
    return runResponsiveGeneration(photoManagerConfig)
  }
  console.error(`Unknown photo manager command: ${command}`)
  return 1
}

try {
  process.exitCode = await main()
} catch (error) {
  if (error?.name === 'ExitPromptError' || error?.name === 'AbortError') {
    console.log('\nCancelled. No further files were changed.')
    process.exitCode = 0
  } else {
    console.error(`ERROR\n${error.message}`)
    process.exitCode = 1
  }
}
