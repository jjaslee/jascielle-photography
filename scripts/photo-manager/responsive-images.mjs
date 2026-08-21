import { access } from 'node:fs/promises'
import sharp from 'sharp'
import {
  responsiveVariantsForPhoto,
} from '../../src/data/responsiveImages.js'
import { intrinsicImageInfo } from './images.mjs'
import { publicPathForSrc } from './preview.mjs'

export async function buildResponsiveVariants(input, photo, config) {
  return Promise.all(
    responsiveVariantsForPhoto(photo, config.responsiveLongEdges).map(
      async (variant) => {
        const { data, info } = await sharp(input, { failOn: 'error' })
          .autoOrient()
          .toColourspace('srgb')
          .resize({
            width: photo.width >= photo.height ? variant.longEdge : undefined,
            height: photo.height > photo.width ? variant.longEdge : undefined,
            withoutEnlargement: true,
            fastShrinkOnLoad: false,
          })
          .jpeg({
            quality: config.jpegQuality,
            progressive: true,
            mozjpeg: true,
          })
          .toBuffer({ resolveWithObject: true })

        if (info.width !== variant.width || info.height !== variant.height) {
          throw new Error(
            `${variant.src} generated at ${info.width}×${info.height}; expected ${variant.width}×${variant.height}.`,
          )
        }

        return {
          ...variant,
          outputPath: publicPathForSrc(config, variant.src),
          buffer: data,
          bytes: info.size,
        }
      },
    ),
  )
}

export function responsiveVariantWrites(variants, options = {}) {
  return variants.map((variant) => ({
    targetPath: variant.outputPath,
    content: variant.buffer,
    mustNotExist: options.mustNotExist ?? true,
  }))
}

function missingFile(error) {
  return (
    error.code === 'ENOENT' ||
    /input file is missing|no such file/i.test(error.message)
  )
}

export async function validateResponsiveVariant(
  variant,
  config,
  fileOverrides = new Map(),
) {
  const filePath = publicPathForSrc(config, variant.src)
  const input = fileOverrides.get(variant.src) ?? filePath

  try {
    const info = await intrinsicImageInfo(input)
    if (info.format !== 'jpeg') {
      return {
        code: 'responsive-format-mismatch',
        subject: variant.src,
        message: `responsive file must be JPEG; found ${info.format ?? 'unknown'}`,
      }
    }
    if (info.width !== variant.width || info.height !== variant.height) {
      return {
        code: 'responsive-dimension-mismatch',
        subject: variant.src,
        message: `expected ${variant.width}×${variant.height}; file is ${info.width}×${info.height}`,
      }
    }
    return null
  } catch (error) {
    return {
      code: missingFile(error) ? 'missing-responsive-variant' : 'unreadable-responsive-variant',
      subject: variant.src,
      message: missingFile(error)
        ? 'expected responsive image variant does not exist'
        : error.message,
    }
  }
}

export async function validateResponsiveVariants(entries, config, options = {}) {
  const fileOverrides = options.fileOverrides ?? new Map()
  const issues = []

  for (const { catalog, index, photo } of entries) {
    if (
      !photo ||
      typeof photo.src !== 'string' ||
      !Number.isInteger(photo.width) ||
      !Number.isInteger(photo.height)
    ) {
      continue
    }
    for (const variant of responsiveVariantsForPhoto(
      photo,
      config.responsiveLongEdges,
    )) {
      const issue = await validateResponsiveVariant(variant, config, fileOverrides)
      if (issue) issues.push({ ...issue, catalog, index })
    }
  }

  return issues
}

export async function responsiveVariantExists(variant, config) {
  try {
    await access(publicPathForSrc(config, variant.src))
    return true
  } catch {
    return false
  }
}
