import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { pipelineExecutionService } from '../services/pipelineExecution.service';
import {
    Activity,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    FileText,
    Trash2,
    Filter,
    Search,
    Terminal,
    Database,
    ShieldCheck,
    ExternalLink
} from 'lucide-react';

const TYPE_CONFIG = {
    etl:    { label: 'ETL Pipeline', color: 'primary',  Icon: Database },
    verify: { label: 'Verify',       color: 'info',     Icon: ShieldCheck },
};
import './Executions.css';

const STATUS_CONFIG = {
    pending:   { color: 'neutral',  icon: Clock,        label: 'Pending' },
    queued:    { color: 'info',     icon: Clock,        label: 'Queued' },
    running:   { color: 'warning',  icon: Loader2,      label: 'Running' },
    success:   { color: 'success',  icon: CheckCircle2, label: 'Completed' },
    failed:    { color: 'error',    icon: XCircle,      label: 'Failed' },
    cancelled: { color: 'neutral',  icon: XCircle,      label: 'Cancelled' },
};

/**
 * Extract a short human-readable error summary from the full error_message.
 * Looks for common Python/Airflow error patterns and returns the most useful line.
 */
function extractErrorSummary(errorMessage) {
    if (!errorMessage) return 'Unknown error';
    const lines = errorMessage.split('\n').map(l => l.trim()).filter(Boolean);

    // Look for common error patterns (last meaningful error line)
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        // Python exceptions: "SomeError: message"
        if (/^[A-Z]\w*(Error|Exception|Failure):/.test(line)) {
            return line.length > 200 ? line.substring(0, 197) + '...' : line;
        }
        // "ERROR - message" from Airflow logs
        if (/^ERROR\s*[-–]/.test(line)) {
            const msg = line.replace(/^ERROR\s*[-–]\s*/, '');
            return msg.length > 200 ? msg.substring(0, 197) + '...' : msg;
        }
        // "raise ..." lines
        if (/^raise\s+/.test(line)) {
            return line.length > 200 ? line.substring(0, 197) + '...' : line;
        }
    }

    // Fallback: first non-empty line with "Task:" prefix stripped
    const first = lines.find(l => !l.startsWith('---')) || lines[0] || 'Unknown error';
    return first.length > 200 ? first.substring(0, 197) + '...' : first;
}

