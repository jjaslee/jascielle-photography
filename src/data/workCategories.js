import {
  portraitImages,
  eventImages,
  placeImages,
  objectImages,
  spaceImages,
} from './galleries'
import { validateWorkTaxonomy } from './validateWorkTaxonomy'

function byTheme(themes) {
  return placeImages.filter((img) => themes.includes(img.theme))
}

/** Places/Landscape — environment primary; excludes habitat-flagged images. */
function landscapeImages() {
  return placeImages.filter(
    (img) => (img.theme === 'green' || img.theme === 'water') && !img.habitat,
  )
}

/** Wildlife/Habitat — wildlife essential and environment matters. */
function habitatImages() {
  return placeImages.filter((img) => img.habitat === true)
}

/** Wildlife/Animals — animal is primary subject. */
function animalImages() {
  return placeImages.filter((img) => img.theme === 'wildlife' && !img.habitat)
}

/** Work category gallery pages — one config drives the reusable gallery component. */
export const workCategoryPages = {
  people: {
    id: 'people',
    title: 'People',
    previous: null,
    next: { label: 'Places', to: '/work/places' },
    sections: [
      { id: 'portraits', label: 'portraits', images: portraitImages },
      { id: 'events', label: 'events', images: eventImages },
    ],
  },
  places: {
    id: 'places',
    title: 'Places',
    previous: { label: 'People', to: '/work/people' },
    next: { label: 'Wildlife', to: '/work/wildlife' },
    sections: [
      { id: 'street', label: 'street', images: byTheme(['street']) },
      { id: 'landscape', label: 'landscape', images: landscapeImages() },
      { id: 'light', label: 'light', images: byTheme(['night']) },
    ],
  },
  wildlife: {
    id: 'wildlife',
    title: 'Wildlife',
    previous: { label: 'Places', to: '/work/places' },
    next: { label: 'Objects', to: '/work/objects' },
    sections: [
      { id: 'animals', label: 'animals', images: animalImages() },
      { id: 'habitat', label: 'habitat', images: habitatImages() },
    ],
  },
  objects: {
    id: 'objects',
    title: 'Objects',
    previous: { label: 'Wildlife', to: '/work/wildlife' },
    next: { label: 'Spaces', to: '/work/spaces' },
    sections: [
      {
        id: 'product',
        label: 'product',
        images: objectImages.filter((img) => img.section === 'product'),
      },
      {
        id: 'still-life',
        label: 'still life',
        images: objectImages.filter((img) => img.section === 'still-life'),
      },
    ],
  },
  spaces: {
    id: 'spaces',
    title: 'Spaces',
    previous: { label: 'Objects', to: '/work/objects' },
    next: { label: 'About', to: '/about' },
    sections: [
      {
        id: 'real-estate',
        label: 'real estate',
        images: spaceImages.filter((img) => img.section === 'real-estate'),
      },
      {
        id: 'interiors',
        label: 'interiors',
        images: spaceImages.filter((img) => img.section === 'interiors'),
      },
    ],
  },
}

validateWorkTaxonomy(workCategoryPages)

export function getWorkCategoryPage(categoryId) {
  return workCategoryPages[categoryId] ?? null
}
