import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Alert from '../components/common/Alert';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  Upload,
  Database,
  FileJson,
  Settings,
  Shield,
  Info
} from 'lucide-react';
import { generateFiles } from '../utils/configGenerator';
import { pipelineConfigService } from '../services/pipelineConfig.service';
import './CreatePipeline.css';

const CreatePipeline = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [showSchemaBuilder, setShowSchemaBuilder] = useState(false);
  const [currentTableIndex, setCurrentTableIndex] = useState(null);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Form data state
  const [formData, setFormData] = useState({
    // Step 1: Project Information
    projectName: '',
    domain: 'banking',
    version: '1.0',
    description: '',

    // Step 2: Global Settings (pre-filled for MVP)
    database: {
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      username: 'postgres',
      password: 'postgres'
    },
    blockchain: {
      enabled: true,
      network: 'ganache',
      rpcUrl: 'http://localhost:8545',
      privateKey: '',
      contractAddress: ''
    },
    executionMode: 'parallel',
    stopOnError: false,

    // Step 3: Tables Configuration
    tables: []
  });

  const steps = [
    { number: 1, title: 'Project Info', icon: Info },
    { number: 2, title: 'Settings', icon: Settings },
    { number: 3, title: 'Tables', icon: Database },
    { number: 4, title: 'Review', icon: Check }
  ];

  const domainOptions = ['banking', 'cryptocurrency', 'medical', 'ecommerce', 'logistics'];
  const executionModeOptions = [
    { value: 'parallel', label: 'Parallel', description: 'Run tables concurrently when possible' },
    { value: 'sequential', label: 'Sequential', description: 'Run tables one after another' }
  ];

  const transformationOptions = [
    { value: 'trim', label: 'Trim Whitespace' },
    { value: 'lowercase', label: 'Convert to Lowercase' },
    { value: 'uppercase', label: 'Convert to Uppercase' },
    { value: 'replace', label: 'Replace Text' },
    { value: 'remove_special_chars', label: 'Remove Special Characters' },
    { value: 'prefix', label: 'Add Prefix' },
    { value: 'suffix', label: 'Add Suffix' },
    { value: 'fill_null', label: 'Fill Null Values' },
    { value: 'remove_duplicates', label: 'Remove Duplicates' },
    { value: 'convert_type', label: 'Convert Data Type' },
    { value: 'round', label: 'Round Numbers' },
    { value: 'date_format', label: 'Format Date' }
  ];

  const validationOptions = [
    { value: 'not_null', label: 'Not Null', needsValue: false },
    { value: 'unique', label: 'Unique Values', needsValue: false },
    { value: 'min_value', label: 'Minimum Value', needsValue: true },
    { value: 'max_value', label: 'Maximum Value', needsValue: true },
    { value: 'min_length', label: 'Minimum Length', needsValue: true },
    { value: 'max_length', label: 'Maximum Length', needsValue: true },
    { value: 'regex', label: 'Regex Pattern', needsValue: true },
    { value: 'in_list', label: 'In List', needsValue: true, isList: true },
    { value: 'email', label: 'Email Format', needsValue: false },
    { value: 'phone', label: 'Phone Number', needsValue: false },
    { value: 'date_range', label: 'Date Range', needsValue: true }
  ];

  const columnTypes = [
    'string', 'integer', 'decimal', 'date', 'datetime', 'boolean'
  ];

  const handleAddTable = () => {
    const newTable = {
      name: '',
      priority: formData.tables.length + 1,
      dependsOn: [],
      sourceFile: null,
      sourceFileName: '',
      ifExists: 'replace',
      schema: {
        columns: []
      },
      transformations: [],
      validations: []
    };
    setFormData({
      ...formData,
      tables: [...formData.tables, newTable]
    });
  };

  const handleRemoveTable = (index) => {
    const newTables = formData.tables.filter((_, i) => i !== index);
    setFormData({ ...formData, tables: newTables });
  };

  const handleTableChange = (index, field, value) => {
    const newTables = [...formData.tables];
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      newTables[index][parent][child] = value;
    } else {
      newTables[index][field] = value;
    }
    setFormData({ ...formData, tables: newTables });
  };

  const handleFileUpload = (index, file) => {
    const newTables = [...formData.tables];
    newTables[index].sourceFile = file;
    newTables[index].sourceFileName = file.name;
    setFormData({ ...formData, tables: newTables });
  };

  const handleAddColumn = (tableIndex) => {
    const newTables = [...formData.tables];
    newTables[tableIndex].schema.columns.push({
      name: '',
      type: 'string',
      nullable: true,
      primaryKey: false,
      maxLength: null
    });
    setFormData({ ...formData, tables: newTables });
  };

  const handleRemoveColumn = (tableIndex, columnIndex) => {
    const newTables = [...formData.tables];
    newTables[tableIndex].schema.columns.splice(columnIndex, 1);
    setFormData({ ...formData, tables: newTables });
  };

  const handleColumnChange = (tableIndex, columnIndex, field, value) => {
    const newTables = [...formData.tables];
    newTables[tableIndex].schema.columns[columnIndex][field] = value;
    setFormData({ ...formData, tables: newTables });
  };

  const handleSchemaUpload = async (tableIndex, file) => {
    try {
      const fileContent = await file.text();
      const schemaData = JSON.parse(fileContent);

      // Validate schema structure
      if (!schemaData.columns || !Array.isArray(schemaData.columns)) {
        alert('Invalid schema file: missing or invalid columns array');
        return;
      }

      // Convert schema format to internal format
      const columns = schemaData.columns.map(col => {
        const column = {
          name: col.name || '',
          type: col.type || 'string',
          nullable: col.nullable !== undefined ? col.nullable : true,
          primaryKey: col.primary_key === true || col.primaryKey === true,
          maxLength: col.max_length || col.maxLength || null
        };

        // Filter out empty names
        if (!column.name || column.name.trim() === '') {
          return null;
        }

        return column;
      }).filter(col => col !== null); // Remove null entries

      // Update the table with the uploaded schema
      const newTables = [...formData.tables];
      newTables[tableIndex].schema.columns = columns;

      // Update table name if provided in schema
      if (schemaData.table_name) {
        newTables[tableIndex].name = schemaData.table_name;
      }

      // Update domain if provided in schema
      if (schemaData.domain) {
        setFormData({
          ...formData,
          domain: schemaData.domain,
          tables: newTables
        });
      } else {
        setFormData({ ...formData, tables: newTables });
      }

      // Show success message
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    } catch (error) {
      console.error('Error parsing schema file:', error);
      alert('Failed to parse schema file. Please ensure it is valid JSON.');
    }
  };

  const handleAddTransformation = (tableIndex) => {
    const newTables = [...formData.tables];
    newTables[tableIndex].transformations.push({
      column: '',
      action: 'lowercase',
      decimals: null
    });
    setFormData({ ...formData, tables: newTables });
  };

  const handleRemoveTransformation = (tableIndex, transformIndex) => {
    const newTables = [...formData.tables];
    newTables[tableIndex].transformations.splice(transformIndex, 1);
    setFormData({ ...formData, tables: newTables });
  };

  const handleTransformationChange = (tableIndex, transformIndex, field, value) => {
    const newTables = [...formData.tables];
    newTables[tableIndex].transformations[transformIndex][field] = value;
    setFormData({ ...formData, tables: newTables });
  };

  const handleAddValidation = (tableIndex) => {
    const newTables = [...formData.tables];
    newTables[tableIndex].validations.push({
      column: '',
      rule: 'not_null',
      value: null,
      values: []
    });
    setFormData({ ...formData, tables: newTables });
  };

  const handleRemoveValidation = (tableIndex, validIndex) => {
    const newTables = [...formData.tables];
    newTables[tableIndex].validations.splice(validIndex, 1);
    setFormData({ ...formData, tables: newTables });
  };

  const handleValidationChange = (tableIndex, validIndex, field, value) => {
    const newTables = [...formData.tables];
    newTables[tableIndex].validations[validIndex][field] = value;
    setFormData({ ...formData, tables: newTables });
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };


  const handleSaveAndStart = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);

      // Validate required fields
      if (!formData.projectName || formData.projectName.trim() === '') {
        setSaveError('Pipeline name is required');
        setIsSaving(false);
        return;
      }

      if (!formData.tables || formData.tables.length === 0) {
        setSaveError('Please add at least one table to the pipeline');
        setIsSaving(false);
        return;
      }

      // Generate files without downloading
      const { yamlContent, schemasJson } = generateFiles(formData);

      // Validate generated content
      if (!yamlContent || yamlContent.trim() === '') {
        setSaveError('Failed to generate YAML configuration');
        setIsSaving(false);
        return;
      }

      if (!schemasJson || schemasJson.trim() === '') {
        setSaveError('Failed to generate JSON schemas');
        setIsSaving(false);
        return;
      }

      // Save to backend
      await pipelineConfigService.create({
        name: formData.projectName.trim(),
        description: formData.description?.trim() || null,
        domain: formData.domain || null,
        version: formData.version || null,
        yaml_config: yamlContent,
        json_schemas: schemasJson
      });

      setShowSuccessAlert(true);

      // Navigate back to pipelines after 2 seconds
      setTimeout(() => {
        navigate('/pipelines');
      }, 2000);
    } catch (error) {
      console.error('Error saving pipeline:', error);
      console.error('Error response:', error.response?.data);

      let errorMessage = 'Failed to save pipeline. Please try again.';

      if (error.response?.data) {
        const errorData = error.response.data;

        // Handle FastAPI validation errors
        if (Array.isArray(errorData.detail)) {
          const validationErrors = errorData.detail.map(err => {
            const field = err.loc?.join('.') || 'field';
            return `${field}: ${err.msg}`;
          }).join(', ');
          errorMessage = `Validation error: ${validationErrors}`;
        } else if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = typeof errorData.message === 'string'
            ? errorData.message
            : JSON.stringify(errorData.message);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      setSaveError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const openSchemaBuilder = (index) => {
    setCurrentTableIndex(index);
    setShowSchemaBuilder(true);
  };

  const closeSchemaBuilder = () => {
    setShowSchemaBuilder(false);
    setCurrentTableIndex(null);
  };

  return (
    <DashboardLayout>
      <div className="create-pipeline">
        {/* Header */}
        <div className="pipeline-header">
          <button className="back-button" onClick={() => navigate('/pipelines')}>
            <ArrowLeft size={20} />
            Back to Pipelines
          </button>
          <div>
            <h1 className="page-title">Create New Pipeline</h1>
            <p className="page-subtitle">Configure your ETL pipeline with data integrity verification</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="steps-container">
          {steps.map((step) => (
            <div
              key={step.number}
              className={`step ${currentStep === step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''
                }`}
            >
              <div className="step-icon">
                {currentStep > step.number ? (
                  <Check size={20} />
                ) : (
                  <step.icon size={20} />
                )}
              </div>
              <div className="step-info">
                <span className="step-number">Step {step.number}</span>
                <span className="step-title">{step.title}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Form Content */}
        <div className="form-content">
          {/* Success Alert */}
          {showSuccessAlert && (
            <Alert variant="success" dismissible onDismiss={() => setShowSuccessAlert(false)}>
              <div>
                <strong>Pipeline saved successfully!</strong>
                <div style={{ marginTop: '8px', fontSize: '14px' }}>
                  Your pipeline configuration has been saved. You can download the files from your profile.
                  <br />
                  Redirecting to pipelines...
                </div>
              </div>
            </Alert>
          )}

          {/* Error Alert */}
          {saveError && (
            <Alert variant="error" dismissible onDismiss={() => setSaveError(null)}>
              <div>
                <strong>Error saving pipeline</strong>
                <div style={{ marginTop: '8px', fontSize: '14px' }}>
                  {saveError}
                </div>
              </div>
            </Alert>
          )}

          {/* Step 1: Project Information */}
          {currentStep === 1 && (
            <Card className="step-card fade-in">
              <Card.Header>
                <Card.Title>Project Information</Card.Title>
              </Card.Header>
              <Card.Body>
                <div className="form-grid">
                  <Input
                    label="Pipeline Name"
                    placeholder="e.g., Banking Daily ETL"
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    required
                  />

                  <div className="input-wrapper">
                    <label className="input-label">
                      Domain <span className="input-required">*</span>
                    </label>
                    <select
                      className="input-field"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    >
                      {domainOptions.map((domain) => (
                        <option key={domain} value={domain}>
                          {domain.charAt(0).toUpperCase() + domain.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="Version"
                    placeholder="1.0"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    required
                  />

                  <div className="input-wrapper full-width">
                    <label className="input-label">Description</label>
                    <textarea
                      className="input-field textarea"
                      rows="4"
                      placeholder="Describe what this pipeline does..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Step 2: Global Settings */}
          {currentStep === 2 && (
            <Card className="step-card fade-in">
              <Card.Header>
                <Card.Title>Global Settings</Card.Title>
              </Card.Header>
              <Card.Body>
                {/* Database Configuration */}
                <div className="settings-section">
                  <h3 className="section-heading">
                    <Database size={20} />
                    Database Configuration
                  </h3>
                  <div className="info-banner">
                    <Info size={16} />
                    <span>Using local PostgreSQL database (can be configured later)</span>
                  </div>
                  <div className="form-grid">
                    <Input label="Host" value={formData.database.host} disabled />
                    <Input label="Port" value={formData.database.port} disabled />
                    <Input label="Database" value={formData.database.database} disabled />
                    <Input label="Username" value={formData.database.username} disabled />
                  </div>
                </div>

                {/* Blockchain Configuration */}
                <div className="settings-section">
                  <h3 className="section-heading">
                    <Shield size={20} />
                    Blockchain Configuration
                  </h3>
                  <div className="info-banner">
                    <Info size={16} />
                    <span>Using Ganache for local blockchain verification</span>
                  </div>
                  <div className="form-grid">
                    <div className="checkbox-wrapper full-width">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.blockchain.enabled}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              blockchain: { ...formData.blockchain, enabled: e.target.checked }
                            })
                          }
                        />
                        <span>Enable blockchain verification</span>
                      </label>
                    </div>
                    <Input label="Network" value={formData.blockchain.network} disabled />
                    <Input label="RPC URL" value={formData.blockchain.rpcUrl} disabled />
                    <Input
                      label="Private Key"
                      type="password"
                      placeholder="Enter your blockchain private key"
                      value={formData.blockchain.privateKey}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          blockchain: { ...formData.blockchain, privateKey: e.target.value }
                        })
                      }
                    />
                    <Input
                      label="Contract Address"
                      placeholder="Enter smart contract address"
                      value={formData.blockchain.contractAddress}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          blockchain: { ...formData.blockchain, contractAddress: e.target.value }
                        })
                      }
                    />
                  </div>
                </div>

                {/* Execution Settings */}
                <div className="settings-section">
                  <h3 className="section-heading">
                    <Settings size={20} />
                    Execution Settings
                  </h3>
                  <div className="execution-modes">
                    {executionModeOptions.map((mode) => (
                      <div
                        key={mode.value}
                        className={`mode-option ${formData.executionMode === mode.value ? 'selected' : ''
                          }`}
                        onClick={() => setFormData({ ...formData, executionMode: mode.value })}
                      >
                        <div className="mode-radio">
                          {formData.executionMode === mode.value && <div className="radio-dot" />}
                        </div>
                        <div className="mode-content">
                          <span className="mode-label">{mode.label}</span>
                          <span className="mode-description">{mode.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="checkbox-wrapper">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.stopOnError}
                        onChange={(e) => setFormData({ ...formData, stopOnError: e.target.checked })}
                      />
                      <span>Stop execution if any table fails</span>
                    </label>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Step 3: Tables Configuration */}
          {currentStep === 3 && (
            <div className="step-card fade-in">
              <div className="tables-header">
                <div>
                  <h2 className="section-title">Tables Configuration</h2>
                  <p className="section-subtitle">Add and configure your data tables</p>
                </div>
                <Button variant="primary" onClick={handleAddTable}>
                  <Plus size={20} />
                  Add Table
                </Button>
              </div>

              {formData.tables.length === 0 ? (
                <Card>
                  <div className="empty-tables">
                    <Database size={48} className="empty-icon" />
                    <h3>No tables added yet</h3>
                    <p>Click "Add Table" to start configuring your pipeline tables</p>
                    <Button variant="primary" onClick={handleAddTable}>
                      <Plus size={20} />
                      Add Your First Table
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="tables-list">
                  {formData.tables.map((table, index) => (
                    <Card key={index} className="table-card">
                      <div className="table-card-header">
                        <div className="table-header-left">
                          <Badge variant="info">Table {index + 1}</Badge>
                          <Input
                            placeholder="Table name (e.g., customers)"
                            value={table.name}
                            onChange={(e) => handleTableChange(index, 'name', e.target.value)}
                          />
                        </div>
                        <button
                          className="icon-button danger"
                          onClick={() => handleRemoveTable(index)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="table-card-body">
                        {/* Source Configuration */}
                        <div className="config-section">
                          <h4 className="config-heading">Source File</h4>
                          <div className="file-upload-area">
                            <input
                              type="file"
                              accept=".csv"
                              id={`file-${index}`}
                              className="file-input"
                              onChange={(e) => handleFileUpload(index, e.target.files[0])}
                            />
                            <label htmlFor={`file-${index}`} className="file-upload-label">
                              <Upload size={24} />
                              <span>
                                {table.sourceFileName || 'Click to upload CSV file'}
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Target Configuration */}
                        <div className="config-section">
                          <h4 className="config-heading">Target Configuration</h4>
                          <div className="config-row">
                            <div className="input-wrapper">
                              <label className="input-label">If table exists</label>
                              <select
                                className="input-field"
                                value={table.ifExists}
                                onChange={(e) => handleTableChange(index, 'ifExists', e.target.value)}
                              >
                                <option value="replace">Replace</option>
                                <option value="append">Append</option>
                                <option value="fail">Fail</option>
                              </select>
                            </div>

                            <div className="input-wrapper">
                              <label className="input-label">Priority</label>
                              <input
                                type="number"
                                className="input-field"
                                min="1"
                                value={table.priority}
                                onChange={(e) =>
                                  handleTableChange(index, 'priority', parseInt(e.target.value))
                                }
                              />
                            </div>
                          </div>

                          {/* Dependencies */}
                          {formData.tables.length > 1 && (
                            <div className="input-wrapper">
                              <label className="input-label">Depends on (optional)</label>
                              <select
                                className="input-field"
                                multiple
                                value={table.dependsOn}
                                onChange={(e) =>
                                  handleTableChange(
                                    index,
                                    'dependsOn',
                                    Array.from(e.target.selectedOptions, (option) => option.value)
                                  )
                                }
                              >
                                {formData.tables
                                  .filter((_, i) => i !== index)
                                  .map((t, i) => (
                                    <option key={i} value={t.name || `table_${i}`}>
                                      {t.name || `Table ${i + 1}`}
                                    </option>
                                  ))}
                              </select>
                              <span className="input-hint">
                                Hold Ctrl/Cmd to select multiple tables
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Schema Definition */}
                        <div className="config-section">
                          <div className="config-section-header">
                            <h4 className="config-heading">Schema Definition</h4>
                            <div className="schema-actions-group">
                              <input
                                type="file"
                                accept=".json"
                                id={`schema-upload-${index}`}
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  if (e.target.files[0]) {
                                    handleSchemaUpload(index, e.target.files[0]);
                                    e.target.value = ''; // Reset input
                                  }
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  document.getElementById(`schema-upload-${index}`)?.click();
                                }}
                              >
                                <Upload size={16} />
                                Upload Schema
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openSchemaBuilder(index)}
                              >
                                <FileJson size={16} />
                                {table.schema.columns.length > 0
                                  ? `${table.schema.columns.length} columns`
                                  : 'Define Schema'}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Transformations */}
                        <div className="config-section">
                          <div className="config-section-header">
                            <h4 className="config-heading">Transformations</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAddTransformation(index)}
                            >
                              <Plus size={16} />
                              Add
                            </Button>
                          </div>
                          {table.transformations.map((transform, tIndex) => (
                            <div key={tIndex} className="transform-row">
                              <input
                                type="text"
                                className="input-field compact"
                                placeholder="Column name"
                                value={transform.column}
                                onChange={(e) =>
                                  handleTransformationChange(index, tIndex, 'column', e.target.value)
                                }
                              />
                              <select
                                className="input-field compact"
                                value={transform.action}
                                onChange={(e) =>
                                  handleTransformationChange(index, tIndex, 'action', e.target.value)
                                }
                              >
                                {transformationOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {transform.action === 'round' && (
                                <input
                                  type="number"
                                  className="input-field compact"
                                  placeholder="Decimals"
                                  value={transform.decimals || ''}
                                  onChange={(e) =>
                                    handleTransformationChange(
                                      index,
                                      tIndex,
                                      'decimals',
                                      parseInt(e.target.value)
                                    )
                                  }
                                />
                              )}
                              <button
                                className="icon-button"
                                onClick={() => handleRemoveTransformation(index, tIndex)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Validations */}
                        <div className="config-section">
                          <div className="config-section-header">
                            <h4 className="config-heading">Validations</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAddValidation(index)}
                            >
                              <Plus size={16} />
                              Add
                            </Button>
                          </div>
                          {table.validations.map((validation, vIndex) => (
                            <div key={vIndex} className="transform-row">
                              <input
                                type="text"
                                className="input-field compact"
                                placeholder="Column name"
                                value={validation.column}
                                onChange={(e) =>
                                  handleValidationChange(index, vIndex, 'column', e.target.value)
                                }
                              />
                              <select
                                className="input-field compact"
                                value={validation.rule}
                                onChange={(e) =>
                                  handleValidationChange(index, vIndex, 'rule', e.target.value)
                                }
                              >
                                {validationOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {validationOptions.find((opt) => opt.value === validation.rule)
                                ?.needsValue && (
                                  <input
                                    type="text"
                                    className="input-field compact"
                                    placeholder="Value"
                                    value={validation.value || ''}
                                    onChange={(e) =>
                                      handleValidationChange(index, vIndex, 'value', e.target.value)
                                    }
                                  />
                                )}
                              <button
                                className="icon-button"
                                onClick={() => handleRemoveValidation(index, vIndex)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <Card className="step-card fade-in">
              <Card.Header>
                <Card.Title>Review Configuration</Card.Title>
              </Card.Header>
              <Card.Body>
                <div className="review-content">
                  <div className="review-section">
                    <h3 className="review-heading">Project Information</h3>
                    <div className="review-grid">
                      <div className="review-item">
                        <span className="review-label">Name:</span>
                        <span className="review-value">{formData.projectName || 'Not set'}</span>
                      </div>
                      <div className="review-item">
                        <span className="review-label">Domain:</span>
                        <span className="review-value">
                          {formData.domain.charAt(0).toUpperCase() + formData.domain.slice(1)}
                        </span>
                      </div>
                      <div className="review-item">
                        <span className="review-label">Version:</span>
                        <span className="review-value">{formData.version}</span>
                      </div>
                      <div className="review-item full-width">
                        <span className="review-label">Description:</span>
                        <span className="review-value">
                          {formData.description || 'No description provided'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="review-section">
                    <h3 className="review-heading">Settings</h3>
                    <div className="review-grid">
                      <div className="review-item">
                        <span className="review-label">Execution Mode:</span>
                        <span className="review-value">
                          {formData.executionMode.charAt(0).toUpperCase() +
                            formData.executionMode.slice(1)}
                        </span>
                      </div>
                      <div className="review-item">
                        <span className="review-label">Stop on Error:</span>
                        <span className="review-value">{formData.stopOnError ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="review-item">
                        <span className="review-label">Blockchain:</span>
                        <span className="review-value">
                          {formData.blockchain.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="review-section">
                    <h3 className="review-heading">Tables ({formData.tables.length})</h3>
                    {formData.tables.map((table, index) => (
                      <div key={index} className="review-table-card">
                        <div className="review-table-header">
                          <Badge variant="info">Table {index + 1}</Badge>
                          <span className="review-table-name">{table.name || 'Unnamed'}</span>
                        </div>
                        <div className="review-table-details">
                          <span>📄 {table.sourceFileName || 'No file'}</span>
                          <span>📊 {table.schema.columns.length} columns</span>
                          <span>🔄 {table.transformations.length} transformations</span>
                          <span>✓ {table.validations.length} validations</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="form-actions">
          <Button variant="ghost" onClick={prevStep} disabled={currentStep === 1}>
            <ArrowLeft size={20} />
            Previous
          </Button>
          <div className="step-indicator">
            Step {currentStep} of {steps.length}
          </div>
          {currentStep < 4 ? (
            <Button variant="primary" onClick={nextStep}>
              Next
              <ArrowRight size={20} />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleSaveAndStart}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save & Start Pipeline'}
              <ArrowRight size={20} />
            </Button>
          )}
        </div>

        {/* Schema Builder Modal */}
        {showSchemaBuilder && currentTableIndex !== null && (
          <Modal
            isOpen={showSchemaBuilder}
            onClose={closeSchemaBuilder}
            size="lg"
            className="schema-modal"
          >
            <Modal.Header>
              <Modal.Title>
                Define Schema - {formData.tables[currentTableIndex]?.name || 'Table'}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="schema-builder">
                <div className="schema-builder-header">
                  <div className="schema-builder-actions">
                    <input
                      type="file"
                      accept=".json"
                      id={`schema-upload-modal-${currentTableIndex}`}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files[0]) {
                          handleSchemaUpload(currentTableIndex, e.target.files[0]);
                          e.target.value = ''; // Reset input
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        document.getElementById(`schema-upload-modal-${currentTableIndex}`)?.click();
                      }}
                    >
                      <Upload size={18} />
                      Upload Schema
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAddColumn(currentTableIndex)}
                      className="add-column-btn"
                    >
                      <Plus size={18} />
                      Add Column
                    </Button>
                  </div>
                </div>

                {formData.tables[currentTableIndex]?.schema.columns.length === 0 ? (
                  <div className="empty-schema">
                    <FileJson size={48} className="empty-icon" />
                    <p>No columns defined yet</p>
                    <p className="empty-hint">Click "Add Column" to start defining your table schema</p>
                  </div>
                ) : (
                  <div className="columns-list">
                    {formData.tables[currentTableIndex]?.schema.columns.map((column, cIndex) => (
                      <div key={cIndex} className="column-card">
                        <div className="column-card-header">
                          <span className="column-number">Column {cIndex + 1}</span>
                          <button
                            className="column-delete-btn"
                            onClick={() => handleRemoveColumn(currentTableIndex, cIndex)}
                            title="Delete column"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="column-card-body">
                          <div className="column-input-group">
                            <label className="column-label">Column Name</label>
                            <input
                              type="text"
                              className="column-input"
                              placeholder="e.g., customer_id"
                              value={column.name}
                              onChange={(e) =>
                                handleColumnChange(currentTableIndex, cIndex, 'name', e.target.value)
                              }
                            />
                          </div>
                          <div className="column-input-group">
                            <label className="column-label">Data Type</label>
                            <select
                              className="column-select"
                              value={column.type}
                              onChange={(e) =>
                                handleColumnChange(currentTableIndex, cIndex, 'type', e.target.value)
                              }
                            >
                              {columnTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type.charAt(0).toUpperCase() + type.slice(1)}
                                </option>
                              ))}
                            </select>
                          </div>
                          {column.type === 'string' && (
                            <div className="column-input-group">
                              <label className="column-label">Max Length</label>
                              <input
                                type="number"
                                className="column-input"
                                placeholder="255"
                                value={column.maxLength || ''}
                                onChange={(e) =>
                                  handleColumnChange(
                                    currentTableIndex,
                                    cIndex,
                                    'maxLength',
                                    parseInt(e.target.value) || null
                                  )
                                }
                              />
                            </div>
                          )}
                        </div>
                        <div className="column-card-footer">
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={column.nullable}
                              onChange={(e) =>
                                handleColumnChange(
                                  currentTableIndex,
                                  cIndex,
                                  'nullable',
                                  e.target.checked
                                )
                              }
                            />
                            <span className="toggle-slider"></span>
                            <span className="toggle-label">Nullable</span>
                          </label>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={column.primaryKey}
                              onChange={(e) =>
                                handleColumnChange(
                                  currentTableIndex,
                                  cIndex,
                                  'primaryKey',
                                  e.target.checked
                                )
                              }
                            />
                            <span className="toggle-slider"></span>
                            <span className="toggle-label">Primary Key</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="primary" onClick={closeSchemaBuilder} className="schema-done-btn">
                <Check size={18} />
                Done
              </Button>
            </Modal.Footer>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CreatePipeline;