import { useEffect } from 'react'
import ProtectedImage from './ProtectedImage'
import { protectedGalleryHandlers } from '../utils/imageProtection'

export default function Lightbox({ image, onClose }) {
  useEffect(() => {
    if (!image) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [image, onClose])

  if (!image) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-[fadeIn_400ms_ease-out] gallery-protected"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
      {...protectedGalleryHandlers}
    >
      <figure
        className="flex flex-col items-end w-fit max-w-[80vw] gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="text-sm font-medium tracking-widest uppercase text-white hover:text-white/80 transition-colors shrink-0"
          onClick={onClose}
        >
          Close
        </button>
        <ProtectedImage
          src={image.src}
          alt={image.alt}
          className="block max-h-[80vh] max-w-[80vw] w-auto h-auto object-contain"
        />
      </figure>
    </div>
  )
}
