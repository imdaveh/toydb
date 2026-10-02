import test from 'node:test'
import assert from 'node:assert/strict'

import { getNextToyWithPhotoInScope } from './toyPhotoNavigation.mjs'

test('skips toys without photos when moving forward in scope', () => {
  const scopeToys = [
    { id: 1, name: 'No Photo A', photos: [] },
    { id: 2, name: 'Has Photo', photos: [{ url: '/photo-2.jpg' }] },
    { id: 3, name: 'No Photo B', photos: [] },
    { id: 4, name: 'Also Has Photo', photos: [{ url: '/photo-4.jpg' }] }
  ]

  const nextToy = getNextToyWithPhotoInScope(scopeToys, 1, 1)
  assert.deepEqual(nextToy, scopeToys[1])
})

test('skips toys without photos when moving backward in scope', () => {
  const scopeToys = [
    { id: 1, name: 'Has Photo', photos: [{ url: '/photo-1.jpg' }] },
    { id: 2, name: 'No Photo A', photos: [] },
    { id: 3, name: 'Has Photo Again', photos: [{ url: '/photo-3.jpg' }] },
    { id: 4, name: 'No Photo B', photos: [] }
  ]

  const previousToy = getNextToyWithPhotoInScope(scopeToys, 3, -1)
  assert.deepEqual(previousToy, scopeToys[0])
})

test('returns null when no toys in scope have photos', () => {
  const scopeToys = [
    { id: 1, name: 'No Photo A', photos: [] },
    { id: 2, name: 'No Photo B', photos: [] }
  ]

  const nextToy = getNextToyWithPhotoInScope(scopeToys, 1, 1)
  assert.equal(nextToy, null)
})
