function movePhotoInOrder(photoIds, photoId, direction) {
  const ids = Array.isArray(photoIds) ? [...photoIds] : [];
  const index = ids.findIndex(id => Number(id) === Number(photoId));

  if (index === -1) return ids;

  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= ids.length) return ids;

  const reordered = [...ids];
  const [movedId] = reordered.splice(index, 1);
  reordered.splice(nextIndex, 0, movedId);
  return reordered;
}

module.exports = { movePhotoInOrder };
