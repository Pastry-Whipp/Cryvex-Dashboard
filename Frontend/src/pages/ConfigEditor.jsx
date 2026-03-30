import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Alert from '../components/common/Alert';
import Modal from '../components/common/Modal';
import {
  ArrowLeft,
  Save,
  RotateCcw,
  FileCode,
  FileJson,
  Calendar,
  Edit3,
  Eye,
  Copy,
  Check,
  Download,
  Play,
  AlertTriangle
} from 'lucide-react';
import { pipelineConfigService } from '../services/pipelineConfig.service';
import { pipelineExecutionService } from '../services/pipelineExecution.service';
import { downloadFile } from '../utils/configGenerator';
import './ConfigEditor.css';

const ConfigEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Editor state
  const [yamlContent, setYamlContent] = useState('');
  const [schemasContent, setSchemasContent] = useState('');
  const [originalYaml, setOriginalYaml] = useState('');
  const [originalSchemas, setOriginalSchemas] = useState('');
  const [activeTab, setActiveTab] = useState('yaml');
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [copied, setCopied] = useState(false);

  // Confirm discard modal
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await pipelineConfigService.getById(id);
      setConfig(data);

      const yaml = data.yaml_config || '';
      let schemas = '';
      try {
        schemas = JSON.stringify(JSON.parse(data.json_schemas), null, 2);
      } catch {
        schemas = data.json_schemas || '';
      }

      setYamlContent(yaml);
      setSchemasContent(schemas);
      setOriginalYaml(yaml);
      setOriginalSchemas(schemas);
      setError(null);
    } catch (err) {
      console.error('Error loading config:', err);
      setError('Failed to load pipeline configuration');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const yamlChanged = yamlContent !== originalYaml;
    const schemasChanged = schemasContent !== originalSchemas;
    setHasChanges(yamlChanged || schemasChanged);
  }, [yamlContent, schemasContent, originalYaml, originalSchemas]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Validate schemas JSON
      if (schemasContent.trim()) {
        try {
          JSON.parse(schemasContent);
        } catch {
          setError('Invalid JSON format in schemas. Please fix and try again.');
          setSaving(false);
          return;
        }
      }

      await pipelineConfigService.update(id, {
        yaml_config: yamlContent,
        json_schemas: schemasContent
      });

      setOriginalYaml(yamlContent);
      setOriginalSchemas(schemasContent);
      setHasChanges(false);
      setIsEditing(false);
      setSuccess('Configuration saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving config:', err);
      setError(err.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setYamlContent(originalYaml);
    setSchemasContent(originalSchemas);
    setHasChanges(false);
    setIsEditing(false);
    setShowDiscardModal(false);
  };

  const handleCopy = () => {
    const content = activeTab === 'yaml' ? yamlContent : schemasContent;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (activeTab === 'yaml') {
      const fileName = `${config.name.toLowerCase().replace(/\s+/g, '_')}_config.yaml`;
      downloadFile(yamlContent, fileName, 'text/yaml');
    } else {
      const fileName = `${config.name.toLowerCase().replace(/\s+/g, '_')}_schemas.json`;
      downloadFile(schemasContent, fileName, 'application/json');
    }
  };

  const handleExecute = async () => {
    try {
      const result = await pipelineExecutionService.execute(parseInt(id), {
        dagId: 'cryvex_dynamic'
      });
      setSuccess(`Pipeline triggered! Execution ID: ${result.execution_id}`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to execute pipeline');
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      setShowDiscardModal(true);
    } else {
      navigate('/my-configs');
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (isEditing && hasChanges) {
        handleSave();
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getLineCount = (text) => {
    return (text || '').split('\n').length;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="config-editor-page">
          <div className="loading-state">Loading configuration...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!config) {
    return (
      <DashboardLayout>
        <div className="config-editor-page">
          <Alert variant="error">Configuration not found</Alert>
          <Button variant="ghost" onClick={() => navigate('/my-configs')}>
            <ArrowLeft size={18} /> Back to Configurations
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="config-editor-page" onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="config-editor-header">
          <div className="header-left">
            <button className="back-btn" onClick={handleBack}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="page-title">{config.name}</h1>
              <div className="config-meta-row">
                {config.domain && <Badge variant="info">{config.domain}</Badge>}
                {config.version && <span className="meta-text">v{config.version}</span>}
                <span className="meta-text">
                  <Calendar size={12} /> {formatDate(config.created_at)}
                </span>
                {hasChanges && <Badge variant="warning">Unsaved Changes</Badge>}
              </div>
            </div>
          </div>
          <div className="header-actions">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => hasChanges ? setShowDiscardModal(true) : setIsEditing(false)}
                >
                  <RotateCcw size={16} /> Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                >
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={handleExecute}>
                  <Play size={16} /> Run Pipeline
                </Button>
                <Button variant="primary" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit3 size={16} /> Edit
                </Button>
              </>
            )}
          </div>
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

        {config.description && (
          <p className="config-description-text">{config.description}</p>
        )}

        {/* Editor */}
        <Card className="editor-card">
          <div className="editor-toolbar">
            <div className="editor-tabs">
              <button
                className={`editor-tab ${activeTab === 'yaml' ? 'active' : ''}`}
                onClick={() => setActiveTab('yaml')}
              >
                <FileCode size={16} />
                YAML Config
                <span className="line-count">{getLineCount(yamlContent)} lines</span>
              </button>
              <button
                className={`editor-tab ${activeTab === 'schemas' ? 'active' : ''}`}
                onClick={() => setActiveTab('schemas')}
              >
                <FileJson size={16} />
                JSON Schemas
                <span className="line-count">{getLineCount(schemasContent)} lines</span>
              </button>
            </div>
            <div className="editor-actions">
              <button className="toolbar-btn" onClick={handleCopy} title="Copy to clipboard">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button className="toolbar-btn" onClick={handleDownload} title="Download file">
                <Download size={16} />
              </button>
              {!isEditing && (
                <span className="view-mode-badge">
                  <Eye size={14} /> View Only
                </span>
              )}
              {isEditing && (
                <span className="edit-mode-badge">
                  <Edit3 size={14} /> Editing
                </span>
              )}
            </div>
          </div>

          <div className="editor-container">
            {activeTab === 'yaml' ? (
              <div className="code-editor-wrapper">
                <div className="line-numbers">
                  {yamlContent.split('\n').map((_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
                <textarea
                  className="code-editor yaml-editor"
                  value={yamlContent}
                  onChange={(e) => setYamlContent(e.target.value)}
                  readOnly={!isEditing}
                  spellCheck={false}
                  wrap="off"
                  placeholder="YAML configuration content..."
                />
              </div>
            ) : (
              <div className="code-editor-wrapper">
                <div className="line-numbers">
                  {schemasContent.split('\n').map((_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
                <textarea
                  className="code-editor json-editor"
                  value={schemasContent}
                  onChange={(e) => setSchemasContent(e.target.value)}
                  readOnly={!isEditing}
                  spellCheck={false}
                  wrap="off"
                  placeholder="JSON schemas content..."
                />
              </div>
            )}
          </div>
        </Card>

        {/* Discard Changes Modal */}
        {showDiscardModal && (
          <Modal isOpen={showDiscardModal} onClose={() => setShowDiscardModal(false)}>
            <Modal.Header>
              <Modal.Title>Discard Changes?</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="discard-modal-content">
                <AlertTriangle size={48} className="warning-icon" />
                <p>You have unsaved changes. Are you sure you want to discard them?</p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onClick={() => setShowDiscardModal(false)}>
                Keep Editing
              </Button>
              <Button variant="danger" onClick={handleDiscard}>
                Discard Changes
              </Button>
            </Modal.Footer>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ConfigEditor;
