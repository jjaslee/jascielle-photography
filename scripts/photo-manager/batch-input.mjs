import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { resolveUserPath } from './paths.mjs'

const execFileAsync = promisify(execFile)
const archiveBufferLimit = 150 * 1024 * 1024

export function isMacArchiveJunk(relativePath) {
  const parts = relativePath.replaceAll('\\', '/').split('/')
  const basename = parts.at(-1) ?? ''
  return parts.includes('__MACOSX') || basename === '.DS_Store' || basename.startsWith('._')
}

export function safeArchivePath(entryName) {
  if (!entryName || /[\0\r\n]/.test(entryName)) {
    throw new Error('ZIP contains an invalid entry name.')
  }
  const portable = entryName.replaceAll('\\', '/')
  if (portable.startsWith('/') || /^[A-Za-z]:/.test(portable)) {
    throw new Error(`Unsafe ZIP entry: ${entryName}`)
  }
  const parts = portable.split('/').filter((part) => part && part !== '.')
  if (parts.includes('..') || parts.some((part) => /[*?[\]]/.test(part))) {
    throw new Error(`Unsafe ZIP entry: ${entryName}`)
  }
  return parts.join('/')
}

function isSupported(filePath, config) {
  return config.supportedExtensions.includes(path.extname(filePath).toLowerCase())
}

async function discoverFolder(rootDir, config, signal) {
  const photoEntries = []
  let ordinaryFiles = 0

  async function visit(currentDir) {
    signal?.throwIfAborted()
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      signal?.throwIfAborted()
      const fullPath = path.join(currentDir, entry.name)
      const relativePath = path.relative(rootDir, fullPath)
      if (isMacArchiveJunk(relativePath)) continue
      if (entry.isDirectory()) await visit(fullPath)
      else if (entry.isFile()) {
        ordinaryFiles += 1
        if (isSupported(fullPath, config)) {
          photoEntries.push({
            sourcePath: fullPath,
            relativePath: relativePath.split(path.sep).join('/'),
          })
        }
      }
    }
  }

  await visit(rootDir)
  if (ordinaryFiles === 0) throw new Error('The input folder is empty.')
  if (photoEntries.length === 0) throw new Error('The input folder contains no supported photos.')
  return photoEntries.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}

async function listArchive(archivePath, signal) {
  try {
    const { stdout } = await execFileAsync('unzip', ['-Z1', archivePath], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      signal,
    })
    return stdout.split(/\r?\n/).filter(Boolean)
  } catch (error) {
    if (error.name === 'AbortError') throw error
    if (error.code === 'ENOENT') {
      throw new Error('ZIP import requires the system “unzip” command.')
    }
    throw new Error(`Cannot read ZIP archive: ${error.stderr?.trim() || error.message}`)
  }
}

async function extractSupportedPhotos(archivePath, destination, config, signal) {
  const listed = await listArchive(archivePath, signal)
  const entries = []
  const seenTargets = new Set()

  for (const entryName of listed) {
    signal?.throwIfAborted()
    const safePath = safeArchivePath(entryName)
    if (!safePath || entryName.endsWith('/') || isMacArchiveJunk(safePath)) continue
    if (!isSupported(safePath, config)) continue
    const targetKey = safePath.toLowerCase()
    if (seenTargets.has(targetKey)) {
      throw new Error(`ZIP contains duplicate output paths: ${safePath}`)
    }
    seenTargets.add(targetKey)
    entries.push({ entryName, safePath })
  }

  if (entries.length === 0) throw new Error('The ZIP archive contains no supported photos.')

  const photoEntries = []
  for (const entry of entries.sort((left, right) => left.safePath.localeCompare(right.safePath))) {
    signal?.throwIfAborted()
    const targetPath = path.resolve(destination, entry.safePath)
    if (!targetPath.startsWith(`${path.resolve(destination)}${path.sep}`)) {
      throw new Error(`Unsafe ZIP entry: ${entry.entryName}`)
    }
    let stdout
    try {
      ;({ stdout } = await execFileAsync('unzip', ['-p', archivePath, entry.entryName], {
        encoding: null,
        maxBuffer: archiveBufferLimit,
        signal,
      }))
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw new Error(`Cannot extract ${entry.entryName}: ${error.stderr?.toString().trim() || error.message}`)
    }
    await mkdir(path.dirname(targetPath), { recursive: true })
    await writeFile(targetPath, stdout)
    photoEntries.push({ sourcePath: targetPath, relativePath: entry.safePath })
  }
  return photoEntries
}

export async function stageBatchInput(sourceArgument, config, options = {}) {
  if (!sourceArgument) {
    throw new Error('Provide a folder or ZIP archive: npm run photo:add-batch -- /path/to/photos')
  }
  const sourcePath = resolveUserPath(sourceArgument, options.pathOptions)
  let sourceStats
  try {
    sourceStats = await stat(sourcePath)
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Batch input does not exist: ${sourcePath}`)
    throw new Error(`Cannot read batch input: ${error.message}`)
  }

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'jascielle-photo-batch-'))
  options.onStagingCreated?.(temporaryRoot)
  const cleanup = () => rm(temporaryRoot, { recursive: true, force: true })

  try {
    if (sourceStats.isDirectory()) {
      const photoEntries = await discoverFolder(sourcePath, config, options.signal)
      return {
        sourcePath,
        sourceType: 'folder',
        temporaryRoot,
        photoEntries,
        photos: photoEntries.map((photo) => photo.sourcePath),
        cleanup,
      }
    }
    if (sourceStats.isFile() && path.extname(sourcePath).toLowerCase() === '.zip') {
      const extractionRoot = path.join(temporaryRoot, 'extracted')
      await mkdir(extractionRoot, { recursive: true })
      const photoEntries = await extractSupportedPhotos(
        sourcePath,
        extractionRoot,
        config,
        options.signal,
      )
      return {
        sourcePath,
        sourceType: 'zip',
        temporaryRoot,
        photoEntries,
        photos: photoEntries.map((photo) => photo.sourcePath),
        cleanup,
      }
    }
    throw new Error('Batch input must be a folder or a .zip archive.')
  } catch (error) {
    await cleanup()
    throw error
  }
}
