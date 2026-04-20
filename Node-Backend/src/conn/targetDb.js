const { Pool } = require('pg');

let targetPool = null;

function getTargetPool() {
  if (!targetPool) {
    targetPool = new Pool({
      host: process.env.TARGET_DB_HOST || 'etl_target_db',
      port: parseInt(process.env.TARGET_DB_PORT || '5432'),
      database: process.env.TARGET_DB_NAME || 'etl_data',
      user: process.env.TARGET_DB_USER || 'postgres',
      password: process.env.TARGET_DB_PASSWORD || 'postgres',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }
  return targetPool;
}

function isTargetConfigured() {
  return !!(
    process.env.TARGET_DB_HOST &&
    process.env.TARGET_DB_NAME &&
    process.env.TARGET_DB_USER
  );
}

async function queryTargetDb(sql, params = []) {
  const pool = getTargetPool();
  const client = await pool.connect();
  try {
    // Return the full pg result object so callers can access .rows, .fields, .rowCount, etc.
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

module.exports = { getTargetPool, isTargetConfigured, queryTargetDb };
