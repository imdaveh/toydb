const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function splitStatements(sql) {
  // naive split on semicolons; keep it simple for typical migration files
  return sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

(async () => {
  try {
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '3306', 10);
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD || process.env.DB_PASS;
    const database = process.env.DB_NAME;
    if (!user || !password || !database) {
      console.error('Missing DB env vars. Set DB_USER, DB_PASSWORD, DB_NAME (and optionally DB_HOST, DB_PORT).');
      process.exit(2);
    }
    const migrationFile = process.argv[2] || 'add_toys.sql';
    const sqlPath = path.join(__dirname, '..', 'migrations', migrationFile);
    if (!fs.existsSync(sqlPath)) {
      console.error('Migration file not found at', sqlPath);
      process.exit(2);
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const conn = await mysql.createConnection({ host, port, user, password, database, multipleStatements: false });
    console.log('Connected to DB', host + ':' + port + '/' + database);
    console.log('Running migration file:', sqlPath);

    const statements = splitStatements(sql);
    for (const raw of statements) {
      const stmt = raw.replace(/;\s*$/, '').trim();
      if (!stmt) continue;

      const alterIfMatch = stmt.match(/ALTER\s+TABLE\s+`?toys`?\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+`?([^`\s]+)`?\s+(.+)/i);
      if (alterIfMatch) {
        const col = alterIfMatch[1];
        let def = alterIfMatch[2].trim();
        def = def.replace(/;$/, '').trim();
        // check if column exists
        const [rows] = await conn.query('SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?', [database, 'toys', col]);
        const cnt = rows && rows[0] && (rows[0].cnt !== undefined ? rows[0].cnt : rows[0]['COUNT(*)']);
        if (cnt) {
          console.log(`Column ${col} already exists, skipping`);
          continue;
        }
        const alterStmt = `ALTER TABLE toys ADD COLUMN \`${col}\` ${def}`;
        console.log('Executing:', alterStmt);
        try {
          await conn.query(alterStmt);
        } catch (e) {
          console.error('Failed to add column', col, e.message || e);
          throw e;
        }
        continue;
      }

      // For other statements, run them and allow CREATE ... IF NOT EXISTS to be no-ops.
      try {
        console.log('Executing statement:', stmt.split('\n')[0].slice(0,200));
        await conn.query(stmt);
      } catch (e) {
        // ignore errors where object already exists (e.g., duplicate column/table) and continue
        const msg = (e && e.message) ? e.message : String(e);
        if (/already exists/i.test(msg) || /Duplicate column/i.test(msg) || /Duplicate entry/i.test(msg)) {
          console.log('Ignored expected error:', msg);
          continue;
        }
        console.error('Statement failed:', msg);
        throw e;
      }
    }

    console.log('Migration completed successfully.');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err && (err.stack || err.message || err));
    process.exit(1);
  }
})();