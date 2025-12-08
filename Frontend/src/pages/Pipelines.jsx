import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import Alert from '../components/common/Alert';
import { 
  Plus, 
  Search, 
  GitBranch, 
  Play, 
  Clock, 
  Calendar, 
  FileCode,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Info,
  StopCircle
} from 'lucide-react';
import { pipelineConfigService } from '../services/pipelineConfig.service';
import { pipelineExecutionService } from '../services/pipelineExecution.service';
import './Pipelines.css';

const Pipelines = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Execution state
  const [executingPipelines, setExecutingPipelines] = useState({});
  const [activePollers, setActivePollers] = useState({});
  const [airflowHealthy, setAirflowHealthy] = useState(null);
  const [showAirflowWarning, setShowAirflowWarning] = useState(false);
  
  // Execution details modal
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);

  useEffect(() => {
    loadConfigs();
    checkAirflowHealth();
    
    // Cleanup pollers on unmount
    return () => {
      Object.values(activePollers).forEach(stopFn => stopFn && stopFn());
    };
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

  const checkAirflowHealth = async () => {
    try {
      const health = await pipelineExecutionService.checkAirflowHealth();
      setAirflowHealthy(health.is_healthy);
      if (!health.is_healthy) {
        setShowAirflowWarning(true);
      }
    } catch (err) {
      console.error('Error checking Airflow health:', err);
      setAirflowHealthy(false);
      setShowAirflowWarning(true);
    }
  };

  const handleExecute = useCallback(async (configId) => {
    // Check Airflow health first
    if (airflowHealthy === false) {
      setShowAirflowWarning(true);
      return;
    }

    try {
      // Update UI to show loading
      setExecutingPipelines(prev => ({
        ...prev,
        [configId]: { status: 'pending', executionId: null, error: null }
      }));

      // Trigger execution
      const result = await pipelineExecutionService.execute(configId);
      
      // Update with execution ID
      setExecutingPipelines(prev => ({
        ...prev,
        [configId]: { 
          status: result.status, 
          executionId: result.execution_id,
          airflowDagId: result.airflow_dag_id,
          airflowRunId: result.airflow_run_id,
          error: null
        }
      }));

      // Start polling for status
      const stopPolling = pipelineExecutionService.pollStatus(
        result.execution_id,
        (statusData, pollError) => {
          if (pollError) {
            console.error('Polling error:', pollError);
            return;
          }
          
          if (statusData) {
            setExecutingPipelines(prev => ({
              ...prev,
              [configId]: { 
                status: statusData.status, 
                executionId: statusData.id,
                airflowDagId: statusData.airflow_dag_id,
                airflowRunId: statusData.airflow_run_id,
                startedAt: statusData.started_at,
                completedAt: statusData.completed_at,
                taskProgress: statusData.task_progress ? JSON.parse(statusData.task_progress) : null,
                error: statusData.error_message
              }
            }));
          }
        },
        3000 // Poll every 3 seconds
      );

      // Store the stop function
      setActivePollers(prev => ({
        ...prev,
        [configId]: stopPolling
      }));

    } catch (err) {
      console.error('Error executing pipeline:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to execute pipeline';
      
      setExecutingPipelines(prev => ({
        ...prev,
        [configId]: { status: 'error', error: errorMessage, executionId: null }
      }));
    }
  }, [airflowHealthy]);

  const handleViewExecution = async (configId) => {
    const execution = executingPipelines[configId];
    if (execution?.executionId) {
      try {
        const details = await pipelineExecutionService.getExecution(execution.executionId);
        setSelectedExecution(details);
        setShowExecutionModal(true);
      } catch (err) {
        console.error('Error fetching execution details:', err);
      }
    }
  };

  const filteredConfigs = configs.filter(config =>
    config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (config.description && config.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (config.domain && config.domain.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getDomainBadge = (domain) => {
    if (!domain) return null;
    const domainColors = {
      banking: 'info',
      medical: 'success',
      crypto: 'warning',
      ecommerce: 'primary',
    };
    const variant = domainColors[domain.toLowerCase()] || 'neutral';
    return <Badge variant={variant}>{domain}</Badge>;
  };

  const getExecutionState = (configId) => {
    return executingPipelines[configId] || null;
  };

  const renderExecuteButton = (config) => {
    const execution = getExecutionState(config.id);
    const status = execution?.status;

    // Check if Airflow is not configured
    if (airflowHealthy === false) {
      return (
        <Button 
          variant="ghost" 
          size="sm" 
          disabled
          title="Airflow is not configured or not accessible"
        >
          <AlertCircle size={16} />
          Not Available
        </Button>
      );
    }

    // Pending/Starting state
    if (status === 'pending') {
      return (
        <Button variant="secondary" size="sm" disabled className="executing-btn">
          <Loader2 size={16} className="spin" />
          Starting...
        </Button>
      );
    }

    // Queued state
    if (status === 'queued') {
      return (
        <Button variant="info" size="sm" disabled className="executing-btn">
          <Clock size={16} />
          Queued
        </Button>
      );
    }

    // Running state
    if (status === 'running') {
      const progress = execution?.taskProgress;
      return (
        <div className="execution-running">
          <Button variant="warning" size="sm" disabled className="executing-btn">
            <Loader2 size={16} className="spin" />
            Running
            {progress && (
              <span className="progress-text">
                ({progress.completed}/{progress.total})
              </span>
            )}
          </Button>
          <button 
            className="view-details-btn"
            onClick={() => handleViewExecution(config.id)}
            title="View execution details"
          >
            <Info size={14} />
          </button>
        </div>
      );
    }

    // Success state
    if (status === 'success') {
      return (
        <div className="execution-complete">
          <Button 
            variant="success" 
            size="sm" 
            onClick={() => handleExecute(config.id)}
            className="success-btn"
          >
            <CheckCircle size={16} />
            Done - Run Again
          </Button>
          <button 
            className="view-details-btn"
            onClick={() => handleViewExecution(config.id)}
            title="View execution details"
          >
            <Info size={14} />
          </button>
        </div>
      );
    }

    // Failed state
    if (status === 'failed' || status === 'error') {
      return (
        <div className="execution-failed">
          <Button 
            variant="danger" 
            size="sm" 
            onClick={() => handleExecute(config.id)}
            className="retry-btn"
            title={execution?.error || 'Execution failed'}
          >
            <XCircle size={16} />
            Failed - Retry
          </Button>
          <button 
            className="view-details-btn"
            onClick={() => handleViewExecution(config.id)}
            title="View error details"
          >
            <Info size={14} />
          </button>
        </div>
      );
    }

    // Default - Ready to execute
    return (
      <Button 
        variant="primary" 
        size="sm" 
        onClick={() => handleExecute(config.id)}
        className="execute-btn"
      >
        <Play size={16} />
        Execute
      </Button>
    );
  };

  const renderExecutionStats = (config) => {
    const execution = getExecutionState(config.id);
    
    if (!execution || !execution.executionId) {
      return (
        <div className="pipeline-execution-stats">
          <div className="execution-stat">
            <span className="stat-label">
              <Clock size={12} />
              Last Run
            </span>
            <span className="stat-value">-</span>
          </div>
          <div className="execution-stat">
            <span className="stat-label">Status</span>
            <span className="stat-value">
              <Badge variant="neutral">Ready</Badge>
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="pipeline-execution-stats">
        <div className="execution-stat">
          <span className="stat-label">
            <Clock size={12} />
            Started
          </span>
          <span className="stat-value">{formatDate(execution.startedAt)}</span>
        </div>
        <div className="execution-stat">
          <span className="stat-label">Status</span>
          <span className="stat-value">
            <Badge variant={pipelineExecutionService.getStatusBadgeVariant(execution.status)}>
              {pipelineExecutionService.getStatusLabel(execution.status)}
            </Badge>
          </span>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="pipelines">
        <div className="pipelines-header">
          <div>
            <h1 className="page-title">Pipeline Configurations</h1>
            <p className="page-subtitle">Manage and execute your ETL pipeline configurations</p>
          </div>
          <div className="header-actions">
            <Button 
              variant="ghost" 
              onClick={() => { loadConfigs(); checkAirflowHealth(); }}
              title="Refresh"
            >
              <RefreshCw size={20} />
            </Button>
          <Link to="/pipelines/create">
            <Button variant="primary">
              <Plus size={20} />
              Create Pipeline
            </Button>
          </Link>
        </div>
        </div>

        {/* Airflow Health Warning */}
        {showAirflowWarning && !airflowHealthy && (
          <Alert 
            variant="warning" 
            dismissible 
            onDismiss={() => setShowAirflowWarning(false)}
            className="airflow-warning"
          >
            <div className="alert-content">
              <AlertCircle size={20} />
              <div>
                <strong>Airflow Connection Issue</strong>
                <p>
                  Unable to connect to Airflow. Pipeline execution is temporarily unavailable.
                  Please ensure Airflow is running and the connection settings are configured correctly.
                </p>
              </div>
            </div>
          </Alert>
        )}

        <div className="pipelines-filters">
          <div className="search-wrapper">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, description, or domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-info">
            {!loading && (
              <>
              <span className="config-count">
                {filteredConfigs.length} configuration{filteredConfigs.length !== 1 ? 's' : ''}
              </span>
                {airflowHealthy !== null && (
                  <span className={`airflow-status ${airflowHealthy ? 'healthy' : 'unhealthy'}`}>
                    <span className="status-dot"></span>
                    Airflow {airflowHealthy ? 'Connected' : 'Disconnected'}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {loading ? (
          <Card>
            <div className="loading-state">
              <Spinner size="lg" />
              <p>Loading pipeline configurations...</p>
            </div>
          </Card>
        ) : error ? (
          <Card>
            <div className="error-state">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={loadConfigs}>
                Try Again
              </Button>
            </div>
          </Card>
        ) : filteredConfigs.length === 0 ? (
          <Card>
            <EmptyState
              icon={GitBranch}
              title={searchQuery ? "No matching configurations" : "No pipeline configurations"}
              description={
                searchQuery 
                  ? "Try adjusting your search terms" 
                  : "Create your first pipeline configuration to get started with data integrity verification"
              }
              action={
                !searchQuery && (
                  <Link to="/pipelines/create">
                    <Button variant="primary">
                      <Plus size={20} />
                      Create Pipeline
                    </Button>
                  </Link>
                )
              }
            />
          </Card>
        ) : (
          <div className="pipelines-grid">
            {filteredConfigs.map((config) => (
              <Card key={config.id} hover>
                <Card.Header>
                  <div className="pipeline-card-header">
                    <FileCode size={24} className="pipeline-icon" />
                    {getDomainBadge(config.domain)}
                  </div>
                  <Card.Title>{config.name}</Card.Title>
                </Card.Header>
                <Card.Body>
                  <p className="pipeline-description">
                    {config.description || 'No description provided'}
                  </p>
                  <div className="pipeline-stats">
                    <div className="pipeline-stat">
                      <span className="stat-label">
                        <Calendar size={12} />
                        Created
                      </span>
                      <span className="stat-value">{formatDate(config.created_at)}</span>
                    </div>
                    <div className="pipeline-stat">
                      <span className="stat-label">Version</span>
                      <span className="stat-value">{config.version || '-'}</span>
                    </div>
                  </div>
                  
                  {/* Execution Stats */}
                  {renderExecutionStats(config)}
                </Card.Body>
                <Card.Footer>
                  <Link to="/my-configs">
                    <Button variant="ghost" size="sm">View Details</Button>
                  </Link>
                  {renderExecuteButton(config)}
                </Card.Footer>
              </Card>
            ))}
          </div>
        )}

        {/* Execution Details Modal */}
        {showExecutionModal && selectedExecution && (
          <Modal
            isOpen={showExecutionModal}
            onClose={() => setShowExecutionModal(false)}
            size="lg"
          >
            <Modal.Header>
              <Modal.Title>Execution Details</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="execution-details">
                <div className="execution-info-grid">
                  <div className="info-item">
                    <span className="info-label">Status</span>
                    <Badge variant={pipelineExecutionService.getStatusBadgeVariant(selectedExecution.status)}>
                      {pipelineExecutionService.getStatusLabel(selectedExecution.status)}
                    </Badge>
                  </div>
                  <div className="info-item">
                    <span className="info-label">DAG ID</span>
                    <span className="info-value">{selectedExecution.airflow_dag_id || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Run ID</span>
                    <span className="info-value code">{selectedExecution.airflow_run_id || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Started</span>
                    <span className="info-value">{formatDate(selectedExecution.started_at)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Completed</span>
                    <span className="info-value">{formatDate(selectedExecution.completed_at)}</span>
                  </div>
                </div>

                {selectedExecution.error_message && (
                  <div className="error-section">
                    <h4>Error Message</h4>
                    <pre className="error-message">{selectedExecution.error_message}</pre>
                  </div>
                )}

                {selectedExecution.tasks && selectedExecution.tasks.length > 0 && (
                  <div className="tasks-section">
                    <h4>Tasks</h4>
                    <div className="tasks-list">
                      {selectedExecution.tasks.map((task, index) => (
                        <div key={index} className="task-item">
                          <span className="task-name">{task.task_id}</span>
                          <Badge variant={pipelineExecutionService.getStatusBadgeVariant(task.state)}>
                            {task.state}
                          </Badge>
                          {task.duration && (
                            <span className="task-duration">{task.duration.toFixed(1)}s</span>
                          )}
                        </div>
                      ))}
            </div>
          </div>
                )}
        </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onClick={() => setShowExecutionModal(false)}>
                Close
              </Button>
            </Modal.Footer>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Pipelines;
