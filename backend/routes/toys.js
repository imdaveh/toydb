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

async function ensureToyPhotoSortOrderColumn() {
  try {
    const [rows] = await pool.query('SHOW COLUMNS FROM toy_photos LIKE ?', ['sort_order']);
    if (rows.length) return;
    await pool.query('ALTER TABLE toy_photos ADD COLUMN sort_order INT UNSIGNED NOT NULL DEFAULT 0 AFTER original_name');
    await pool.query('UPDATE toy_photos SET sort_order = id WHERE sort_order = 0');
  } catch (error) {
    console.error('Failed to ensure toy_photos.sort_order exists:', error.message);
  }
}

ensureToyPhotoSortOrderColumn().catch(error => {
  console.error('Photo sort-order setup failed:', error.message);
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per image
  fileFilter: (req, file, callback) => {
    if (!supportedImageTypes.has(file.mimetype)) return callback(new Error('Only JPEG, PNG, and WebP images are allowed'));
    callback(null, true);
  }
});

async function createThumbnailFromBuffer(buffer, targetPath) {
  await sharp(buffer, { limitInputPixels: 100000000 })
    .rotate()
    .resize(240, 240, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(targetPath);
}

async function generateThumbnailIfMissing(filename) {
  const sourcePath = path.join(uploadsDir, filename);
  const thumbFilename = filename.replace(/(\.[^.]+)$/, '-thumb.webp');
  const thumbPath = path.join(uploadsDir, thumbFilename);

  try {
    await fs.promises.access(thumbPath);
    return `/uploads/${thumbFilename}`;
  } catch (error) {}

  try {
    const source = await fs.promises.readFile(sourcePath);
    await createThumbnailFromBuffer(source, thumbPath);
    return `/uploads/${thumbFilename}`;
  } catch (error) {
    console.warn('Failed to generate thumbnail for', filename, error.message);
    return `/uploads/${filename}`;
  }
}

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
    const sourcePath = path.join(uploadsDir, filename);
    const thumbFilename = filename.replace(/(\.[^.]+)$/, '-thumb.webp');
    const thumbPath = path.join(uploadsDir, thumbFilename);
    const [maxRows] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM toy_photos WHERE toy_id = ?', [toyId]);
    const sortOrder = Number(maxRows[0]?.max_sort || 0) + 1;

    await fs.promises.writeFile(sourcePath, photo.buffer);
    await createThumbnailFromBuffer(photo.buffer, thumbPath);
    await pool.query('INSERT INTO toy_photos (toy_id, filename, original_name, sort_order) VALUES (?, ?, ?, ?)', [toyId, filename, photo.originalName, sortOrder]);
  }
}

