import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    ShieldCheck
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

const Executions = () => {
    const [executions, setExecutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [taskLogs, setTaskLogs] = useState({});
    const [loadingLogs, setLoadingLogs] = useState({});
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

    const toggleExpand = (id) => {
        setExpandedId(prev => prev === id ? null : id);
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
                            const cfg = STATUS_CONFIG[exec.status] || STATUS_CONFIG.pending;
                            const StatusIcon = cfg.icon;
                            const isExpanded = expandedId === exec.id;
                            const isActive = ['pending', 'queued', 'running'].includes(exec.status);
                            let progress = null;
                            try { progress = exec.task_progress ? JSON.parse(exec.task_progress) : null; } catch {}

                            return (
                                <Card key={exec.id} className={`execution-card ${isActive ? 'execution-active' : ''}`}>
                                    <div className="execution-row" onClick={() => toggleExpand(exec.id)}>
                                        <div className="execution-status-icon">
                                            <StatusIcon
                                                size={22}
                                                className={exec.status === 'running' ? 'spin' : ''}
                                            />
                                        </div>

                                        <div className="execution-main">
                                            <div className="execution-title">
                                                <span className="execution-name">
                                                    {exec.config_name || exec.airflow_dag_id || `Execution #${exec.id}`}
                                                </span>
                                                <Badge variant={cfg.color}>{cfg.label}</Badge>
                                                {(() => {
                                                    const type = TYPE_CONFIG[exec.execution_type] || TYPE_CONFIG.etl;
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
                                                <span>{formatDate(exec.created_at)}</span>
                                                <span className="meta-sep">|</span>
                                                <span>Duration: {getDuration(exec.started_at, exec.completed_at)}</span>
                                                {progress && progress.total > 0 && (
                                                    <>
                                                        <span className="meta-sep">|</span>
                                                        <span>Tasks: {progress.completed}/{progress.total}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="execution-actions">
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

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="execution-details">
                                            <div className="detail-grid">
                                                <div className="detail-item">
                                                    <span className="detail-label">DAG ID</span>
                                                    <span className="detail-value">{exec.airflow_dag_id || '-'}</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-label">Run ID</span>
                                                    <span className="detail-value mono">{exec.airflow_run_id || '-'}</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-label">Started</span>
                                                    <span className="detail-value">{formatDate(exec.started_at)}</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-label">Completed</span>
                                                    <span className="detail-value">{formatDate(exec.completed_at)}</span>
                                                </div>
                                            </div>

                                            {exec.error_message && (
                                                <div className="execution-error">
                                                    <XCircle size={16} />
                                                    <span>{exec.error_message}</span>
                                                </div>
                                            )}

                                            {/* Task instances */}
                                            {exec.tasks && exec.tasks.length > 0 && (
                                                <div className="tasks-section">
                                                    <h4>Tasks</h4>
                                                    <div className="tasks-list">
                                                        {exec.tasks.map(task => {
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
                                                                            {taskLogs[logKey] ? 'Hide Logs' : 'Logs'}
                                                                        </button>
                                                                    </div>
                                                                    {loadingLogs[logKey] && (
                                                                        <div className="task-logs-loading">Loading logs...</div>
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

                                            {/* If no tasks yet but execution has logs field */}
                                            {exec.logs && (
                                                <div className="tasks-section">
                                                    <h4>Logs</h4>
                                                    <pre className="task-logs">{exec.logs}</pre>
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