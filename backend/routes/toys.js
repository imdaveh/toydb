const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const uploadsDir = require('../uploadsPath');

const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per image
  fileFilter: (req, file, callback) => {
    if (!supportedImageTypes.has(file.mimetype)) return callback(new Error('Only JPEG, PNG, and WebP images are allowed'));
    callback(null, true);
  }
});

async function preparePhotos(files) {
  return Promise.all(files.map(async file => {
    try {
      const metadata = await sharp(file.buffer, { limitInputPixels: 100000000 }).metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw new Error('Unsupported image format');
      return {
        buffer: await sharp(file.buffer, { limitInputPixels: 100000000 })
          .rotate()
          .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer(),
        originalName: file.originalname
      };
    } catch (err) {
      throw new Error(`Invalid photo: ${file.originalname}`);
    }
  }));
}

async function savePhotos(toyId, photos) {
  for (const photo of photos) {
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
    await fs.promises.writeFile(path.join(uploadsDir, filename), photo.buffer);
    await pool.query('INSERT INTO toy_photos (toy_id, filename, original_name) VALUES (?, ?, ?)', [toyId, filename, photo.originalName]);
  }
}

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB per CSV
  fileFilter: (req, file, callback) => {
    const okExt = /\.csv$/i.test(file.originalname);
    const okMime = ['text/csv', 'application/vnd.ms-excel', 'application/csv', 'text/plain'].includes(file.mimetype);
    if (!okExt && !okMime) return callback(new Error('Only CSV files are allowed'));
    callback(null, true);
  }
});

const importColumns = ['name', 'manufacturer', 'series', 'sub_series', 'theme', 'toyline', 'year', 'cost', 'value', 'source', 'notes', 'included', 'missing', 'broken', 'condition', 'tags', 'wishlist'];

// Replace a toy's tag assignments with the given list of tag ids.
async function setToyTags(toyId, tagIds) {
  const ids = [...new Set((Array.isArray(tagIds) ? tagIds : []).map(id => parseInt(id, 10)).filter(Number.isInteger))];
  await pool.query('DELETE FROM toy_tags WHERE toy_id = ?', [toyId]);
  if (ids.length) {
    await pool.query('INSERT IGNORE INTO toy_tags (toy_id, tag_id) VALUES ?', [ids.map(tagId => [toyId, tagId])]);
  }
}

// Parse the `tags` field, which arrives as a JSON string (multipart forms) or an array (JSON body).
function parseTagIds(rawTags) {
  if (Array.isArray(rawTags)) return rawTags;
  if (typeof rawTags === 'string' && rawTags.trim()) {
    try { return JSON.parse(rawTags); } catch (err) { return []; }
  }
  return [];
}

async function attachTags(toys) {
  for (const toy of toys) {
    const [tagRows] = await pool.query(
      'SELECT t.id, t.name FROM tags t JOIN toy_tags tt ON tt.tag_id = t.id WHERE tt.toy_id = ? ORDER BY t.name',
      [toy.id]
    );
    toy.tags = tagRows;
  }
}

// Minimal RFC 4180 CSV parser (handles quoted fields, escaped quotes, CRLF/LF).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\r') { /* skip, handled by \n */ }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
}

const suggestionFields = ['manufacturer', 'toyline', 'series', 'sub_series', 'theme', 'source'];

