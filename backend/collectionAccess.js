function normalizeUserId(value) {
  return Number(value);
}

function isCollectionVisibleToUser(viewer, ownerId, sharedOwnerIds = new Set()) {
  if (!viewer || !ownerId) return false;
  const viewerId = normalizeUserId(viewer.id);
  const targetOwnerId = normalizeUserId(ownerId);
  if (!Number.isFinite(viewerId) || !Number.isFinite(targetOwnerId)) return false;
  if (viewerId === targetOwnerId) return true;
  return sharedOwnerIds.has(targetOwnerId);
}

function buildAccessibleCollections(viewer, users = [], sharedOwnerIds = new Set()) {
  const list = Array.isArray(users) ? users : [];
  const normalizedViewer = viewer ? { ...viewer, id: normalizeUserId(viewer.id) } : null;
  const viewerId = normalizedViewer && Number.isFinite(normalizedViewer.id) ? normalizedViewer.id : null;
  const allowedIds = new Set();
  if (viewerId !== null) allowedIds.add(viewerId);
  for (const ownerId of sharedOwnerIds) {
    const numericOwnerId = normalizeUserId(ownerId);
    if (Number.isFinite(numericOwnerId)) allowedIds.add(numericOwnerId);
  }

  return list
    .filter(user => allowedIds.has(normalizeUserId(user.id)))
    .map(user => ({
      id: normalizeUserId(user.id),
      email: user.email,
      username: user.username || user.email,
      isAdmin: Boolean(user.is_admin)
    }))
    .sort((left, right) => {
      if (viewerId !== null && left.id === viewerId && right.id !== viewerId) return -1;
      if (viewerId !== null && right.id === viewerId && left.id !== viewerId) return 1;
      return String(left.username || left.email).localeCompare(String(right.username || right.email), undefined, { numeric: true });
    });
}

module.exports = { isCollectionVisibleToUser, buildAccessibleCollections };
