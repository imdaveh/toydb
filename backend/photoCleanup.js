const fs = require('node:fs');
const path = require('node:path');

const legacyExtensions = ['.webp', '.jpg', '.jpeg', '.png', '.gif', '.bmp'];

function getPhotoCandidatePaths(baseDir, filename) {
  const cleanName = typeof filename === 'string' ? path.basename(filename) : '';
  if (!cleanName) return [];

  const withoutExtension = cleanName.replace(/\.[^.]+$/, '');
  const exactPaths = new Set();
  const candidates = [cleanName, `${withoutExtension}-thumb.webp`];

  for (const extension of legacyExtensions) {
    candidates.push(`${withoutExtension}${extension}`);
    candidates.push(`${withoutExtension}-thumb${extension}`);
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    exactPaths.add(path.join(baseDir, candidate));
  }

  return [...exactPaths];
}

function deleteToyPhotoFiles(baseDir, filename) {
  let deleted = 0;
  for (const candidatePath of getPhotoCandidatePaths(baseDir, filename)) {
    try {
      if (!fs.existsSync(candidatePath)) continue;
      fs.unlinkSync(candidatePath);
      deleted += 1;
    } catch (error) {
      // ignore missing or locked temp files; the DB record is still cleared above
    }
  }
  return deleted;
}

module.exports = { deleteToyPhotoFiles };
