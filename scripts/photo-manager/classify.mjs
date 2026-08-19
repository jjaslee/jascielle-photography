import { input, select } from '@inquirer/prompts'
import { metadataForClassification } from '../../src/data/photoSchema.js'
import { heading, slugify } from './format.mjs'

const BACK = '__back__'
const CANCEL = '__cancel__'

const screens = {
  major: `WHAT IS PRIMARILY BEING PHOTOGRAPHED?

[1] PEOPLE
    The person or human activity is the subject.
    Choose for a planned/direct portrait or an event/activity—when the image
    is primarily about WHO is pictured or WHAT PEOPLE ARE DOING.
    Do not choose this merely because people appear in a street or landscape.

[2] PLACES
    The environment, location, or atmosphere is the subject.
    Streets, architecture, transit, landscapes, water, night light, or the
    feeling of WHERE dominate. Incidental wildlife may be visible.

[3] WILDLIFE
    Wildlife is essential: an animal is the clear subject, or wildlife within
    its environment is the story. Removing it substantially changes the image.

[4] OBJECTS
    Product photography, still life, or a physical object is the visual subject.

[5] SPACES
    Real estate, interiors, or a designed architectural space is the subject.

TIP: What would someone search for to find this photograph?`,
  people: `PEOPLE — WHAT TYPE OF WORK?

[1] PORTRAITS
    Directed or planned session, graduation, creative portrait, posed or
    semi-posed—the person is the reason the photograph exists.

[2] EVENTS
    Sports, competition, performance, club/community event, or another activity
    where context and what is happening matter more than posing.`,
  portraitMood: `VISUAL MOOD

[1] Bright
    Lighter, sunny, or open tonality.

[2] Moody
    Darker, shadowy, overcast, or blue-hour tonality.`,
  places: `PLACES — WHAT DEFINES THE PHOTOGRAPH?

[1] STREET
    Built environment, transit, storefronts, alleys, cars, signage, or an
    observational/documentary feeling—not primarily nighttime illumination.

[2] LANDSCAPE
    The place itself: coast, forest, garden, mountain, field, harbor, or natural
    scenery. If incidental wildlife disappeared, it would still be this image.

[3] LIGHT
    Night, twilight, blue hour, neon, lamps, or darkness is central; the image
    would lose much of its identity in daylight.`,
  environment: `WHAT MOST DEFINES THE ENVIRONMENT?

[1] LAND / VEGETATION
    Forest, garden, fields, hills, vegetation, or terrain.

[2] WATER / COAST
    Ocean, harbor, river, beach, coastline, boats, or water-dominant scenery.`,
  wildlife: `WILDLIFE — WHAT IS THE PHOTOGRAPH ABOUT?

[1] ANIMALS
    The animal itself is primary: portrait, behavior, species detail, or a
    subject with major visual importance. Environment supports the subject.

[2] HABITAT
    Wildlife AND its environment are essential. Removing the wildlife changes
    the composition or meaning.

TEST: Remove the animal. Still basically the same? Places / Landscape.
Fundamentally different? Wildlife / Habitat.`,
}

function choicesWithBack(choices, canCancel = false) {
  const result = [...choices, { name: '← Back', value: BACK }]
  if (canCancel) result.push({ name: 'Cancel', value: CANCEL })
  return result
}

export function classificationSummary(classification) {
  const mapped = metadataForClassification(classification)
  return { ...mapped, classification }
}

