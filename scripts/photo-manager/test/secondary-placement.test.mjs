import test from 'node:test'
import assert from 'node:assert/strict'
import { applyOptionalPlacements } from '../catalog.mjs'
import {
  BACK,
  NO_SECONDARY_PLACEMENT,
  resolveOptionalPlacementSelection,
  validateOptionalPlacementSelection,
} from '../prompts.mjs'
import { emptyPlacements, validPhoto } from './helpers.mjs'

function placementFixture() {
  return {
    catalogs: {},
    placements: {
      ...emptyPlacements(),
      categoryCovers: { places: '/images/places/current-cover.jpg' },
      featured: { places: '/images/places/current-featured.jpg' },
    },
  }
}

const photo = validPhoto({ src: '/images/places/new-photo.jpg' })

test('explicit No secondary placement produces no secondary mutations', () => {
  const state = placementFixture()
  const before = structuredClone(state.placements)
  const selections = resolveOptionalPlacementSelection([NO_SECONDARY_PLACEMENT])
  applyOptionalPlacements(state, 'places', photo, selections)
  assert.deepEqual(state.placements, before)
})

test('empty selection continues to produce no secondary mutations', () => {
  const state = placementFixture()
  const before = structuredClone(state.placements)
  applyOptionalPlacements(state, 'places', photo, resolveOptionalPlacementSelection([]))
  assert.deepEqual(state.placements, before)
})

test('one real secondary placement still works', () => {
  const state = placementFixture()
  applyOptionalPlacements(
    state,
    'places',
    photo,
    resolveOptionalPlacementSelection(['preview']),
  )
  assert.deepEqual(state.placements.workPreviews.places, [photo.src])
})

test('multiple real secondary placements still work', () => {
  const state = placementFixture()
  applyOptionalPlacements(
    state,
    'places',
    photo,
    resolveOptionalPlacementSelection(['preview', 'featured', 'cover']),
  )
  assert.deepEqual(state.placements.workPreviews.places, [photo.src])
  assert.equal(state.placements.featured.places, photo.src)
  assert.equal(state.placements.categoryCovers.places, photo.src)
})

test('No secondary placement combined with a real placement is rejected', () => {
  assert.equal(
    validateOptionalPlacementSelection([
      { value: NO_SECONDARY_PLACEMENT },
      { value: 'preview' },
    ]),
    'Choose either "No secondary placement" or one or more placements.',
  )
})

test('Back retains its existing result', () => {
  assert.equal(resolveOptionalPlacementSelection([BACK]), BACK)
})
