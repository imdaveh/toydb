const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { deleteToyPhotoFiles } = require('./photoCleanup');

test('deleteToyPhotoFiles removes the stored photo and its thumbnail', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toydb-delete-photo-'));
  const sourcePath = path.join(dir, 'photo-123.webp');
  const thumbPath = path.join(dir, 'photo-123-thumb.webp');

  fs.writeFileSync(sourcePath, 'source');
  fs.writeFileSync(thumbPath, 'thumb');

  const deleted = deleteToyPhotoFiles(dir, 'photo-123.webp');

  assert.equal(deleted, 2);
  assert.equal(fs.existsSync(sourcePath), false);
  assert.equal(fs.existsSync(thumbPath), false);
});

test('deleteToyPhotoFiles also removes legacy original extensions for the same photo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toydb-delete-legacy-photo-'));
  const legacySource = path.join(dir, 'photo-456.jpg');
  const thumbnail = path.join(dir, 'photo-456-thumb.webp');

  fs.writeFileSync(legacySource, 'legacy source');
  fs.writeFileSync(thumbnail, 'legacy thumb');

  const deleted = deleteToyPhotoFiles(dir, 'photo-456.webp');

  assert.equal(deleted, 2);
  assert.equal(fs.existsSync(legacySource), false);
  assert.equal(fs.existsSync(thumbnail), false);
});
