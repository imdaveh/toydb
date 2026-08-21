const path = require('path');
const fs = require('fs');

// Override with UPLOADS_DIR in production so uploaded photos live outside the
// deployed code directory and survive future deployments overwriting it.
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

module.exports = uploadsDir;
