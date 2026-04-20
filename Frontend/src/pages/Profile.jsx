import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Alert from '../components/common/Alert';
import Input from '../components/common/Input';
import {
  User,
  Mail,
  Calendar,
  Shield,
  Edit3,
  Check,
  X,
  Key,
  Settings,
  FileCode,
  Activity,
  GitBranch
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { pipelineConfigService } from '../services/pipelineConfig.service';
import { pipelineExecutionService } from '../services/pipelineExecution.service';
import api from '../services/api';
import { Link } from 'react-router-dom';
import './Profile.css';

const Profile = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || ''
  });

  // Real stats
  const [stats, setStats] = useState({ configs: 0, executions: 0, successful: 0, active: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [configs, executions] = await Promise.allSettled([
        pipelineConfigService.getAll(),
        pipelineExecutionService.getMyExecutions({ limit: 100 })
      ]);
      const cfgs = configs.status === 'fulfilled' ? configs.value : [];
      const execs = executions.status === 'fulfilled' ? executions.value : [];
      setStats({
        configs: cfgs.length,
        executions: execs.length,
        successful: execs.filter(e => e.status === 'success').length,
        active: execs.filter(e => ['running', 'queued', 'pending'].includes(e.status)).length
      });
    } catch {}
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleSave = async () => {
    try {
      await api.put('/users/me', formData);
      setSuccess('Profile updated successfully');
      setIsEditing(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile');
      setTimeout(() => setError(null), 4000);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: user?.full_name || '',
      email: user?.email || ''
    });
    setIsEditing(false);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DashboardLayout>
      <div className="profile-page">
        <div className="profile-header">
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account settings and preferences</p>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" dismissible onDismiss={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <div className="profile-content">
          {/* Profile Card */}
          <Card className="profile-card">
            <div className="profile-card-header">
              <div className="profile-avatar">
                <span className="avatar-text">{getInitials(user?.full_name)}</span>
              </div>
              <div className="profile-identity">
                <h2 className="profile-name">{user?.full_name || 'User'}</h2>
                <span className="profile-username">@{user?.username || 'username'}</span>
                <div className="profile-badges">
                  <Badge variant={user?.is_active ? 'success' : 'neutral'}>
                    {user?.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant={user?.is_verified ? 'info' : 'warning'}>
                    {user?.is_verified ? 'Verified' : 'Unverified'}
                  </Badge>
                </div>
              </div>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="edit-btn"
                >
                  <Edit3 size={16} />
                  Edit Profile
                </Button>
              )}
            </div>

            <div className="profile-details">
              {isEditing ? (
                <div className="edit-form">
                  <Input
                    label="Full Name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Enter your full name"
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter your email"
                  />
                  <div className="edit-actions">
                    <Button variant="ghost" onClick={handleCancel}>
                      <X size={16} />
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSave}>
                      <Check size={16} />
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="details-grid">
                  <div className="detail-item">
                    <div className="detail-icon">
                      <Mail size={20} />
                    </div>
                    <div className="detail-content">
                      <span className="detail-label">Email Address</span>
                      <span className="detail-value">{user?.email || 'Not set'}</span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-icon">
                      <User size={20} />
                    </div>
                    <div className="detail-content">
                      <span className="detail-label">Username</span>
                      <span className="detail-value">@{user?.username || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-icon">
                      <Shield size={20} />
                    </div>
                    <div className="detail-content">
                      <span className="detail-label">Role</span>
                      <span className="detail-value">{user?.is_admin ? 'Admin' : 'User'}</span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-icon">
                      <Calendar size={20} />
                    </div>
                    <div className="detail-content">
                      <span className="detail-label">Member Since</span>
                      <span className="detail-value">{formatDate(user?.created_at)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="quick-actions">
            <Card className="action-card">
              <div className="action-icon">
                <FileCode size={24} />
              </div>
              <div className="action-content">
                <h3>My Configurations</h3>
                <p>View and manage your saved pipeline configurations</p>
              </div>
              <Link to="/my-configs">
                <Button variant="outline" size="sm">
                  View Configs
                </Button>
              </Link>
            </Card>

            <Card className="action-card">
              <div className="action-icon">
                <Activity size={24} />
              </div>
              <div className="action-content">
                <h3>Executions</h3>
                <p>Monitor your pipeline runs and view logs</p>
              </div>
              <Link to="/executions">
                <Button variant="outline" size="sm">
                  View Runs
                </Button>
              </Link>
            </Card>

            <Card className="action-card">
              <div className="action-icon">
                <Settings size={24} />
              </div>
              <div className="action-content">
                <h3>Settings</h3>
                <p>Theme, connections, and account preferences</p>
              </div>
              <Link to="/settings">
                <Button variant="outline" size="sm">
                  Settings
                </Button>
              </Link>
            </Card>
          </div>

          {/* Account Stats */}
          <Card className="stats-card">
            <h3 className="stats-title">Account Overview</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-number">{stats.configs}</span>
                <span className="stat-label">Configurations</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats.executions}</span>
                <span className="stat-label">Total Executions</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats.successful}</span>
                <span className="stat-label">Successful Runs</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats.active}</span>
                <span className="stat-label">Active Now</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
