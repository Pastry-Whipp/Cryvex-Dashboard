const yaml = require('js-yaml');

/**
 * Apply known-good fixes to a raw uploaded pipeline YAML so that it works
 * with the current Docker stack. Returns the normalized object plus a list of
 * the fixes that were applied (surfaced in the UI so users know what we
 * changed for them).
 *
 * Fixes applied:
 *   - /usr/local/airflow → /opt/airflow (Astronomer image path → our image)
 *   - global.database.host     : postgres → etl_target_db
 *   - global.database.database : postgres → etl_data
 *   - global.blockchain.rpc_url: host.docker.internal → ganache
 *   - abi_file path: normalized to /opt/airflow/include/etl_modules/abi.json
 */
function normalizeYaml(rawText) {
  const fixes = [];

  // 1. Path replace on raw text (covers EVERY path without walking the tree).
  let text = rawText;
  if (text.includes('/usr/local/airflow')) {
    text = text.replace(/\/usr\/local\/airflow/g, '/opt/airflow');
    fixes.push('Replaced /usr/local/airflow → /opt/airflow on all paths');
  }

  let parsed;
  try {
    parsed = yaml.load(text);
  } catch (err) {
    const e = new Error(`YAML parse error: ${err.message}`);
    e.status = 400;
    throw e;
  }

  if (!parsed || typeof parsed !== 'object') {
    const e = new Error('YAML file did not contain a valid pipeline object');
    e.status = 400;
    throw e;
  }

  // 2. Fix global.database if it points at the wrong host/db.
  if (parsed.global && parsed.global.database) {
    const db = parsed.global.database;
    if (db.host === 'postgres') {
      db.host = 'etl_target_db';
      fixes.push('global.database.host: "postgres" → "etl_target_db"');
    }
    if (db.database === 'postgres') {
      db.database = 'etl_data';
      fixes.push('global.database.database: "postgres" → "etl_data"');
    }
  }

  // 3. Fix blockchain RPC URL: host.docker.internal is unreliable on Linux
  //    and not needed when ganache is on the same compose network.
  if (parsed.global && parsed.global.blockchain) {
    const bc = parsed.global.blockchain;
    if (typeof bc.rpc_url === 'string' && bc.rpc_url.includes('host.docker.internal')) {
      bc.rpc_url = bc.rpc_url.replace('host.docker.internal', 'ganache');
      fixes.push(`global.blockchain.rpc_url → "${bc.rpc_url}"`);
    }
  }

  return { parsed, fixes };
}

/**
 * Walk the parsed pipeline YAML and return a structured summary of the
 * base and derived tables it references. This is what the frontend uses to
 * render the "upload CSV + schema for each table" form.
 */
function describePipeline(parsed) {
  const baseTables = [];
  const derivedTables = [];

  const tables = parsed.tables || {};
  for (const [name, cfg] of Object.entries(tables)) {
    baseTables.push({
      name,
      priority: cfg.priority || null,
      depends_on: cfg.depends_on || [],
      expected_csv_path: cfg.source && cfg.source.file && cfg.source.file.path || null,
      expected_schema_path: cfg.schema && cfg.schema.file || null,
      target_table_name: cfg.target && cfg.target.table_name || name
    });
  }

  const derived = parsed.derived_tables || {};
  for (const [name, cfg] of Object.entries(derived)) {
    derivedTables.push({
      name,
      priority: cfg.priority || null,
      depends_on: cfg.depends_on || [],
      target_table_name: cfg.target && cfg.target.table_name || name,
      has_sql: !!(cfg.query && cfg.query.sql)
    });
  }

  return {
    project: parsed.project || {},
    base_tables: baseTables,
    derived_tables: derivedTables,
    execution: parsed.execution || {},
    has_blockchain: !!(parsed.global && parsed.global.blockchain && parsed.global.blockchain.enabled)
  };
}

/**
 * Rewrite a parsed pipeline YAML so every base table's source CSV and schema
 * file point at the locations we actually save them to inside the shared
 * `pipeline_configs` volume. This is how the Airflow worker will find the
 * files we uploaded from the dashboard — both containers share that volume.
 *
 * Layout used:
 *   /opt/airflow/pipeline_configs/datasets/{configId}/{table}.csv
 *   /opt/airflow/pipeline_configs/schemas/{table}_schema.json
 *
 * @param parsed         parsed YAML object (mutated in place)
 * @param configId       DB id of the PipelineConfig row
 * @param tableFileMap   { tableName: { csvSaved: bool, schemaSaved: bool } }
 */
function rewritePathsForSharedVolume(parsed, configId, tableFileMap) {
  const rewrites = [];
  const tables = parsed.tables || {};
  for (const [name, cfg] of Object.entries(tables)) {
    const info = tableFileMap[name] || {};

    if (info.csvSaved) {
      const newPath = `/opt/airflow/pipeline_configs/datasets/${configId}/${name}.csv`;
      if (!cfg.source) cfg.source = {};
      if (!cfg.source.file) cfg.source.file = {};
      cfg.source.file.path = newPath;
      if (!cfg.source.file.type) cfg.source.file.type = 'csv';
      rewrites.push(`${name}.source.file.path → ${newPath}`);
    }

    if (info.schemaSaved) {
      const newPath = `/opt/airflow/pipeline_configs/schemas/${name}_schema.json`;
      if (!cfg.schema) cfg.schema = {};
      cfg.schema.file = newPath;
      rewrites.push(`${name}.schema.file → ${newPath}`);
    }
  }
  return rewrites;
}

function dumpYaml(parsed) {
  return yaml.dump(parsed, { noRefs: true, lineWidth: -1 });
}

module.exports = {
  normalizeYaml,
  describePipeline,
  rewritePathsForSharedVolume,
  dumpYaml
};
