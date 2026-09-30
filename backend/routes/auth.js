const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { validatePassword } = require('../passwordValidation');

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES || '7d';

function signAccess(user) {
  return jwt.sign({ id: user.id, email: user.email }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}
function signRefresh(user) {
  return jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

// Register
router.post('/register', async (req, res) => {
  const { email, password, username } = req.body || {};
  const passwordError = validatePassword(password);
  if (!email || passwordError) return res.status(400).json({ error: passwordError || 'Email is required' });
  const normalizedUsername = String(username || email.split('@')[0] || '').trim();
  if (!normalizedUsername) return res.status(400).json({ error: 'Username is required' });
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, normalizedUsername]);
    if (rows.length) return res.status(400).json({ error: 'Email or username already registered' });
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (email, username, password_hash, enabled, is_admin) VALUES (?, ?, ?, FALSE, FALSE)', [email, normalizedUsername, hash]);
    res.status(201).json({
      message: 'Your account request is awaiting administrator approval.',
      user: { id: result.insertId, email, username: normalizedUsername, enabled: false }
    });
  } catch (err) {
    console.error('Register error:', err && { code: err.code, message: err.message, sqlMessage: err.sqlMessage });
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password for the authenticated user.
router.get('/users', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, email, username FROM users WHERE enabled = TRUE AND id <> ? ORDER BY username, email', [req.user.id]);
    res.json({ users: rows.map(row => ({ id: row.id, email: row.email, username: row.username || row.email })) });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/collection-shares', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT cs.viewer_user_id AS viewerUserId, u.username, u.email
       FROM collection_shares cs
       JOIN users u ON u.id = cs.viewer_user_id
       WHERE cs.owner_user_id = ?
       ORDER BY u.username, u.email`,
      [req.user.id]
    );
    res.json({ shares: rows.map(row => ({ viewerUserId: row.viewerUserId, username: row.username || row.email, email: row.email })) });
  } catch (err) {
    console.error('List collection shares error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/collection-shares', authenticate, async (req, res) => {
  const { viewerUserId } = req.body || {};
  const normalizedViewerUserId = Number(viewerUserId);
  if (!normalizedViewerUserId) return res.status(400).json({ error: 'User to share with is required' });
  if (normalizedViewerUserId === Number(req.user.id)) return res.status(400).json({ error: 'You cannot share your own collection with yourself' });

  try {
    const [viewerRows] = await pool.query('SELECT id, username, email FROM users WHERE id = ? AND enabled = TRUE', [normalizedViewerUserId]);
    if (!viewerRows.length) return res.status(404).json({ error: 'User not found' });
    await pool.query('INSERT IGNORE INTO collection_shares (owner_user_id, viewer_user_id) VALUES (?, ?)', [req.user.id, normalizedViewerUserId]);
    res.json({ ok: true, share: { viewerUserId: normalizedViewerUserId, username: viewerRows[0].username || viewerRows[0].email } });
  } catch (err) {
    console.error('Create collection share error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/collection-shares/:viewerUserId', authenticate, async (req, res) => {
  const viewerUserId = Number(req.params.viewerUserId);
  if (!viewerUserId || viewerUserId === Number(req.user.id)) return res.status(400).json({ error: 'Invalid share target' });
  try {
    const [result] = await pool.query('DELETE FROM collection_shares WHERE owner_user_id = ? AND viewer_user_id = ?', [req.user.id, viewerUserId]);
    res.json({ ok: true, deleted: result.affectedRows || 0 });
  } catch (err) {
    console.error('Delete collection share error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/change-password', require('../middleware/auth').authenticate, async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body || {};
  if (!oldPassword || !newPassword || !confirmPassword) return res.status(400).json({ error: 'All password fields are required' });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'New passwords do not match' });
  const passwordError = validatePassword(newPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });

  try {
    const [rows] = await pool.query('SELECT id, email, password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    if (!await bcrypt.compare(oldPassword, user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' });
    if (await bcrypt.compare(newPassword, user.password_hash)) return res.status(400).json({ error: 'New password must be different from the current password' });

    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 10), user.id]);
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);
    const sessionUser = { id: user.id, email: user.email };
    const refreshToken = signRefresh(sessionUser);
    await pool.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))', [user.id, refreshToken]);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true, accessToken: signAccess(sessionUser) });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  try {
    const [rows] = await pool.query('SELECT id, email, username, password_hash, enabled, is_admin FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(400).json({ error: 'Invalid credentials' });
    const userRow = rows[0];
    const ok = await bcrypt.compare(password, userRow.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    if (!userRow.enabled) return res.status(403).json({ error: 'Your account is awaiting administrator approval.' });
    const user = { id: userRow.id, email: userRow.email, username: userRow.username || userRow.email };
    const refreshToken = signRefresh(user);
    await pool.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))', [user.id, refreshToken]);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const accessToken = signAccess(user);
    res.json({ accessToken, user: { id: user.id, email: user.email, username: user.username, isAdmin: Boolean(userRow.is_admin) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Refresh access token
router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token' });
  try {
    // check token exists in DB
    const [rows] = await pool.query('SELECT user_id FROM refresh_tokens WHERE token = ? AND expires_at > NOW()', [token]);
    if (!rows.length) return res.status(403).json({ error: 'Refresh token invalid' });
    const payload = jwt.verify(token, REFRESH_SECRET);
    const [users] = await pool.query('SELECT id, email, username, enabled, is_admin FROM users WHERE id = ?', [payload.id]);
    if (!users.length) return res.status(404).json({ error: 'User not found' });
    const user = users[0];
    if (!user.enabled) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
      res.clearCookie('refreshToken');
      return res.status(403).json({ error: 'Your account is disabled' });
    }
    const accessToken = signAccess(user);
    res.json({ accessToken, user: { id: user.id, email: user.email, username: user.username || user.email, isAdmin: Boolean(user.is_admin) } });
  } catch (err) {
    console.error(err);
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
    } catch (err) {
      console.error('Error deleting refresh token', err);
    }
  }
  res.clearCookie('refreshToken');
  res.json({ ok: true });
});

module.exports = router;
