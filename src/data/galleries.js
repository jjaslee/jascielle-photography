import portraitImages from './photos/portraits.json'
import eventImages from './photos/events.json'
import placeImages from './photos/places.json'
import objectImages from './photos/objects.json'
import spaceImages from './photos/spaces.json'
import sitePlacements from './photos/sitePlacements.json'

export { portraitImages, eventImages, placeImages, objectImages, spaceImages }

/** Backwards-compatible export used by older consumers. */
export const spaceInteriorImages = spaceImages.filter(
  (photo) => photo.section === 'interiors',
)

const allCatalogPhotos = [
  ...portraitImages,
  ...eventImages,
  ...placeImages,
  ...objectImages,
  ...spaceImages,
]

function altForSource(src, fallback) {
  return allCatalogPhotos.find((photo) => photo.src === src)?.alt ?? fallback
}

/** Shown on the legacy Places page. */
export const placeFilterOptions = [
  { id: 'all', label: 'All' },
  { id: 'night', label: 'Ember' },
  { id: 'street', label: 'Passing' },
  { id: 'water', label: 'Tidal' },
  { id: 'green', label: 'Canopy' },
  { id: 'wildlife', label: 'Wildlife' },
]

export const portfolioCategories = [
  {
    slug: 'portraits',
    title: 'Portraits',
    description: 'Grad and creative sessions',
    cover: sitePlacements.categoryCovers.portraits,
    to: '/portraits',
  },
  {
    slug: 'events',
    title: 'Events',
    description: 'Sports, clubs, and on-the-day coverage',
    cover: sitePlacements.categoryCovers.events,
    to: '/events',
  },
  {
    slug: 'places',
    title: 'Places & light',
    description: 'Street, nature, and editorial work',
    cover: sitePlacements.categoryCovers.places,
    to: '/places',
  },
]

/** Work page category index rows. */
export const homeWorkCategories = [
  {
    id: 'people',
    title: 'People',
    sublabels: ['Portraits', 'Events'],
    destination: '/work/people',
    previewImages: sitePlacements.workPreviews.people,
    archiveLinks: [
      { label: 'Portraits', to: '/portraits' },
      { label: 'Events', to: '/events' },
    ],
  },
  {
    id: 'places',
    title: 'Places',
    sublabels: ['Street', 'Landscape', 'Light'],
    destination: '/work/places',
    previewImages: sitePlacements.workPreviews.places,
    archiveLinks: [{ label: 'Places', to: '/places' }],
  },
  {
    id: 'wildlife',
    title: 'Wildlife',
    sublabels: ['Animals', 'Habitat'],
    destination: '/work/wildlife',
    previewImages: sitePlacements.workPreviews.wildlife,
    archiveLinks: [],
  },
  {
    id: 'objects',
    title: 'Objects',
    sublabels: ['Product', 'Still Life'],
    destination: '/work/objects',
    previewImages: sitePlacements.workPreviews.objects,
    archiveLinks: [],
  },
  {
    id: 'spaces',
    title: 'Spaces',
    sublabels: ['Real Estate', 'Interiors'],
    destination: '/work/spaces',
    previewImages: sitePlacements.workPreviews.spaces,
    archiveLinks: [],
  },
]

/** Homepage Featured row — editorial copy remains deliberately hand-authored. */
export const featuredWork = [
  {
    id: 'people',
    image: sitePlacements.featured.people,
    alt: altForSource(sitePlacements.featured.people, 'Featured people photograph'),
    title: 'People',
    to: '/work/people',
    footerLabel: 'People — Portraits · Events',
  },
  {
    id: 'places',
    image: sitePlacements.featured.places,
    alt: altForSource(sitePlacements.featured.places, 'Featured place photograph'),
    title: 'Places',
    to: '/work/places',
    footerLabel: 'Places — Street · Landscape · Light',
  },
  {
    id: 'wildlife',
    image: sitePlacements.featured.wildlife,
    alt: altForSource(sitePlacements.featured.wildlife, 'Featured wildlife photograph'),
    title: 'Wildlife',
    to: '/work/wildlife',
    footerLabel: 'Wildlife — Animals · Habitat',
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
