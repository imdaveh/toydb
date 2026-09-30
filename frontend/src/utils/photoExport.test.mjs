import test from 'node:test';
import assert from 'node:assert/strict';
import { exportCanvasBlob } from './photoExport.js';

function createCanvasMock(sequence) {
  let index = 0;
  return {
    toBlob(callback, mimeType, quality) {
      const current = sequence[index++];
      if (typeof current === 'function') return callback(current(callback, mimeType, quality));
      return callback(current);
    }
  };
}

test('exportCanvasBlob falls back when webp export is unavailable', async () => {
  const canvas = createCanvasMock([
    () => null,
    (_, mimeType) => ({ type: mimeType, size: 120, toString: () => 'jpeg' })
  ]);

  const blob = await exportCanvasBlob(canvas);
  assert.equal(blob.type, 'image/jpeg');
  assert.equal(blob.size, 120);
});

test('exportCanvasBlob throws when every export format fails', async () => {
  const canvas = createCanvasMock([() => null, () => null, () => null]);

  await assert.rejects(() => exportCanvasBlob(canvas), /Unable to export photo/i);
});
