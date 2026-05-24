export const portraitImages = [
  { src: '/images/portraits/hero.jpg', alt: 'Portrait session', mood: 'bright' },
  { src: '/images/portraits/IMG_4013.jpg', alt: 'Warm portrait', mood: 'bright' },
  { src: '/images/portraits/IMG_4164.jpg', alt: 'Outdoor portrait', mood: 'bright' },
  { src: '/images/portraits/IMG_4173.jpg', alt: 'Grad-style portrait', mood: 'bright' },
  { src: '/images/portraits/IMG_9437.jpg', alt: 'Moody portrait', mood: 'moody' },
  { src: '/images/portraits/IMG_9424.jpg', alt: 'Low-key portrait', mood: 'moody' },
]

export const eventImages = [
  { src: '/images/events/IMG_9443.jpg', alt: 'Event moment', category: 'sports' },
  { src: '/images/events/IMG_3916.jpg', alt: 'Outdoor event', category: 'sports' },
]

export const placeImages = [
  { src: '/images/places/IMG_8861.jpg', alt: 'Wildlife', category: 'animals' },
  { src: '/images/places/IMG_4109.jpg', alt: 'Nature detail', category: 'nature' },
]

/** Shown on Places page; add images with matching `category` as you grow the gallery. */
export const placeFilterOptions = [
  { id: 'all', label: 'All' },
  { id: 'animals', label: 'Animals' },
  { id: 'nature', label: 'Nature' },
  { id: 'travel', label: 'Travel' },
]

export const portfolioCategories = [
  {
    slug: 'portraits',
    title: 'Portraits',
    description: 'Grad, headshots, and personal sessions',
    cover: '/images/portraits/hero.jpg',
    to: '/portraits',
  },
  {
    slug: 'events',
    title: 'Events',
    description: 'Sports, clubs, and on-the-day coverage',
    cover: '/images/events/IMG_9443.jpg',
    to: '/events',
  },
  {
    slug: 'places',
    title: 'Places & light',
    description: 'Street, nature, and editorial work',
    cover: '/images/places/IMG_8861.jpg',
    to: '/places',
  },
]

export const services = [
  {
    id: 'grad',
    title: 'Grad Portrait',
    price: 140,
    description: 'Senior portraits and small groups. Relaxed direction and edited gallery delivery.',
  },
  {
    id: 'portrait',
    title: 'Portrait / Creative Session',
    price: 100,
    description: 'Individual sessions for creative, professional, or personal use.',
  },
  {
    id: 'event',
    title: 'Event Coverage',
    price: 250,
    description: 'Clubs, sports, and campus events, with candid moments and key highlights.',
  },
]

export const sessionAddons = {
  title: 'Session Add-ons',
  priceLabel: 'Available upon inquiry',
  description:
    'Rush delivery, extra edited images, extended coverage, additional locations, and custom gallery requests.',
}
