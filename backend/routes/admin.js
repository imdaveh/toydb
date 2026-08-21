const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

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