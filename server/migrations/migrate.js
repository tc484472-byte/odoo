const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  console.log('[Migration] Starting database migration...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    await db.initDb();
    console.log('[Migration] Executing schema SQL...');
    // Split statements or execute via client
    const client = await db.getClient();
    await client.query(sql);
    client.release();
    console.log('[Migration] Schema migration completed successfully!');
  } catch (err) {
    console.error('[Migration Error]:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0));
}

module.exports = { runMigration };