// Return the current user's previous values for form autocomplete.
router.get('/suggestions', authenticate, async (req, res) => {
  try {
    const suggestions = {};
    for (const field of suggestionFields) {
      const [rows] = await pool.query(
        `SELECT DISTINCT ${field} AS value FROM toys WHERE user_id = ? AND ${field} IS NOT NULL AND TRIM(${field}) <> '' ORDER BY ${field} LIMIT 100`,
        [req.user.id]
      );
      suggestions[field] = rows.map(row => row.value);
    }
    res.json({ suggestions });
  } catch (err) {
    console.error('Suggestion query error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create toy
router.post('/', authenticate, upload.array('photos', 8), async (req, res) => {
  const userId = req.user.id;
  const { name, manufacturer, series, sub_series, theme, toyline, year, included, missing, broken, condition, cost, value, source, notes, wishlist, for_sale, tags } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const photos = await preparePhotos(req.files || []);
    const [result] = await pool.query(
      'INSERT INTO toys (user_id, is_wishlist, for_sale, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, included, missing, broken, `condition`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, wishlist === 'true' || wishlist === true, for_sale === 'true' || for_sale === true, name, manufacturer || null, series || null, sub_series || null, theme || null, toyline || null, year ? parseInt(year) : null, cost ? parseFloat(cost) : null, value ? parseFloat(value) : null, source || null, notes || null, included || null, missing || null, broken || null, condition || null]
    );
    const toyId = result.insertId;
    await setToyTags(toyId, parseTagIds(tags));
    await savePhotos(toyId, photos);
    res.json({ ok: true, id: toyId });
  } catch (err) {
    console.error('Insert error', err && err.code);
    res.status(err.message && err.message.startsWith('Invalid photo') ? 400 : 500).json({ error: err.message && err.message.startsWith('Invalid photo') ? err.message : 'Server error' });
  }
});

// Download an empty CSV template for bulk import
router.get('/import/template', authenticate, (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="toydb-import-template.csv"');
  res.send(importColumns.join(',') + '\n');
});

// Bulk import toys from a CSV file
router.post('/import', authenticate, csvUpload.single('file'), async (req, res) => {
  const userId = req.user.id;
  if (!req.file) return res.status(400).json({ error: 'CSV file is required' });

  let rows;
  try {
    const text = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    rows = parseCsv(text);
  } catch (err) {
    return res.status(400).json({ error: 'Unable to parse CSV file' });
  }
  if (!rows.length) return res.status(400).json({ error: 'CSV file is empty' });

  const header = rows[0].map(h => h.trim().toLowerCase());
  const dataRows = rows.slice(1);
  if (dataRows.length > 500) return res.status(400).json({ error: 'CSV files are limited to 500 rows per import' });

  const [allTags] = await pool.query('SELECT id, name FROM tags');
  const tagIdsByName = new Map(allTags.map(t => [t.name.toLowerCase(), t.id]));

  const errors = [];
  let imported = 0;
  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 2; // +1 for header row, +1 for 1-indexing
    const values = dataRows[i];
    if (values.every(v => v.trim() === '')) continue;

    const record = {};
    header.forEach((key, index) => { record[key] = (values[index] || '').trim(); });

    if (!record.name) { errors.push({ row: rowNumber, error: 'Name is required' }); continue; }

    const includedValue = record.included || '';
    const brokenValue = record.broken || '';
    const year = record.year ? parseInt(record.year, 10) : null;
    if (record.year && Number.isNaN(year)) { errors.push({ row: rowNumber, error: 'Year must be a number' }); continue; }
    const cost = record.cost ? parseFloat(record.cost) : null;
    if (record.cost && Number.isNaN(cost)) { errors.push({ row: rowNumber, error: 'Cost must be a number' }); continue; }
    const value = record.value ? parseFloat(record.value) : null;
    if (record.value && Number.isNaN(value)) { errors.push({ row: rowNumber, error: 'Value must be a number' }); continue; }
    const isWishlist = ['true', '1', 'yes'].includes((record.wishlist || '').toLowerCase());

    const requestedTagNames = record.tags ? record.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const tagIds = [];
    const unknownTagNames = [];
    for (const tagName of requestedTagNames) {
      const tagId = tagIdsByName.get(tagName.toLowerCase());
      if (tagId) tagIds.push(tagId); else unknownTagNames.push(tagName);
    }

    try {
      const [result] = await pool.query(
        'INSERT INTO toys (user_id, is_wishlist, for_sale, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, included, missing, broken, `condition`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, isWishlist, false, record.name, record.manufacturer || null, record.series || null, record.sub_series || null, record.theme || null, record.toyline || null, year, cost, value, record.source || null, record.notes || null, includedValue || null, record.missing || null, brokenValue || null, record.condition || null]
      );
      await setToyTags(result.insertId, tagIds);
      if (unknownTagNames.length) errors.push({ row: rowNumber, error: `Imported, but ignored unknown tags: ${unknownTagNames.join(', ')}` });
      imported++;
    } catch (err) {
      console.error('CSV import row error', err);
      errors.push({ row: rowNumber, error: 'Server error saving this row' });
    }
  }

  res.json({ ok: true, imported, errors });
});

// Get distinct values for a field from the user's collection.
router.get('/bulk-values', authenticate, async (req, res) => {
  const allowedFields = new Set(['toyline', 'manufacturer', 'series', 'sub_series', 'theme', 'year', 'condition']);
  const field = req.query.field;
  if (!allowedFields.has(field)) return res.status(400).json({ error: 'Invalid field' });

  try {
    let q = '';
    const params = [req.user.id];

    if (field === 'year') {
      q = 'SELECT DISTINCT `year` AS value FROM toys WHERE user_id = ? AND is_wishlist = 0 AND `year` IS NOT NULL ORDER BY `year`';
    } else if (field === 'condition') {
      q = 'SELECT DISTINCT `condition` AS value FROM toys WHERE user_id = ? AND is_wishlist = 0 AND `condition` IS NOT NULL AND TRIM(`condition`) <> "" ORDER BY `condition`';
    } else {
      q = `SELECT DISTINCT ${field} AS value FROM toys WHERE user_id = ? AND is_wishlist = 0 AND ${field} IS NOT NULL AND TRIM(${field}) <> '' ORDER BY ${field}`;
    }

    const [rows] = await pool.query(q, params);
    res.json({ values: rows.map(row => row.value) });
  } catch (err) {
    console.error('Bulk value lookup error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

function normalizeBulkCriteria(rawCriteria) {
  const criteria = Array.isArray(rawCriteria) ? rawCriteria : [{ field: rawCriteria && rawCriteria.field, value: rawCriteria && rawCriteria.value }];
  return criteria
    .map(item => ({
      field: String(item && item.field).trim(),
      value: item && Object.prototype.hasOwnProperty.call(item, 'value') ? item.value : ''
    }))
    .filter(item => item.field && String(item.value ?? '').trim() !== '');
}

// Bulk delete toys from the user's collection matching one or more field/value rules.
router.post('/bulk-delete', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { criteria, field, value, preview } = req.body || {};
  const allowedFields = new Set(['toyline', 'manufacturer', 'series', 'sub_series', 'theme', 'year', 'condition', 'tag']);

  try {
    const normalizedCriteria = normalizeBulkCriteria(criteria || (field ? [{ field, value }] : []));
    if (!normalizedCriteria.length) return res.status(400).json({ error: 'At least one field/value pair is required' });

    const invalidField = normalizedCriteria.find(item => !allowedFields.has(item.field));
    if (invalidField) return res.status(400).json({ error: `Invalid field: ${invalidField.field}` });

    const whereClauses = [];
    const params = [userId];

    for (const criterion of normalizedCriteria) {
      const fieldName = criterion.field;
      const normalizedValue = String(criterion.value).trim();

      if (fieldName === 'year') {
        const year = Number(normalizedValue);
        if (!Number.isInteger(year)) return res.status(400).json({ error: 'Year must be a whole number' });
        whereClauses.push('t.`year` = ?');
        params.push(year);
        continue;
      }

      if (fieldName === 'tag') {
        whereClauses.push('t.id IN (SELECT tt.toy_id FROM toy_tags tt JOIN tags tag ON tag.id = tt.tag_id WHERE tag.name = ?)');
        params.push(normalizedValue);
        continue;
      }

      whereClauses.push('t.' + fieldName + ' = ?');
      params.push(normalizedValue);
    }

    const matchQuery = `
      SELECT t.id, t.name, t.manufacturer, t.series, t.sub_series, t.theme, t.toyline, t.year AS year_value, t.condition
      FROM toys t
      WHERE t.user_id = ? AND t.is_wishlist = 0 AND ${whereClauses.join(' AND ')}
      ORDER BY t.name ASC
    `;

    const [matchingRows] = await pool.query(matchQuery, params);

    const matches = matchingRows.map(row => ({
      id: row.id,
      name: row.name,
      manufacturer: row.manufacturer,
      series: row.series,
      sub_series: row.sub_series,
      theme: row.theme,
      toyline: row.toyline,
      year: row.year_value,
      condition: row.condition
    }));

    if (preview) {
      return res.json({ ok: true, preview: true, total: matches.length, matches });
    }

    if (!matches.length) return res.json({ ok: true, deleted: 0, preview: false, matches: [] });

    const toyIds = matches.map(row => row.id);
    const [photos] = await pool.query('SELECT filename FROM toy_photos WHERE toy_id IN (?)', [toyIds]);
    for (const photo of photos) {
      const fp = path.join(uploadsDir, photo.filename);
      try { fs.unlinkSync(fp); } catch (e) {}
    }

    await pool.query('DELETE FROM toy_photos WHERE toy_id IN (?)', [toyIds]);
    await pool.query('DELETE FROM toys WHERE id IN (?)', [toyIds]);

    res.json({ ok: true, deleted: toyIds.length, preview: false, matches });
  } catch (err) {
    console.error('Bulk delete error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all toys for user
router.get('/', authenticate, async (req, res) => {
  const userId = req.user.id;
  const wishlist = req.query.wishlist === 'true' ? 1 : 0;
  const forSale = req.query.for_sale === 'true' ? 1 : 0;
  try {
    const query = forSale
      ? 'SELECT id, is_wishlist, for_sale, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, included, missing, broken, `condition`, created_at FROM toys WHERE user_id = ? AND for_sale = ?'
      : 'SELECT id, is_wishlist, for_sale, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, included, missing, broken, `condition`, created_at FROM toys WHERE user_id = ? AND is_wishlist = ?';
    const [toys] = await pool.query(query, [userId, forSale || wishlist]);
    // fetch photos for each toy
    for (const t of toys) {
      const [photos] = await pool.query('SELECT id, filename, original_name FROM toy_photos WHERE toy_id = ?', [t.id]);
      t.photos = photos.map(p => ({ id: p.id, url: `/uploads/${p.filename}`, name: p.original_name }));
    }
    await attachTags(toys);
    res.json({ toys });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single toy
router.get('/:id', authenticate, async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;
  try {
    const [rows] = await pool.query('SELECT id, is_wishlist, for_sale, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, included, missing, broken, `condition`, created_at FROM toys WHERE id = ? AND user_id = ?', [id, userId]);
    if (!rows.length) return res.status(404).json({ error: 'Toy not found' });
    const toy = rows[0];
    const [photos] = await pool.query('SELECT id, filename, original_name FROM toy_photos WHERE toy_id = ?', [toy.id]);
    toy.photos = photos.map(p => ({ id: p.id, url: `/uploads/${p.filename}`, name: p.original_name }));
    await attachTags([toy]);
    res.json({ toy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update toy
router.put('/:id', authenticate, async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;
  const { name, manufacturer, series, sub_series, theme, toyline, year, included, missing, broken, condition, cost, value, source, notes, tags, for_sale } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const [result] = await pool.query('UPDATE toys SET name=?, manufacturer=?, series=?, sub_series=?, theme=?, toyline=?, `year`=?, cost=?, `value`=?, source=?, notes=?, included=?, missing=?, broken=?, `condition`=?, for_sale=? WHERE id=? AND user_id=?', [name, manufacturer || null, series || null, sub_series || null, theme || null, toyline || null, year ? parseInt(year) : null, cost ? parseFloat(cost) : null, value ? parseFloat(value) : null, source || null, notes || null, included || null, missing || null, broken || null, condition || null, for_sale === 'true' || for_sale === true || for_sale === 1 || for_sale === '1', id, userId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Toy not found' });
    await setToyTags(id, parseTagIds(tags));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Move a wishlist toy into the user's collection without changing its details.
router.patch('/:id/move-to-collection', authenticate, async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;
  try {
    const [result] = await pool.query('UPDATE toys SET is_wishlist = 0 WHERE id = ? AND user_id = ? AND is_wishlist = 1', [id, userId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Wishlist toy not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete toy (and its photos)
router.delete('/:id', authenticate, async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;
  try {
    // fetch photos to delete files
    const [photos] = await pool.query('SELECT filename FROM toy_photos WHERE toy_id = ?', [id]);
    for (const p of photos) {
      const fp = path.join(uploadsDir, p.filename);
      try { fs.unlinkSync(fp); } catch (e) {}
    }
    await pool.query('DELETE FROM toys WHERE id = ? AND user_id = ?', [id, userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload photos for an existing toy
router.post('/:id/photos', authenticate, upload.array('photos', 8), async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;
  try {
    const [rows] = await pool.query('SELECT id FROM toys WHERE id = ? AND user_id = ?', [id, userId]);
    if (!rows.length) return res.status(404).json({ error: 'Toy not found' });
    const photos = await preparePhotos(req.files || []);
    await savePhotos(id, photos);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(err.message && err.message.startsWith('Invalid photo') ? 400 : 500).json({ error: err.message && err.message.startsWith('Invalid photo') ? err.message : 'Server error' });
  }
});

// Delete a photo
router.delete('/:toyId/photos/:photoId', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { toyId, photoId } = req.params;
  try {
    const [toyRows] = await pool.query('SELECT id FROM toys WHERE id = ? AND user_id = ?', [toyId, userId]);
    if (!toyRows.length) return res.status(404).json({ error: 'Toy not found' });
    const [rows] = await pool.query('SELECT filename FROM toy_photos WHERE id = ? AND toy_id = ?', [photoId, toyId]);
    if (!rows.length) return res.status(404).json({ error: 'Photo not found' });
    const filename = rows[0].filename;
    await pool.query('DELETE FROM toy_photos WHERE id = ? AND toy_id = ?', [photoId, toyId]);
    const fp = path.join(uploadsDir, filename);
    try { fs.unlinkSync(fp); } catch (e) {}
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
