export const RESPONSIVE_IMAGE_LONG_EDGES = Object.freeze([640, 960, 1400])

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`)
  }
}

export function dimensionsForLongEdge(width, height, longEdge) {
  assertPositiveInteger(width, 'Image width')
  assertPositiveInteger(height, 'Image height')
  assertPositiveInteger(longEdge, 'Responsive long edge')

  const sourceLongEdge = Math.max(width, height)
  if (sourceLongEdge <= longEdge) return { width, height }

  const scale = longEdge / sourceLongEdge
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

export function responsiveVariantSrc(src, longEdge) {
  assertPositiveInteger(longEdge, 'Responsive long edge')
  if (typeof src !== 'string' || !src.startsWith('/images/')) {
    throw new Error('Responsive image sources must use a public /images/ path.')
  }

  const slashIndex = src.lastIndexOf('/')
  const dotIndex = src.lastIndexOf('.')
  if (dotIndex <= slashIndex + 1) {
    throw new Error(`Cannot derive a responsive image path from ${src}.`)
  }

  return `${src.slice(0, slashIndex)}/responsive/${src.slice(
    slashIndex + 1,
    dotIndex,
  )}-${longEdge}.jpg`
}

export function responsiveVariantsForPhoto(
  photo,
  longEdges = RESPONSIVE_IMAGE_LONG_EDGES,
) {
  assertPositiveInteger(photo?.width, 'Image width')
  assertPositiveInteger(photo?.height, 'Image height')
  const sourceLongEdge = Math.max(photo.width, photo.height)

  return longEdges
    .filter((longEdge) => longEdge < sourceLongEdge)
    .map((longEdge) => ({
      longEdge,
      src: responsiveVariantSrc(photo.src, longEdge),
      ...dimensionsForLongEdge(photo.width, photo.height, longEdge),
    }))
}

export function responsiveImageSrcSet(photo) {
  const candidates = [
    ...responsiveVariantsForPhoto(photo),
    { src: photo.src, width: photo.width, height: photo.height },
  ]
    .sort((left, right) => left.width - right.width)
    .filter(
      (candidate, index, all) =>
        index === 0 || candidate.width !== all[index - 1].width,
    )

  return candidates.map((candidate) => `${candidate.src} ${candidate.width}w`).join(', ')
}
