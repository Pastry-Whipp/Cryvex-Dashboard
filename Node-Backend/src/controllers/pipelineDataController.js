const PipelineConfig = require('../models/PipelineConfig');
const { targetDbService } = require('../services/targetDatabaseService');
const { decryptRows } = require('../utils/decryptionHelper');

async function checkDatabaseHealth(req, res) {
  if (!targetDbService.isConfigured) {
    return res.json({ is_connected: false, message: 'Target database is not configured. Please set TARGET_DB_* environment variables.' });
  }
  const is_connected = await targetDbService.testConnection();
  return res.json({
    is_connected,
    message: is_connected ? 'Target database is connected and accessible' : 'Unable to connect to target database'
  });
}

async function getUserPipelines(req, res) {
  const pipelines = await PipelineConfig.findAll({ where: { user_id: req.user.id } });

  const result = pipelines.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    domain: p.domain,
    table_count: targetDbService.extractTablesFromConfig(p.yaml_config).length,
    created_at: p.created_at.toISOString()
  }));

  return res.json(result);
}

async function getPipelineTables(req, res) {
  const pipelineId = parseInt(req.params.pipeline_id);
  const schema = req.query.schema || 'public';

  if (!targetDbService.isConfigured) {
    return res.status(503).json({ detail: 'Target database is not configured' });
  }

  const pipeline = await PipelineConfig.findOne({ where: { id: pipelineId, user_id: req.user.id } });
  if (!pipeline) return res.status(404).json({ detail: 'Pipeline not found or access denied' });

  try {
    const tables = await targetDbService.getPipelineTables(pipeline.id, pipeline.yaml_config, schema);
    tables.forEach(t => { t.pipeline_name = pipeline.name; });
    return res.json(tables);
  } catch (err) {
    return res.status(500).json({ detail: `Failed to fetch pipeline tables: ${err.message}` });
  }
}

async function getTableColumns(req, res) {
  const { table_name } = req.params;
  const { pipeline_id, schema = 'public' } = req.query;

  if (!targetDbService.isConfigured) return res.status(503).json({ detail: 'Target database is not configured' });

  const pipeline = await PipelineConfig.findOne({ where: { id: pipeline_id, user_id: req.user.id } });
  if (!pipeline) return res.status(404).json({ detail: 'Pipeline not found or access denied' });

  const configured = targetDbService.extractTablesFromConfig(pipeline.yaml_config);
  if (!configured.includes(table_name)) {
    return res.status(403).json({ detail: 'Table is not part of this pipeline configuration' });
  }

  try {
    const columns = await targetDbService.getTableColumns(table_name, schema);
    return res.json(columns);
  } catch (err) {
    return res.status(500).json({ detail: `Failed to fetch columns: ${err.message}` });
  }
}

async function getTableData(req, res) {
  const { table_name } = req.params;
  const {
    pipeline_id, schema = 'public',
    page = '1', page_size = '50',
    search, sort_column, sort_order = 'ASC'
  } = req.query;

  if (!targetDbService.isConfigured) return res.status(503).json({ detail: 'Target database is not configured' });

  const pipeline = await PipelineConfig.findOne({ where: { id: pipeline_id, user_id: req.user.id } });
  if (!pipeline) return res.status(404).json({ detail: 'Pipeline not found or access denied' });

  const configured = targetDbService.extractTablesFromConfig(pipeline.yaml_config);
  if (!configured.includes(table_name)) {
    return res.status(403).json({ detail: 'Table is not part of this pipeline configuration' });
  }

  try {
    const pageNum = parseInt(page);
    const pageSizeNum = Math.min(parseInt(page_size), 500);

    const { data, totalCount } = await targetDbService.getTableData(
      table_name, schema, pageNum, pageSizeNum, search, sort_column, sort_order
    );
    const columns = await targetDbService.getTableColumns(table_name, schema);
    const total_pages = Math.ceil(totalCount / pageSizeNum);

    const decryptedData = decryptRows(data, pipeline.yaml_config);

    return res.json({
      data: decryptedData,
      columns: columns.map(c => c.column_name),
      total_count: totalCount,
      page: pageNum,
      page_size: pageSizeNum,
      total_pages,
      table_name,
      pipeline_name: pipeline.name
    });
  } catch (err) {
    return res.status(500).json({ detail: `Failed to fetch table data: ${err.message}` });
  }
}

