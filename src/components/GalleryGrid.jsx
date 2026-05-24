import { useEffect, useState } from 'react'
import Lightbox from './Lightbox'
import ProtectedImage from './ProtectedImage'
import { protectedGalleryHandlers } from '../utils/imageProtection'
import { buildGalleryCells, fallbackGalleryCells } from '../utils/galleryLayout'

function GalleryTile({ image, className = '', onOpen }) {
  return (
    <button
      type="button"
      className={`group block w-full min-h-0 overflow-hidden text-left ${className}`}
      onClick={() => onOpen(image)}
    >
      <ProtectedImage
        src={image.src}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-opacity duration-500 ease-elegant group-hover:opacity-90"
      />
    </button>
  )
}

function GalleryCell({ cell, onOpen }) {
  if (cell.type === 'pair') {
    return (
      <div className="gallery-cell-pair">
        {cell.images.map((image) => (
          <GalleryTile
            key={image.src}
            image={image}
            className="flex-1"
            onOpen={onOpen}
          />
        ))}
      </div>
    )
  }

  const image = cell.images[0]
  return (
    <GalleryTile
      image={image}
      className="aspect-[3/4] [content-visibility:auto]"
      onOpen={onOpen}
    />
  )
}

export default function GalleryGrid({ images }) {
  const [lightbox, setLightbox] = useState(null)
  const [cells, setCells] = useState(() => fallbackGalleryCells(images))

  useEffect(() => {
    let active = true
    setCells(fallbackGalleryCells(images))

    buildGalleryCells(images).then((layout) => {
      if (active) setCells(layout)
    })

    return () => {
      active = false
    }
  }, [images])

  return (
    <>
      <div className="gallery-grid" {...protectedGalleryHandlers}>
        {cells.map((cell) => (
          <GalleryCell
            key={cell.images.map((img) => img.src).join('|')}
            cell={cell}
            onOpen={setLightbox}
          />
        ))}
      </div>
      <Lightbox image={lightbox} onClose={() => setLightbox(null)} />
    </>
  )
}
