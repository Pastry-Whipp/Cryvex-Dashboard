const PipelineConfig = require('../models/PipelineConfig');
const { ACTION_TYPE, ENTITY_TYPE } = require('../models/AuditLog');
const { auditService } = require('../services/auditService');
const { saveConfigFile, saveSchemaFiles, updateConfigFile, deleteConfigFile } = require('../utils/fileManager');

function serializeConfig(c) {
  return {
    id: c.id,
    user_id: c.user_id,
    name: c.name,
    description: c.description,
    domain: c.domain,
    version: c.version,
    yaml_config: c.yaml_config,
    json_schemas: c.json_schemas,
    schedule_enabled: c.schedule_enabled || false,
    schedule_cron: c.schedule_cron || null,
    schedule_type: c.schedule_type || null,
    last_scheduled_at: c.last_scheduled_at || null,
    created_at: c.created_at,
    updated_at: c.updated_at
  };
}

async function createPipelineConfig(req, res) {
  const { name, description, domain, version, yaml_config, json_schemas } = req.body;

  if (!name || !yaml_config || !json_schemas) {
    return res.status(400).json({ detail: 'name, yaml_config and json_schemas are required' });
  }

  const config = await PipelineConfig.create({
    user_id: req.user.id,
    name, description, domain, version,
    yaml_config,
    json_schemas: typeof json_schemas === 'string' ? json_schemas : JSON.stringify(json_schemas)
  });

  try {
    saveConfigFile(config.id, config.name, config.yaml_config);
    saveSchemaFiles(config.id, config.json_schemas);
  } catch (e) {
    console.error('Error saving config/schema files:', e.message);
  }

  await auditService.logAction({
    userId: req.user.id,
    actionType: ACTION_TYPE.CREATE,
    entityType: ENTITY_TYPE.PIPELINE_CONFIG,
    entityId: config.id,
    entityName: config.name,
    details: { domain: config.domain, version: config.version },
    ipAddress: req.ip
  });

  return res.status(201).json(serializeConfig(config));
}

async function getMyPipelineConfigs(req, res) {
  const configs = await PipelineConfig.findAll({
    where: { user_id: req.user.id },
    order: [['created_at', 'DESC']]
  });
  return res.json(configs.map(serializeConfig));
}

async function getPipelineConfig(req, res) {
  const config = await PipelineConfig.findOne({
    where: { id: req.params.config_id, user_id: req.user.id }
  });
  if (!config) return res.status(404).json({ detail: 'Pipeline configuration not found' });
  return res.json(serializeConfig(config));
}

async function updatePipelineConfig(req, res) {
  const config = await PipelineConfig.findOne({
    where: { id: req.params.config_id, user_id: req.user.id }
  });
  if (!config) return res.status(404).json({ detail: 'Pipeline configuration not found' });

  const allowedFields = ['name', 'description', 'domain', 'version', 'yaml_config', 'json_schemas', 'schedule_enabled', 'schedule_cron', 'schedule_type'];
  const updatedFields = [];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      config[field] = req.body[field];
      updatedFields.push(field);
    }
  }

  await config.save();

  if (updatedFields.includes('yaml_config') || updatedFields.includes('name')) {
    try {
      updateConfigFile(config.id, config.name, config.yaml_config);
    } catch (e) {
      console.error('Error updating config file:', e.message);
    }
  }

  if (updatedFields.includes('json_schemas')) {
    try {
      saveSchemaFiles(config.id, config.json_schemas);
    } catch (e) {
      console.error('Error updating schema files:', e.message);
    }
  }

  await auditService.logAction({
    userId: req.user.id,
    actionType: ACTION_TYPE.UPDATE,
    entityType: ENTITY_TYPE.PIPELINE_CONFIG,
    entityId: config.id,
    entityName: config.name,
    details: { updated_fields: updatedFields },
    ipAddress: req.ip
  });

  return res.json(serializeConfig(config));
}

async function deletePipelineConfig(req, res) {
  const configId = parseInt(req.params.config_id);
  const config = await PipelineConfig.findOne({
    where: { id: configId, user_id: req.user.id }
  });
  if (!config) return res.status(404).json({ detail: 'Pipeline configuration not found' });

  const configName = config.name;

  await auditService.logAction({
    userId: req.user.id,
    actionType: ACTION_TYPE.DELETE,
    entityType: ENTITY_TYPE.PIPELINE_CONFIG,
    entityId: configId,
    entityName: configName,
    ipAddress: req.ip
  });

  await config.destroy();

  try {
    deleteConfigFile(configId);
  } catch (e) {
    console.error('Error deleting config file:', e.message);
  }

  return res.status(204).send();
}

module.exports = {
  createPipelineConfig,
  getMyPipelineConfigs,
  getPipelineConfig,
  updatePipelineConfig,
  deletePipelineConfig
};
