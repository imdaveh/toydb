const test = require('node:test');
const assert = require('node:assert/strict');
const { isCollectionVisibleToUser, buildAccessibleCollections } = require('./collectionAccess');

test('owners can always view their own collection', () => {
  assert.equal(isCollectionVisibleToUser({ id: 1 }, 1, new Set()), true);
});

test('shared owners are visible to permitted viewers', () => {
  assert.equal(isCollectionVisibleToUser({ id: 2 }, 1, new Set([1])), true);
});

test('unshared owners remain hidden from other users', () => {
  assert.equal(isCollectionVisibleToUser({ id: 3 }, 1, new Set([2])), false);
});

test('buildAccessibleCollections includes the current user and any shared owners', () => {
  const result = buildAccessibleCollections({ id: 1 }, [
    { id: 1, username: 'me' },
    { id: 2, username: 'alice' },
    { id: 3, username: 'bob' }
  ], new Set([2]));

  assert.deepEqual(result.map(item => item.id), [1, 2]);
});