const Executions = () => {
    const navigate = useNavigate();
    const [executions, setExecutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [taskLogs, setTaskLogs] = useState({});
    const [loadingLogs, setLoadingLogs] = useState({});
    // Full details fetched on-demand when expanding a non-active execution
    const [executionDetails, setExecutionDetails] = useState({});
    const [loadingDetails, setLoadingDetails] = useState({});
    const pollStoppers = useRef({});

    const fetchExecutions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await pipelineExecutionService.getMyExecutions({
                limit: 50,
                statusFilter: statusFilter || undefined
            });
            setExecutions(data);
        } catch (err) {
            console.error('Error fetching executions:', err);
            setError('Failed to load executions.');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchExecutions();
    }, [fetchExecutions]);

    // Poll active executions
    useEffect(() => {
        const activeExecs = executions.filter(e =>
            ['pending', 'queued', 'running'].includes(e.status)
        );

        // Stop polling for executions that are no longer active
        Object.keys(pollStoppers.current).forEach(id => {
            if (!activeExecs.find(e => e.id === parseInt(id))) {
                pollStoppers.current[id]();
                delete pollStoppers.current[id];
            }
        });

        // Start polling for new active executions
        activeExecs.forEach(exec => {
            if (pollStoppers.current[exec.id]) return;

            pollStoppers.current[exec.id] = pipelineExecutionService.pollStatus(
                exec.id,
                (data, err) => {
                    if (data) {
                        setExecutions(prev =>
                            prev.map(e => e.id === exec.id ? { ...e, ...data } : e)
                        );
                        // Stop polling when terminal
                        if (['success', 'failed', 'cancelled'].includes(data.status)) {
                            delete pollStoppers.current[exec.id];
                        }
                    }
                },
                4000
            );
        });

        return () => {
            Object.values(pollStoppers.current).forEach(stop => stop());
            pollStoppers.current = {};
        };
    }, [executions.map(e => `${e.id}:${e.status}`).join(',')]);

    const handleDelete = async (execId) => {
        if (!window.confirm('Delete this execution record?')) return;
        try {
            await pipelineExecutionService.deleteExecution(execId);
            setExecutions(prev => prev.filter(e => e.id !== execId));
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const handleViewLogs = async (execId, taskId) => {
        const key = `${execId}_${taskId}`;
        if (taskLogs[key]) {
            setTaskLogs(prev => { const n = { ...prev }; delete n[key]; return n; });
            return;
        }
        setLoadingLogs(prev => ({ ...prev, [key]: true }));
        try {
            const data = await pipelineExecutionService.getTaskLogs(execId, taskId);
            setTaskLogs(prev => ({ ...prev, [key]: data.logs || 'No logs available' }));
        } catch {
            setTaskLogs(prev => ({ ...prev, [key]: 'Failed to fetch logs.' }));
        } finally {
            setLoadingLogs(prev => ({ ...prev, [key]: false }));
        }
    };

    const toggleExpand = async (id, exec) => {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(id);

        // For non-active executions, fetch full details (task list + fresh logs)
        // on first expand so the task viewer and error block are always populated.
        const isActive = ['pending', 'queued', 'running'].includes(exec?.status);
        if (!isActive && !executionDetails[id]) {
            setLoadingDetails(prev => ({ ...prev, [id]: true }));
            try {
                const details = await pipelineExecutionService.getExecution(id, true);
                setExecutionDetails(prev => ({ ...prev, [id]: details }));
            } catch (err) {
                console.error('Failed to fetch execution details:', err);
            } finally {
                setLoadingDetails(prev => ({ ...prev, [id]: false }));
            }
        }
    };

    const formatDate = (d) => {
        if (!d) return '-';
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date(d));
    };

    const getDuration = (start, end) => {
        if (!start) return '-';
        const s = new Date(start);
        const e = end ? new Date(end) : new Date();
        const diff = Math.floor((e - s) / 1000);
        if (diff < 60) return `${diff}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
        return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
    };

    const filtered = executions.filter(e => {
        if (typeFilter && (e.execution_type || 'etl') !== typeFilter) return false;
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return (
            e.airflow_dag_id?.toLowerCase().includes(s) ||
            e.airflow_run_id?.toLowerCase().includes(s) ||
            e.config_name?.toLowerCase().includes(s) ||
            String(e.id).includes(s)
        );
    });

    return (
        <DashboardLayout>
            <div className="executions-container">
                <div className="executions-header">
                    <div className="header-title">
                        <Activity size={32} className="header-icon" />
                        <div>
                            <h1>Pipeline Executions</h1>
                            <p>Monitor running pipelines and view execution history</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchExecutions} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                        Refresh
                    </Button>
                </div>

                {/* Filters */}
                <div className="executions-filters">
                    <div className="filter-group">
                        <Filter size={18} />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="queued">Queued</option>
                            <option value="running">Running</option>
                            <option value="success">Completed</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>
                    <div className="filter-group">
                        <Database size={18} />
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">All Types</option>
                            <option value="etl">ETL Pipeline</option>
                            <option value="verify">Verify</option>
                        </select>
                    </div>
                    <div className="search-group">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search by name, DAG ID, or run ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>

                {/* Executions List */}
                <div className="executions-list">
                    {loading && executions.length === 0 ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Loading executions...</p>
                        </div>
                    ) : error ? (
                        <div className="error-state">
                            <p>{error}</p>
                            <button onClick={fetchExecutions} className="retry-button">Retry</button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state">
                            <Activity size={48} />
                            <h3>No executions found</h3>
                            <p>Run a pipeline from the Pipelines page to see executions here.</p>
                        </div>
                    ) : (
                        filtered.map(exec => {
                            // Merge in full details fetched on expand (task list, refreshed logs)
                            const detail = executionDetails[exec.id];
                            const merged = detail ? { ...exec, ...detail } : exec;

                            const cfg = STATUS_CONFIG[merged.status] || STATUS_CONFIG.pending;
                            const StatusIcon = cfg.icon;
                            const isExpanded = expandedId === exec.id;
                            const isActive = ['pending', 'queued', 'running'].includes(merged.status);
                            const isLoadingDetail = loadingDetails[exec.id];
                            let progress = null;
                            try { progress = merged.task_progress ? JSON.parse(merged.task_progress) : null; } catch {}

                            return (
                                <Card key={exec.id} className={`execution-card ${isActive ? 'execution-active' : ''}`}>
                                    <div className="execution-row" onClick={() => toggleExpand(exec.id, exec)}>
                                        <div className="execution-status-icon">
                                            <StatusIcon
                                                size={22}
                                                className={exec.status === 'running' ? 'spin' : ''}
                                            />
                                        </div>

                                        <div className="execution-main">
                                            <div className="execution-title">
                                                <span className="execution-name">
                                                    {merged.config_name || merged.airflow_dag_id || `Execution #${exec.id}`}
                                                </span>
                                                <Badge variant={cfg.color}>{cfg.label}</Badge>
                                                {(() => {
                                                    const type = TYPE_CONFIG[merged.execution_type] || TYPE_CONFIG.etl;
                                                    const TypeIcon = type.Icon;
                                                    return (
                                                        <Badge variant={type.color}>
                                                            <TypeIcon size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                                                            {type.label}
                                                        </Badge>
                                                    );
                                                })()}
                                            </div>
                                            <div className="execution-meta">
                                                <span>ID: {exec.id}</span>
                                                <span className="meta-sep">|</span>
                                                <span>{formatDate(merged.created_at)}</span>
                                                <span className="meta-sep">|</span>
                                                <span>Duration: {getDuration(merged.started_at, merged.completed_at)}</span>
                                                {progress && progress.total > 0 && (
                                                    <>
                                                        <span className="meta-sep">|</span>
                                                        <span>Tasks: {progress.completed}/{progress.total}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="execution-actions">
                                            {merged.status === 'success' && (merged.execution_type || 'etl') === 'etl' && merged.pipeline_config_id && (
                                                <button
                                                    className="action-icon-btn"
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/data-explorer?pipeline_id=${merged.pipeline_config_id}`); }}
                                                    title="View data in Explorer"
                                                >
                                                    <ExternalLink size={16} />
                                                </button>
                                            )}
                                            {!isActive && (
                                                <button
                                                    className="action-icon-btn danger"
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(exec.id); }}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>

                                    {/* Progress bar for active */}
                                    {isActive && progress && progress.total > 0 && (
                                        <div className="execution-progress-bar">
                                            <div
                                                className="progress-fill"
                                                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                                            />
                                        </div>
                                    )}

                                    {/* Inline error preview for failed executions (visible without expanding) */}
                                    {!isExpanded && merged.status === 'failed' && merged.error_message && (
                                        <div className="execution-error-inline" onClick={(e) => { e.stopPropagation(); toggleExpand(exec.id, exec); }}>
                                            <XCircle size={14} />
                                            <span className="error-inline-text">
                                                {extractErrorSummary(merged.error_message)}
                                            </span>
                                            <span className="error-inline-expand">View full logs ↓</span>
                                        </div>
                                    )}

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="execution-details">
                                            {/* Loading spinner while fetching details */}
                                            {isLoadingDetail && (
                                                <div className="detail-loading">
                                                    <Loader2 size={18} className="spin" />
                                                    <span>Loading execution details…</span>
                                                </div>
                                            )}

                                            <div className="detail-grid">
                                                <div className="detail-item">
                                                    <span className="detail-label">DAG ID</span>
                                                    <span className="detail-value">{merged.airflow_dag_id || '-'}</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-label">Run ID</span>
                                                    <span className="detail-value mono">{merged.airflow_run_id || '-'}</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-label">Started</span>
                                                    <span className="detail-value">{formatDate(merged.started_at)}</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-label">Completed</span>
                                                    <span className="detail-value">{formatDate(merged.completed_at)}</span>
                                                </div>
                                            </div>

                                            {/* Error / log block */}
                                            {merged.error_message && (
                                                <div className="execution-error-block">
                                                    <div className="error-header">
                                                        <XCircle size={16} />
                                                        <strong>Error Details</strong>
                                                    </div>
                                                    <pre className="error-message-pre">{merged.error_message}</pre>
                                                </div>
                                            )}

                                            {/* Task instances with per-task log viewer */}
                                            {merged.tasks && merged.tasks.length > 0 && (
                                                <div className="tasks-section">
                                                    <h4>Tasks</h4>
                                                    <div className="tasks-list">
                                                        {merged.tasks.map(task => {
                                                            const taskCfg = STATUS_CONFIG[task.state] || STATUS_CONFIG.pending;
                                                            const TaskIcon = taskCfg.icon;
                                                            const logKey = `${exec.id}_${task.task_id}`;
                                                            return (
                                                                <div key={task.task_id} className="task-item">
                                                                    <div className="task-row">
                                                                        <TaskIcon size={16} className={task.state === 'running' ? 'spin' : ''} />
                                                                        <span className="task-name">{task.task_id}</span>
                                                                        <Badge variant={taskCfg.color} size="sm">{task.state}</Badge>
                                                                        {task.duration != null && (
                                                                            <span className="task-duration">{Math.round(task.duration)}s</span>
                                                                        )}
                                                                        <button
                                                                            className="log-btn"
                                                                            onClick={(e) => { e.stopPropagation(); handleViewLogs(exec.id, task.task_id); }}
                                                                        >
                                                                            <Terminal size={14} />
                                                                            {taskLogs[logKey] ? 'Hide Logs' : 'View Full Logs'}
                                                                        </button>
                                                                    </div>
                                                                    {loadingLogs[logKey] && (
                                                                        <div className="task-logs-loading">
                                                                            <Loader2 size={14} className="spin" /> Loading logs…
                                                                        </div>
                                                                    )}
                                                                    {taskLogs[logKey] && (
                                                                        <pre className="task-logs">{taskLogs[logKey]}</pre>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Fallback: raw logs field */}
                                            {merged.logs && !merged.tasks && (
                                                <div className="tasks-section">
                                                    <h4>Logs</h4>
                                                    <pre className="task-logs">{merged.logs}</pre>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Executions;