export async function promptClassification() {
  let stage = 'major'
  const history = []
  const state = {}

  const advance = (next) => {
    history.push(stage)
    stage = next
  }
  const goBack = () => {
    stage = history.pop() ?? 'major'
  }

  while (true) {
    if (stage === 'major') {
      heading(screens.major)
      const answer = await select({
        message: 'Primary subject',
        choices: [
          { name: 'PEOPLE', value: 'people' },
          { name: 'PLACES', value: 'places' },
          { name: 'WILDLIFE', value: 'wildlife' },
          { name: 'OBJECTS', value: 'objects' },
          { name: 'SPACES', value: 'spaces' },
          { name: 'Cancel', value: CANCEL },
        ],
      })
      if (answer === CANCEL) return null
      state.major = answer
      advance(
        answer === 'people'
          ? 'people'
          : answer === 'places'
            ? 'places'
            : answer === 'wildlife'
              ? 'wildlife'
              : answer === 'objects'
                ? 'objects'
                : 'spaces',
      )
      continue
    }

    if (stage === 'people') {
      heading(screens.people)
      const answer = await select({
        message: 'People work type',
        choices: choicesWithBack([
          { name: 'PORTRAITS', value: 'portraits' },
          { name: 'EVENTS', value: 'events' },
        ]),
      })
      if (answer === BACK) {
        goBack()
        continue
      }
      state.section = answer
      advance(answer === 'portraits' ? 'portraitSession' : 'eventType')
      continue
    }

    if (stage === 'portraitSession') {
      heading('SESSION TYPE')
      const answer = await select({
        message: 'Session type',
        choices: choicesWithBack([
          { name: 'Graduation', value: 'grad' },
          { name: 'Creative portrait', value: 'creative' },
          { name: 'General portrait', value: 'portrait' },
          { name: 'Other', value: 'custom' },
        ]),
      })
      if (answer === BACK) {
        goBack()
        continue
      }
      if (answer === 'custom') {
        advance('portraitCustom')
      } else {
        state.session = answer
        advance('portraitMood')
      }
      continue
    }

    if (stage === 'portraitCustom' || stage === 'eventCustom') {
      const value = await input({
        message: 'Custom type (type “back” to return)',
        validate: (answer) => answer.trim().length > 0 || 'Enter a value or type back.',
      })
      if (value.trim().toLowerCase() === 'back') {
        goBack()
        continue
      }
      const slug = slugify(value)
      if (!slug) continue
      if (stage === 'portraitCustom') {
        state.session = slug
        advance('portraitMood')
      } else {
        state.category = slug
        return state
      }
      continue
    }

    if (stage === 'portraitMood') {
      heading(screens.portraitMood)
      const answer = await select({
        message: 'Visual mood',
        choices: choicesWithBack([
          { name: 'Bright', value: 'bright' },
          { name: 'Moody', value: 'moody' },
        ]),
      })
      if (answer === BACK) {
        goBack()
        continue
      }
      state.theme = answer
      return state
    }

    if (stage === 'eventType') {
      heading('EVENT TYPE')
      const answer = await select({
        message: 'Event type',
        choices: choicesWithBack([
          { name: 'Sports', value: 'sports' },
          { name: 'Performance', value: 'performance' },
          { name: 'Community / club', value: 'community' },
          { name: 'Other', value: 'custom' },
        ]),
      })
      if (answer === BACK) {
        goBack()
        continue
      }
      if (answer === 'custom') {
        advance('eventCustom')
      } else {
        state.category = answer
        return state
      }
      continue
    }

    if (stage === 'places') {
      heading(screens.places)
      const answer = await select({
        message: 'Places subsection',
        choices: choicesWithBack([
          { name: 'STREET', value: 'street' },
          { name: 'LANDSCAPE', value: 'landscape' },
          { name: 'LIGHT', value: 'light' },
        ]),
      })
      if (answer === BACK) {
        goBack()
        continue
      }
      state.section = answer
      if (answer === 'landscape') advance('landscapeEnvironment')
      else return state
      continue
    }

    if (stage === 'landscapeEnvironment' || stage === 'habitatEnvironment') {
      heading(
        stage === 'landscapeEnvironment'
          ? screens.environment
          : `HABITAT TYPE\n\n${screens.environment}\n\n[3] OTHER\n    Habitat routing remains explicit; no array slicing is used.`,
      )
      const options = [
        { name: 'Land / vegetation', value: 'green' },
        { name: 'Water / coast', value: 'water' },
      ]
      if (stage === 'habitatEnvironment') options.push({ name: 'Other', value: 'other' })
      const answer = await select({
        message: 'Environment',
        choices: choicesWithBack(options),
      })
      if (answer === BACK) {
        goBack()
        continue
      }
      state.environment = answer
      return state
    }

    if (stage === 'wildlife') {
      heading(screens.wildlife)
      const answer = await select({
        message: 'Wildlife subsection',
        choices: choicesWithBack([
          { name: 'ANIMALS', value: 'animals' },
          { name: 'HABITAT', value: 'habitat' },
        ]),
      })
      if (answer === BACK) {
        goBack()
        continue
      }
      state.section = answer
      if (answer === 'habitat') advance('habitatEnvironment')
      else return state
      continue
    }

    if (stage === 'objects' || stage === 'spaces') {
      const objects = stage === 'objects'
      heading(objects ? 'OBJECTS — WHAT TYPE OF WORK?' : 'SPACES — WHAT TYPE OF WORK?')
      const answer = await select({
        message: objects ? 'Objects subsection' : 'Spaces subsection',
        choices: choicesWithBack(
          objects
            ? [
                { name: 'Product', value: 'product' },
                { name: 'Still Life', value: 'still-life' },
              ]
            : [
                { name: 'Real Estate', value: 'real-estate' },
                { name: 'Interiors', value: 'interiors' },
              ],
        ),
      })
      if (answer === BACK) {
        goBack()
        continue
      }
      state.section = answer
      return state
    }
  }
}
