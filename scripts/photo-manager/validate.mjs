import { readdir } from 'node:fs/promises'
import path from 'node:path'
import {
  fieldsNeedingReview,
  primaryPlacement,
  validatePhotoRecord,
} from '../../src/data/photoSchema.js'
import {
  allSecondaryReferences,
  flattenCatalogs,
  loadCatalogState,
} from './catalog.mjs'
import { intrinsicImageInfo } from './images.mjs'
import { publicPathForSrc } from './preview.mjs'

function addIssue(target, code, subject, message, extra = {}) {
  target.push({ code, subject, message, ...extra })
}

async function collectManagedFiles(config) {
  const files = []
  for (const folderPath of Object.values(config.managedFolders)) {
    let entries
    try {
      entries = await readdir(folderPath, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue
      if (!config.supportedExtensions.includes(path.extname(entry.name).toLowerCase())) continue
      files.push(path.join(folderPath, entry.name))
    }
  }
  return files
}

export async function validateCatalogState(state, config, options = {}) {
  const errors = []
  const warnings = []
  const entries = flattenCatalogs(state)
  const bySrc = new Map()
  const fileOverrides = options.fileOverrides ?? new Map()
  let placementsShapeValid = true

  for (const entry of entries) {
    const { catalog, photo } = entry
    const subject = photo?.src ?? `${catalog}[${entry.index}]`
    for (const message of validatePhotoRecord(catalog, photo)) {
      addIssue(errors, 'invalid-record', subject, message, { catalog, index: entry.index })
    }
    if (typeof photo?.src === 'string') {
      const matches = bySrc.get(photo.src) ?? []
      matches.push(entry)
      bySrc.set(photo.src, matches)
    }
  }

  for (const [src, matches] of bySrc) {
    if (matches.length > 1) {
      addIssue(
        errors,
        'duplicate-src',
        src,
        `registered ${matches.length} times (${matches.map((entry) => entry.catalog).join(', ')})`,
      )
    }
  }

  const placements = state.placements
  if (!placements || typeof placements !== 'object' || Array.isArray(placements)) {
    addIssue(errors, 'invalid-placements', 'sitePlacements.json', 'must contain a JSON object')
    placementsShapeValid = false
  } else {
    for (const [category, values] of Object.entries(placements.workPreviews ?? {})) {
      if (!Array.isArray(values) || values.some((src) => typeof src !== 'string')) {
        addIssue(errors, 'invalid-placements', `workPreviews.${category}`, 'must be an array of src strings')
        placementsShapeValid = false
      } else if (new Set(values).size !== values.length) {
        addIssue(errors, 'duplicate-secondary-reference', `workPreviews.${category}`, 'contains duplicate src values')
      }
    }
    for (const group of ['categoryCovers', 'featured']) {
      for (const [category, src] of Object.entries(placements[group] ?? {})) {
        if (typeof src !== 'string') {
          addIssue(errors, 'invalid-placements', `${group}.${category}`, 'must be a src string')
          placementsShapeValid = false
        }
      }
    }
  }

  if (options.checkFiles !== false) {
    for (const { catalog, index, photo } of entries) {
      if (typeof photo?.src !== 'string') continue
      let filePath
      try {
        filePath = publicPathForSrc(config, photo.src)
      } catch (error) {
        addIssue(errors, 'unsafe-file-path', photo.src, error.message, { catalog, index })
        continue
      }
      const input = fileOverrides.get(photo.src) ?? filePath
      const extension = path.extname(photo.src).toLowerCase()
      if (!config.supportedExtensions.includes(extension)) {
        addIssue(errors, 'unsupported-file-format', photo.src, `unsupported catalog extension ${extension || '(none)'}`, {
          catalog,
          index,
        })
        continue
      }
      try {
        const info = await intrinsicImageInfo(input)
        const expectedFormats = {
          '.jpg': 'jpeg',
          '.jpeg': 'jpeg',
          '.png': 'png',
          '.webp': 'webp',
        }
        if (expectedFormats[extension] !== info.format) {
          addIssue(
            errors,
            'format-mismatch',
            photo.src,
            `file extension ${extension} does not match intrinsic ${info.format ?? 'unknown'} format`,
            { catalog, index, actual: info },
          )
        }
        if (photo.width !== info.width || photo.height !== info.height) {
          addIssue(
            errors,
            'dimension-mismatch',
            photo.src,
            `catalog says ${photo.width}×${photo.height}; file is ${info.width}×${info.height}`,
            { catalog, index, actual: info },
          )
        }
        if (Math.max(info.width, info.height) > config.maxLongEdge * 1.1) {
          addIssue(
            warnings,
            'oversized-dimensions',
            photo.src,
            `${info.width}×${info.height} exceeds the ${config.maxLongEdge}px target`,
            { catalog, index, actual: info },
          )
        }
        if (info.bytes > config.largeFileWarningBytes) {
          addIssue(
            warnings,
            'large-file',
            photo.src,
            `${info.bytes} bytes exceeds the optimized-file warning threshold`,
            { catalog, index, actual: info },
          )
        }
      } catch (error) {
        const missing =
          error.code === 'ENOENT' || /input file is missing|no such file/i.test(error.message)
        const code = missing ? 'missing-file' : 'unreadable-file'
        addIssue(errors, code, photo.src, missing ? 'catalog file does not exist' : error.message, {
          catalog,
          index,
        })
      }
    }
  }

  const registeredSrcs = new Set(bySrc.keys())
  if (placementsShapeValid) {
    for (const reference of allSecondaryReferences(state.placements)) {
      if (!registeredSrcs.has(reference.src)) {
        addIssue(
          errors,
          'invalid-secondary-reference',
          reference.src,
          `${reference.type} does not point to a managed catalog record`,
        )
      }
    }
  }

  if (options.checkOrphans !== false && options.checkFiles !== false) {
    const managedFiles = await collectManagedFiles(config)
    for (const filePath of managedFiles) {
      const src = `/${path.relative(config.publicDir, filePath).split(path.sep).join('/')}`
      if (!registeredSrcs.has(src)) {
        addIssue(warnings, 'orphan-file', src, 'managed image file is not registered in a catalog')
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      photos: entries.length,
      catalogs: Object.fromEntries(
        Object.entries(state.catalogs).map(([name, photos]) => [name, photos.length]),
      ),
      unreviewedRecommended: entries.reduce(
        (total, { photo }) => total + fieldsNeedingReview(photo).length,
        0,
      ),
      invalidPlacements: entries.filter(({ catalog, photo }) => !primaryPlacement(catalog, photo)).length,
    },
  }
}

export function printValidation(result) {
  if (result.errors.length === 0) {
    console.log(`VALID — ${result.stats.photos} photographs checked`)
  } else {
    for (const issue of result.errors) {
      console.error(`ERROR\n${issue.subject}\n${issue.message}\n`)
    }
    console.error(`INVALID — ${result.errors.length} error(s)`)
  }
  for (const issue of result.warnings) {
    console.warn(`WARNING\n${issue.subject}\n${issue.message}\n`)
  }
}

export async function runValidationCommand(config) {
  try {
    const state = await loadCatalogState(config)
    const result = await validateCatalogState(state, config)
    printValidation(result)
    return result.valid ? 0 : 1
  } catch (error) {
    console.error(`ERROR\nCatalog could not be loaded\n${error.message}`)
    return 1
  }
}
