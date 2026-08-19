import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ProtectedImage from '../ProtectedImage'
import { protectedGalleryHandlers } from '../../utils/imageProtection'

const TRANSITION_MS = 420

export default function WorkImageLightbox({
  image,
  sourceElement,
  scrollElement,
  scrollTop,
  reduced = false,
  onClose,
}) {
  const closeButtonRef = useRef(null)
  const closeTimerRef = useRef(0)
  const closingRef = useRef(false)
  const returnFocusRef = useRef(sourceElement)
  const [closing, setClosing] = useState(false)
  const [imageReady, setImageReady] = useState(false)

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true

    if (reduced) {
      onClose()
      return
    }

    setClosing(true)
    closeTimerRef.current = window.setTimeout(onClose, TRANSITION_MS)
  }, [onClose, reduced])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.workLightboxOpen = ''
    if (scrollElement?.isConnected) scrollElement.scrollTop = scrollTop

    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus())
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
      } else if (event.key === 'Tab') {
        event.preventDefault()
        closeButtonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(focusFrame)
      window.clearTimeout(closeTimerRef.current)
      delete root.dataset.workLightboxOpen
      document.removeEventListener('keydown', onKeyDown)
      if (scrollElement?.isConnected) scrollElement.scrollTop = scrollTop
      if (returnFocusRef.current?.isConnected) {
        returnFocusRef.current.focus({ preventScroll: true })
      }
    }
  }, [requestClose, scrollElement, scrollTop])

  useEffect(() => {
    let active = true
    let settled = false
    const preload = new Image()
    preload.decoding = 'async'

    const reveal = async () => {
      if (settled) return
      settled = true
      try {
        await preload.decode()
      } catch {
        // A completed load can still be displayed if decode() is unavailable.
      }
      if (active) setImageReady(true)
    }

    preload.onload = reveal
    preload.onerror = reveal
    preload.src = image.src
    if (preload.complete) reveal()

    return () => {
      active = false
      preload.onload = null
      preload.onerror = null
    }
  }, [image.src])

  const hasCaption = Boolean(image.location || image.year)

  return createPortal(
    <div
      className={`work-image-lightbox gallery-protected${
        imageReady ? ' is-image-ready' : ''
      }${closing ? ' is-closing' : ''}${reduced ? ' is-reduced-motion' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Photograph inspection: ${image.alt}`}
      aria-busy={!imageReady}
      onClick={requestClose}
      onWheel={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onTouchMove={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      {...protectedGalleryHandlers}
    >
      <div className="work-image-lightbox__backdrop" aria-hidden="true" />

      <div className="work-image-lightbox__stage">
        <div className="work-image-lightbox__figure">
          <div
            className="work-image-lightbox__frame"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              className="work-image-lightbox__close"
              aria-label="Close photograph inspection"
              onClick={requestClose}
            >
              <span className="work-image-lightbox__close-icon" aria-hidden="true" />
            </button>

            <ProtectedImage
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              draggable={false}
              className="work-image-lightbox__image"
              onLoad={() => setImageReady(true)}
            />
          </div>

          {hasCaption && (
            <p
              className="work-image-lightbox__caption"
              onClick={(event) => event.stopPropagation()}
            >
              {image.location && (
                <span className="work-image-lightbox__caption-location">
                  {image.location}
                </span>
              )}
              {image.year && (
                <span className="work-image-lightbox__caption-year">{image.year}</span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
