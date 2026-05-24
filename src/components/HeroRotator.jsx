import { useEffect, useState } from 'react'
import ProtectedImage from './ProtectedImage'

const INTERVAL_MS = 5500

export default function HeroRotator({ images }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (images.length <= 1) return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (media.matches) return

    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % images.length)
    }, INTERVAL_MS)

    return () => window.clearInterval(id)
  }, [images.length])

  if (!images.length) return null

  return (
    <div className="relative h-full w-full" aria-live="polite">
      {images.map((img, i) => (
        <ProtectedImage
          key={img.src}
          src={img.src}
          alt={img.alt}
          loading={i === 0 ? 'eager' : 'lazy'}
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-slower ease-elegant ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </div>
  )
}
