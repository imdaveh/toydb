const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

// ensure uploads dir exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

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

const suggestionFields = ['manufacturer', 'toyline', 'series', 'sub_series', 'source'];

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
  const { name, manufacturer, series, sub_series, toyline, year, accessories, missing, condition, grade, cost, value, source, notes, wishlist } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const photos = await preparePhotos(req.files || []);
    const [result] = await pool.query(
      'INSERT INTO toys (user_id, is_wishlist, name, manufacturer, series, sub_series, toyline, `year`, cost, `value`, source, notes, accessories, missing, `condition`, grade) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, wishlist === 'true' || wishlist === true, name, manufacturer || null, series || null, sub_series || null, toyline || null, year ? parseInt(year) : null, cost ? parseFloat(cost) : null, value ? parseFloat(value) : null, source || null, notes || null, accessories || null, missing || null, condition || null, grade || null]
    );
    const toyId = result.insertId;
    await savePhotos(toyId, photos);
    res.json({ ok: true, id: toyId });
  } catch (err) {
    console.error('Insert error', err && err.code);
    res.status(err.message && err.message.startsWith('Invalid photo') ? 400 : 500).json({ error: err.message && err.message.startsWith('Invalid photo') ? err.message : 'Server error' });
  }
});

// Get all toys for user
router.get('/', authenticate, async (req, res) => {
  const userId = req.user.id;
  const wishlist = req.query.wishlist === 'true' ? 1 : 0;
  try {
    const [toys] = await pool.query('SELECT id, is_wishlist, name, manufacturer, series, sub_series, toyline, `year`, cost, `value`, source, notes, accessories, missing, `condition`, grade, created_at FROM toys WHERE user_id = ? AND is_wishlist = ?', [userId, wishlist]);
    // fetch photos for each toy
    for (const t of toys) {
      const [photos] = await pool.query('SELECT id, filename, original_name FROM toy_photos WHERE toy_id = ?', [t.id]);
      t.photos = photos.map(p => ({ id: p.id, url: `/uploads/${p.filename}`, name: p.original_name }));
    }
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
    const [rows] = await pool.query('SELECT id, is_wishlist, name, manufacturer, series, sub_series, toyline, `year`, cost, `value`, source, notes, accessories, missing, `condition`, grade, created_at FROM toys WHERE id = ? AND user_id = ?', [id, userId]);
    if (!rows.length) return res.status(404).json({ error: 'Toy not found' });
    const toy = rows[0];
    const [photos] = await pool.query('SELECT id, filename, original_name FROM toy_photos WHERE toy_id = ?', [toy.id]);
    toy.photos = photos.map(p => ({ id: p.id, url: `/uploads/${p.filename}`, name: p.original_name }));
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
  const { name, manufacturer, series, sub_series, toyline, year, accessories, missing, condition, grade, cost, value, source, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const [result] = await pool.query('UPDATE toys SET name=?, manufacturer=?, series=?, sub_series=?, toyline=?, `year`=?, cost=?, `value`=?, source=?, notes=?, accessories=?, missing=?, `condition`=?, grade=? WHERE id=? AND user_id=?', [name, manufacturer || null, series || null, sub_series || null, toyline || null, year ? parseInt(year) : null, cost ? parseFloat(cost) : null, value ? parseFloat(value) : null, source || null, notes || null, accessories || null, missing || null, condition || null, grade || null, id, userId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Toy not found' });
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
