const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

// ensure uploads dir exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.random().toString(36).substring(2,8) + ext;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// Create toy
router.post('/', authenticate, upload.array('photos', 8), async (req, res) => {
  const userId = req.user.id;
  const { name, manufacturer, series, sub_series, toyline, year, accessories, condition, cost, source, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO toys (user_id, name, manufacturer, series, sub_series, toyline, `year`, cost, source, notes, accessories, `condition`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, name, manufacturer || null, series || null, sub_series || null, toyline || null, year ? parseInt(year) : null, (req.body.cost ? parseFloat(req.body.cost) : null), req.body.source || null, req.body.notes || null, accessories || null, condition || null]
    );
    const toyId = result.insertId;
    // store photos
    const files = req.files || [];
    for (const f of files) {
      await pool.query('INSERT INTO toy_photos (toy_id, filename, original_name) VALUES (?, ?, ?)', [toyId, f.filename, f.originalname]);
    }
    res.json({ ok: true, id: toyId });
  } catch (err) {
    console.error('Insert error', err && err.code);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all toys for user
router.get('/', authenticate, async (req, res) => {
  const userId = req.user.id;
  try {
    const [toys] = await pool.query('SELECT id, name, manufacturer, series, sub_series, toyline, `year`, cost, source, notes, accessories, `condition`, created_at FROM toys WHERE user_id = ?', [userId]);
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
    const [rows] = await pool.query('SELECT id, name, manufacturer, series, sub_series, toyline, `year`, cost, source, notes, accessories, `condition`, created_at FROM toys WHERE id = ? AND user_id = ?', [id, userId]);
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
  const { name, manufacturer, series, sub_series, toyline, year, accessories, condition, cost, source, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const [result] = await pool.query('UPDATE toys SET name=?, manufacturer=?, series=?, sub_series=?, toyline=?, `year`=?, cost=?, source=?, notes=?, accessories=?, `condition`=? WHERE id=? AND user_id=?', [name, manufacturer || null, series || null, sub_series || null, toyline || null, year ? parseInt(year) : null, (cost ? parseFloat(cost) : null), source || null, notes || null, accessories || null, condition || null, id, userId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Toy not found' });
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
    const files = req.files || [];
    for (const f of files) {
      await pool.query('INSERT INTO toy_photos (toy_id, filename, original_name) VALUES (?, ?, ?)', [id, f.filename, f.originalname]);
    }
    res.json({ ok: true });
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
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
