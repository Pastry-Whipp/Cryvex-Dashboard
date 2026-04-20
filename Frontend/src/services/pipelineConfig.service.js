import api from './api';

export const pipelineConfigService = {
  getAll: async () => {
    const response = await api.get('/pipeline-configs');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/pipeline-configs/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/pipeline-configs', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/pipeline-configs/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    await api.delete(`/pipeline-configs/${id}`);
  },

  // Upload a raw pipeline YAML file and get back a normalized preview
  // (tables list, derived tables list, auto-fixes that were applied).
  // No DB write happens at this step.
  parseYaml: async (yamlFile) => {
    const form = new FormData();
    form.append('yaml_file', yamlFile);
    const response = await api.post('/pipeline-configs/parse-yaml', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Commit a full pipeline bundle: normalized YAML text + one CSV + one
  // schema JSON per base table. `tableFiles` is an object:
  //   { tableName: { csv: File, schema: File } }
  uploadBundle: async ({ name, description, domain, version, yamlText, tableFiles }) => {
    const form = new FormData();
    form.append('name', name);
    if (description) form.append('description', description);
    if (domain) form.append('domain', domain);
    if (version) form.append('version', version);
    form.append('yaml_text', yamlText);
    for (const [tableName, files] of Object.entries(tableFiles)) {
      if (files.csv) form.append(`csv_${tableName}`, files.csv);
      if (files.schema) form.append(`schema_${tableName}`, files.schema);
    }
    const response = await api.post('/pipeline-configs/upload-bundle', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
};






