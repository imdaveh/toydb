require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  console.warn('Warning: ACCESS_TOKEN_SECRET or REFRESH_TOKEN_SECRET not set. Use .env file based on .env.example');
}

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: FRONTEND, credentials: true }));

app.use('/auth', authRoutes);

// protected route example
function authenticate(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'Missing authorization' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid authorization format' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.get('/dashboard', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    res.json({ user: { id: user.id, email: user.email, createdAt: user.created_at } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
