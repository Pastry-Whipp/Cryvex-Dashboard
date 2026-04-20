import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import VerificationResultsModal from '../components/verification/VerificationResultsModal';
import {
    Plus,
    Search,
    Shield,
    Clock,
    Calendar,
    CheckCircle,
    XCircle,
    AlertCircle,
    RefreshCw,
    Loader2,
    Info,
    StopCircle,
    Download,
} from 'lucide-react';
import { pipelineConfigService } from '../services/pipelineConfig.service';
import { verificationService, merkleProofService } from '../services/verification.service';
import { pipelineExecutionService } from '../services/pipelineExecution.service';
import { generatePipelineVerificationPDF } from '../utils/reportGenerator';
import './VerifyIntegrity.css';

const VerifyIntegrity = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Verification state
    const [verifyingPipelines, setVerifyingPipelines] = useState({});
    const [activePollers, setActivePollers] = useState({});
    const [airflowHealthy, setAirflowHealthy] = useState(null);
    const [showAirflowWarning, setShowAirflowWarning] = useState(false);

    // Verification results modal
    const [selectedVerification, setSelectedVerification] = useState(null);
    const [showResultsModal, setShowResultsModal] = useState(false);

    useEffect(() => {
        loadConfigs();
        checkAirflowHealth();

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

            try {
                const allExecutions = await pipelineExecutionService.getMyExecutions({ limit: 200 });
                const verifyExecs = allExecutions.filter(e => e.execution_type === 'verify');

                const latestByConfig = {};
                for (const exec of verifyExecs) {
                    const cid = exec.pipeline_config_id;
                    if (!latestByConfig[cid] || new Date(exec.created_at) > new Date(latestByConfig[cid].created_at)) {
                        latestByConfig[cid] = exec;
                    }
                }

                const restoredState = {};
                for (const [configId, exec] of Object.entries(latestByConfig)) {
                    restoredState[configId] = {
                        status: exec.status,
                        executionId: exec.id,
                        airflowDagId: exec.airflow_dag_id,
                        airflowRunId: exec.airflow_run_id,
                        startedAt: exec.started_at,
                        completedAt: exec.completed_at,
                        taskProgress: exec.task_progress ? JSON.parse(exec.task_progress) : null,
                        error: exec.error_message
                    };
                }

                setVerifyingPipelines(prev => ({ ...restoredState, ...prev }));
            } catch (err) {
                console.warn('Could not load verification history:', err);
            }
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
            if (!health.is_healthy) setShowAirflowWarning(true);
        } catch (err) {
            setAirflowHealthy(false);
            setShowAirflowWarning(true);
        }
    };

    const handleVerify = useCallback(async (configId) => {
        if (airflowHealthy === false) {
            setShowAirflowWarning(true);
            return;
        }

        try {
            setVerifyingPipelines(prev => ({
                ...prev,
                [configId]: { status: 'pending', executionId: null, error: null }
            }));

            const result = await verificationService.triggerVerification(configId);

            setVerifyingPipelines(prev => ({
                ...prev,
                [configId]: {
                    status: result.status,
                    executionId: result.execution_id,
                    airflowDagId: result.airflow_dag_id,
                    airflowRunId: result.airflow_run_id,
                    error: null
                }
            }));

            const stopPolling = verificationService.pollVerificationStatus(
                result.execution_id,
                (statusData, pollError) => {
                    if (pollError) return;
                    if (statusData) {
                        setVerifyingPipelines(prev => ({
                            ...prev,
                            [configId]: {
                                status: statusData.status,
                                executionId: statusData.id,
                                airflowDagId: statusData.airflow_dag_id,
                                airflowRunId: statusData.airflow_run_id,
                                startedAt: statusData.started_at,
                                completedAt: statusData.completed_at,
                                taskProgress: statusData.task_progress ? JSON.parse(statusData.task_progress) : null,
                                error: statusData.error_message,
                                fullData: statusData
                            }
                        }));

                        if (statusData.status === 'success' || statusData.status === 'failed') {
                            setSelectedVerification(statusData);
                            setShowResultsModal(true);
                        }
                    }
                },
                3000
            );

            setActivePollers(prev => ({ ...prev, [configId]: stopPolling }));
        } catch (err) {
            const errorMessage = err.response?.data?.detail || err.message || 'Failed to verify pipeline';
            setVerifyingPipelines(prev => ({
                ...prev,
                [configId]: { status: 'error', error: errorMessage, executionId: null }
            }));
        }
    }, [airflowHealthy]);

    const handleForceStop = useCallback(async (configId) => {
        const verification = verifyingPipelines[configId];
        if (!verification?.executionId) return;

        try {
            await verificationService.forceStop(verification.executionId);
            const stopFn = activePollers[configId];
            if (stopFn) stopFn();
            setActivePollers(prev => { const n = { ...prev }; delete n[configId]; return n; });
            setVerifyingPipelines(prev => ({
                ...prev,
                [configId]: {
                    ...prev[configId],
                    status: 'cancelled',
                    completedAt: new Date().toISOString(),
                    error: 'Force stopped by user'
                }
            }));
        } catch (err) {
            console.error('Error force stopping:', err);
        }
    }, [verifyingPipelines, activePollers]);

    const handleViewResults = async (configId) => {
        const verification = verifyingPipelines[configId];
        if (verification?.executionId) {
            try {
                const details = await verificationService.getVerificationResults(verification.executionId);
                setSelectedVerification(details);
                setShowResultsModal(true);
            } catch (err) {
                console.error('Error fetching verification results:', err);
            }
        }
    };

    const handleDownloadPDF = async (configId) => {
        const verification = verifyingPipelines[configId];
        if (!verification?.executionId) return;
        try {
            // Fetch verification details + all merkle_audit tables in parallel
            const [details, tablesData] = await Promise.all([
                verificationService.getVerificationResults(verification.executionId),
                merkleProofService.getVerifiedTables()
            ]);
            await generatePipelineVerificationPDF({
                verification: details,
                auditTables: tablesData.tables || []
            });
        } catch (err) {
            console.error('Error generating PDF:', err);
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
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getDomainBadge = (domain) => {
        if (!domain) return null;
        const domainColors = { banking: 'info', medical: 'success', crypto: 'warning', ecommerce: 'primary' };
        return <Badge variant={domainColors[domain.toLowerCase()] || 'neutral'}>{domain}</Badge>;
    };

    const getVerificationState = (configId) => verifyingPipelines[configId] || null;

    const renderVerifyButton = (config) => {
        const verification = getVerificationState(config.id);
        const status = verification?.status;

        if (airflowHealthy === false) {
            return (
                <Button variant="ghost" size="sm" disabled title="Airflow is not accessible">
                    <AlertCircle size={16} />
                    Not Available
                </Button>
            );
        }

        if (status === 'pending') {
            return (
                <div className="verification-running">
                    <Button variant="secondary" size="sm" disabled className="verifying-btn">
                        <Loader2 size={16} className="spin" />
                        Starting...
                    </Button>
                    <button className="force-stop-btn" onClick={() => handleForceStop(config.id)} title="Force stop">
                        <StopCircle size={14} />
                    </button>
                </div>
            );
        }

        if (status === 'queued') {
            return (
                <div className="verification-running">
                    <Button variant="info" size="sm" disabled className="verifying-btn">
                        <Clock size={16} />
                        Queued
                    </Button>
                    <button className="force-stop-btn" onClick={() => handleForceStop(config.id)} title="Force stop">
                        <StopCircle size={14} />
                    </button>
                </div>
            );
        }

        if (status === 'running') {
            const progress = verification?.taskProgress;
            return (
                <div className="verification-running">
                    <Button variant="warning" size="sm" disabled className="verifying-btn">
                        <Loader2 size={16} className="spin" />
                        Verifying
                        {progress && <span className="progress-text">({progress.completed}/{progress.total})</span>}
                    </Button>
                    <button className="view-details-btn" onClick={() => handleViewResults(config.id)} title="View details">
                        <Info size={14} />
                    </button>
                    <button className="force-stop-btn" onClick={() => handleForceStop(config.id)} title="Force stop">
                        <StopCircle size={14} />
                    </button>
                </div>
            );
        }

        if (status === 'success') {
            return (
                <div className="verification-complete">
                    <Button variant="success" size="sm" onClick={() => handleVerify(config.id)} className="success-btn">
                        <CheckCircle size={16} />
                        Verified - Verify Again
                    </Button>
                    <button className="view-details-btn" onClick={() => handleViewResults(config.id)} title="View results">
                        <Info size={14} />
                    </button>
                    <button className="view-details-btn" onClick={() => handleDownloadPDF(config.id)} title="Download PDF Report">
                        <Download size={14} />
                    </button>
                </div>
            );
        }

        if (status === 'failed' || status === 'error') {
            return (
                <div className="verification-failed">
                    <Button variant="danger" size="sm" onClick={() => handleVerify(config.id)} className="retry-btn" title={verification?.error || 'Verification failed'}>
                        <XCircle size={16} />
                        Failed - Retry
                    </Button>
                    <button className="view-details-btn" onClick={() => handleViewResults(config.id)} title="View error details">
                        <Info size={14} />
                    </button>
                    <button className="view-details-btn" onClick={() => handleDownloadPDF(config.id)} title="Download PDF Report">
                        <Download size={14} />
                    </button>
                </div>
            );
        }

        if (status === 'cancelled') {
            return (
                <div className="verification-failed">
                    <Button variant="ghost" size="sm" onClick={() => handleVerify(config.id)} className="retry-btn">
                        <StopCircle size={16} />
                        Stopped - Verify Again
                    </Button>
                    <button className="view-details-btn" onClick={() => handleViewResults(config.id)} title="View details">
                        <Info size={14} />
                    </button>
                </div>
            );
        }

        return (
            <Button variant="primary" size="sm" onClick={() => handleVerify(config.id)} className="verify-btn">
                <Shield size={16} />
                Verify Integrity
            </Button>
        );
    };

    const renderVerificationStats = (config) => {
        const verification = getVerificationState(config.id);

        if (!verification || !verification.executionId) {
            return (
                <div className="pipeline-verification-stats">
                    <div className="verification-stat">
                        <span className="stat-label"><Clock size={12} /> Last Verified</span>
                        <span className="stat-value">Never</span>
                    </div>
                    <div className="verification-stat">
                        <span className="stat-label">Status</span>
                        <span className="stat-value"><Badge variant="neutral">Not Verified</Badge></span>
                    </div>
                </div>
            );
        }

        const isTerminal = ['success', 'failed', 'cancelled'].includes(verification.status);
        return (
            <div className="pipeline-verification-stats">
                <div className="verification-stat">
                    <span className="stat-label">
                        <Clock size={12} />
                        {isTerminal ? 'Last Verified' : 'Started'}
                    </span>
                    <span className="stat-value">
                        {formatDate(isTerminal ? (verification.completedAt || verification.startedAt) : verification.startedAt)}
                    </span>
                </div>
                <div className="verification-stat">
                    <span className="stat-label">Status</span>
                    <span className="stat-value">
                        <Badge variant={verificationService.getStatusBadgeVariant(verification.status)}>
                            {verificationService.getStatusLabel(verification.status)}
                        </Badge>
                    </span>
                </div>
            </div>
        );
    };

    return (
        <DashboardLayout>
            <div className="verify-integrity">
                <div className="verify-integrity-header">
                    <div>
                        <h1 className="page-title">Verify Data Integrity</h1>
                        <p className="page-subtitle">Verify your pipeline data against blockchain Merkle roots</p>
                    </div>
                    <div className="header-actions">
                        <Button variant="ghost" onClick={() => { loadConfigs(); checkAirflowHealth(); }} title="Refresh">
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

                {showAirflowWarning && !airflowHealthy && (
                    <Alert variant="warning" dismissible onDismiss={() => setShowAirflowWarning(false)} className="airflow-warning">
                        <div className="alert-content">
                            <AlertCircle size={20} />
                            <div>
                                <strong>Airflow Connection Issue</strong>
                                <p>Unable to connect to Airflow. Verification is temporarily unavailable.</p>
                            </div>
                        </div>
                    </Alert>
                )}

                <div className="verify-integrity-filters">
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
                            <Button variant="outline" size="sm" onClick={loadConfigs}>Try Again</Button>
                        </div>
                    </Card>
                ) : filteredConfigs.length === 0 ? (
                    <Card>
                        <EmptyState
                            icon={Shield}
                            title={searchQuery ? 'No matching configurations' : 'No pipeline configurations'}
                            description={
                                searchQuery
                                    ? 'Try adjusting your search terms'
                                    : 'Create your first pipeline configuration to verify data integrity'
                            }
                            action={
                                !searchQuery && (
                                    <Link to="/pipelines/create">
                                        <Button variant="primary"><Plus size={20} /> Create Pipeline</Button>
                                    </Link>
                                )
                            }
                        />
                    </Card>
                ) : (
                    <div className="verify-integrity-grid">
                        {filteredConfigs.map((config) => (
                            <Card key={config.id} hover>
                                <Card.Header>
                                    <div className="pipeline-card-header">
                                        <Shield size={24} className="pipeline-icon" />
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
                                            <span className="stat-label"><Calendar size={12} /> Created</span>
                                            <span className="stat-value">{formatDate(config.created_at)}</span>
                                        </div>
                                        <div className="pipeline-stat">
                                            <span className="stat-label">Version</span>
                                            <span className="stat-value">{config.version || '-'}</span>
                                        </div>
                                    </div>
                                    {renderVerificationStats(config)}
                                </Card.Body>
                                <Card.Footer>
                                    <Link to="/my-configs">
                                        <Button variant="ghost" size="sm">View Config</Button>
                                    </Link>
                                    {renderVerifyButton(config)}
                                </Card.Footer>
                            </Card>
                        ))}
                    </div>
                )}

                {showResultsModal && selectedVerification && (
                    <VerificationResultsModal
                        isOpen={showResultsModal}
                        onClose={() => setShowResultsModal(false)}
                        verification={selectedVerification}
                    />
                )}
            </div>
        </DashboardLayout>
    );
};

export default VerifyIntegrity;
