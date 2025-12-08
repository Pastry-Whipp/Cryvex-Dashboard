import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import { GitBranch, Activity, Shield, Plus, Upload, CheckCircle, Clock, FileCode, User, Calendar } from 'lucide-react';
import { pipelineConfigService } from '../services/pipelineConfig.service';
import { auditLogService } from '../services/auditLog.service';
import { useAuth } from '../hooks/useAuth';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [configs, setConfigs] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executionsLoading, setExecutionsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadConfigs();
    loadRecentExecutions();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await pipelineConfigService.getAll();
      setConfigs(data);
      setError(null);
    } catch (err) {
      console.error('Error loading configs:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentExecutions = async () => {
    try {
      setExecutionsLoading(true);
      const response = await auditLogService.getAuditLogs({ limit: 5, offset: 0 });
      setExecutions(response.logs);
    } catch (err) {
      console.error('Error loading executions:', err);
    } finally {
      setExecutionsLoading(false);
    }
  };

  const formatDate = (dateString) => {
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

  const stats = [
    {
      label: 'Pipeline Configs',
      value: loading ? '...' : configs.length.toString(),
      icon: FileCode,
      color: 'primary',
      available: true
    },
    {
      label: 'Active Pipelines',
      value: '--',
      icon: Activity,
      color: 'success',
      available: false,
      comingSoon: true
    },
    {
      label: 'Executions This Month',
      value: '--',
      icon: Activity,
      color: 'info',
      available: false,
      comingSoon: true
    },
    {
      label: 'Verified Records',
      value: '--',
      icon: Shield,
      color: 'warning',
      available: false,
      comingSoon: true
    },
  ];

  // Get recent configs for display
  const recentConfigs = configs.slice(0, 4);

  return (
    <DashboardLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Dashboard</h1>
            <p className="dashboard-subtitle">
              Welcome back{user?.full_name ? `, ${user.full_name}` : ''}! Here's your ETL overview.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="dashboard-stats">
          {stats.map((stat, index) => (
            <Card key={index} className={`stat-card ${stat.comingSoon ? 'stat-card-coming-soon' : ''}`}>
              <div className="stat-card-content">
                <div
                  className="stat-icon"
                  style={{
                    backgroundColor: stat.comingSoon ? 'var(--muted)' : `var(--${stat.color}-light)`,
                    color: stat.comingSoon ? 'var(--muted-foreground)' : `var(--${stat.color})`
                  }}
                >
                  <stat.icon size={24} />
                </div>
                <div className="stat-info">
                  <p className="stat-label">{stat.label}</p>
                  <div className="stat-value-wrapper">
                    <h3 className={`stat-value ${stat.comingSoon ? 'stat-value-muted' : ''}`}>
                      {stat.value}
                    </h3>
                    {stat.comingSoon && (
                      <Badge variant="neutral" className="coming-soon-badge">Coming Soon</Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="dashboard-actions">
          <h3 className="section-title">Quick Actions</h3>
          <div className="action-buttons">
            <Link to="/pipelines/create">
              <Button variant="primary">
                <Plus size={20} />
                Create Pipeline Config
              </Button>
            </Link>
            <Link to="/my-configs">
              <Button variant="secondary">
                <Upload size={20} />
                Manage Configs
              </Button>
            </Link>
            <Button variant="outline" disabled className="coming-soon-action">
              <CheckCircle size={20} />
              Verify Integrity
              <span className="action-coming-soon-tag">Soon</span>
            </Button>
          </div>
        </div>

        {/* Recent Pipeline Configs */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3 className="section-title">Recent Pipeline Configs</h3>
            <Link to="/my-configs" className="section-link">
              View All
            </Link>
          </div>

          <Card>
            {loading ? (
              <div className="loading-container">
                <Spinner size="md" />
                <p>Loading your configurations...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={loadConfigs}>
                  Try Again
                </Button>
              </div>
            ) : recentConfigs.length === 0 ? (
              <div className="empty-state-mini">
                <FileCode size={32} className="empty-icon" />
                <p>No pipeline configurations yet</p>
                <Link to="/pipelines/create">
                  <Button variant="primary" size="sm">
                    <Plus size={16} />
                    Create Your First Config
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="table-container">
                <table className="execution-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Domain</th>
                      <th>Version</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentConfigs.map((config) => (
                      <tr key={config.id}>
                        <td className="font-medium">{config.name}</td>
                        <td>
                          {config.domain ? (
                            <Badge variant="info">{config.domain}</Badge>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="text-muted">{config.version || '-'}</td>
                        <td className="text-muted">{formatDate(config.created_at)}</td>
                        <td>
                          <Link to="/my-configs">
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Recent Executions */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3 className="section-title">Recent Executions</h3>
            <Link to="/executions" className="section-link">
              View All
            </Link>
          </div>

          <Card>
            {executionsLoading ? (
              <div className="loading-container">
                <Spinner size="md" />
                <p>Loading recent executions...</p>
              </div>
            ) : executions.length === 0 ? (
              <div className="empty-state-mini">
                <Activity size={32} className="empty-icon" />
                <p>No executions yet</p>
                <Link to="/pipelines">
                  <Button variant="primary" size="sm">
                    <Plus size={16} />
                    Execute a Pipeline
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="table-container">
                <table className="execution-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Name</th>
                      <th>User</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <div className="action-cell" style={{ color: auditLogService.getActionColor(log.action_type) }}>
                            <span className="action-label">{auditLogService.getActionLabel(log.action_type)}</span>
                          </div>
                        </td>
                        <td>
                          <Badge variant="info">{auditLogService.getEntityLabel(log.entity_type)}</Badge>
                        </td>
                        <td className="font-medium">{log.entity_name || `ID: ${log.entity_id}`}</td>
                        <td>
                          <div className="user-cell">
                            <User size={14} />
                            <span>{log.username || 'System'}</span>
                          </div>
                        </td>
                        <td className="text-muted">{formatDate(log.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
