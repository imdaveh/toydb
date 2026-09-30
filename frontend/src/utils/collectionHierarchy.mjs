export const NEXT_FIELD_BY_FIELD = {
  manufacturer: 'toyline',
  toyline: 'series',
  series: null,
  sub_series: null,
  theme: null,
  year: 'manufacturer'
}

export const FIELD_ORDER_BY_ROOT = {
  manufacturer: ['manufacturer', 'toyline', 'series'],
  toyline: ['toyline', 'series'],
  year: ['year', 'manufacturer', 'toyline', 'series']
}

export function normalizeGroupValue(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function getNextField(field) {
  return NEXT_FIELD_BY_FIELD[field] || null
}

export function getRootFieldOrder(field) {
  if (!field || typeof field !== 'string') return []
  return FIELD_ORDER_BY_ROOT[field] || []
}

export function groupToysByField(toys, field) {
  const grouped = new Map()

  for (const toy of toys) {
    const rawValue = field === 'year' ? toy?.year : toy?.[field]
    const key = normalizeGroupValue(rawValue) || 'Uncategorized'

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }

    grouped.get(key).push(toy)
  }

  return [...grouped.entries()].sort(([left], [right]) => {
    if (left === 'Uncategorized') return 1
    if (right === 'Uncategorized') return -1
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
  })
}

export function matchesPath(toy, path = []) {
  return path.every(({ field, value }) => normalizeGroupValue(toy?.[field]) === normalizeGroupValue(value))
}

export function getSelectedToysForPath(toys, path = []) {
  if (!path.length) return toys
  return toys.filter(toy => matchesPath(toy, path))
}

export function getUpdatedPathForSelection(path = [], field, value) {
  const nextStep = { field, value }
  if (!path.length) return [nextStep]

  const sameFieldIndex = [...path].reverse().findIndex(step => step.field === field)
  if (sameFieldIndex !== -1) {
    const replacementIndex = path.length - 1 - sameFieldIndex
    const nextPath = [...path.slice(0, replacementIndex), nextStep]
    return nextPath
  }

  const last = path[path.length - 1]
  if (field === last.field && value === last.value) {
    return path
  }

  if (field === getNextField(last.field)) {
    return [...path, nextStep]
  }

  return [nextStep]
}

export function buildAddToyPrefill(path = [], toys = [], activeFilters = []) {
  const pathValues = {}
  if (Array.isArray(path)) {
    for (const step of path) {
      if (!step || typeof step.field !== 'string') continue
      if (['manufacturer', 'toyline', 'series', 'sub_series', 'year'].includes(step.field)) {
        pathValues[step.field] = step.value
      }
    }
  }

  const filterValues = {}
  for (const filter of Array.isArray(activeFilters) ? activeFilters : []) {
    if (!filter || typeof filter.field !== 'string') continue
    if (!['manufacturer', 'toyline', 'series', 'sub_series', 'theme', 'year'].includes(filter.field)) continue
    const value = filter.value
    if (value === null || value === undefined || String(value).trim() === '') continue
    filterValues[filter.field] = value
  }

  const fallbackFields = ['manufacturer', 'toyline', 'series', 'sub_series', 'theme', 'year']
  const fallbackValues = {}

  for (const field of fallbackFields) {
    if (Object.prototype.hasOwnProperty.call(pathValues, field) || Object.prototype.hasOwnProperty.call(filterValues, field)) continue

    const values = (Array.isArray(toys) ? toys : [])
      .map(toy => toy?.[field])
      .filter(value => value !== null && value !== undefined && String(value).trim() !== '')

    if (!values.length) continue

    const uniqueValues = [...new Set(values.map(value => String(value))) ]
    if (uniqueValues.length === 1) fallbackValues[field] = values[0]
    else if (field === 'theme' && values.length) fallbackValues[field] = values[0]
  }

  const combined = { ...pathValues, ...filterValues, ...fallbackValues }
  const prefill = {}

  for (const [field, value] of Object.entries(combined)) {
    if (value === null || value === undefined || String(value).trim() === '') continue
    prefill[field] = field === 'year' ? Number(value) : String(value)
  }

  return prefill
}

