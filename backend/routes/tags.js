const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

// List all tags (available to any authenticated user for forms/filters)
router.get('/', authenticate, async (req, res) => {
  try {
    const [tags] = await pool.query('SELECT id, name FROM tags ORDER BY name');
    res.json({ tags });
  } catch (err) {
    console.error('List tags error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
