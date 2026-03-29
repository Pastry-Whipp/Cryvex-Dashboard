const fs = require('fs');
const path = require('path');

const CONFIG_BASE_DIR = path.join(__dirname, '..', '..', 'pipeline_configs');
const SCHEMAS_DIR = path.join(CONFIG_BASE_DIR, 'schemas');

function ensureConfigDirectory() {
  if (!fs.existsSync(CONFIG_BASE_DIR)) {
    fs.mkdirSync(CONFIG_BASE_DIR, { recursive: true });
  }
  return CONFIG_BASE_DIR;
}

function ensureSchemasDirectory() {
  ensureConfigDirectory();
  if (!fs.existsSync(SCHEMAS_DIR)) {
    fs.mkdirSync(SCHEMAS_DIR, { recursive: true });
  }
  return SCHEMAS_DIR;
}

function getConfigFilePath(configId, configName) {
  ensureConfigDirectory();
  const safeName = configName
    .replace(/[^a-zA-Z0-9 \-_]/g, '')
    .trim()
    .replace(/ /g, '_');
  return path.join(CONFIG_BASE_DIR, `${configId}_${safeName}.yaml`);
}

function saveConfigFile(configId, configName, yamlContent) {
  try {
    const filePath = getConfigFilePath(configId, configName);
    fs.writeFileSync(filePath, yamlContent, 'utf8');
    console.log(`Saved config file: ${filePath}`);
    return filePath;
  } catch (err) {
    console.error(`Failed to save config file for id=${configId}:`, err.message);
    return null;
  }
}

/**
 * Save schema JSON files to the shared volume.
 * json_schemas can be:
 *   - A JSON string of an array of schema objects: [{ table_name, columns, ... }, ...]
 *   - A JSON string of an object keyed by table name: { "customers": { columns: [...] }, ... }
 *   - Already parsed (array or object)
 */
function saveSchemaFiles(configId, jsonSchemas) {
  try {
    ensureSchemasDirectory();

    let schemas;
    if (typeof jsonSchemas === 'string') {
      schemas = JSON.parse(jsonSchemas);
    } else {
      schemas = jsonSchemas;
    }

    // Handle array format: [{ table_name: "customers", columns: [...] }, ...]
    if (Array.isArray(schemas)) {
      schemas.forEach(schema => {
        const tableName = schema.table_name || schema.tableName;
        if (!tableName) return;
        const filePath = path.join(SCHEMAS_DIR, `${tableName}_schema.json`);
        fs.writeFileSync(filePath, JSON.stringify(schema, null, 2), 'utf8');
        console.log(`Saved schema file: ${filePath}`);
      });
    }
    // Handle object format: { "customers": { columns: [...] }, ... }
    else if (typeof schemas === 'object' && schemas !== null) {
      Object.entries(schemas).forEach(([tableName, schema]) => {
        const filePath = path.join(SCHEMAS_DIR, `${tableName}_schema.json`);
        const schemaWithName = { table_name: tableName, ...schema };
        fs.writeFileSync(filePath, JSON.stringify(schemaWithName, null, 2), 'utf8');
        console.log(`Saved schema file: ${filePath}`);
      });
    }

    return true;
  } catch (err) {
    console.error(`Failed to save schema files for config id=${configId}:`, err.message);
    return false;
  }
}

function updateConfigFile(configId, configName, yamlContent) {
  deleteConfigFile(configId);
  return saveConfigFile(configId, configName, yamlContent);
}

function deleteConfigFile(configId) {
  try {
    ensureConfigDirectory();
    const files = fs.readdirSync(CONFIG_BASE_DIR).filter(f => f.startsWith(`${configId}_`) && f.endsWith('.yaml'));
    files.forEach(f => {
      fs.unlinkSync(path.join(CONFIG_BASE_DIR, f));
      console.log(`Deleted config file: ${f}`);
    });
    return true;
  } catch (err) {
    console.error(`Error deleting config file for id=${configId}:`, err.message);
    return false;
  }
}

module.exports = { saveConfigFile, saveSchemaFiles, updateConfigFile, deleteConfigFile };
