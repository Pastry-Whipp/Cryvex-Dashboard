import React, { useState, useEffect } from 'react';
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
  Check
} from 'lucide-react';
import { pipelineConfigService } from '../services/pipelineConfig.service';
import { downloadFile } from '../utils/configGenerator';
import './MyConfigs.css';

const MyConfigs = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFormData, setUploadFormData] = useState({
    name: '',
    description: '',
    domain: '',
    version: '',
    yamlFile: null,
    schemasFile: null
  });

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

  const handleFileSelect = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (type === 'yaml') {
        setUploadFormData({ ...uploadFormData, yamlFile: file });
      } else {
        setUploadFormData({ ...uploadFormData, schemasFile: file });
      }
    }
  };

  const handleUpload = async () => {
    if (!uploadFormData.name || !uploadFormData.yamlFile || !uploadFormData.schemasFile) {
      setError('Please fill in all required fields and select files');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Read files
      const yamlContent = await uploadFormData.yamlFile.text();
      const schemasContent = await uploadFormData.schemasFile.text();

      // Validate JSON schemas
      try {
        JSON.parse(schemasContent);
      } catch (err) {
        setError('Invalid JSON format in schemas file');
        setUploading(false);
        return;
      }

      // Create config
      await pipelineConfigService.create({
        name: uploadFormData.name,
        description: uploadFormData.description || null,
        domain: uploadFormData.domain || null,
        version: uploadFormData.version || null,
        yaml_config: yamlContent,
        json_schemas: schemasContent
      });

      setSuccess('Pipeline configuration uploaded successfully');
      setShowUploadModal(false);
      setUploadFormData({
        name: '',
        description: '',
        domain: '',
        version: '',
        yamlFile: null,
        schemasFile: null
      });
      loadConfigs();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error uploading config:', err);
      setError(err.response?.data?.detail || 'Failed to upload pipeline configuration');
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
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadYaml(config)}
                  >
                    <FileCode size={16} />
                    Download YAML
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadSchemas(config)}
                  >
                    <FileJson size={16} />
                    Download Schemas
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <Modal
            isOpen={showUploadModal}
            onClose={() => setShowUploadModal(false)}
            size="lg"
          >
            <Modal.Header>
              <Modal.Title>Upload Pipeline Configuration</Modal.Title>
            </Modal.Header>
            <Modal.Body>
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
                      onChange={(e) => handleFileSelect(e, 'yaml')}
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
                </div>
                <div className="file-upload-section">
                  <label className="file-upload-label">
                    <span>JSON Schemas File *</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => handleFileSelect(e, 'schemas')}
                    />
                    <div className="file-upload-display">
                      {uploadFormData.schemasFile ? (
                        <span className="file-name">
                          <FileJson size={16} />
                          {uploadFormData.schemasFile.name}
                        </span>
                      ) : (
                        <span className="file-placeholder">Select JSON schemas file</span>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="ghost"
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload'}
                <Upload size={18} />
              </Button>
            </Modal.Footer>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyConfigs;




