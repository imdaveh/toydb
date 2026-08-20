const jwt = require('jsonwebtoken');
const pool = require('../db');

async function authenticate(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'Missing authorization' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid authorization format' });
  const token = parts[1];
  let payload;
  try {
    payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const [users] = await pool.query('SELECT id, email, is_admin FROM users WHERE id = ? AND enabled = TRUE', [payload.id]);
    if (!users.length) return res.status(403).json({ error: 'Account is disabled' });
    req.user = { id: users[0].id, email: users[0].email, isAdmin: Boolean(users[0].is_admin) };
    next();
  } catch (err) {
    console.error('Authentication lookup failed:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Administrator access required' });
  next();
}

module.exports = { authenticate, requireAdmin };
