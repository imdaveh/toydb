const test = require('node:test');
const assert = require('node:assert/strict');
const { movePhotoInOrder } = require('./photoOrder');

test('movePhotoInOrder moves a photo up in the list', () => {
  assert.deepEqual(movePhotoInOrder([1, 2, 3, 4], 3, 'up'), [1, 3, 2, 4]);
});

test('movePhotoInOrder moves a photo down in the list', () => {
  assert.deepEqual(movePhotoInOrder([1, 2, 3, 4], 2, 'down'), [1, 3, 2, 4]);
});

test('movePhotoInOrder keeps an already-first item stable', () => {
  assert.deepEqual(movePhotoInOrder([1, 2, 3], 1, 'up'), [1, 2, 3]);
});
