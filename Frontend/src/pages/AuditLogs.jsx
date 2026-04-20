import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import {
  FileText, Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
  PlusCircle, Edit, Trash2, PlayCircle, Activity, User, Clock,
  Database, GitBranch, Info, AlertCircle, ShieldOff
} from 'lucide-react';
import { auditLogService } from '../services/auditLog.service';
import { useAuth } from '../hooks/useAuth';
import './AuditLogs.css';

const ACTION_ICONS = {
  create: PlusCircle,
  update: Edit,
  delete: Trash2,
  execute: PlayCircle,
  status_change: Activity
};

const ACTION_BADGES = {
  create: 'success',
  update: 'info',
  delete: 'error',
  execute: 'primary',
  status_change: 'warning'
};

const ENTITY_ICONS = {
  pipeline_config: GitBranch,
  pipeline_execution: Database
};

const AuditLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 30;

  // Detail modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, entityFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await auditLogService.getAuditLogs({
        actionType: actionFilter || undefined,
        entityType: entityFilter || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error loading audit logs:', err);
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(date);
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  const parseDetails = (details) => {
    if (!details) return null;
    if (typeof details === 'object') return details;
    try { return JSON.parse(details); } catch { return null; }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      log.entity_name?.toLowerCase().includes(s) ||
      log.username?.toLowerCase().includes(s) ||
      log.action_type?.toLowerCase().includes(s) ||
      String(log.entity_id).includes(s)
    );
  });

  const handleViewDetail = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  // Admin-only page guard
  if (user && !user.is_admin) {
    return (
      <DashboardLayout>
        <div className="audit-access-denied">
          <ShieldOff size={56} />
          <h2>Access Denied</h2>
          <p>Audit Logs are restricted to administrators only.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="audit-logs-page">
        {/* Header */}
        <div className="audit-header">
          <div className="audit-header-title">
            <FileText size={32} className="header-icon" />
            <div>
              <h1>Audit Logs</h1>
              <p>Track all system actions, pipeline executions, and configuration changes</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="audit-filters">
          <div className="audit-filter-group">
            <Filter size={18} />
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="audit-filter-select"
            >
              <option value="">All Actions</option>
              <option value="create">Created</option>
              <option value="update">Updated</option>
              <option value="delete">Deleted</option>
              <option value="execute">Executed</option>
              <option value="status_change">Status Changed</option>
            </select>
          </div>
          <div className="audit-filter-group">
            <Database size={18} />
            <select
              value={entityFilter}
              onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
              className="audit-filter-select"
            >
              <option value="">All Entities</option>
              <option value="pipeline_config">Pipeline Config</option>
              <option value="pipeline_execution">Pipeline Execution</option>
            </select>
          </div>
          <div className="audit-search-group">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by name, user, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="audit-search-input"
            />
          </div>
          <div className="audit-total">
            <span>{total} total log{total !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Logs Table */}
        {loading && logs.length === 0 ? (
          <Card>
            <div className="audit-loading">
              <Spinner size="lg" />
              <p>Loading audit logs...</p>
            </div>
          </Card>
        ) : error ? (
          <Card>
            <div className="audit-error">
              <AlertCircle size={48} />
              <h3>Failed to Load</h3>
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={fetchLogs}>Retry</Button>
            </div>
          </Card>
        ) : filteredLogs.length === 0 ? (
          <Card>
            <div className="audit-empty">
              <FileText size={48} />
              <h3>No Audit Logs Found</h3>
              <p>{searchTerm ? 'Try adjusting your search or filters' : 'System actions will appear here as they happen'}</p>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <div className="audit-table-container">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Name / Target</th>
                      <th>User</th>
                      <th>Time</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(log => {
                      const ActionIcon = ACTION_ICONS[log.action_type] || FileText;
                      const EntityIcon = ENTITY_ICONS[log.entity_type] || Database;
                      const details = parseDetails(log.details);

                      return (
                        <tr key={log.id} onClick={() => handleViewDetail(log)} className="audit-row">
                          <td>
                            <div className="audit-action-cell">
                              <span
                                className="action-icon-dot"
                                style={{ backgroundColor: auditLogService.getActionColor(log.action_type) }}
                              >
                                <ActionIcon size={12} />
                              </span>
                              <Badge variant={ACTION_BADGES[log.action_type] || 'neutral'}>
                                {auditLogService.getActionLabel(log.action_type)}
                              </Badge>
                            </div>
                          </td>
                          <td>
                            <div className="audit-entity-cell">
                              <EntityIcon size={14} />
                              <span>{auditLogService.getEntityLabel(log.entity_type)}</span>
                            </div>
                          </td>
                          <td>
                            <span className="audit-entity-name">{log.entity_name || `#${log.entity_id}`}</span>
                          </td>
                          <td>
                            <div className="audit-user-cell">
                              <User size={14} />
                              <span>{log.username || 'System'}</span>
                            </div>
                          </td>
                          <td>
                            <span className="audit-time" title={formatDate(log.created_at)}>
                              {formatRelativeTime(log.created_at)}
                            </span>
                          </td>
                          <td>
                            {details && (
                              <button className="audit-details-btn" onClick={(e) => { e.stopPropagation(); handleViewDetail(log); }}>
                                <Info size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="audit-pagination">
                <span className="audit-page-info">
                  Page {page} of {totalPages} ({total} logs)
                </span>
                <div className="audit-page-controls">
                  <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>
                    First
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                    <ChevronLeft size={16} /> Prev
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                    Next <ChevronRight size={16} />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                    Last
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedLog && (
          <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} size="md">
            <Modal.Header>
              <Modal.Title>Audit Log Detail</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="audit-detail-content">
                <div className="audit-detail-grid">
                  <div className="audit-detail-item">
                    <span className="detail-label">Action</span>
                    <Badge variant={ACTION_BADGES[selectedLog.action_type] || 'neutral'}>
                      {auditLogService.getActionLabel(selectedLog.action_type)}
                    </Badge>
                  </div>
                  <div className="audit-detail-item">
                    <span className="detail-label">Entity Type</span>
                    <span className="detail-value">{auditLogService.getEntityLabel(selectedLog.entity_type)}</span>
                  </div>
                  <div className="audit-detail-item">
                    <span className="detail-label">Entity Name</span>
                    <span className="detail-value">{selectedLog.entity_name || '-'}</span>
                  </div>
                  <div className="audit-detail-item">
                    <span className="detail-label">Entity ID</span>
                    <span className="detail-value mono">{selectedLog.entity_id}</span>
                  </div>
                  <div className="audit-detail-item">
                    <span className="detail-label">User</span>
                    <span className="detail-value">{selectedLog.username || 'System'}</span>
                  </div>
                  <div className="audit-detail-item">
                    <span className="detail-label">IP Address</span>
                    <span className="detail-value mono">{selectedLog.ip_address || '-'}</span>
                  </div>
                  <div className="audit-detail-item full-width">
                    <span className="detail-label">Timestamp</span>
                    <span className="detail-value">{formatDate(selectedLog.created_at)}</span>
                  </div>
                </div>

                {parseDetails(selectedLog.details) && (
                  <div className="audit-detail-json">
                    <span className="detail-label">Details</span>
                    <pre className="detail-json-pre">
                      {JSON.stringify(parseDetails(selectedLog.details), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onClick={() => setShowDetailModal(false)}>Close</Button>
            </Modal.Footer>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AuditLogs;
