const PipelineConfig = require('../models/PipelineConfig');
const { ACTION_TYPE, ENTITY_TYPE } = require('../models/AuditLog');
const { auditService } = require('../services/auditService');
const {
  saveConfigFile,
  saveSchemaFiles,
  saveSingleSchemaFile,
  saveDatasetFile,
  updateConfigFile,
  deleteConfigFile
} = require('../utils/fileManager');
const {
  normalizeYaml,
  describePipeline,
  rewritePathsForSharedVolume,
  dumpYaml
} = require('../utils/yamlNormalizer');

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

/**
 * Parse an uploaded YAML file, auto-fix common mistakes (paths, hosts,
 * rpc_url), and return a structured description of the pipeline so the
 * frontend can render a file-upload form (one CSV + one schema per base
 * table). Nothing is persisted at this step — it's a preview.
 *
 * Expected input: multipart/form-data with a single "yaml_file" field, OR
 *                 JSON body { yaml_text: "..." }
 */
async function parseYaml(req, res) {
  try {
    let rawText = null;
    if (req.file && req.file.buffer) {
      rawText = req.file.buffer.toString('utf8');
    } else if (req.body && req.body.yaml_text) {
      rawText = req.body.yaml_text;
    }
    if (!rawText) {
      return res.status(400).json({ detail: 'yaml_file or yaml_text is required' });
    }

    const { parsed, fixes } = normalizeYaml(rawText);
    const summary = describePipeline(parsed);

    return res.json({
      fixes_applied: fixes,
      summary,
      normalized_yaml: dumpYaml(parsed)
    });
  } catch (err) {
    return res.status(err.status || 500).json({ detail: err.message });
  }
}

/**
 * Upload a full pipeline "bundle": a normalized YAML plus one CSV + one
 * schema JSON per base table referenced in it. All files land in the shared
 * pipeline_configs volume and the YAML is rewritten so Airflow finds them.
 *
 * Expected input: multipart/form-data with fields:
 *   - name, description, domain, version  (strings)
 *   - yaml_text                            (the normalized YAML as a string)
 *   - csv_<tableName>                      (one file per table, required)
 *   - schema_<tableName>                   (one file per table, required)
 */
async function uploadBundle(req, res) {
  try {
    const { name, description, domain, version, yaml_text } = req.body;
    if (!name || !yaml_text) {
      return res.status(400).json({ detail: 'name and yaml_text are required' });
    }

    // Re-parse the normalized YAML (frontend sends back what /parse-yaml
    // returned, but we never trust the client so we normalize again).
    const { parsed } = normalizeYaml(yaml_text);
    const summary = describePipeline(parsed);

    // Index uploaded files by field name for quick lookup.
    // multer.fields() gives us req.files as { fieldName: [File, ...] }.
    const files = req.files || {};
    const missing = [];
    for (const t of summary.base_tables) {
      if (!files[`csv_${t.name}`] || !files[`csv_${t.name}`][0]) {
        missing.push(`csv_${t.name}`);
      }
      if (!files[`schema_${t.name}`] || !files[`schema_${t.name}`][0]) {
        missing.push(`schema_${t.name}`);
      }
    }
    if (missing.length) {
      return res.status(400).json({
        detail: `Missing required files for base tables: ${missing.join(', ')}`
      });
    }

    // 1. Create the config row first so we have an ID for dataset paths.
    const config = await PipelineConfig.create({
      user_id: req.user.id,
      name,
      description: description || null,
      domain: domain || null,
      version: version || null,
      yaml_config: '',  // filled in below after we rewrite paths
      json_schemas: '[]'
    });

    // 2. Save per-table CSVs and schemas into the shared volume.
    const schemasArray = [];
    const tableFileMap = {};
    for (const t of summary.base_tables) {
      const csvFile = files[`csv_${t.name}`][0];
      saveDatasetFile(config.id, t.name, csvFile.buffer);

      const schemaFile = files[`schema_${t.name}`][0];
      let schemaObj;
      try {
        schemaObj = JSON.parse(schemaFile.buffer.toString('utf8'));
      } catch (e) {
        await config.destroy();
        return res.status(400).json({
          detail: `Invalid JSON in schema file for table '${t.name}': ${e.message}`
        });
      }
      saveSingleSchemaFile(t.name, schemaObj);

      schemasArray.push({ table_name: t.name, ...schemaObj });
      tableFileMap[t.name] = { csvSaved: true, schemaSaved: true };
    }

    // 3. Rewrite YAML paths to point at the shared volume locations.
    const pathRewrites = rewritePathsForSharedVolume(parsed, config.id, tableFileMap);
    const finalYaml = dumpYaml(parsed);

    // 4. Persist final YAML + schemas on the row and on disk.
    config.yaml_config = finalYaml;
    config.json_schemas = JSON.stringify(schemasArray);
    await config.save();

    try {
      saveConfigFile(config.id, config.name, config.yaml_config);
      // saveSingleSchemaFile was already called per-table above, so we skip
      // the batch saveSchemaFiles call here.
    } catch (e) {
      console.error('Error saving config file:', e.message);
    }

    await auditService.logAction({
      userId: req.user.id,
      actionType: ACTION_TYPE.CREATE,
      entityType: ENTITY_TYPE.PIPELINE_CONFIG,
      entityId: config.id,
      entityName: config.name,
      details: { source: 'yaml-upload-bundle', path_rewrites: pathRewrites.length },
      ipAddress: req.ip
    });

    return res.status(201).json({
      ...serializeConfig(config),
      path_rewrites: pathRewrites
    });
  } catch (err) {
    console.error('uploadBundle error:', err);
    return res.status(err.status || 500).json({ detail: err.message });
  }
}

module.exports = {
  createPipelineConfig,
  getMyPipelineConfigs,
  getPipelineConfig,
  updatePipelineConfig,
  deletePipelineConfig,
  parseYaml,
  uploadBundle
};
