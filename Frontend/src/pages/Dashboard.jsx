import React from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { GitBranch, Activity, Shield, Plus, Upload, CheckCircle } from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const stats = [
    { label: 'Total Pipelines', value: '24', icon: GitBranch, color: 'primary' },
    { label: 'Active Pipelines', value: '18', icon: Activity, color: 'success' },
    { label: 'Executions This Month', value: '1,247', icon: Activity, color: 'info' },
    { label: 'Verified Records', value: '3,891', icon: Shield, color: 'warning' },
  ];

  const recentExecutions = [
    {
      id: 1,
      pipeline: 'Banking ETL Pipeline',
      status: 'success',
      records: '1,234',
      startedAt: '2 hours ago',
      duration: '2m 15s',
    },
    {
      id: 2,
      pipeline: 'Medical Records Processor',
      status: 'success',
      records: '856',
      startedAt: '5 hours ago',
      duration: '1m 45s',
    },
    {
      id: 3,
      pipeline: 'Crypto Transaction Validator',
      status: 'error',
      records: '423',
      startedAt: '1 day ago',
      duration: '3m 02s',
    },
    {
      id: 4,
      pipeline: 'Banking ETL Pipeline',
      status: 'success',
      records: '1,567',
      startedAt: '1 day ago',
      duration: '2m 30s',
    },
  ];

  const getStatusBadge = (status) => {
    const variants = {
      success: 'success',
      error: 'error',
      running: 'info',
    };
    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Dashboard</h1>
            <p className="dashboard-subtitle">Welcome back! Here's your ETL overview.</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="dashboard-stats">
          {stats.map((stat, index) => (
            <Card key={index} className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon" style={{ backgroundColor: `var(--${stat.color}-light)`, color: `var(--${stat.color})` }}>
                  <stat.icon size={24} />
                </div>
                <div className="stat-info">
                  <p className="stat-label">{stat.label}</p>
                  <h3 className="stat-value">{stat.value}</h3>
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
                Create Pipeline
              </Button>
            </Link>
            <Button variant="secondary">
              <Upload size={20} />
              Upload Data
            </Button>
            <Link to="/integrity/verify">
              <Button variant="outline">
                <CheckCircle size={20} />
                Verify Integrity
              </Button>
            </Link>
          </div>
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
            <div className="table-container">
              <table className="execution-table">
                <thead>
                  <tr>
                    <th>Pipeline</th>
                    <th>Status</th>
                    <th>Records</th>
                    <th>Started</th>
                    <th>Duration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExecutions.map((execution) => (
                    <tr key={execution.id}>
                      <td className="font-medium">{execution.pipeline}</td>
                      <td>{getStatusBadge(execution.status)}</td>
                      <td>{execution.records}</td>
                      <td className="text-muted">{execution.startedAt}</td>
                      <td className="text-muted">{execution.duration}</td>
                      <td>
                        <Link to={`/executions/${execution.id}`}>
                          <Button variant="ghost" size="sm">View Logs</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
