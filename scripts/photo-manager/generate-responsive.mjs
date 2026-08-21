import { stat } from 'node:fs/promises'
import { flattenCatalogs, loadCatalogState } from './catalog.mjs'
import { formatBytes, heading } from './format.mjs'
import {
  buildResponsiveVariants,
  responsiveVariantExists,
  responsiveVariantWrites,
  validateResponsiveVariant,
} from './responsive-images.mjs'
import { commitFiles } from './transaction.mjs'
import { printValidation, validateCatalogState } from './validate.mjs'
import { publicPathForSrc } from './preview.mjs'
import { responsiveVariantsForPhoto } from '../../src/data/responsiveImages.js'

export async function runResponsiveGeneration(config) {
  const state = await loadCatalogState(config)
  const sourceValidation = await validateCatalogState(state, config, {
    checkResponsive: false,
  })
  if (!sourceValidation.valid) {
    printValidation(sourceValidation)
    return 1
  }

  heading('GENERATE RESPONSIVE WORK IMAGES')
  let generated = 0
  let rebuilt = 0
  let skipped = 0
  let outputBytes = 0

  for (const { photo } of flattenCatalogs(state)) {
    const expected = responsiveVariantsForPhoto(
      photo,
      config.responsiveLongEdges,
    )
    const pending = []

    for (const variant of expected) {
      const existed = await responsiveVariantExists(variant, config)
      const issue = existed
        ? await validateResponsiveVariant(variant, config)
        : { code: 'missing-responsive-variant' }
      if (!issue) {
        skipped += 1
        outputBytes += (await stat(publicPathForSrc(config, variant.src))).size
      } else {
        pending.push({ ...variant, existed })
      }
    }

    if (!pending.length) continue
    const outputs = await buildResponsiveVariants(
      publicPathForSrc(config, photo.src),
      photo,
      config,
    )
    const selected = outputs.filter((output) =>
      pending.some((variant) => variant.src === output.src),
    )
    await commitFiles(
      responsiveVariantWrites(selected, { mustNotExist: false }),
    )
    for (const output of selected) {
      const prior = pending.find((variant) => variant.src === output.src)
      if (prior.existed) rebuilt += 1
      else generated += 1
      outputBytes += output.bytes
    }
  }

  const finalValidation = await validateCatalogState(state, config)
  printValidation(finalValidation)
  if (!finalValidation.valid) return 1

  console.log(
    `${generated} generated, ${rebuilt} rebuilt, ${skipped} already valid`,
  )
  console.log(`${formatBytes(outputBytes)} responsive output`)
  console.log('Existing full-size catalog images were not modified.')
  return 0
}
