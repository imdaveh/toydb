const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const pool = require('../db');
const uploadsDir = require('../uploadsPath');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

function getReferencedPhotoNames(rows) {
  const referencedNames = new Set();

  for (const row of rows) {
    if (!row.filename) continue;
    referencedNames.add(row.filename);
    const thumbFilename = row.filename.replace(/(\.[^.]+)$/, '-thumb.webp');
    if (thumbFilename !== row.filename) referencedNames.add(thumbFilename);
  }

  return referencedNames;
}

async function getOrphanedPhotoFiles() {
  const [rows] = await pool.query('SELECT filename FROM toy_photos');
  const referencedNames = getReferencedPhotoNames(rows);

  let entries = [];
  try {
    entries = await fs.promises.readdir(uploadsDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  return entries
    .filter(entry => entry.isFile() && !referencedNames.has(entry.name))
    .map(entry => entry.name);
}

router.get('/users', async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, email, enabled, is_admin, created_at FROM users WHERE id <> ? ORDER BY enabled ASC, created_at ASC',
      [req.user.id]
    );
    res.json({ users: users.map(user => ({
      id: user.id,
      email: user.email,
      enabled: Boolean(user.enabled),
      isAdmin: Boolean(user.is_admin),
      createdAt: user.created_at
    })) });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/users/:id', async (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean' });
  try {
    const [result] = await pool.query('UPDATE users SET enabled = ? WHERE id = ? AND id <> ?', [enabled, req.params.id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'User not found' });
    if (!enabled) await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/users/:id/admin', async (req, res) => {
  const { isAdmin } = req.body || {};
  if (typeof isAdmin !== 'boolean') return res.status(400).json({ error: 'isAdmin must be a boolean' });
  try {
    if (Number(req.params.id) === Number(req.user.id)) {
      return res.status(403).json({ error: 'You cannot revoke your own administrator privileges.' });
    }

    const [result] = await pool.query('UPDATE users SET is_admin = ? WHERE id = ? AND id <> ?', [isAdmin, req.params.id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'User not found' });

    res.json({ ok: true });
  } catch (err) {
    console.error('Update admin privilege error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM users WHERE id = ? AND id <> ?', [req.params.id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/photos/orphans', async (req, res) => {
  try {
    const orphanFiles = await getOrphanedPhotoFiles();
    res.json({ orphanCount: orphanFiles.length, files: orphanFiles });
  } catch (err) {
    console.error('Count orphaned photos error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/photos/orphans/cleanup', async (req, res) => {
  try {
    const orphanFiles = await getOrphanedPhotoFiles();
    const deleted = [];

    for (const filename of orphanFiles) {
      const filePath = path.join(uploadsDir, filename);
      try {
        await fs.promises.unlink(filePath);
        deleted.push(filename);
      } catch (err) {
        console.error('Delete orphaned photo error:', err);
      }
    }

    res.json({ ok: true, deletedCount: deleted.length, orphanCount: orphanFiles.length });
  } catch (err) {
    console.error('Cleanup orphaned photos error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/tags', async (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Tag name is required' });
  try {
    const [result] = await pool.query('INSERT INTO tags (name) VALUES (?)', [name]);
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Tag already exists' });
    console.error('Create tag error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/tags/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM tags WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Tag not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete tag error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;