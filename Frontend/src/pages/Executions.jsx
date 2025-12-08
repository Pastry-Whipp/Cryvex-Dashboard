import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { auditLogService } from '../services/auditLog.service';
import {
    FileText,
    Filter,
    Search,
    ChevronLeft,
    ChevronRight,
    PlusCircle,
    Edit,
    Trash2,
    PlayCircle,
    Activity,
    Calendar,
    User
} from 'lucide-react';
import './Executions.css';

const Executions = () => {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [totalLogs, setTotalLogs] = useState(0);

    // Filters
    const [filters, setFilters] = useState({
        actionType: '',
        entityType: '',
        searchTerm: '',
        limit: 50,
        offset: 0
    });

    // Fetch logs
    const fetchLogs = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = {
                actionType: filters.actionType || undefined,
                entityType: filters.entityType || undefined,
                limit: filters.limit,
                offset: filters.offset
            };

            const response = await auditLogService.getAuditLogs(params);
            setLogs(response.logs);
            setTotalLogs(response.total);
        } catch (err) {
            console.error('Error fetching audit logs:', err);
            setError('Failed to load audit logs. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [filters.actionType, filters.entityType, filters.limit, filters.offset]);

    // Filter logs by search term (client-side)
    const filteredLogs = logs.filter(log => {
        if (!filters.searchTerm) return true;
        const searchLower = filters.searchTerm.toLowerCase();
        return (
            log.entity_name?.toLowerCase().includes(searchLower) ||
            log.username?.toLowerCase().includes(searchLower) ||
            log.action_type?.toLowerCase().includes(searchLower)
        );
    });

    // Pagination
    const totalPages = Math.ceil(totalLogs / filters.limit);
    const currentPage = Math.floor(filters.offset / filters.limit) + 1;

    const handlePageChange = (newPage) => {
        setFilters(prev => ({
            ...prev,
            offset: (newPage - 1) * filters.limit
        }));
    };

    // Get action icon
    const getActionIcon = (actionType) => {
        switch (actionType) {
            case 'create': return <PlusCircle size={18} />;
            case 'update': return <Edit size={18} />;
            case 'delete': return <Trash2 size={18} />;
            case 'execute': return <PlayCircle size={18} />;
            case 'status_change': return <Activity size={18} />;
            default: return <FileText size={18} />;
        }
    };

    // Format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    return (
        <DashboardLayout>
            <div className="executions-container">
                <div className="executions-header">
                    <div className="header-title">
                        <Activity size={32} className="header-icon" />
                        <div>
                            <h1>Execution Logs</h1>
                            <p>Track all pipeline interactions and activities</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="executions-filters">
                    <div className="filter-group">
                        <Filter size={18} />
                        <select
                            value={filters.actionType}
                            onChange={(e) => setFilters(prev => ({ ...prev, actionType: e.target.value, offset: 0 }))}
                            className="filter-select"
                        >
                            <option value="">All Actions</option>
                            <option value="create">Created</option>
                            <option value="update">Updated</option>
                            <option value="delete">Deleted</option>
                            <option value="execute">Executed</option>
                            <option value="status_change">Status Changed</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <Filter size={18} />
                        <select
                            value={filters.entityType}
                            onChange={(e) => setFilters(prev => ({ ...prev, entityType: e.target.value, offset: 0 }))}
                            className="filter-select"
                        >
                            <option value="">All Types</option>
                            <option value="pipeline_config">Pipeline Config</option>
                            <option value="pipeline_execution">Pipeline Execution</option>
                        </select>
                    </div>

                    <div className="search-group">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search by name or user..."
                            value={filters.searchTerm}
                            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                            className="search-input"
                        />
                    </div>
                </div>

                {/* Logs Table */}
                <div className="executions-content">
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Loading audit logs...</p>
                        </div>
                    ) : error ? (
                        <div className="error-state">
                            <p>{error}</p>
                            <button onClick={fetchLogs} className="retry-button">Retry</button>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="empty-state">
                            <FileText size={48} />
                            <h3>No logs found</h3>
                            <p>No audit logs match your current filters.</p>
                        </div>
                    ) : (
                        <>
                            <div className="logs-table-container">
                                <table className="logs-table">
                                    <thead>
                                        <tr>
                                            <th>Action</th>
                                            <th>Entity</th>
                                            <th>Name</th>
                                            <th>User</th>
                                            <th>Date & Time</th>
                                            <th>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLogs.map((log) => (
                                            <tr key={log.id} className="log-row">
                                                <td>
                                                    <div className="action-cell" style={{ color: auditLogService.getActionColor(log.action_type) }}>
                                                        {getActionIcon(log.action_type)}
                                                        <span>{auditLogService.getActionLabel(log.action_type)}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="entity-badge">
                                                        {auditLogService.getEntityLabel(log.entity_type)}
                                                    </span>
                                                </td>
                                                <td className="entity-name">{log.entity_name || `ID: ${log.entity_id}`}</td>
                                                <td>
                                                    <div className="user-cell">
                                                        <User size={16} />
                                                        <span>{log.username || 'System'}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="date-cell">
                                                        <Calendar size={16} />
                                                        <span>{formatDate(log.created_at)}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {log.details && (
                                                        <button
                                                            className="details-button"
                                                            onClick={() => {
                                                                try {
                                                                    const details = JSON.parse(log.details);
                                                                    alert(JSON.stringify(details, null, 2));
                                                                } catch (e) {
                                                                    alert(log.details);
                                                                }
                                                            }}
                                                        >
                                                            View
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="pagination">
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="pagination-button"
                                    >
                                        <ChevronLeft size={18} />
                                        Previous
                                    </button>

                                    <div className="pagination-info">
                                        Page {currentPage} of {totalPages} ({totalLogs} total logs)
                                    </div>

                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="pagination-button"
                                    >
                                        Next
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Executions;
