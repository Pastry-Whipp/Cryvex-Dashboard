const { Pool } = require('pg');

let airflowPool = null;

function getAirflowPool() {
  if (!airflowPool) {
    airflowPool = new Pool({
      host: process.env.AIRFLOW_DB_HOST || 'localhost',
      port: parseInt(process.env.AIRFLOW_DB_PORT || '5432'),
      database: process.env.AIRFLOW_DB_NAME || 'postgres',
      user: process.env.AIRFLOW_DB_USER || 'postgres',
      password: process.env.AIRFLOW_DB_PASSWORD || 'postgres',
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }
  return airflowPool;
}

async function queryAirflowDb(sql, params = []) {
  const pool = getAirflowPool();
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

module.exports = { getAirflowPool, queryAirflowDb };
