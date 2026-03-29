import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import {
  GitBranch, Activity, Shield, Plus, Upload, CheckCircle, Clock,
  FileCode, User, Calendar, Loader2, XCircle, CheckCircle2, Database
} from 'lucide-react';
import { pipelineConfigService } from '../services/pipelineConfig.service';
import { pipelineExecutionService } from '../services/pipelineExecution.service';
import { useAuth } from '../hooks/useAuth';
import './Dashboard.css';

const EXEC_STATUS = {
  pending:   { color: 'neutral',  icon: Clock,        label: 'Pending' },
  queued:    { color: 'info',     icon: Clock,        label: 'Queued' },
  running:   { color: 'warning',  icon: Loader2,      label: 'Running' },
  success:   { color: 'success',  icon: CheckCircle2, label: 'Completed' },
  failed:    { color: 'error',    icon: XCircle,      label: 'Failed' },
  cancelled: { color: 'neutral',  icon: XCircle,      label: 'Cancelled' },
};

const Dashboard = () => {
  const { user } = useAuth();
  const [configs, setConfigs] = useState([]);
  const [recentExecs, setRecentExecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [execsLoading, setExecsLoading] = useState(true);
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
      setExecsLoading(true);
      const data = await pipelineExecutionService.getMyExecutions({ limit: 50 });
      setRecentExecs(data);
    } catch (err) {
      console.error('Error loading executions:', err);
    } finally {
      setExecsLoading(false);
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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Compute real stats
  const activeCount = recentExecs.filter(e => ['running', 'queued', 'pending'].includes(e.status)).length;
  const thisMonth = new Date();
  const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
  const execsThisMonth = recentExecs.filter(e => new Date(e.created_at) >= monthStart).length;
  const successCount = recentExecs.filter(e => e.status === 'success').length;

  const stats = [
    {
      label: 'Pipeline Configs',
      value: loading ? '...' : configs.length.toString(),
      icon: FileCode,
      color: 'primary'
    },
    {
      label: 'Active Pipelines',
      value: execsLoading ? '...' : activeCount.toString(),
      icon: Activity,
      color: 'success'
    },
    {
      label: 'Executions This Month',
      value: execsLoading ? '...' : execsThisMonth.toString(),
      icon: GitBranch,
      color: 'info'
    },
    {
      label: 'Successful Runs',
      value: execsLoading ? '...' : successCount.toString(),
      icon: CheckCircle,
      color: 'warning'
    },
  ];

  const recentConfigs = configs.slice(0, 4);
  const recentExecsDisplay = recentExecs.slice(0, 5);

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
            <Card key={index} className="stat-card">
              <div className="stat-card-content">
                <div
                  className="stat-icon"
                  style={{
                    backgroundColor: `var(--accent)`,
                    color: `var(--primary)`
                  }}
                >
                  <stat.icon size={24} />
                </div>
                <div className="stat-info">
                  <p className="stat-label">{stat.label}</p>
                  <div className="stat-value-wrapper">
                    <h3 className="stat-value">{stat.value}</h3>
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
            <Link to="/pipelines">
              <Button variant="secondary">
                <Activity size={20} />
                Run Pipeline
              </Button>
            </Link>
            <Link to="/verify-integrity">
              <Button variant="outline">
                <CheckCircle size={20} />
                Verify Integrity
              </Button>
            </Link>
            <Link to="/data-explorer">
              <Button variant="outline">
                <Database size={20} />
                Data Explorer
              </Button>
            </Link>
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
            {execsLoading ? (
              <div className="loading-container">
                <Spinner size="md" />
                <p>Loading recent executions...</p>
              </div>
            ) : recentExecsDisplay.length === 0 ? (
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
                      <th>Pipeline</th>
                      <th>Status</th>
                      <th>DAG</th>
                      <th>Started</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentExecsDisplay.map((exec) => {
                      const cfg = EXEC_STATUS[exec.status] || EXEC_STATUS.pending;
                      return (
                        <tr key={exec.id}>
                          <td className="font-medium">
                            {exec.config_name || `Config #${exec.pipeline_config_id}`}
                          </td>
                          <td>
                            <Badge variant={cfg.color}>{cfg.label}</Badge>
                          </td>
                          <td className="text-muted">{exec.airflow_dag_id || '-'}</td>
                          <td className="text-muted">{formatDate(exec.started_at || exec.created_at)}</td>
                          <td>
                            <Link to="/executions">
                              <Button variant="ghost" size="sm">Details</Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
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
