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

  async getTableStats(tableName, schema = 'public') {
    const columns = await this.getTableColumns(tableName, schema);

    // Get row count
    const countResult = await queryTargetDb(
      `SELECT COUNT(*) as total FROM "${schema}"."${tableName}"`
    );
    const totalRows = parseInt(countResult.rows[0].total);

    const columnStats = [];

    for (const col of columns) {
      const colName = col.column_name;
      const dataType = col.data_type;

      // Basic stats: null count, distinct count
      const basicResult = await queryTargetDb(
        `SELECT
          COUNT(*) FILTER (WHERE "${colName}" IS NULL) as null_count,
          COUNT(DISTINCT "${colName}") as distinct_count
        FROM "${schema}"."${tableName}"`
      );

      const stat = {
        column_name: colName,
        data_type: dataType,
        null_count: parseInt(basicResult.rows[0].null_count),
        distinct_count: parseInt(basicResult.rows[0].distinct_count),
        null_percentage: totalRows > 0
          ? parseFloat(((parseInt(basicResult.rows[0].null_count) / totalRows) * 100).toFixed(1))
          : 0
      };

      // Numeric columns: min, max, avg
      const numericTypes = ['integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision'];
      if (numericTypes.includes(dataType)) {
        try {
          const numResult = await queryTargetDb(
            `SELECT
              MIN("${colName}")::float as min_val,
              MAX("${colName}")::float as max_val,
              AVG("${colName}")::float as avg_val,
              SUM("${colName}")::float as sum_val
            FROM "${schema}"."${tableName}"
            WHERE "${colName}" IS NOT NULL`
          );
          if (numResult.rows[0]) {
            stat.min = numResult.rows[0].min_val;
            stat.max = numResult.rows[0].max_val;
            stat.avg = numResult.rows[0].avg_val !== null
              ? parseFloat(numResult.rows[0].avg_val.toFixed(2))
              : null;
            stat.sum = numResult.rows[0].sum_val;
          }

          // Distribution: 10 buckets
          if (stat.min !== null && stat.max !== null && stat.min !== stat.max) {
            const bucketResult = await queryTargetDb(
              `SELECT
                width_bucket("${colName}"::float, $1::float, $2::float + 0.001, 10) as bucket,
                COUNT(*) as count
              FROM "${schema}"."${tableName}"
              WHERE "${colName}" IS NOT NULL
              GROUP BY bucket
              ORDER BY bucket`,
              [stat.min, stat.max]
            );
            const range = stat.max - stat.min;
            stat.distribution = bucketResult.rows.map(r => ({
              bucket: parseInt(r.bucket),
              count: parseInt(r.count),
              range_start: parseFloat((stat.min + (parseInt(r.bucket) - 1) * (range / 10)).toFixed(2)),
              range_end: parseFloat((stat.min + parseInt(r.bucket) * (range / 10)).toFixed(2))
            }));
          }
        } catch (err) {
          // skip numeric stats if query fails
        }
      }

      // Text / categorical columns: top 10 values
      const textTypes = ['character varying', 'text', 'varchar', 'boolean'];
      if (textTypes.includes(dataType) || stat.distinct_count <= 50) {
        try {
          const topResult = await queryTargetDb(
            `SELECT "${colName}"::text as value, COUNT(*) as count
            FROM "${schema}"."${tableName}"
            WHERE "${colName}" IS NOT NULL
            GROUP BY "${colName}"
            ORDER BY count DESC
            LIMIT 10`
          );
          stat.top_values = topResult.rows.map(r => ({
            value: r.value,
            count: parseInt(r.count)
          }));
        } catch (err) {
          // skip top values if query fails
        }
      }

      columnStats.push(stat);
    }

    // Column type distribution
    const typeCounts = {};
    columns.forEach(c => {
      const type = c.data_type;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    const typeDistribution = Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count
    }));

    return {
      table_name: tableName,
      total_rows: totalRows,
      total_columns: columns.length,
      type_distribution: typeDistribution,
      column_stats: columnStats
    };
  }
}

const targetDbService = new TargetDatabaseService();
module.exports = { targetDbService };