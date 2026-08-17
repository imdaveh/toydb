const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  try {
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '3306', 10);
    const user = process.env.DB_USER;
    const password = process.env.DB_PASS;
    const database = process.env.DB_NAME;
    if (!user || !password || !database) {
      console.error('Missing DB env vars. Set DB_USER, DB_PASS, DB_NAME (and optionally DB_HOST, DB_PORT).');
      process.exit(2);
    }
    const sqlPath = path.join(__dirname, '..', 'backend', 'migrations', 'add_toys.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error('Migration file not found at', sqlPath);
      process.exit(2);
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const conn = await mysql.createConnection({ host, port, user, password, database, multipleStatements: true });
    console.log('Connected to DB', host + ':' + port + '/' + database);
    console.log('Running migration file:', sqlPath);
    await conn.query(sql);
    console.log('Migration completed successfully.');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err && (err.stack || err.message || err));
    process.exit(1);
  }
})();