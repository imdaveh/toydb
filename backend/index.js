require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const toysRoutes = require('./routes/toys');
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

// serve uploaded images
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

app.use('/auth', authRoutes);
app.use('/toys', toysRoutes);

app.get('/dashboard', require('./middleware/auth').authenticate, async (req, res) => {
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
