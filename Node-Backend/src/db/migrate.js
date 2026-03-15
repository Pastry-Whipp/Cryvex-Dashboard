/**
 * Run this once to create all tables:
 *   node src/db/migrate.js
 */
require('dotenv').config();
const { Client } = require('pg');
const { sequelize } = require('./sequelize');

// Import all models to register them
require('../models/User');
require('../models/PipelineConfig');
require('../models/PipelineExecution');
require('../models/AuditLog');

async function createDatabaseIfNotExists() {
  const dbName = process.env.DB_NAME || 'cryvex_db';
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres', // Connect to default database
  });

  try {
    await client.connect();
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (res.rowCount === 0) {
      console.log(`Database "${dbName}" does not exist. Creating...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created successfully.`);
    } else {
      console.log(`✅ Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.error('❌ Error checking/creating database:', err);
    throw err;
  } finally {
    await client.end();
  }
}

async function migrate() {
  try {
    await createDatabaseIfNotExists();
    await sequelize.sync({ force: false, alter: true });
    console.log('✅ All tables created/updated successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
