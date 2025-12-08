import React, { useState } from 'react';
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
  FileCode
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
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
      // Here you would call the API to update user profile
      // await userService.updateProfile(formData);
      setSuccess('Profile updated successfully');
      setIsEditing(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to update profile');
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
                      <span className="detail-value">{user?.role || 'Operator'}</span>
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
                <Key size={24} />
              </div>
              <div className="action-content">
                <h3>Security</h3>
                <p>Update your password and security settings</p>
              </div>
              <Button variant="outline" size="sm" disabled>
                Coming Soon
              </Button>
            </Card>

            <Card className="action-card">
              <div className="action-icon">
                <Settings size={24} />
              </div>
              <div className="action-content">
                <h3>Preferences</h3>
                <p>Customize your dashboard experience</p>
              </div>
              <Button variant="outline" size="sm" disabled>
                Coming Soon
              </Button>
            </Card>
          </div>

          {/* Account Stats */}
          <Card className="stats-card">
            <h3 className="stats-title">Account Overview</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-number">-</span>
                <span className="stat-label">Total Pipelines</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">-</span>
                <span className="stat-label">Configurations</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">-</span>
                <span className="stat-label">Executions</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">-</span>
                <span className="stat-label">Integrity Checks</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