function sortToyCollection(rows) {
  return [...rows].sort((left, right) => {
    const yearLeft = left?.year === null || left?.year === undefined || left?.year === '' ? Number.MAX_SAFE_INTEGER : Number(left.year);
    const yearRight = right?.year === null || right?.year === undefined || right?.year === '' ? Number.MAX_SAFE_INTEGER : Number(right.year);
    if (yearLeft !== yearRight) return yearLeft - yearRight;

    const seriesLeft = String(left?.series ?? '').trim().toLowerCase();
    const seriesRight = String(right?.series ?? '').trim().toLowerCase();
    if (seriesLeft !== seriesRight) return seriesLeft.localeCompare(seriesRight);

    const subSeriesLeft = String(left?.sub_series ?? '').trim().toLowerCase();
    const subSeriesRight = String(right?.sub_series ?? '').trim().toLowerCase();
    if (subSeriesLeft !== subSeriesRight) return subSeriesLeft.localeCompare(subSeriesRight);

    const themeLeft = String(left?.theme ?? '').trim().toLowerCase();
    const themeRight = String(right?.theme ?? '').trim().toLowerCase();
    if (themeLeft !== themeRight) return themeLeft.localeCompare(themeRight);

    const nameLeft = String(left?.name ?? '').trim().toLowerCase();
    const nameRight = String(right?.name ?? '').trim().toLowerCase();
    if (nameLeft !== nameRight) return nameLeft.localeCompare(nameRight);

    return (Number(left?.copy ?? 1) || 1) - (Number(right?.copy ?? 1) || 1);
  });
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

const importColumns = ['id', 'copy', 'name', 'manufacturer', 'series', 'sub_series', 'theme', 'toyline', 'year', 'cost', 'value', 'source', 'notes', 'condition', 'tags', 'accessories', 'owned_accessories', 'wishlist', 'for_sale', 'hidden'];

function normalizeCsvText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildToyNaturalKey(record = {}) {
  return [
    normalizeCsvText(record.name),
    normalizeCsvText(record.manufacturer),
    normalizeCsvText(record.toyline),
    normalizeCsvText(record.series),
    normalizeCsvText(record.sub_series),
    normalizeCsvText(record.theme),
    normalizeCsvText(record.year)
  ].join('||');
}

function parseCopyValue(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return 1;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function setToyAccessories(toyId, accessories) {
  const cleaned = [];
  const seen = new Set();

  for (const entry of Array.isArray(accessories) ? accessories : []) {
    const accessoryName = typeof entry === 'string' ? entry : (entry && entry.name);
    const hasAccessory = typeof entry === 'string'
      ? false
      : Boolean(entry && entry.has_accessory !== undefined ? entry.has_accessory : entry && entry.hasAccessory);
    const name = String(accessoryName || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({ name, has_accessory: hasAccessory });
  }

  await pool.query('DELETE FROM toy_accessories WHERE toy_id = ?', [toyId]);
  if (!cleaned.length) return;
  await pool.query('INSERT INTO toy_accessories (toy_id, name, has_accessory) VALUES ?', [cleaned.map(accessory => [toyId, accessory.name, accessory.has_accessory ? 1 : 0])]);
}

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

function parseAccessoryEntries(rawAccessories) {
  if (Array.isArray(rawAccessories)) return rawAccessories;
  if (typeof rawAccessories === 'string' && rawAccessories.trim()) {
    try {
      const parsed = JSON.parse(rawAccessories);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {}
    return rawAccessories.split(/[,|\n;]/).map(item => ({ name: item.trim(), has_accessory: false })).filter(item => item.name);
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

async function attachAccessories(toys) {
  for (const toy of toys) {
    const [accessoryRows] = await pool.query(
      'SELECT id, name, has_accessory FROM toy_accessories WHERE toy_id = ? ORDER BY name ASC',
      [toy.id]
    );
    toy.accessories = accessoryRows.map(row => ({
      id: row.id,
      name: row.name,
      has_accessory: Boolean(row.has_accessory)
    }));
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

// Return the current user's previous values for form autocomplete, filtered by the active form context.
router.get('/suggestions', authenticate, async (req, res) => {
  try {
    const context = {
      manufacturer: req.query.manufacturer || '',
      toyline: req.query.toyline || '',
      series: req.query.series || '',
      sub_series: req.query.sub_series || '',
      theme: req.query.theme || '',
      year: req.query.year || ''
    };

    const suggestions = {};
    for (const field of suggestionFields) {
      const filters = ['user_id = ?'];
      const params = [req.user.id];

      for (const [key, value] of Object.entries(context)) {
        if (!value || !String(value).trim()) continue;
        if (key === field) continue;

        if (key === 'year') {
          filters.push('`year` = ?');
          params.push(Number.parseInt(String(value), 10));
          continue;
        }

        filters.push(`${key} = ?`);
        params.push(value);
      }

      const [rows] = await pool.query(
        `SELECT DISTINCT ${field} AS value FROM toys WHERE ${filters.join(' AND ')} AND ${field} IS NOT NULL AND TRIM(${field}) <> '' ORDER BY ${field} LIMIT 100`,
        params
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
  const { name, manufacturer, series, sub_series, theme, toyline, year, condition, cost, value, source, notes, wishlist, for_sale, hidden, tags, accessories, copy } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const parsedCopy = copy === undefined || copy === null || copy === '' ? 1 : Number(copy);
  if (!Number.isInteger(parsedCopy) || parsedCopy < 1) return res.status(400).json({ error: 'Copy must be a positive whole number' });
  try {
    const photos = await preparePhotos(req.files || []);
    const [result] = await pool.query(
      'INSERT INTO toys (user_id, copy, is_wishlist, for_sale, hidden, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, `condition`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, parsedCopy, wishlist === 'true' || wishlist === true, for_sale === 'true' || for_sale === true, hidden === 'true' || hidden === true, name, manufacturer || null, series || null, sub_series || null, theme || null, toyline || null, year ? parseInt(year) : null, cost ? parseFloat(cost) : null, value ? parseFloat(value) : null, source || null, notes || null, condition || null]
    );
    const toyId = result.insertId;
    await setToyTags(toyId, parseTagIds(tags));
    await setToyAccessories(toyId, parseAccessoryEntries(accessories));
    await savePhotos(toyId, photos);
    res.json({ ok: true, id: toyId });
  } catch (err) {
    console.error('Insert error', err && err.code);
    res.status(err.message && err.message.startsWith('Invalid photo') ? 400 : 500).json({ error: err.message && err.message.startsWith('Invalid photo') ? err.message : 'Server error' });
  }
});

// Download a CSV template with sample data for bulk import
router.get('/import/template', authenticate, (req, res) => {
  const sampleRows = [
    ['1', '1', 'Millennium Falcon', 'LEGO', 'Star Wars', '', 'Space', 'Millennium Falcon', '2000', '89.99', '129.99', 'Local shop', 'Includes box and instructions', 'Excellent', 'Star Wars,Space', 'Han Solo minifigure|Seat', 'Han Solo minifigure', 'false', 'false', 'false'],
    ['2', '1', 'Transformers Optimus Prime', 'Hasbro', 'Transformers', 'Generations', 'Autobots', 'Prime', '2022', '24.99', '42.50', 'Online auction', 'New in box', 'Like New', 'Robot,Action Figure', 'Blaster accessory', 'Blaster accessory', 'false', 'true', 'false']
  ];

  const csv = [
    importColumns,
    ...sampleRows
  ].map(row => row.map(escapeCsvCell).join(',')).join('\n') + '\n';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="toydb-import-template.csv"');
  res.send(csv);
});

// Export the user's collection to CSV.
router.get('/export/csv', authenticate, async (req, res) => {
  const userId = req.user.id;
  const criteria = req.query.criteria ? JSON.parse(req.query.criteria) : (req.body && req.body.criteria ? req.body.criteria : []);

  try {
    const allowedFields = new Set(['toyline', 'manufacturer', 'series', 'sub_series', 'theme', 'year', 'condition']);
    const normalizedCriteria = normalizeBulkCriteria(criteria);
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

      whereClauses.push('t.' + fieldName + ' = ?');
      params.push(normalizedValue);
    }

    const baseWhere = 't.user_id = ? AND t.is_wishlist = 0 AND t.hidden = 0';
    const filterWhere = whereClauses.length ? ' AND ' + whereClauses.join(' AND ') : '';

    const [rows] = await pool.query(
      `SELECT t.id, t.copy, t.name, t.manufacturer, t.series, t.sub_series, t.theme, t.toyline, t.year AS year_value, t.cost, t.value, t.source, t.notes, t.condition, t.is_wishlist, t.for_sale, t.hidden,
        GROUP_CONCAT(DISTINCT tags.name ORDER BY tags.name SEPARATOR '|') AS tags,
        GROUP_CONCAT(DISTINCT CASE WHEN toy_accessories.has_accessory = 1 THEN toy_accessories.name ELSE NULL END ORDER BY toy_accessories.name SEPARATOR '|') AS owned_accessories,
        GROUP_CONCAT(DISTINCT CASE WHEN toy_accessories.has_accessory = 0 THEN toy_accessories.name ELSE NULL END ORDER BY toy_accessories.name SEPARATOR '|') AS accessories
       FROM toys t
       LEFT JOIN toy_tags tt ON tt.toy_id = t.id
       LEFT JOIN tags ON tags.id = tt.tag_id
       LEFT JOIN toy_accessories ON toy_accessories.toy_id = t.id
       WHERE ${baseWhere}${filterWhere}
       GROUP BY t.id, t.copy, t.name, t.manufacturer, t.series, t.sub_series, t.theme, t.toyline, t.year, t.cost, t.value, t.source, t.notes, t.condition, t.is_wishlist, t.for_sale, t.hidden
       ORDER BY t.name, t.copy`,
      params
    );

    const csvRows = [
      ['id', 'copy', 'name', 'manufacturer', 'series', 'sub_series', 'theme', 'toyline', 'year', 'cost', 'value', 'source', 'notes', 'condition', 'tags', 'accessories', 'owned_accessories', 'wishlist', 'for_sale', 'hidden'],
      ...rows.map(row => [row.id, row.copy ?? 1, row.name || '', row.manufacturer || '', row.series || '', row.sub_series || '', row.theme || '', row.toyline || '', row.year_value ?? '', row.cost ?? '', row.value ?? '', row.source || '', row.notes || '', row.condition || '', row.tags || '', row.accessories || '', row.owned_accessories || '', row.is_wishlist ? 'true' : 'false', row.for_sale ? 'true' : 'false', row.hidden ? 'true' : 'false'])
    ];

    const csv = csvRows.map(row => row.map(escapeCsvCell).join(',')).join('\n') + '\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="toydb-export.csv"');
    res.send(csv);
  } catch (err) {
    if (err && err.message && err.message.startsWith('Invalid field')) return res.status(400).json({ error: err.message });
    if (err && err.message === 'Year must be a whole number') return res.status(400).json({ error: err.message });
    console.error('CSV export error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Import toys from a CSV file. This supports both template imports and export round-trips.
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

  const hasSyncColumns = header.includes('id') || header.includes('copy');
  const [allTags] = await pool.query('SELECT id, name FROM tags');
  const tagIdsByName = new Map(allTags.map(t => [t.name.toLowerCase(), t.id]));
  const [existingToys] = await pool.query(
    'SELECT id, copy, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, `condition`, is_wishlist, for_sale, hidden FROM toys WHERE user_id = ?',
    [userId]
  );

  if (!hasSyncColumns) {
    const errors = [];
    let imported = 0;
    for (let i = 0; i < dataRows.length; i++) {
      const rowNumber = i + 2;
      const values = dataRows[i];
      if (values.every(v => v.trim() === '')) continue;

      const record = {};
      header.forEach((key, index) => { record[key] = (values[index] || '').trim(); });

      if (!record.name) { errors.push({ row: rowNumber, error: 'Name is required' }); continue; }

      const accessoryNames = String(record.accessories || '').split(/[|,;\n]/).map(item => item.trim()).filter(Boolean);
      const ownedAccessoryNames = new Set(String(record.owned_accessories || '').split(/[|,;\n]/).map(item => item.trim()).filter(Boolean));
      const accessoryEntries = accessoryNames.map(name => ({ name, has_accessory: ownedAccessoryNames.has(name) }));

      const year = record.year ? parseInt(record.year, 10) : null;
      if (record.year && Number.isNaN(year)) { errors.push({ row: rowNumber, error: 'Year must be a number' }); continue; }
      const cost = record.cost ? parseFloat(record.cost) : null;
      if (record.cost && Number.isNaN(cost)) { errors.push({ row: rowNumber, error: 'Cost must be a number' }); continue; }
      const value = record.value ? parseFloat(record.value) : null;
      if (record.value && Number.isNaN(value)) { errors.push({ row: rowNumber, error: 'Value must be a number' }); continue; }
      const parsedCopy = parseCopyValue(record.copy);
      if (record.copy && parsedCopy === null) { errors.push({ row: rowNumber, error: 'Copy must be a positive whole number' }); continue; }
      const isWishlist = ['true', '1', 'yes'].includes((record.wishlist || '').toLowerCase());
      const isForSale = ['true', '1', 'yes'].includes((record.for_sale || '').toLowerCase());
      const isHidden = ['true', '1', 'yes'].includes((record.hidden || '').toLowerCase());

      const requestedTagNames = record.tags ? String(record.tags).split(/[|,;\n]/).map(t => t.trim()).filter(Boolean) : [];
      const uniqueRequestedTagNames = [...new Map(requestedTagNames.map(tagName => [tagName.toLowerCase(), tagName])).values()];
      const missingTagNames = uniqueRequestedTagNames.filter(tagName => !tagIdsByName.has(tagName.toLowerCase()));

      if (missingTagNames.length) {
        const cleanMissingTagNames = [...new Map(missingTagNames.map(tagName => [tagName.toLowerCase(), tagName])).values()];
        await pool.query('INSERT IGNORE INTO tags (name) VALUES ?', [cleanMissingTagNames.map(tagName => [tagName])]);
        const [newTagRows] = await pool.query(
          `SELECT id, name FROM tags WHERE LOWER(name) IN (${cleanMissingTagNames.map(() => '?').join(',')})`,
          cleanMissingTagNames.map(tagName => tagName.toLowerCase())
        );
        for (const tagRow of newTagRows) { tagIdsByName.set(tagRow.name.toLowerCase(), tagRow.id); }
      }

      const tagIds = uniqueRequestedTagNames.map(tagName => tagIdsByName.get(tagName.toLowerCase())).filter(Boolean);

      try {
        const [result] = await pool.query(
          'INSERT INTO toys (user_id, copy, is_wishlist, for_sale, hidden, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, `condition`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, parsedCopy || 1, isWishlist, isForSale, isHidden, record.name, record.manufacturer || null, record.series || null, record.sub_series || null, record.theme || null, record.toyline || null, year, cost, value, record.source || null, record.notes || null, record.condition || null]
        );
        await setToyTags(result.insertId, tagIds);
        await setToyAccessories(result.insertId, accessoryEntries);
        imported++;
      } catch (err) {
        console.error('CSV import row error', err);
        errors.push({ row: rowNumber, error: 'Server error saving this row' });
      }
    }

    return res.json({ ok: true, mode: 'import', imported, errors });
  }

  const errors = [];
  let updated = 0;
  let created = 0;
  const existingById = new Map(existingToys.map(toy => [Number(toy.id), toy]));

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 2;
    const values = dataRows[i];
    if (values.every(v => v.trim() === '')) continue;

    const record = {};
    header.forEach((key, index) => { record[key] = (values[index] || '').trim(); });

    if (!record.name) { errors.push({ row: rowNumber, error: 'Name is required' }); continue; }

    const accessoryNames = String(record.accessories || '').split(/[|,;\n]/).map(item => item.trim()).filter(Boolean);
    const ownedAccessoryNames = new Set(String(record.owned_accessories || '').split(/[|,;\n]/).map(item => item.trim()).filter(Boolean));
    const accessoryEntries = accessoryNames.map(name => ({ name, has_accessory: ownedAccessoryNames.has(name) }));

    const year = record.year ? parseInt(record.year, 10) : null;
    if (record.year && Number.isNaN(year)) { errors.push({ row: rowNumber, error: 'Year must be a number' }); continue; }
    const cost = record.cost ? parseFloat(record.cost) : null;
    if (record.cost && Number.isNaN(cost)) { errors.push({ row: rowNumber, error: 'Cost must be a number' }); continue; }
    const value = record.value ? parseFloat(record.value) : null;
    if (record.value && Number.isNaN(value)) { errors.push({ row: rowNumber, error: 'Value must be a number' }); continue; }

    const parsedCopy = parseCopyValue(record.copy);
    if (record.copy && parsedCopy === null) { errors.push({ row: rowNumber, error: 'Copy must be a positive whole number' }); continue; }
    const finalCopy = parsedCopy || 1;
    const rowId = record.id ? Number(record.id) : null;
    const naturalKey = buildToyNaturalKey(record);

    const requestedTagNames = record.tags ? String(record.tags).split(/[|,;\n]/).map(t => t.trim()).filter(Boolean) : [];
    const uniqueRequestedTagNames = [...new Map(requestedTagNames.map(tagName => [tagName.toLowerCase(), tagName])).values()];
    const missingTagNames = uniqueRequestedTagNames.filter(tagName => !tagIdsByName.has(tagName.toLowerCase()));

    if (missingTagNames.length) {
      const cleanMissingTagNames = [...new Map(missingTagNames.map(tagName => [tagName.toLowerCase(), tagName])).values()];
      await pool.query('INSERT IGNORE INTO tags (name) VALUES ?', [cleanMissingTagNames.map(tagName => [tagName])]);
      const [newTagRows] = await pool.query(
        `SELECT id, name FROM tags WHERE LOWER(name) IN (${cleanMissingTagNames.map(() => '?').join(',')})`,
        cleanMissingTagNames.map(tagName => tagName.toLowerCase())
      );
      for (const tagRow of newTagRows) { tagIdsByName.set(tagRow.name.toLowerCase(), tagRow.id); }
    }

    const tagIds = uniqueRequestedTagNames.map(tagName => tagIdsByName.get(tagName.toLowerCase())).filter(Boolean);

    try {
      let matchingToy = null;
      if (!Number.isNaN(rowId) && rowId !== null && existingById.has(rowId)) {
        matchingToy = existingById.get(rowId);
      } else {
        matchingToy = existingToys.find(toy => buildToyNaturalKey(toy) === naturalKey && Number(toy.copy || 1) === finalCopy) || null;
      }

      if (!matchingToy) {
        const matchingNaturalKeyRows = existingToys.filter(toy => buildToyNaturalKey(toy) === naturalKey);
        const nextCopy = matchingNaturalKeyRows.length ? Math.max(...matchingNaturalKeyRows.map(toy => Number(toy.copy || 1))) + 1 : 1;
        const [result] = await pool.query(
          'INSERT INTO toys (user_id, copy, is_wishlist, for_sale, hidden, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, `condition`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, nextCopy, ['true', '1', 'yes'].includes((record.wishlist || '').toLowerCase()), ['true', '1', 'yes'].includes((record.for_sale || '').toLowerCase()), ['true', '1', 'yes'].includes((record.hidden || '').toLowerCase()), record.name, record.manufacturer || null, record.series || null, record.sub_series || null, record.theme || null, record.toyline || null, year, cost, value, record.source || null, record.notes || null, record.condition || null]
        );
        await setToyTags(result.insertId, tagIds);
        await setToyAccessories(result.insertId, accessoryEntries);
        created++;
        existingToys.push({ id: result.insertId, copy: nextCopy, name: record.name, manufacturer: record.manufacturer || null, series: record.series || null, sub_series: record.sub_series || null, theme: record.theme || null, toyline: record.toyline || null, year: year, cost, value, source: record.source || null, notes: record.notes || null, condition: record.condition || null, is_wishlist: ['true', '1', 'yes'].includes((record.wishlist || '').toLowerCase()), for_sale: ['true', '1', 'yes'].includes((record.for_sale || '').toLowerCase()), hidden: ['true', '1', 'yes'].includes((record.hidden || '').toLowerCase()) });
        existingById.set(result.insertId, existingToys[existingToys.length - 1]);
        continue;
      }

      const isWishlist = ['true', '1', 'yes'].includes((record.wishlist || '').toLowerCase());
      const isForSale = ['true', '1', 'yes'].includes((record.for_sale || '').toLowerCase());
      const isHidden = ['true', '1', 'yes'].includes((record.hidden || '').toLowerCase());

      await pool.query(
        'UPDATE toys SET name=?, manufacturer=?, series=?, sub_series=?, theme=?, toyline=?, `year`=?, cost=?, `value`=?, source=?, notes=?, `condition`=?, copy=?, for_sale=?, hidden=?, is_wishlist=? WHERE id=? AND user_id=?',
        [record.name, record.manufacturer || null, record.series || null, record.sub_series || null, record.theme || null, record.toyline || null, year, cost, value, record.source || null, record.notes || null, record.condition || null, finalCopy, isForSale, isHidden, isWishlist, matchingToy.id, userId]
      );
      await setToyTags(matchingToy.id, tagIds);
      await setToyAccessories(matchingToy.id, accessoryEntries);
      updated++;
    } catch (err) {
      console.error('CSV sync row error', err);
      errors.push({ row: rowNumber, error: 'Server error syncing this row' });
    }
  }

  res.json({ ok: true, mode: 'sync', imported: updated + created, summary: { updated, created, skipped: 0, invalid: errors.length }, errors });
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
  const criteria = Array.isArray(rawCriteria) ? rawCriteria : (rawCriteria ? [rawCriteria] : []);
  return criteria
    .map(item => ({
      field: String(item && item.field).trim(),
      value: item && Object.prototype.hasOwnProperty.call(item, 'value') ? String(item.value ?? '').trim() : ''
    }))
    .filter(item => item.field && item.value !== '');
}

function buildCriteriaClauses(rawCriteria, options = {}) {
  const allowedFields = new Set(options.allowedFields || ['toyline', 'manufacturer', 'series', 'sub_series', 'theme', 'year', 'condition']);
  const normalizedCriteria = normalizeBulkCriteria(rawCriteria);
  const invalidField = normalizedCriteria.find(item => !allowedFields.has(item.field));
  if (invalidField) throw new Error(`Invalid field: ${invalidField.field}`);

  const whereClauses = [];
  const params = [];

  for (const criterion of normalizedCriteria) {
    const fieldName = criterion.field;
    const normalizedValue = String(criterion.value).trim();

    if (fieldName === 'year') {
      const year = Number(normalizedValue);
      if (!Number.isInteger(year)) throw new Error('Year must be a whole number');
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

  return { normalizedCriteria, whereClauses, params };
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
  const ownerId = Number(req.query.ownerId || req.user.id);
  const requestedUserId = Number(req.user.id);
  const [shareRows] = await pool.query('SELECT owner_user_id FROM collection_shares WHERE viewer_user_id = ?', [requestedUserId]);
  const sharedOwnerIds = new Set(shareRows.map(row => Number(row.owner_user_id)));
  if (ownerId !== requestedUserId && !sharedOwnerIds.has(ownerId)) {
    return res.status(403).json({ error: 'You do not have access to this collection.' });
  }

  const userId = ownerId;
  const wishlist = req.query.wishlist === 'true' ? 1 : 0;
  const forSale = req.query.for_sale === 'true' ? 1 : 0;
  const hidden = req.query.hidden === 'true' ? 1 : 0;
  try {
    let query = '';
    let params = [userId];

    if (hidden) {
      query = 'SELECT id, copy, is_wishlist, for_sale, hidden, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, `condition`, created_at FROM toys WHERE user_id = ? AND hidden = ? ORDER BY (year IS NULL), year, (series IS NULL), series, (sub_series IS NULL), sub_series, (theme IS NULL), theme, name, copy';
      params.push(1);
    } else if (forSale) {
      query = 'SELECT id, copy, is_wishlist, for_sale, hidden, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, `condition`, created_at FROM toys WHERE user_id = ? AND for_sale = ? AND hidden = 0 ORDER BY (year IS NULL), year, (series IS NULL), series, (sub_series IS NULL), sub_series, (theme IS NULL), theme, name, copy';
      params.push(1);
    } else if (wishlist) {
      query = 'SELECT id, copy, is_wishlist, for_sale, hidden, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, `condition`, created_at FROM toys WHERE user_id = ? AND is_wishlist = ? AND hidden = 0 ORDER BY (year IS NULL), year, (series IS NULL), series, (sub_series IS NULL), sub_series, (theme IS NULL), theme, name, copy';
      params.push(1);
    } else {
      query = 'SELECT id, copy, is_wishlist, for_sale, hidden, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, `condition`, created_at FROM toys WHERE user_id = ? AND is_wishlist = 0 AND hidden = 0 ORDER BY (year IS NULL), year, (series IS NULL), series, (sub_series IS NULL), sub_series, (theme IS NULL), theme, name, copy';
    }

    const [toys] = await pool.query(query, params);
    const orderedToys = sortToyCollection(toys);
    for (const t of orderedToys) {
      const [photos] = await pool.query('SELECT id, filename, original_name, sort_order FROM toy_photos WHERE toy_id = ? ORDER BY sort_order ASC, created_at ASC', [t.id]);
      t.photos = await Promise.all(photos.map(async p => ({
        id: p.id,
        url: `/uploads/${p.filename}`,
        thumbnail_url: await generateThumbnailIfMissing(p.filename),
        name: p.original_name
      })));
    }
    await attachTags(orderedToys);
    await attachAccessories(orderedToys);
    res.json({ toys: orderedToys });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single toy
router.get('/:id', authenticate, async (req, res) => {
  const ownerId = Number(req.query.ownerId || req.user.id);
  const requestedUserId = Number(req.user.id);
  const [shareRows] = await pool.query('SELECT owner_user_id FROM collection_shares WHERE viewer_user_id = ?', [requestedUserId]);
  const sharedOwnerIds = new Set(shareRows.map(row => Number(row.owner_user_id)));
  if (ownerId !== requestedUserId && !sharedOwnerIds.has(ownerId)) {
    return res.status(403).json({ error: 'You do not have access to this collection.' });
  }

  const userId = ownerId;
  const id = req.params.id;
  try {
    const [rows] = await pool.query('SELECT id, copy, is_wishlist, for_sale, hidden, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, `condition`, created_at FROM toys WHERE id = ? AND user_id = ?', [id, userId]);
    if (!rows.length) return res.status(404).json({ error: 'Toy not found' });
    const toy = rows[0];
    const [photos] = await pool.query('SELECT id, filename, original_name, sort_order FROM toy_photos WHERE toy_id = ? ORDER BY sort_order ASC, created_at ASC', [toy.id]);
    toy.photos = await Promise.all(photos.map(async p => ({
      id: p.id,
      url: `/uploads/${p.filename}`,
      thumbnail_url: await generateThumbnailIfMissing(p.filename),
      name: p.original_name
    })));
    await attachTags([toy]);
    await attachAccessories([toy]);
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
  const { name, manufacturer, series, sub_series, theme, toyline, year, condition, cost, value, source, notes, tags, accessories, for_sale, hidden, copy } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const parsedCopy = copy === undefined || copy === null || copy === '' ? 1 : Number(copy);
  if (!Number.isInteger(parsedCopy) || parsedCopy < 1) return res.status(400).json({ error: 'Copy must be a positive whole number' });
  try {
    const [result] = await pool.query('UPDATE toys SET name=?, manufacturer=?, series=?, sub_series=?, theme=?, toyline=?, `year`=?, cost=?, `value`=?, source=?, notes=?, `condition`=?, copy=?, for_sale=?, hidden=? WHERE id=? AND user_id=?', [name, manufacturer || null, series || null, sub_series || null, theme || null, toyline || null, year ? parseInt(year) : null, cost ? parseFloat(cost) : null, value ? parseFloat(value) : null, source || null, notes || null, condition || null, parsedCopy, for_sale === 'true' || for_sale === true || for_sale === 1 || for_sale === '1', hidden === 'true' || hidden === true || hidden === 1 || hidden === '1', id, userId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Toy not found' });
    await setToyTags(id, parseTagIds(tags));
    await setToyAccessories(id, parseAccessoryEntries(accessories));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Duplicate a toy (and its tags and accessories), incrementing the copy number.
router.post('/:id/copy', authenticate, async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;
  try {
    const [rows] = await pool.query('SELECT * FROM toys WHERE id = ? AND user_id = ?', [id, userId]);
    if (!rows.length) return res.status(404).json({ error: 'Toy not found' });
    const toy = rows[0];

    // `<=>` is MySQL's null-safe equality operator, needed since several identity fields can be NULL.
    const [maxRows] = await pool.query(
      'SELECT COALESCE(MAX(copy), 0) AS max_copy FROM toys WHERE user_id = ? AND name <=> ? AND manufacturer <=> ? AND series <=> ? AND sub_series <=> ? AND theme <=> ? AND toyline <=> ? AND `year` <=> ?',
      [userId, toy.name, toy.manufacturer, toy.series, toy.sub_series, toy.theme, toy.toyline, toy.year]
    );
    const nextCopy = Number(maxRows[0]?.max_copy || 0) + 1;

    const [result] = await pool.query(
      'INSERT INTO toys (user_id, copy, is_wishlist, for_sale, hidden, name, manufacturer, series, sub_series, theme, toyline, `year`, cost, `value`, source, notes, `condition`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, nextCopy, toy.is_wishlist, toy.for_sale, toy.hidden, toy.name, toy.manufacturer, toy.series, toy.sub_series, toy.theme, toy.toyline, toy.year, toy.cost, toy.value, toy.source, toy.notes, toy.condition]
    );
    const newToyId = result.insertId;

    const [tagRows] = await pool.query('SELECT tag_id FROM toy_tags WHERE toy_id = ?', [id]);
    if (tagRows.length) {
      await pool.query('INSERT IGNORE INTO toy_tags (toy_id, tag_id) VALUES ?', [tagRows.map(row => [newToyId, row.tag_id])]);
    }

    const [accessoryRows] = await pool.query('SELECT name, has_accessory FROM toy_accessories WHERE toy_id = ?', [id]);
    if (accessoryRows.length) {
      await pool.query('INSERT INTO toy_accessories (toy_id, name, has_accessory) VALUES ?', [accessoryRows.map(row => [newToyId, row.name, row.has_accessory])]);
    }

    res.json({ ok: true, id: newToyId });
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

router.patch('/:toyId/photos/reorder', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { toyId } = req.params;
  const { photoIds } = req.body || {};

  if (!Array.isArray(photoIds) || !photoIds.length) {
    return res.status(400).json({ error: 'Photo order is required' });
  }

  try {
    const [toyRows] = await pool.query('SELECT id FROM toys WHERE id = ? AND user_id = ?', [toyId, userId]);
    if (!toyRows.length) return res.status(404).json({ error: 'Toy not found' });

    const uniquePhotoIds = [...new Set(photoIds.map(value => Number(value)).filter(Number.isFinite))];
    if (!uniquePhotoIds.length) return res.status(400).json({ error: 'Photo order is invalid' });

    const [existingRows] = await pool.query('SELECT id FROM toy_photos WHERE toy_id = ? AND id IN (?)', [toyId, uniquePhotoIds]);
    const existingIds = existingRows.map(row => Number(row.id));
    if (existingIds.length !== uniquePhotoIds.length || existingIds.some(id => !uniquePhotoIds.includes(id))) {
      return res.status(400).json({ error: 'Photo order contains photos that do not belong to this toy' });
    }

    await Promise.all(uniquePhotoIds.map((photoId, index) => (
      pool.query('UPDATE toy_photos SET sort_order = ? WHERE id = ? AND toy_id = ?', [index, photoId, toyId])
    )));

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Replace a photo with an edited version.
router.put('/:toyId/photos/:photoId', authenticate, upload.single('photo'), async (req, res) => {
  const userId = req.user.id;
  const { toyId, photoId } = req.params;
  if (!req.file) return res.status(400).json({ error: 'Photo is required' });

  try {
    const [toyRows] = await pool.query('SELECT id FROM toys WHERE id = ? AND user_id = ?', [toyId, userId]);
    if (!toyRows.length) return res.status(404).json({ error: 'Toy not found' });

    const [rows] = await pool.query('SELECT filename, original_name FROM toy_photos WHERE id = ? AND toy_id = ?', [photoId, toyId]);
    if (!rows.length) return res.status(404).json({ error: 'Photo not found' });

    const existing = rows[0];
    const processed = await sharp(req.file.buffer, { limitInputPixels: 100000000 })
      .rotate()
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
    const sourcePath = path.join(uploadsDir, filename);
    const thumbFilename = filename.replace(/(\.[^.]+)$/, '-thumb.webp');
    const thumbPath = path.join(uploadsDir, thumbFilename);

    await fs.promises.writeFile(sourcePath, processed);
    await createThumbnailFromBuffer(processed, thumbPath);

    await pool.query('UPDATE toy_photos SET filename = ?, original_name = ? WHERE id = ? AND toy_id = ?', [filename, existing.original_name || req.file.originalname || 'photo.webp', photoId, toyId]);

    const oldFilePath = path.join(uploadsDir, existing.filename);
    try { fs.unlinkSync(oldFilePath); } catch (e) {}
    const oldThumbPath = path.join(uploadsDir, existing.filename.replace(/(\.[^.]+)$/, '-thumb.webp'));
    try { fs.unlinkSync(oldThumbPath); } catch (e) {}

    res.json({ ok: true, filename, url: `/uploads/${filename}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
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
    const thumbPath = path.join(uploadsDir, filename.replace(/(\.[^.]+)$/, '-thumb.webp'));
    try { fs.unlinkSync(thumbPath); } catch (e) {}
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.normalizeBulkCriteria = normalizeBulkCriteria;
module.exports.buildCriteriaClauses = buildCriteriaClauses;
