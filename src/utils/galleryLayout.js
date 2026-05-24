const LANDSCAPE_RATIO = 1.05

function loadImageMeta(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = src
  })
}

function packLandscapePairs(items) {
  const cells = []
  let pending = null

  for (const item of items) {
    if (item.landscape) {
      if (pending) {
        cells.push({ type: 'pair', images: [pending, item] })
        pending = null
      } else {
        pending = item
      }
      continue
    }

    if (pending) {
      cells.push({ type: 'single', images: [pending] })
      pending = null
    }
    cells.push({ type: 'single', images: [item] })
  }

  if (pending) {
    cells.push({ type: 'single', images: [pending] })
  }

  return cells
}

export async function buildGalleryCells(images) {
  const sized = await Promise.all(
    images.map(async (image) => {
      try {
        const { width, height } = await loadImageMeta(image.src)
        return {
          ...image,
          width,
          height,
          landscape: width / height >= LANDSCAPE_RATIO,
        }
      } catch {
        return { ...image, width: 3, height: 4, landscape: false }
      }
    }),
  )

  return packLandscapePairs(sized)
}

export function fallbackGalleryCells(images) {
  return images.map((image) => ({ type: 'single', images: [image] }))
}
