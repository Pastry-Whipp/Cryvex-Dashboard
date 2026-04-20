import React from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { CheckCircle, XCircle, AlertTriangle, Shield, Database, Hash, List, Download } from 'lucide-react';
import { generatePipelineVerificationPDF } from '../../utils/reportGenerator';
import './VerificationResultsModal.css';

const VerificationResultsModal = ({ isOpen, onClose, verification }) => {
    if (!verification) return null;

    const isSuccess = verification.status === 'success';
    const isFailed = verification.status === 'failed';
    const isRunning = verification.status === 'running' || verification.status === 'queued';

    // Parse task progress for verification results
    const taskProgress = verification.task_progress ? JSON.parse(verification.task_progress) : null;
    const tasks = verification.tasks || [];

    // Show all tasks — the verification DAG uses a single 'run_verification' task
    const verificationTasks = tasks;

    const getTaskIcon = (state) => {
        if (state === 'success') return <CheckCircle size={16} className="task-icon success" />;
        if (state === 'failed') return <XCircle size={16} className="task-icon failed" />;
        if (state === 'running') return <div className="spinner-small"></div>;
        return <AlertTriangle size={16} className="task-icon pending" />;
    };

    const getTaskBadgeVariant = (state) => {
        if (state === 'success') return 'success';
        if (state === 'failed') return 'danger';
        if (state === 'running') return 'warning';
        return 'neutral';
    };

    const formatDuration = (duration) => {
        if (!duration) return '-';
        if (duration < 1) return `${(duration * 1000).toFixed(0)}ms`;
        return `${duration.toFixed(2)}s`;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <Modal.Header>
                <Modal.Title>
                    <div className="modal-title-with-icon">
                        <Shield size={24} />
                        Verification Results
                    </div>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="verification-results">
                    {/* Overall Status */}
                    <div className={`verification-status-banner ${isSuccess ? 'success' : isFailed ? 'failed' : 'pending'}`}>
                        <div className="status-icon">
                            {isSuccess && <CheckCircle size={48} />}
                            {isFailed && <XCircle size={48} />}
                            {isRunning && <div className="spinner-large"></div>}
                        </div>
                        <div className="status-content">
                            <h3 className="status-title">
                                {isSuccess && 'Verification Passed'}
                                {isFailed && 'Verification Failed'}
                                {isRunning && 'Verification In Progress'}
                            </h3>
                            <p className="status-description">
                                {isSuccess && 'All data integrity checks passed successfully. Your data matches the blockchain records.'}
                                {isFailed && 'Some integrity checks failed. Please review the details below.'}
                                {isRunning && 'Verification is currently running. Please wait...'}
                            </p>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    {taskProgress && (
                        <div className="verification-summary">
                            <div className="summary-card">
                                <Database size={20} />
                                <div className="summary-content">
                                    <span className="summary-label">Total Tables</span>
                                    <span className="summary-value">{taskProgress.total || 0}</span>
                                </div>
                            </div>
                            <div className="summary-card success">
                                <CheckCircle size={20} />
                                <div className="summary-content">
                                    <span className="summary-label">Verified</span>
                                    <span className="summary-value">{taskProgress.completed || 0}</span>
                                </div>
                            </div>
                            <div className="summary-card failed">
                                <XCircle size={20} />
                                <div className="summary-content">
                                    <span className="summary-label">Failed</span>
                                    <span className="summary-value">{taskProgress.failed || 0}</span>
                                </div>
                            </div>
                            <div className="summary-card running">
                                <List size={20} />
                                <div className="summary-content">
                                    <span className="summary-label">Running</span>
                                    <span className="summary-value">{taskProgress.running || 0}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {verification.error_message && (
                        <div className="error-section">
                            <div className="error-header">
                                <AlertTriangle size={20} />
                                <h4>Error Details</h4>
                            </div>
                            <pre className="error-message">{verification.error_message}</pre>
                        </div>
                    )}

                    {/* Table Verification Results */}
                    {verificationTasks.length > 0 && (
                        <div className="tables-section">
                            <h4 className="section-title">
                                <Database size={18} />
                                Verification Task Details
                            </h4>
                            <div className="tables-list">
                                {verificationTasks.map((task, index) => {
                                    const tableName = task.task_id.replace(/^(verify_|run_)/, '');
                                    return (
                                        <div key={index} className={`table-item ${task.state}`}>
                                            <div className="table-header">
                                                {getTaskIcon(task.state)}
                                                <span className="table-name">{tableName}</span>
                                                <Badge variant={getTaskBadgeVariant(task.state)}>
                                                    {task.state}
                                                </Badge>
                                            </div>
                                            <div className="table-details">
                                                <div className="table-detail">
                                                    <Hash size={14} />
                                                    <span className="detail-label">Duration:</span>
                                                    <span className="detail-value">{formatDuration(task.duration)}</span>
                                                </div>
                                                {task.start_date && (
                                                    <div className="table-detail">
                                                        <span className="detail-label">Started:</span>
                                                        <span className="detail-value">
                                                            {new Date(task.start_date).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                )}
                                                {task.end_date && (
                                                    <div className="table-detail">
                                                        <span className="detail-label">Completed:</span>
                                                        <span className="detail-value">
                                                            {new Date(task.end_date).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Execution Info */}
                    <div className="execution-info">
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="info-label">Pipeline</span>
                                <span className="info-value">{verification.config_name || 'Unknown'}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">DAG ID</span>
                                <span className="info-value code">{verification.airflow_dag_id || '-'}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Run ID</span>
                                <span className="info-value code">{verification.airflow_run_id || '-'}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Started</span>
                                <span className="info-value">
                                    {verification.started_at
                                        ? new Date(verification.started_at).toLocaleString()
                                        : '-'}
                                </span>
                            </div>
                            {verification.completed_at && (
                                <div className="info-item">
                                    <span className="info-label">Completed</span>
                                    <span className="info-value">
                                        {new Date(verification.completed_at).toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                {(isSuccess || isFailed) && (
                    <Button
                        variant="outline"
                        onClick={() => generatePipelineVerificationPDF({ verification })}
                    >
                        <Download size={16} />
                        Download Report
                    </Button>
                )}
                <Button variant="primary" onClick={onClose}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default VerificationResultsModal;
