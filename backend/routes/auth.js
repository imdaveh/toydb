const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

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
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 6) return res.status(400).json({ error: 'Invalid email or password (min 6 chars)' });
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, hash]);
    const user = { id: result.insertId, email };

    const refreshToken = signRefresh(user);
    // store refresh token
    await pool.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))', [user.id, refreshToken]);

    // set HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const accessToken = signAccess(user);
    res.json({ accessToken, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Register error:', err && { code: err.code, message: err.message, sqlMessage: err.sqlMessage });
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  try {
    const [rows] = await pool.query('SELECT id, password_hash FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(400).json({ error: 'Invalid credentials' });
    const userRow = rows[0];
    const ok = await bcrypt.compare(password, userRow.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const user = { id: userRow.id, email };
    const refreshToken = signRefresh(user);
    await pool.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))', [user.id, refreshToken]);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const accessToken = signAccess(user);
    res.json({ accessToken, user: { id: user.id, email: user.email } });
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
    const [users] = await pool.query('SELECT id, email FROM users WHERE id = ?', [payload.id]);
    if (!users.length) return res.status(404).json({ error: 'User not found' });
    const user = users[0];
    const accessToken = signAccess(user);
    res.json({ accessToken, user: { id: user.id, email: user.email } });
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
