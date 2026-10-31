const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

let pool = null;
let isMemoryMode = false;

// Initialize Database Connection
async function initDb() {
  if (pool) return;

  const connectionString = process.env.DATABASE_URL;

  if (connectionString && connectionString.trim() !== '') {
    try {
      console.log('[DB] Connecting to PostgreSQL database...');
      const isSsl = process.env.NODE_ENV === 'production' || connectionString.includes('supabase');
      pool = new Pool({
        connectionString,
        ssl: isSsl ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      const client = await pool.connect();
      const res = await client.query('SELECT NOW() as current_time');
      client.release();
      console.log(`[DB] Connected to PostgreSQL successfully at ${res.rows[0].current_time}`);
      isMemoryMode = false;
      return;
    } catch (err) {
      console.warn(`[DB] PostgreSQL connection failed: ${err.message}. Falling back to In-Memory PostgreSQL engine.`);
    }
  } else {
    console.log('[DB] No DATABASE_URL specified. Initializing In-Memory PostgreSQL engine...');
  }

  // Fallback to in-memory PostgreSQL emulator (pg-mem) with pg adapter
  try {
    const { newDb } = require('pg-mem');
    const memDb = newDb();

    // Register PostgreSQL UUID generator
    memDb.public.registerFunction({
      name: 'uuid_generate_v4',
      returns: memDb.public.getType('text'),
      implementation: () => require('crypto').randomUUID()
    });

    // Create pg drop-in adapter
    const pgAdapter = memDb.adapters.createPg();
    pool = new pgAdapter.Pool();

    // Read and execute schema
    const schemaSql = fs.readFileSync(path.join(__dirname, 'migrations', 'schema.sql'), 'utf8');
    const cleanSql = schemaSql
      .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/g, '')
      .replace(/TIMESTAMPTZ/g, 'TIMESTAMP');

    // Execute schema tables
    memDb.public.none(cleanSql);
    isMemoryMode = true;
    console.log('[DB] In-Memory PostgreSQL database initialized with schema successfully.');
  } catch (err) {
    console.error('[DB] Failed to initialize database:', err);
    throw err;
  }
}

// Universal Query function
async function query(text, params = []) {
  if (!pool) {
    await initDb();
  }

  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL === 'true') {
      console.log(`[DB Query - ${duration}ms]: ${text.substring(0, 80)}...`);
    }
    return res;
  } catch (err) {
    console.error(`[DB Error] Query: ${text} | Error: ${err.message}`);
    throw err;
  }
}

// Transaction client helper
async function getClient() {
  if (!pool) {
    await initDb();
  }
  return await pool.connect();
}

module.exports = {
  query,
  getClient,
  initDb,
  isInMemory: () => isMemoryMode
};
