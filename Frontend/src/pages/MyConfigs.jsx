import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Alert from '../components/common/Alert';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import {
  Download,
  Upload,
  Trash2,
  FileJson,
  FileCode,
  Calendar,
  X,
  Check,
  Eye,
  Edit3
} from 'lucide-react';
import { pipelineConfigService } from '../services/pipelineConfig.service';
import { downloadFile } from '../utils/configGenerator';
import './MyConfigs.css';

const MyConfigs = () => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Two-step upload flow:
  //   step 1 = pick YAML + enter metadata → /parse-yaml
  //   step 2 = review parsed tables, attach one CSV + one schema JSON each
  const [uploadStep, setUploadStep] = useState(1);
  const [uploadFormData, setUploadFormData] = useState({
    name: '',
    description: '',
    domain: '',
    version: '',
    yamlFile: null
  });
  const [parsedPreview, setParsedPreview] = useState(null);   // { fixes_applied, summary, normalized_yaml }
  const [tableFiles, setTableFiles] = useState({});           // { tableName: { csv: File, schema: File } }
  const [parseError, setParseError] = useState(null);

  const resetUploadModal = () => {
    setShowUploadModal(false);
    setUploadStep(1);
    setParsedPreview(null);
    setTableFiles({});
    setParseError(null);
    setUploadFormData({
      name: '',
      description: '',
      domain: '',
      version: '',
      yamlFile: null
    });
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await pipelineConfigService.getAll();
      setConfigs(data);
      setError(null);
    } catch (err) {
      console.error('Error loading configs:', err);
      setError('Failed to load pipeline configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadYaml = (config) => {
    const fileName = `${config.name.toLowerCase().replace(/\s+/g, '_')}_config.yaml`;
    downloadFile(config.yaml_config, fileName, 'text/yaml');
  };

  const handleDownloadSchemas = (config) => {
    try {
      console.log('Downloading schemas for config:', config.id);
      console.log('Config json_schemas:', config.json_schemas);
      
      // Check if json_schemas exists and is not empty
      if (!config.json_schemas) {
        console.error('json_schemas is null or undefined');
        setError('No schema data available for this configuration');
        return;
      }

      if (typeof config.json_schemas !== 'string') {
        console.error('json_schemas is not a string:', typeof config.json_schemas);
        setError('Schema data is in an unexpected format');
        return;
      }

      if (config.json_schemas.trim() === '') {
        console.error('json_schemas is empty string');
        setError('No schema data available for this configuration');
        return;
      }

      // Parse the JSON string
      let schemas;
      try {
        schemas = JSON.parse(config.json_schemas);
        console.log('Parsed schemas:', schemas);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Schema content:', config.json_schemas);
        setError('Invalid JSON format in schema data');
        return;
      }

      // Ensure schemas is an array
      if (!Array.isArray(schemas)) {
        console.error('Schemas is not an array:', typeof schemas);
        setError('Schema data is not in the expected format (should be an array)');
        return;
      }

      // Check if schemas array is empty
      if (schemas.length === 0) {
        console.warn('Schemas array is empty');
        setError('No schemas found in this configuration');
        return;
      }

      // Download each schema file
      let downloadedCount = 0;
      schemas.forEach((schema, index) => {
        if (!schema || typeof schema !== 'object') {
          console.warn(`Skipping invalid schema at index ${index}:`, schema);
          return;
        }

        const tableName = schema.table_name || `table_${index + 1}`;
        const fileName = `${tableName}_schema.json`;
        const content = JSON.stringify(schema, null, 2);
        downloadFile(content, fileName, 'application/json');
        downloadedCount++;
      });

      if (downloadedCount === 0) {
        setError('No valid schemas found to download');
        return;
      }

      // Clear any previous errors on success
      setError(null);
      console.log(`Successfully downloaded ${downloadedCount} schema file(s)`);
    } catch (err) {
      console.error('Error downloading schemas:', err);
      setError(`Failed to download schema files: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this pipeline configuration?')) {
      return;
    }

    try {
      await pipelineConfigService.delete(id);
      setConfigs(configs.filter(c => c.id !== id));
      setSuccess('Pipeline configuration deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting config:', err);
      setError('Failed to delete pipeline configuration');
    }
  };

  const handleYamlFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadFormData({ ...uploadFormData, yamlFile: file });
      setParseError(null);
    }
  };

  const handleTableFileSelect = (tableName, kind, file) => {
    setTableFiles((prev) => ({
      ...prev,
      [tableName]: { ...(prev[tableName] || {}), [kind]: file }
    }));
  };

  // Step 1 → Step 2: send the YAML to the backend for parsing + auto-fix.
  const handleParseYaml = async () => {
    if (!uploadFormData.name) {
      setParseError('Configuration name is required');
      return;
    }
    if (!uploadFormData.yamlFile) {
      setParseError('Select a YAML file first');
      return;
    }
    try {
      setUploading(true);
      setParseError(null);
      const preview = await pipelineConfigService.parseYaml(uploadFormData.yamlFile);
      setParsedPreview(preview);
      // Reset per-table file state in case user re-parses.
      const initial = {};
      (preview.summary?.base_tables || []).forEach(t => { initial[t.name] = { csv: null, schema: null }; });
      setTableFiles(initial);
      setUploadStep(2);
    } catch (err) {
      console.error('Parse YAML error:', err);
      setParseError(err.response?.data?.detail || 'Failed to parse YAML file');
    } finally {
      setUploading(false);
    }
  };

  // Step 2 → commit: send YAML + per-table CSV/schema files.
  const handleCommitBundle = async () => {
    const baseTables = parsedPreview?.summary?.base_tables || [];
    const missing = baseTables.filter(
      t => !tableFiles[t.name]?.csv || !tableFiles[t.name]?.schema
    );
    if (missing.length) {
      setError(`Missing CSV or schema for: ${missing.map(t => t.name).join(', ')}`);
      return;
    }
    try {
      setUploading(true);
      setError(null);
      await pipelineConfigService.uploadBundle({
        name: uploadFormData.name,
        description: uploadFormData.description,
        domain: uploadFormData.domain,
        version: uploadFormData.version,
        yamlText: parsedPreview.normalized_yaml,
        tableFiles
      });
      setSuccess('Pipeline configuration uploaded and wired up successfully');
      resetUploadModal();
      loadConfigs();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error('Upload bundle error:', err);
      setError(err.response?.data?.detail || 'Failed to upload pipeline bundle');
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <DashboardLayout>
      <div className="my-configs-page">
        <div className="my-configs-header">
          <div>
            <h1 className="page-title">My Pipeline Configurations</h1>
            <p className="page-subtitle">Manage your saved pipeline configurations</p>
          </div>
          <Button variant="primary" onClick={() => setShowUploadModal(true)}>
            <Upload size={20} />
            Upload Configuration
          </Button>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" dismissible onDismiss={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Configurations List */}
        {loading ? (
          <Card>
            <div className="loading-state">Loading configurations...</div>
          </Card>
        ) : configs.length === 0 ? (
          <Card>
            <div className="empty-state">
              <FileCode size={48} className="empty-icon" />
              <h3>No configurations found</h3>
              <p>Upload your first pipeline configuration to get started</p>
              <Button variant="primary" onClick={() => setShowUploadModal(true)}>
                <Upload size={20} />
                Upload Configuration
              </Button>
            </div>
          </Card>
        ) : (
          <div className="configs-grid">
            {configs.map((config) => (
              <Card key={config.id} className="config-card">
                <div className="config-card-header">
                  <div>
                    <h3 className="config-name">{config.name}</h3>
                    {config.domain && (
                      <Badge variant="info" className="config-badge">
                        {config.domain}
                      </Badge>
                    )}
                  </div>
                  <button
                    className="config-delete-btn"
                    onClick={() => handleDelete(config.id)}
                    title="Delete configuration"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                {config.description && (
                  <p className="config-description">{config.description}</p>
                )}

                <div className="config-meta">
                  {config.version && (
                    <span className="config-meta-item">
                      <span className="config-meta-label">Version:</span>
                      {config.version}
                    </span>
                  )}
                  <span className="config-meta-item">
                    <Calendar size={14} />
                    {formatDate(config.created_at)}
                  </span>
                </div>

                <div className="config-actions">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/my-configs/${config.id}`)}
                  >
                    <Eye size={16} />
                    View / Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadYaml(config)}
                  >
                    <FileCode size={16} />
                    YAML
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadSchemas(config)}
                  >
                    <FileJson size={16} />
                    Schemas
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Upload Modal — two-step flow */}
        {showUploadModal && (
          <Modal
            isOpen={showUploadModal}
            onClose={resetUploadModal}
            size="lg"
          >
            <Modal.Header>
              <Modal.Title>
                {uploadStep === 1 ? 'Upload Pipeline YAML' : 'Attach CSV + Schema per Table'}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {uploadStep === 1 && (
                <div className="upload-form">
                  <Input
                    label="Configuration Name"
                    placeholder="e.g., Banking ETL Pipeline"
                    value={uploadFormData.name}
                    onChange={(e) =>
                      setUploadFormData({ ...uploadFormData, name: e.target.value })
                    }
                    required
                  />
                  <Input
                    label="Description"
                    placeholder="Brief description of the pipeline"
                    value={uploadFormData.description}
                    onChange={(e) =>
                      setUploadFormData({ ...uploadFormData, description: e.target.value })
                    }
                  />
                  <div className="form-row">
                    <Input
                      label="Domain"
                      placeholder="e.g., banking"
                      value={uploadFormData.domain}
                      onChange={(e) =>
                        setUploadFormData({ ...uploadFormData, domain: e.target.value })
                      }
                    />
                    <Input
                      label="Version"
                      placeholder="e.g., 1.0"
                      value={uploadFormData.version}
                      onChange={(e) =>
                        setUploadFormData({ ...uploadFormData, version: e.target.value })
                      }
                    />
                  </div>
                  <div className="file-upload-section">
                    <label className="file-upload-label">
                      <span>YAML Configuration File *</span>
                      <input
                        type="file"
                        accept=".yaml,.yml"
                        onChange={handleYamlFileSelect}
                      />
                      <div className="file-upload-display">
                        {uploadFormData.yamlFile ? (
                          <span className="file-name">
                            <FileCode size={16} />
                            {uploadFormData.yamlFile.name}
                          </span>
                        ) : (
                          <span className="file-placeholder">Select YAML file</span>
                        )}
                      </div>
                    </label>
                    <p className="input-hint" style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                      The file will be parsed on the server. Common mistakes
                      (wrong Airflow paths, wrong DB host, host.docker.internal
                      RPC URL) are auto-fixed before you commit.
                    </p>
                  </div>
                  {parseError && (
                    <Alert variant="error">{parseError}</Alert>
                  )}
                </div>
              )}

              {uploadStep === 2 && parsedPreview && (
                <div className="upload-form">
                  {parsedPreview.fixes_applied?.length > 0 && (
                    <Alert variant="info">
                      <strong>Auto-fixes applied:</strong>
                      <ul style={{ margin: '6px 0 0 18px' }}>
                        {parsedPreview.fixes_applied.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </Alert>
                  )}

                  <p style={{ margin: '12px 0 4px' }}>
                    <strong>Base tables detected:</strong>{' '}
                    {parsedPreview.summary.base_tables.length}
                    {parsedPreview.summary.derived_tables.length > 0 && (
                      <> &middot; <strong>Derived:</strong> {parsedPreview.summary.derived_tables.length}</>
                    )}
                  </p>
                  <p className="input-hint" style={{ fontSize: 12, opacity: 0.75, marginBottom: 16 }}>
                    Attach one CSV data file and one JSON schema file for each base table.
                    Both are required. Derived tables are computed from SQL so they need neither.
                  </p>

                  {parsedPreview.summary.base_tables.map((t) => {
                    const picked = tableFiles[t.name] || {};
                    return (
                      <Card key={t.name} style={{ padding: 14, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div>
                            <strong>{t.name}</strong>
                            {t.target_table_name && t.target_table_name !== t.name && (
                              <span style={{ marginLeft: 8, opacity: 0.7 }}>
                                → target: {t.target_table_name}
                              </span>
                            )}
                          </div>
                          {t.priority != null && (
                            <Badge variant="info">priority {t.priority}</Badge>
                          )}
                        </div>

                        <div className="form-row">
                          <label className="file-upload-label" style={{ flex: 1 }}>
                            <span>CSV Data File *</span>
                            <input
                              type="file"
                              accept=".csv,text/csv"
                              onChange={(e) => handleTableFileSelect(t.name, 'csv', e.target.files[0])}
                            />
                            <div className="file-upload-display">
                              {picked.csv ? (
                                <span className="file-name">
                                  <FileCode size={14} /> {picked.csv.name}
                                </span>
                              ) : (
                                <span className="file-placeholder">Select CSV</span>
                              )}
                            </div>
                          </label>

                          <label className="file-upload-label" style={{ flex: 1 }}>
                            <span>Schema JSON *</span>
                            <input
                              type="file"
                              accept=".json,application/json"
                              onChange={(e) => handleTableFileSelect(t.name, 'schema', e.target.files[0])}
                            />
                            <div className="file-upload-display">
                              {picked.schema ? (
                                <span className="file-name">
                                  <FileJson size={14} /> {picked.schema.name}
                                </span>
                              ) : (
                                <span className="file-placeholder">Select schema</span>
                              )}
                            </div>
                          </label>
                        </div>
                      </Card>
                    );
                  })}

                  {parsedPreview.summary.derived_tables.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <strong>Derived tables (no upload needed):</strong>
                      <ul style={{ margin: '6px 0 0 18px', fontSize: 13 }}>
                        {parsedPreview.summary.derived_tables.map((d) => (
                          <li key={d.name}>
                            {d.name}
                            {d.depends_on?.length > 0 && (
                              <span style={{ opacity: 0.65 }}> &nbsp;depends on: {d.depends_on.join(', ')}</span>
                            )}
                            {!d.has_sql && <span style={{ color: 'red' }}> &nbsp;(missing SQL!)</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="ghost"
                onClick={resetUploadModal}
                disabled={uploading}
              >
                Cancel
              </Button>
              {uploadStep === 2 && (
                <Button
                  variant="outline"
                  onClick={() => setUploadStep(1)}
                  disabled={uploading}
                >
                  Back
                </Button>
              )}
              {uploadStep === 1 ? (
                <Button
                  variant="primary"
                  onClick={handleParseYaml}
                  disabled={uploading}
                >
                  {uploading ? 'Parsing...' : 'Parse YAML'}
                  <Upload size={18} />
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleCommitBundle}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Create Pipeline'}
                  <Check size={18} />
                </Button>
              )}
            </Modal.Footer>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyConfigs;




