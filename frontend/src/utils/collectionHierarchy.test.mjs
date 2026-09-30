import test from 'node:test'
import assert from 'node:assert/strict'

import { addImplicitAncestorSteps, buildAddToyPrefill, getUpdatedPathForSelection, groupToysByField, matchesPath, getNextField, resolveDrillGroups, sanitizeDashboardViewState } from './collectionHierarchy.mjs'

test('groups toys by nested fields and preserves drilldown order', () => {
  const toys = [
    { manufacturer: 'Hasbro', toyline: 'Transformers', series: 'Generation 1', sub_series: 'Autobots', year: 1984 },
    { manufacturer: 'Hasbro', toyline: 'Transformers', series: 'Generation 1', sub_series: 'Decepticons', year: 1984 },
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Team', year: 1985 },
    { manufacturer: 'Takara', toyline: 'Transformers', series: 'Masterpiece', sub_series: 'Optimus Prime', year: 2000 }
  ]

  const byToyline = groupToysByField(toys, 'toyline')
  assert.deepEqual(byToyline.map(([label]) => label), ['G.I. Joe', 'Transformers'])

  const matching = toys.filter(toy => matchesPath(toy, [{ field: 'manufacturer', value: 'Hasbro' }, { field: 'toyline', value: 'Transformers' }]))
  assert.equal(matching.length, 2)
  assert.equal(getNextField('toyline'), 'series')
})

test('replaces stale siblings instead of appending them to the old path', () => {
  const path = [{ field: 'toyline', value: 'Star Wars' }]
  const nextPath = getUpdatedPathForSelection(path, 'toyline', 'G.I. Joe')

  assert.deepEqual(nextPath, [{ field: 'toyline', value: 'G.I. Joe' }])
})

test('replaces a same-level sibling while keeping ancestor steps in place', () => {
  const path = [{ field: 'manufacturer', value: 'Hasbro' }, { field: 'toyline', value: 'Star Wars' }]
  const nextPath = getUpdatedPathForSelection(path, 'toyline', 'G.I. Joe')

  assert.deepEqual(nextPath, [{ field: 'manufacturer', value: 'Hasbro' }, { field: 'toyline', value: 'G.I. Joe' }])
})

test('stops at the series level once the toyline is narrowed to a single series', () => {
  const toys = [
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Team', year: 1985 },
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Night Force', year: 1985 },
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Astonishing Adventures', year: 1985 }
  ]

  const drillState = resolveDrillGroups(toys, 'series')

  assert.equal(drillState.field, 'series')
  assert.deepEqual(drillState.groups.map(([label]) => label), ['A Real American Hero'])
})

test('adds the implicit series step when drilling from a toyline into a sub-series list', () => {
  const path = [{ field: 'toyline', value: 'G.I. Joe' }]
  const toys = [
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Team', year: 1985 },
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Night Force', year: 1985 }
  ]

  const nextPath = addImplicitAncestorSteps(path, toys, 'sub_series')
  assert.deepEqual(nextPath, [
    { field: 'toyline', value: 'G.I. Joe' },
    { field: 'series', value: 'A Real American Hero' }
  ])
})

test('stops at the series step even when the series data is blank under a selected toyline', () => {
  const toys = [
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: '', sub_series: 'A Real American Hero', year: 1985 },
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: '', sub_series: 'Night Force', year: 1985 },
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: '', sub_series: 'Astonishing Adventures', year: 1985 }
  ]

  const drillState = resolveDrillGroups(toys, 'series')

  assert.equal(drillState.field, 'series')
  assert.deepEqual(drillState.groups, [])
})

test('adds the implicit series ancestor when a manufacturer-selected toyline has a single series but multiple sub-series', () => {
  const path = [
    { field: 'manufacturer', value: 'Hasbro' },
    { field: 'toyline', value: 'G.I. Joe' }
  ]
  const toys = [
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Team', year: 1985 },
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Night Force', year: 1985 },
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Astonishing Adventures', year: 1985 }
  ]

  const nextPath = addImplicitAncestorSteps(path, toys, 'sub_series')
  assert.deepEqual(nextPath, [
    { field: 'manufacturer', value: 'Hasbro' },
    { field: 'toyline', value: 'G.I. Joe' },
    { field: 'series', value: 'A Real American Hero' }
  ])
})

