const yaml = require('js-yaml');
const { isTargetConfigured, queryTargetDb } = require('../conn/targetDb');

class TargetDatabaseService {
  get isConfigured() {
    return isTargetConfigured();
  }

  async testConnection() {
    try {
      await queryTargetDb('SELECT 1');
      return true;
    } catch (err) {
      console.error('Target DB connection failed:', err.message);
      return false;
    }
  }

  extractTablesFromConfig(yamlConfig) {
    try {
      const config = yaml.load(yamlConfig);
      const tables = [];

      // Format 1: config.tables.<name>.target.table_name (base tables)
      if (config.tables && typeof config.tables === 'object') {
        Object.values(config.tables).forEach(t => {
          if (t?.target?.table_name) tables.push(t.target.table_name);
        });
      }

      // Format 2: config.derived_tables.<name>.target.table_name
      if (config.derived_tables && typeof config.derived_tables === 'object') {
        Object.values(config.derived_tables).forEach(t => {
          if (t?.target?.table_name) tables.push(t.target.table_name);
        });
      }

      // Format 3 (legacy): config.sources[].tables
      if (config.sources) {
        config.sources.forEach(s => {
          if (Array.isArray(s.tables)) tables.push(...s.tables);
          else if (typeof s.tables === 'string') tables.push(s.tables);
        });
      }

      // Format 4 (legacy): config.transformations[].output_table
      if (config.transformations) {
        config.transformations.forEach(t => {
          if (t.output_table) tables.push(t.output_table);
        });
      }

      // Format 5 (legacy): config.destinations[].table / .tables
      if (config.destinations) {
        config.destinations.forEach(d => {
          if (d.table) tables.push(d.table);
          if (Array.isArray(d.tables)) tables.push(...d.tables);
        });
      }

      return [...new Set(tables)];
    } catch (err) {
      console.error('Error extracting tables from config:', err.message);
      return [];
    }
  }

  async getPipelineTables(pipelineConfigId, yamlConfig, schema = 'public') {
    const configuredTables = this.extractTablesFromConfig(yamlConfig);
    if (!configuredTables.length) return [];

    const placeholders = configuredTables.map((_, i) => `$${i + 2}`).join(',');
    const sql = `
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns c
         WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) as column_count,
        pg_size_pretty(pg_total_relation_size('"' || table_schema || '"."' || table_name || '"')) as size
      FROM information_schema.tables t
      WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
      AND table_name IN (${placeholders})
      ORDER BY table_name;
    `;

    const result = await queryTargetDb(sql, [schema, ...configuredTables]);
    const tables = result.rows;

    const existingNames = tables.map(t => t.table_name);
    const enriched = [];

    for (const table of tables) {
      try {
        const countResult = await queryTargetDb(`SELECT COUNT(*) as row_count FROM "${schema}"."${table.table_name}"`);
        table.row_count = parseInt(countResult.rows[0].row_count);
      } catch {
        table.row_count = 0;
      }
      table.pipeline_config_id = pipelineConfigId;
      table.exists = true;
      enriched.push(table);
    }

    // Include configured tables that don't exist in DB yet
    for (const name of configuredTables) {
      if (!existingNames.includes(name)) {
        enriched.push({
          table_name: name,
          column_count: 0,
          size: '0 bytes',
          row_count: 0,
          pipeline_config_id: pipelineConfigId,
          exists: false
        });
      }
    }

    return enriched;
  }

  async getTableColumns(tableName, schema = 'public') {
    const sql = `
      SELECT column_name, data_type, is_nullable, column_default,
             character_maximum_length, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `;
    const result = await queryTargetDb(sql, [schema, tableName]);
    return result.rows;
  }

  async getTableData(tableName, schema = 'public', page = 1, pageSize = 50, search = null, sortColumn = null, sortOrder = 'ASC') {
    const offset = (page - 1) * pageSize;
    const columns = await this.getTableColumns(tableName, schema);
    const columnNames = columns.map(c => c.column_name);

    let whereClause = '';
    let params = [];

    if (search) {
      const conditions = columnNames.map((_, i) => `"${columnNames[i]}"::text ILIKE $${i + 1}`);
      whereClause = 'WHERE ' + conditions.join(' OR ');
      params = columnNames.map(() => `%${search}%`);
    }

    const countResult = await queryTargetDb(
      `SELECT COUNT(*) as total FROM "${schema}"."${tableName}" ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].total);

    const orderClause = (sortColumn && columnNames.includes(sortColumn))
      ? `ORDER BY "${sortColumn}" ${sortOrder === 'DESC' ? 'DESC' : 'ASC'}`
      : '';

    const limitParam = `$${params.length + 1}`;
    const offsetParam = `$${params.length + 2}`;

    const dataResult = await queryTargetDb(
      `SELECT * FROM "${schema}"."${tableName}" ${whereClause} ${orderClause} LIMIT ${limitParam} OFFSET ${offsetParam}`,
      [...params, pageSize, offset]
    );

    return { data: dataResult.rows, totalCount };
  }

  async executeQuery(query, limit = 1000) {
    if (!query.trim().toUpperCase().startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed');
    }
    if (!query.toUpperCase().includes('LIMIT')) {
      query = `${query.trimEnd().replace(/;$/, '')} LIMIT ${limit}`;
    }
    const result = await queryTargetDb(query);
    const columnNames = result.fields ? result.fields.map(f => f.name) : [];
    return { data: result.rows, columns: columnNames };
  }

  async getTableSample(tableName, schema = 'public', limit = 5) {
    const result = await queryTargetDb(`SELECT * FROM "${schema}"."${tableName}" LIMIT $1`, [limit]);
    return result.rows;
  }
}

const targetDbService = new TargetDatabaseService();
module.exports = { targetDbService };