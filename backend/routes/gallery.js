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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!supportedImageTypes.has(file.mimetype)) return callback(new Error('Only JPEG, PNG, and WebP images are allowed'));
    callback(null, true);
  }
});

async function prepareGalleryPhoto(file) {
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
}

async function saveGalleryPhoto(userId, file, caption = '') {
  const prepared = await prepareGalleryPhoto(file);
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
  const cleanedCaption = typeof caption === 'string' ? caption.trim().slice(0, 500) : '';
  await fs.promises.writeFile(path.join(uploadsDir, filename), prepared.buffer);
  const [result] = await pool.query(
    'INSERT INTO gallery_photos (user_id, filename, original_name, caption) VALUES (?, ?, ?, ?)',
    [userId, filename, prepared.originalName, cleanedCaption]
  );
  return { id: result.insertId, filename, originalName: prepared.originalName, caption: cleanedCaption };
}

router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, filename, original_name, caption FROM gallery_photos WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({
      photos: rows.map(photo => ({
        id: photo.id,
        url: `/uploads/${photo.filename}`,
        name: photo.original_name || photo.filename,
        caption: photo.caption || ''
      }))
    });
  } catch (err) {
    console.error('Load gallery photos error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Photo is required' });

  try {
    const caption = typeof req.body.caption === 'string' ? req.body.caption : '';
    const photo = await saveGalleryPhoto(req.user.id, req.file, caption);
    res.status(201).json({ photo: { id: photo.id, url: `/uploads/${photo.filename}`, name: photo.originalName, caption: photo.caption } });
  } catch (err) {
    console.error('Gallery upload error:', err);
    res.status(err.message && err.message.startsWith('Invalid photo') ? 400 : 500).json({
      error: err.message && err.message.startsWith('Invalid photo') ? err.message : 'Server error'
    });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim().slice(0, 500) : '';

  try {
    const [result] = await pool.query(
      'UPDATE gallery_photos SET caption = ? WHERE id = ? AND user_id = ?',
      [caption, id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Photo not found' });
    res.json({ ok: true, caption });
  } catch (err) {
    console.error('Update gallery caption error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT filename FROM gallery_photos WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Photo not found' });

    const filename = rows[0].filename;
    await pool.query('DELETE FROM gallery_photos WHERE id = ? AND user_id = ?', [id, req.user.id]);

    try {
      await fs.promises.unlink(path.join(uploadsDir, filename));
    } catch (fileErr) {
      if (fileErr.code !== 'ENOENT') console.error('Delete gallery file error:', fileErr);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete gallery photo error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
