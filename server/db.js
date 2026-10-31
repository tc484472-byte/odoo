const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

let pool = null;
let isMemoryMode = false;

const dataDir = path.join(__dirname, 'data');
const snapshotFile = path.join(dataDir, 'db_snapshot.json');

const TABLES = [
  'users',
  'customers',
  'products',
  'product_variants',
  'plans',
  'plan_products',
  'discount_rules',
  'tax_rules',
  'quotations',
  'quotation_items',
  'subscriptions',
  'subscription_items',
  'invoices',
  'invoice_items',
  'payments',
  'discount_usage',
  'notifications',
  'automation_logs',
  'audit_logs',
  'password_reset_tokens'
];

let saveTimeout = null;

// Save tables to local disk snapshot
async function saveSnapshot() {
  if (!isMemoryMode || !pool) return;
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const snapshot = {};
    for (const table of TABLES) {
      try {
        const res = await pool.query(`SELECT * FROM ${table}`);
        snapshot[table] = res.rows || [];
      } catch (err) {
        snapshot[table] = [];
      }
    }

    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB Snapshot Save Error]:', err.message);
  }
}

function scheduleSnapshot() {
  if (!isMemoryMode) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveSnapshot().catch(() => {});
  }, 400);
}

// Restore tables from local disk snapshot
async function loadSnapshot() {
  if (!isMemoryMode || !pool) return false;
  if (!fs.existsSync(snapshotFile)) return false;

  try {
    const raw = fs.readFileSync(snapshotFile, 'utf8');
    const snapshot = JSON.parse(raw);

    // Check if snapshot contains data
    const userCount = snapshot.users ? snapshot.users.length : 0;
    if (userCount === 0) return false;

    console.log(`[DB] Found existing local disk snapshot with ${userCount} users. Restoring tables...`);

    for (const table of TABLES) {
      const rows = snapshot[table] || [];
      if (rows.length === 0) continue;

      for (const row of rows) {
        const keys = Object.keys(row);
        const values = Object.values(row);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const cols = keys.join(', ');

        try {
          await pool.query(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, values);
        } catch (insertErr) {
          // Ignore individual row conflict if already present
        }
      }
    }

    console.log('[DB] Local database state restored from snapshot successfully.');
    return true;
  } catch (err) {
    console.error('[DB Snapshot Load Error]:', err.message);
    return false;
  }
}

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

  // Fallback to in-memory PostgreSQL emulator (pg-mem) with pg adapter & local disk persistence
  try {
    const { newDb } = require('pg-mem');
    const memDb = newDb();

    // Register PostgreSQL UUID generator
    memDb.public.registerFunction({
      name: 'uuid_generate_v4',
      returns: memDb.public.getType('text'),
      implementation: () => require('crypto').randomUUID()
    });

    // Patch pg-mem table prototype so that inserting explicit IDs auto-advances the serial sequence counter
    try {
      memDb.public.none('CREATE TABLE _seq_patch (id SERIAL PRIMARY KEY);');
      const patchTbl = memDb.public.getTable('_seq_patch');
      const TableProto = Object.getPrototypeOf(patchTbl);
      const origDoInsert = TableProto.doInsert;
      TableProto.doInsert = function(t, toInsert, opts) {
        if (this.serialsId) {
          let serials = t.getMap(this.serialsId);
          for (const [k, v] of serials.entries()) {
            if (toInsert[k] !== undefined && toInsert[k] !== null) {
              const num = Number(toInsert[k]);
              if (!isNaN(num) && num > v) {
                serials = serials.set(k, num);
              }
            }
          }
          t.set(this.serialsId, serials);
        }
        return origDoInsert.call(this, t, toInsert, opts);
      };
      memDb.public.none('DROP TABLE _seq_patch;');
    } catch (patchErr) {
      console.warn('[DB] Could not patch pg-mem sequence:', patchErr.message);
    }

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

    // Helper to synchronize all SERIAL sequences with current MAX(id)
    const syncAllSequences = () => {
      for (const table of TABLES) {
        try {
          const t = memDb.public.getTable(table);
          if (t && t.serialsId) {
            let serials = memDb.data.getMap(t.serialsId);
            const res = memDb.public.many(`SELECT COALESCE(MAX(id), 0) as max_id FROM ${table}`);
            const maxId = Number(res[0]?.max_id || 0);
            if (maxId > 0) {
              serials = serials.set('id', maxId);
              memDb.data.set(t.serialsId, serials);
            }
          }
        } catch (e) {}
      }
    };

    // Attempt to load previous snapshot from disk
    const restored = await loadSnapshot();
    if (!restored) {
      // Seed fresh demonstration data
      const { seedData } = require('./migrations/seed');
      await seedData();
      await saveSnapshot();
    }

    // Ensure all sequences are aligned with seeded or restored records
    syncAllSequences();
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

    // Auto-save snapshot on mutations in memory mode
    if (isMemoryMode && /^\s*(INSERT|UPDATE|DELETE)\b/i.test(text)) {
      scheduleSnapshot();
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
  const client = await pool.connect();
  const origQuery = client.query.bind(client);

  client.query = async (text, params) => {
    const res = await origQuery(text, params);
    if (isMemoryMode && typeof text === 'string' && /^\s*(INSERT|UPDATE|DELETE|COMMIT)\b/i.test(text)) {
      scheduleSnapshot();
    }
    return res;
  };

  return client;
}

module.exports = {
  query,
  getClient,
  initDb,
  saveSnapshot,
  isInMemory: () => isMemoryMode
};
