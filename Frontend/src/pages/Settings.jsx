import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Alert from '../components/common/Alert';
import Input from '../components/common/Input';
import {
  Settings,
  User,
  Mail,
  Calendar,
  Shield,
  Edit3,
  Check,
  X,
  Key,
  Database,
  Server,
  Link2,
  Globe,
  Monitor,
  Moon,
  Sun,
  Info,
  RefreshCw,
  FileCode
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { dataExplorerService } from '../services/dataExplorer.service';
import api from '../services/api';
import './Settings.css';

const SettingsPage = () => {
  const { user } = useAuth();

  // Profile edit
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || ''
  });
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  // Theme
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('cryvex-theme') || 'light';
  });

  // Connection health
  const [dbHealth, setDbHealth] = useState(null);
  const [airflowHealth, setAirflowHealth] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  useEffect(() => {
    checkConnections();
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('cryvex-theme', theme);
  }, [theme]);

  const checkConnections = async () => {
    setCheckingHealth(true);
    try {
      const [dbRes, airflowRes] = await Promise.allSettled([
        dataExplorerService.checkHealth(),
        api.get('/pipeline-executions/airflow/health')
      ]);
      setDbHealth(dbRes.status === 'fulfilled' ? dbRes.value.is_connected : false);
      setAirflowHealth(
        airflowRes.status === 'fulfilled' ? airflowRes.value.data?.healthy ?? airflowRes.value.data?.is_healthy ?? true : false
      );
    } catch {
      setDbHealth(false);
      setAirflowHealth(false);
    } finally {
      setCheckingHealth(false);
    }
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
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  return (
    <DashboardLayout>
      <div className="settings-page">
        <div className="settings-header">
          <div className="settings-title-section">
            <Settings size={32} className="settings-page-icon" />
            <div>
              <h1 className="settings-page-title">Settings</h1>
              <p className="settings-page-subtitle">Manage your account and application preferences</p>
            </div>
          </div>
        </div>

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

        <div className="settings-grid">
          {/* Profile Section */}
          <section className="settings-section">
            <div className="section-label">
              <User size={18} />
              <h2>Profile</h2>
            </div>

            <Card className="profile-settings-card">
              <div className="profile-settings-header">
                <div className="settings-avatar">
                  <span>{getInitials(user?.full_name)}</span>
                </div>
                <div className="settings-profile-info">
                  <h3>{user?.full_name || 'User'}</h3>
                  <span className="settings-username">@{user?.username}</span>
                  <div className="settings-badges">
                    <Badge variant={user?.is_active ? 'success' : 'neutral'}>
                      {user?.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant={user?.is_verified ? 'info' : 'warning'}>
                      {user?.is_verified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </div>
                </div>
                {!isEditing && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit3 size={14} />
                    Edit
                  </Button>
                )}
              </div>

              {isEditing ? (
                <div className="settings-edit-form">
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
                  <div className="settings-edit-actions">
                    <Button variant="ghost" size="sm" onClick={handleCancel}>
                      <X size={14} />
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSave}>
                      <Check size={14} />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="settings-details-list">
                  <div className="settings-detail-row">
                    <Mail size={16} />
                    <span className="detail-key">Email</span>
                    <span className="detail-val">{user?.email || 'Not set'}</span>
                  </div>
                  <div className="settings-detail-row">
                    <Shield size={16} />
                    <span className="detail-key">Role</span>
                    <span className="detail-val">{user?.role || 'Operator'}</span>
                  </div>
                  <div className="settings-detail-row">
                    <Calendar size={16} />
                    <span className="detail-key">Joined</span>
                    <span className="detail-val">{formatDate(user?.created_at)}</span>
                  </div>
                </div>
              )}
            </Card>
          </section>

          {/* Appearance Section */}
          <section className="settings-section">
            <div className="section-label">
              <Monitor size={18} />
              <h2>Appearance</h2>
            </div>

            <Card>
              <div className="theme-picker">
                <div className="theme-info">
                  <h3>Theme</h3>
                  <p>Select your preferred color scheme</p>
                </div>
                <div className="theme-options">
                  <button
                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    <Sun size={20} />
                    <span>Light</span>
                  </button>
                  <button
                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon size={20} />
                    <span>Dark</span>
                  </button>
                </div>
              </div>
            </Card>
          </section>

          {/* Connections Section */}
          <section className="settings-section">
            <div className="section-label">
              <Server size={18} />
              <h2>Connections</h2>
            </div>

            <Card>
              <div className="connections-header">
                <h3>Service Status</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={checkConnections}
                  disabled={checkingHealth}
                >
                  <RefreshCw size={14} className={checkingHealth ? 'spin' : ''} />
                  Refresh
                </Button>
              </div>
              <div className="connections-list">
                <div className="connection-row">
                  <div className="connection-info">
                    <Database size={18} />
                    <div>
                      <span className="connection-name">Target Database</span>
                      <span className="connection-detail">ETL pipeline output storage</span>
                    </div>
                  </div>
                  <Badge variant={dbHealth === null ? 'neutral' : dbHealth ? 'success' : 'error'}>
                    {dbHealth === null ? 'Checking...' : dbHealth ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <div className="connection-row">
                  <div className="connection-info">
                    <Globe size={18} />
                    <div>
                      <span className="connection-name">Apache Airflow</span>
                      <span className="connection-detail">ETL orchestration engine</span>
                    </div>
                  </div>
                  <Badge variant={airflowHealth === null ? 'neutral' : airflowHealth ? 'success' : 'error'}>
                    {airflowHealth === null ? 'Checking...' : airflowHealth ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <div className="connection-row">
                  <div className="connection-info">
                    <Link2 size={18} />
                    <div>
                      <span className="connection-name">Blockchain (Ganache)</span>
                      <span className="connection-detail">Merkle root storage</span>
                    </div>
                  </div>
                  <Badge variant="neutral">Auto</Badge>
                </div>
              </div>
            </Card>
          </section>

          {/* About Section */}
          <section className="settings-section">
            <div className="section-label">
              <Info size={18} />
              <h2>About</h2>
            </div>

            <Card>
              <div className="about-content">
                <div className="about-logo">CRYVEX</div>
                <p className="about-description">
                  Blockchain-enabled ETL pipeline tracker with data integrity verification.
                  Built as a Final Year Project.
                </p>
                <div className="about-details">
                  <div className="about-row">
                    <span>Version</span>
                    <Badge variant="neutral">1.0.0</Badge>
                  </div>
                  <div className="about-row">
                    <span>Stack</span>
                    <span className="about-val">React + Node.js + Airflow + Solidity</span>
                  </div>
                  <div className="about-row">
                    <span>Database</span>
                    <span className="about-val">PostgreSQL</span>
                  </div>
                  <div className="about-row">
                    <span>Blockchain</span>
                    <span className="about-val">Ethereum (Ganache)</span>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* Security Section */}
          <section className="settings-section">
            <div className="section-label">
              <Key size={18} />
              <h2>Security</h2>
            </div>

            <Card>
              <div className="security-content">
                <div className="security-row">
                  <div>
                    <h3>Change Password</h3>
                    <p>Update your account password</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    Coming Soon
                  </Button>
                </div>
                <div className="security-row">
                  <div>
                    <h3>Two-Factor Authentication</h3>
                    <p>Add an extra layer of security to your account</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    Coming Soon
                  </Button>
                </div>
              </div>
            </Card>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