async function executeQuery(req, res) {
  const { pipeline_id } = req.query;
  const { query, limit = 1000 } = req.body;

  if (!targetDbService.isConfigured) return res.status(503).json({ detail: 'Target database is not configured' });

  const pipeline = await PipelineConfig.findOne({ where: { id: pipeline_id, user_id: req.user.id } });
  if (!pipeline) return res.status(404).json({ detail: 'Pipeline not found or access denied' });

  try {
    const { data, columns } = await targetDbService.executeQuery(query, parseInt(limit));
    // For ad-hoc queries we don't have a schema-level column list, so we try to
    // decrypt using the pipeline's encryption config — columns not present in the
    // result are silently skipped inside decryptRows.
    const decryptedData = decryptRows(data, pipeline.yaml_config);
    return res.json({
      data: decryptedData,
      columns,
      row_count: decryptedData.length,
      message: `Query executed successfully. Returned ${decryptedData.length} rows.`
    });
  } catch (err) {
    if (err.message.includes('Only SELECT')) {
      return res.status(400).json({ detail: err.message });
    }
    return res.status(500).json({ detail: `Query execution failed: ${err.message}` });
  }
}

async function getTableSample(req, res) {
  const { table_name } = req.params;
  const { pipeline_id, schema = 'public', limit = '5' } = req.query;

  if (!targetDbService.isConfigured) return res.status(503).json({ detail: 'Target database is not configured' });

  const pipeline = await PipelineConfig.findOne({ where: { id: pipeline_id, user_id: req.user.id } });
  if (!pipeline) return res.status(404).json({ detail: 'Pipeline not found or access denied' });

  const configured = targetDbService.extractTablesFromConfig(pipeline.yaml_config);
  if (!configured.includes(table_name)) {
    return res.status(403).json({ detail: 'Table is not part of this pipeline configuration' });
  }

  try {
    const sample_data = await targetDbService.getTableSample(table_name, schema, parseInt(limit));
    const columns = await targetDbService.getTableColumns(table_name, schema);
    const decryptedSample = decryptRows(sample_data, pipeline.yaml_config);
    return res.json({
      data: decryptedSample,
      columns: columns.map(c => c.column_name),
      sample_size: decryptedSample.length,
      pipeline_name: pipeline.name
    });
  } catch (err) {
    return res.status(500).json({ detail: `Failed to fetch sample data: ${err.message}` });
  }
}

async function getTableStats(req, res) {
  const { table_name } = req.params;
  const { pipeline_id, schema = 'public' } = req.query;

  if (!targetDbService.isConfigured) return res.status(503).json({ detail: 'Target database is not configured' });

  const pipeline = await PipelineConfig.findOne({ where: { id: pipeline_id, user_id: req.user.id } });
  if (!pipeline) return res.status(404).json({ detail: 'Pipeline not found or access denied' });

  const configured = targetDbService.extractTablesFromConfig(pipeline.yaml_config);
  if (!configured.includes(table_name)) {
    return res.status(403).json({ detail: 'Table is not part of this pipeline configuration' });
  }

  try {
    const stats = await targetDbService.getTableStats(table_name, schema);
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ detail: `Failed to fetch table stats: ${err.message}` });
  }
}

module.exports = {
  checkDatabaseHealth,
  getUserPipelines,
  getPipelineTables,
  getTableColumns,
  getTableData,
  executeQuery,
  getTableSample,
  getTableStats
};