test('prefills the add-toy form from the current tree path and available common values', () => {
  const path = [
    { field: 'manufacturer', value: 'Hasbro' },
    { field: 'toyline', value: 'Star Wars' },
    { field: 'series', value: 'Empire Strikes Back' },
    { field: 'sub_series', value: 'Wave 1' }
  ]
  const toys = [
    { manufacturer: 'Hasbro', toyline: 'Star Wars', series: 'Empire Strikes Back', sub_series: 'Wave 1', theme: 'Sci-Fi', year: 2024 },
    { manufacturer: 'Hasbro', toyline: 'Star Wars', series: 'Empire Strikes Back', sub_series: 'Wave 1', theme: 'Sci-Fi', year: 2024 }
  ]

  const prefill = buildAddToyPrefill(path, toys)

  assert.deepEqual(prefill, {
    manufacturer: 'Hasbro',
    toyline: 'Star Wars',
    series: 'Empire Strikes Back',
    sub_series: 'Wave 1',
    theme: 'Sci-Fi',
    year: 2024
  })
})

test('adds active dashboard filters to the add-toy prefill', () => {
  const path = [{ field: 'toyline', value: 'G.I. Joe' }]
  const toys = [
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Team', theme: 'Action', year: 1985 },
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Team', theme: 'Action', year: 1985 }
  ]

  const prefill = buildAddToyPrefill(path, toys, [
    { field: 'manufacturer', value: 'Hasbro' },
    { field: 'theme', value: 'Action' },
    { field: 'year', value: '1985' }
  ])

  assert.deepEqual(prefill, {
    manufacturer: 'Hasbro',
    toyline: 'G.I. Joe',
    series: 'A Real American Hero',
    sub_series: 'Team',
    theme: 'Action',
    year: 1985
  })
})

test('uses the shorter drill chains for the dashboard entry points', () => {
  const toys = [
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Team', theme: 'Action', year: 1985 },
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Night Force', theme: 'Action', year: 1985 },
    { manufacturer: 'Takara', toyline: 'Transformers', series: 'Masterpiece', sub_series: 'Optimus Prime', theme: 'Sci-Fi', year: 2000 },
    { manufacturer: 'Hasbro', toyline: 'Transformers', series: 'Generation 1', sub_series: 'Autobots', theme: 'Sci-Fi', year: 1984 }
  ]

  assert.equal(getNextField('toyline'), 'series')
  assert.equal(getNextField('series'), null)

  const manufacturerDrill = resolveDrillGroups(toys, 'manufacturer')
  assert.equal(manufacturerDrill.field, 'manufacturer')
  assert.deepEqual(manufacturerDrill.groups.map(([label]) => label), ['Hasbro', 'Takara'])

  const toylineDrill = resolveDrillGroups(toys, 'toyline')
  assert.equal(toylineDrill.field, 'toyline')
  assert.deepEqual(toylineDrill.groups.map(([label]) => label), ['G.I. Joe', 'Transformers'])

  const yearDrill = resolveDrillGroups(toys, 'year')
  assert.equal(yearDrill.field, 'year')
  assert.deepEqual(yearDrill.groups.map(([label]) => label), ['1984', '1985', '2000'])
})

test('advances directly to the series list when drilling from a toyline', () => {
  const toys = [
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'A Real American Hero', sub_series: 'Team', theme: 'Action', year: 1985 },
    { manufacturer: 'Hasbro', toyline: 'G.I. Joe', series: 'The Mission', sub_series: 'Night Force', theme: 'Action', year: 1985 }
  ]

  const drillState = resolveDrillGroups(toys, 'toyline')
  assert.equal(drillState.field, 'series')
  assert.deepEqual(drillState.groups.map(([label]) => label), ['A Real American Hero', 'The Mission'])
})

test('preserves selectedGroupPath when serializing dashboard state for navigation', () => {
  const state = sanitizeDashboardViewState({
    grouping: 'manufacturer',
    selectedGroup: 'Hasbro',
    selectedGroupPath: [
      { field: 'manufacturer', value: 'Hasbro' },
      { field: 'toyline', value: 'G.I. Joe' },
      { field: 'series', value: 'A Real American Hero' }
    ],
    filterOpen: true,
    filterField: 'theme',
    filterValue: 'Action',
    searchOpen: false,
    searchDraft: 'hero',
    searchField: 'all',
    searchQuery: 'hero',
    appliedFilters: [{ field: 'condition', value: 'Mint' }],
    wishlist: false,
    forSale: false,
    hidden: false
  })

  assert.deepEqual(state.selectedGroupPath, [
    { field: 'manufacturer', value: 'Hasbro' },
    { field: 'toyline', value: 'G.I. Joe' },
    { field: 'series', value: 'A Real American Hero' }
  ])
  assert.equal(state.grouping, 'manufacturer')
  assert.equal(state.searchQuery, 'hero')
})
