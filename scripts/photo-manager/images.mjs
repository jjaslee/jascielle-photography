import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const orientationSwapsAxes = new Set([5, 6, 7, 8])

export function orientedDimensions(metadata) {
  const width = metadata.width
  const height = metadata.height
  if (!width || !height) return { width, height }
  return orientationSwapsAxes.has(metadata.orientation)
    ? { width: height, height: width }
    : { width, height }
}

export function plannedDimensions(width, height, maxLongEdge) {
  const longEdge = Math.max(width, height)
  if (longEdge <= maxLongEdge) return { width, height }
  const scale = maxLongEdge / longEdge
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

export function orientationLabel(width, height) {
  if (width === height) return 'Square'
  return width > height ? 'Landscape' : 'Portrait'
}

export async function inspectImage(sourcePath, config) {
  const extension = path.extname(sourcePath).toLowerCase()
  if (!config.supportedExtensions.includes(extension)) {
    throw new Error(
      `Unsupported input ${extension || '(no extension)'}. Supported: ${config.supportedExtensions.join(', ')}. RAW, CR3, and HEIC are not supported by this tool.`,
    )
  }

  let metadata
  let fileStats
  try {
    ;[metadata, fileStats] = await Promise.all([
      sharp(sourcePath, { failOn: 'error' }).metadata(),
      stat(sourcePath),
    ])
  } catch (error) {
    throw new Error(`Cannot read image: ${error.message}`)
  }

  if (!metadata.width || !metadata.height) {
    throw new Error('The image has no readable intrinsic dimensions.')
  }
  const dimensions = orientedDimensions(metadata)
  return {
    sourcePath,
    filename: path.basename(sourcePath),
    extension,
    format: metadata.format?.toUpperCase() ?? 'UNKNOWN',
    width: dimensions.width,
    height: dimensions.height,
    bytes: fileStats.size,
    orientation: metadata.orientation,
    orientationWillNormalize: Boolean(metadata.orientation && metadata.orientation !== 1),
    hasAlpha: Boolean(metadata.hasAlpha),
    planned: plannedDimensions(dimensions.width, dimensions.height, config.maxLongEdge),
  }
}

export async function optimizeImage(sourcePath, config, options = {}) {
  const inspection = options.inspection ?? (await inspectImage(sourcePath, config))
  if (inspection.hasAlpha && !options.allowFlatten) {
    throw new Error('This image contains transparency. JPEG conversion requires explicit approval to flatten it.')
  }

  let pipeline = sharp(sourcePath, { failOn: 'error' }).autoOrient().toColourspace('srgb')
  if (inspection.hasAlpha) pipeline = pipeline.flatten({ background: options.background ?? '#ffffff' })

  const { data, info } = await pipeline
    .resize({
      width: config.maxLongEdge,
      height: config.maxLongEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: config.jpegQuality,
      progressive: true,
      mozjpeg: true,
    })
    .toBuffer({ resolveWithObject: true })

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    bytes: info.size,
    format: info.format,
  }
}

export async function intrinsicImageInfo(input) {
  const metadata = await sharp(input, { failOn: 'error' }).metadata()
  const dimensions = orientedDimensions(metadata)
  const bytes = Buffer.isBuffer(input) ? input.byteLength : (await stat(input)).size
  return {
    width: dimensions.width,
    height: dimensions.height,
    format: metadata.format,
    bytes,
  }
}

export async function sourceDigest(sourcePath) {
  const { createHash } = await import('node:crypto')
  const data = await readFile(sourcePath)
  return createHash('sha256').update(data).digest('hex')
}
