export function toyHasPhoto(toy) {
  return Array.isArray(toy?.photos) && toy.photos.length > 0
}

export function getNextToyWithPhotoInScope(scopeToys = [], currentToyId = null, direction = 1) {
  if (!Array.isArray(scopeToys) || scopeToys.length === 0) {
    return null
  }

  const normalizedDirection = Number(direction) || 0
  const safeStartIndex = scopeToys.findIndex(item => item?.id === currentToyId)
  const startIndex = safeStartIndex >= 0 ? safeStartIndex : 0

  if (normalizedDirection === 0) {
    return toyHasPhoto(scopeToys[startIndex]) ? scopeToys[startIndex] : null
  }

  for (let offset = 1; offset <= scopeToys.length; offset += 1) {
    const candidateIndex = (startIndex + offset * normalizedDirection + scopeToys.length) % scopeToys.length
    const candidate = scopeToys[candidateIndex]
    if (toyHasPhoto(candidate)) {
      return candidate
    }
  }

  return null
}
