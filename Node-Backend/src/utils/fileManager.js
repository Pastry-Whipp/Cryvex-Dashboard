const fs = require('fs');
const path = require('path');

const CONFIG_BASE_DIR = path.join(__dirname, '..', '..', 'pipeline_configs');

function ensureConfigDirectory() {
  if (!fs.existsSync(CONFIG_BASE_DIR)) {
    fs.mkdirSync(CONFIG_BASE_DIR, { recursive: true });
  }
  return CONFIG_BASE_DIR;
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

module.exports = { saveConfigFile, updateConfigFile, deleteConfigFile };