export function sanitizeDashboardViewState(state = {}) {
  const nextState = { ...state }

  nextState.grouping = typeof nextState.grouping === 'string' ? nextState.grouping : 'toyline'
  nextState.selectedGroup = nextState.selectedGroup !== undefined ? nextState.selectedGroup ?? null : null
  nextState.selectedGroupPath = Array.isArray(nextState.selectedGroupPath)
    ? nextState.selectedGroupPath.filter(step => step && typeof step.field === 'string' && typeof step.value !== 'undefined')
    : []
  nextState.filterOpen = Boolean(nextState.filterOpen)
  nextState.filterField = typeof nextState.filterField === 'string' ? nextState.filterField : 'manufacturer'
  nextState.filterValue = typeof nextState.filterValue === 'string' ? nextState.filterValue : ''
  nextState.searchOpen = Boolean(nextState.searchOpen)
  nextState.searchDraft = typeof nextState.searchDraft === 'string' ? nextState.searchDraft : ''
  nextState.searchField = typeof nextState.searchField === 'string' ? nextState.searchField : 'all'
  nextState.searchQuery = typeof nextState.searchQuery === 'string' ? nextState.searchQuery : ''
  nextState.appliedFilters = Array.isArray(nextState.appliedFilters)
    ? nextState.appliedFilters.filter(filter => filter && typeof filter.field === 'string' && typeof filter.value !== 'undefined')
    : []
  nextState.wishlist = Boolean(nextState.wishlist)
  nextState.forSale = Boolean(nextState.forSale)
  nextState.hidden = Boolean(nextState.hidden)

  return nextState
}

export function resolveDrillGroups(toys, startingField) {
  if (!startingField) {
    return { field: null, groups: [], toys }
  }

  let field = startingField
  let drillToys = toys
  let groups = []

  while (field) {
    const currentGroups = groupToysByField(drillToys, field).filter(([label]) => label !== 'Uncategorized')

    if (currentGroups.length > 1) {
      groups = currentGroups
      return { field, groups, toys: drillToys }
    }

    if (currentGroups.length === 1) {
      const nextField = getNextField(field)
      if (!nextField) {
        groups = currentGroups
        return { field, groups, toys: drillToys }
      }

      const nextGroups = groupToysByField(currentGroups[0][1], nextField).filter(([label]) => label !== 'Uncategorized')
      if (nextGroups.length > 1) {
        field = nextField
        drillToys = currentGroups[0][1]
        groups = nextGroups
        return { field, groups, toys: drillToys }
      }

      drillToys = currentGroups[0][1]
      field = nextField
      continue
    }

    const nextField = getNextField(field)
    if (!nextField) break

    const nextGroups = groupToysByField(drillToys, nextField).filter(([label]) => label !== 'Uncategorized')
    if (nextGroups.length > 1) {
      field = nextField
      groups = nextGroups
      return { field, groups, toys: drillToys }
    }

    break
  }

  const finalGroups = field ? groupToysByField(drillToys, field).filter(([label]) => label !== 'Uncategorized') : []
  return { field, groups: finalGroups, toys: drillToys }
}

export function addImplicitAncestorSteps(path = [], toys, targetField) {
  let nextPath = [...path]
  let activeToys = toys
  let currentField = path.length ? getNextField(path[path.length - 1].field) : null

  while (currentField && currentField !== targetField) {
    const groups = groupToysByField(activeToys, currentField).filter(([label]) => label !== 'Uncategorized')
    if (groups.length !== 1) break

    const [singleValue, matchingToys] = groups[0]
    const exists = nextPath.some(step => step.field === currentField && step.value === singleValue)
    if (!exists) {
      nextPath = [...nextPath, { field: currentField, value: singleValue }]
    }

    activeToys = matchingToys
    currentField = getNextField(currentField)
  }

  return nextPath
}
