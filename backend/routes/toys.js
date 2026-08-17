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

async function ensureToyColumns() {
  try {
    // Try adding columns; ignore errors if they already exist
    await pool.query("ALTER TABLE toys ADD COLUMN toyline VARCHAR(255)");
  } catch (e) { /* ignore */ }
  try {
    await pool.query("ALTER TABLE toys ADD COLUMN `year` SMALLINT UNSIGNED");
  } catch (e) { /* ignore */ }
}

// Create toy
router.post('/', authenticate, upload.array('photos', 8), async (req, res) => {
  const userId = req.user.id;
  const { name, manufacturer, series, sub_series, toyline, year, accessories, condition } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO toys (user_id, name, manufacturer, series, sub_series, toyline, `year`, accessories, `condition`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, name, manufacturer || null, series || null, sub_series || null, toyline || null, year ? parseInt(year) : null, accessories || null, condition || null]
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
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      try {
        await ensureToyColumns();
        const [result] = await pool.query(
          'INSERT INTO toys (user_id, name, manufacturer, series, sub_series, toyline, `year`, accessories, `condition`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, name, manufacturer || null, series || null, sub_series || null, toyline || null, year ? parseInt(year) : null, accessories || null, condition || null]
        );
        const toyId = result.insertId;
        const files = req.files || [];
        for (const f of files) {
          await pool.query('INSERT INTO toy_photos (toy_id, filename, original_name) VALUES (?, ?, ?)', [toyId, f.filename, f.originalname]);
        }
        return res.json({ ok: true, id: toyId });
      } catch (e) {
        console.error('Retry insert failed', e);
      }
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all toys for user
router.get('/', authenticate, async (req, res) => {
  const userId = req.user.id;
  try {
    let toys;
    try {
      const [rows] = await pool.query('SELECT id, name, manufacturer, series, sub_series, toyline, `year`, accessories, `condition`, created_at FROM toys WHERE user_id = ?', [userId]);
      toys = rows;
    } catch (e) {
      if (e && e.code === 'ER_BAD_FIELD_ERROR') {
        await ensureToyColumns();
        const [rows] = await pool.query('SELECT id, name, manufacturer, series, sub_series, toyline, `year`, accessories, `condition`, created_at FROM toys WHERE user_id = ?', [userId]);
        toys = rows;
      } else throw e;
    }
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
    let rows;
    try {
      [rows] = await pool.query('SELECT id, name, manufacturer, series, sub_series, toyline, `year`, accessories, `condition`, created_at FROM toys WHERE id = ? AND user_id = ?', [id, userId]);
    } catch (e) {
      if (e && e.code === 'ER_BAD_FIELD_ERROR') {
        await ensureToyColumns();
        [rows] = await pool.query('SELECT id, name, manufacturer, series, sub_series, toyline, `year`, accessories, `condition`, created_at FROM toys WHERE id = ? AND user_id = ?', [id, userId]);
      } else throw e;
    }
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
  const { name, manufacturer, series, sub_series, toyline, year, accessories, condition } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    let result;
    try {
      [result] = await pool.query('UPDATE toys SET name=?, manufacturer=?, series=?, sub_series=?, toyline=?, `year`=?, accessories=?, `condition`=? WHERE id=? AND user_id=?', [name, manufacturer || null, series || null, sub_series || null, toyline || null, year ? parseInt(year) : null, accessories || null, condition || null, id, userId]);
    } catch (e) {
      if (e && e.code === 'ER_BAD_FIELD_ERROR') {
        await ensureToyColumns();
        [result] = await pool.query('UPDATE toys SET name=?, manufacturer=?, series=?, sub_series=?, toyline=?, `year`=?, accessories=?, `condition`=? WHERE id=? AND user_id=?', [name, manufacturer || null, series || null, sub_series || null, toyline || null, year ? parseInt(year) : null, accessories || null, condition || null, id, userId]);
      } else throw e;
    }
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
