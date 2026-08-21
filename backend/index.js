require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const toysRoutes = require('./routes/toys');
const adminRoutes = require('./routes/admin');
const tagsRoutes = require('./routes/tags');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const allowedOrigins = new Set([
  ...FRONTEND.split(',').map(origin => origin.trim()).filter(Boolean),
  ...(process.env.CORS_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean),
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://[::1]:5173',
  'http://[::1]:4173',
  'https://mntoyhunters.com',
  'https://www.mntoyhunters.com'
]);

if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  console.warn('Warning: ACCESS_TOKEN_SECRET or REFRESH_TOKEN_SECRET not set. Use .env file based on .env.example');
}

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));

// serve uploaded images
app.use('/uploads', express.static(require('./uploadsPath')));

app.use('/auth', authRoutes);
app.use('/toys', toysRoutes);
app.use('/admin', adminRoutes);
app.use('/tags', tagsRoutes);

app.get('/health', async (req, res) => {
  try {
    if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
      return res.status(503).json({ ok: false });
    }
    await pool.query('SELECT 1 FROM users LIMIT 1');
    await pool.query('SELECT 1 FROM refresh_tokens LIMIT 1');
    res.json({ ok: true });
  } catch (err) {
    console.error('Health check failed:', err && (err.code || err.message));
    res.status(503).json({ ok: false });
  }
});

app.get('/dashboard', require('./middleware/auth').authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, email, is_admin, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    res.json({ user: { id: user.id, email: user.email, isAdmin: Boolean(user.is_admin), createdAt: user.created_at } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
