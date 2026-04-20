import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import {
  Users, Search, Shield, ShieldOff, UserX, UserCheck, Trash2, RefreshCw,
  Crown, User, ChevronLeft, ChevronRight, AlertTriangle
} from 'lucide-react';
import { adminService } from '../services/admin.service';
import { useAuth } from '../hooks/useAuth';
import './Users.css';

const PAGE_SIZE = 20;

const UsersPage = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // userId being acted on

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.listUsers({
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        page,
      });
      setUsers(data.users || data.items || data || []);
      setTotal(data.total ?? (Array.isArray(data) ? data.length : 0));
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    if (currentUser?.is_admin) {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [fetchUsers, currentUser]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Stats derived from loaded data (use all loaded users)
  const statsUsers = users;
  const totalUsers = total;
  const activeUsers = statsUsers.filter(u => u.is_active).length;
  const adminUsers = statsUsers.filter(u => u.is_admin).length;
  const inactiveUsers = statsUsers.filter(u => !u.is_active).length;

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    }).format(new Date(dateString));
  };

  const getInitials = (fullName, username) => {
    if (fullName) {
      const parts = fullName.trim().split(' ');
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return fullName.slice(0, 2).toUpperCase();
    }
    if (username) return username.slice(0, 2).toUpperCase();
    return '??';
  };

  const handleToggleActive = async (targetUser) => {
    try {
      setActionLoading(`active-${targetUser.id}`);
      await adminService.updateUser(targetUser.id, { is_active: !targetUser.is_active });
      setUsers(prev =>
        prev.map(u => u.id === targetUser.id ? { ...u, is_active: !u.is_active } : u)
      );
    } catch (err) {
      console.error('Failed to toggle active status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async (targetUser) => {
    try {
      setActionLoading(`admin-${targetUser.id}`);
      await adminService.updateUser(targetUser.id, { is_admin: !targetUser.is_admin });
      setUsers(prev =>
        prev.map(u => u.id === targetUser.id ? { ...u, is_admin: !u.is_admin } : u)
      );
    } catch (err) {
      console.error('Failed to toggle admin role:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDelete = (targetUser) => {
    setDeleteTarget(targetUser);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    try {
      setActionLoading(`delete-${deleteTarget.id}`);
      await adminService.deleteUser(deleteTarget.id);
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setTotal(prev => Math.max(0, prev - 1));
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete user:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Access denied state
  if (!loading && currentUser && !currentUser.is_admin) {
    return (
      <DashboardLayout>
        <div className="users-access-denied">
          <AlertTriangle size={64} />
          <h2>Access Denied</h2>
          <p>You do not have permission to view this page. Admin access is required.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="users-page">
        {/* Header */}
        <div className="audit-header">
          <div className="audit-header-title">
            <Users size={32} className="header-icon" />
            <div>
              <h1>User Management</h1>
              <p>Manage all registered users and their permissions</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </Button>
        </div>

        {/* Stats Row */}
        <div className="users-stats-grid">
          <div className="users-stat-card">
            <div className="stat-icon stat-icon-blue">
              <User size={20} />
            </div>
            <div className="stat-value">{totalUsers}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <div className="users-stat-card">
            <div className="stat-icon stat-icon-green">
              <UserCheck size={20} />
            </div>
            <div className="stat-value">{activeUsers}</div>
            <div className="stat-label">Active Users</div>
          </div>
          <div className="users-stat-card">
            <div className="stat-icon stat-icon-purple">
              <Crown size={20} />
            </div>
            <div className="stat-value">{adminUsers}</div>
            <div className="stat-label">Admin Users</div>
          </div>
          <div className="users-stat-card">
            <div className="stat-icon stat-icon-red">
              <UserX size={20} />
            </div>
            <div className="stat-value">{inactiveUsers}</div>
            <div className="stat-label">Inactive Users</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="users-toolbar">
          <div className="users-search-wrapper">
            <Search size={16} className="users-search-icon" />
            <input
              type="text"
              placeholder="Search by name, username, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="users-search-input"
            />
          </div>
          <span className="audit-total">
            {total} user{total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Content */}
        {loading && users.length === 0 ? (
          <Card>
            <div className="audit-loading">
              <Spinner size="lg" />
              <p>Loading users...</p>
            </div>
          </Card>
        ) : error ? (
          <Card>
            <div className="audit-error">
              <AlertTriangle size={48} />
              <h3>Failed to Load</h3>
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={fetchUsers}>Retry</Button>
            </div>
          </Card>
        ) : users.length === 0 ? (
          <Card>
            <div className="users-empty">
              <Users size={48} />
              <h3>No Users Found</h3>
              <p>{searchTerm ? 'Try adjusting your search query' : 'No users have been registered yet'}</p>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <div className="users-table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Status</th>
                      <th>Role</th>
                      <th>Verified</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const isSelf = currentUser?.id === u.id;
                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="users-user-cell">
                              <div className="users-avatar">
                                {getInitials(u.full_name, u.username)}
                              </div>
                              <div className="users-identity">
                                <span className="users-identity-name">{u.full_name || u.username}</span>
                                <span className="users-identity-sub">@{u.username} · {u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge variant={u.is_active ? 'success' : 'error'}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td>
                            <Badge variant={u.is_admin ? 'primary' : 'neutral'}>
                              {u.is_admin ? 'Admin' : 'User'}
                            </Badge>
                          </td>
                          <td>
                            <Badge variant={u.is_verified ? 'success' : 'warning'}>
                              {u.is_verified ? 'Verified' : 'Unverified'}
                            </Badge>
                          </td>
                          <td>
                            <span className="audit-time">{formatDate(u.created_at)}</span>
                          </td>
                          <td>
                            <div className="users-actions">
                              {/* Toggle Active */}
                              {!isSelf && (
                                <button
                                  className={`users-btn-sm ${u.is_active ? 'users-btn-deactivate' : 'users-btn-activate'}`}
                                  onClick={() => handleToggleActive(u)}
                                  disabled={actionLoading === `active-${u.id}`}
                                  title={u.is_active ? 'Deactivate user' : 'Activate user'}
                                >
                                  {u.is_active ? (
                                    <><UserX size={12} /> Deactivate</>
                                  ) : (
                                    <><UserCheck size={12} /> Activate</>
                                  )}
                                </button>
                              )}

                              {/* Toggle Admin */}
                              <button
                                className={`users-btn-sm ${u.is_admin ? 'users-btn-revoke' : 'users-btn-admin'}`}
                                onClick={() => handleToggleAdmin(u)}
                                disabled={actionLoading === `admin-${u.id}`}
                                title={u.is_admin ? 'Revoke admin role' : 'Grant admin role'}
                              >
                                {u.is_admin ? (
                                  <><ShieldOff size={12} /> Revoke Admin</>
                                ) : (
                                  <><Shield size={12} /> Make Admin</>
                                )}
                              </button>

                              {/* Delete */}
                              {!isSelf && (
                                <button
                                  className="users-btn-sm users-btn-delete"
                                  onClick={() => confirmDelete(u)}
                                  disabled={actionLoading === `delete-${u.id}`}
                                  title="Delete user"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
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
                  Page {page} of {totalPages} ({total} users)
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

        {/* Delete Confirmation Modal */}
        {showDeleteModal && deleteTarget && (
          <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }} size="sm">
            <Modal.Header>
              <Modal.Title>Delete User</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="users-delete-modal-body">
                <AlertTriangle size={40} className="users-delete-warn-icon" />
                <p>
                  Are you sure you want to delete user{' '}
                  <strong>@{deleteTarget.username}</strong>? This action cannot be undone.
                </p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirmed}
                disabled={actionLoading === `delete-${deleteTarget.id}`}
              >
                <Trash2 size={14} />
                {actionLoading === `delete-${deleteTarget.id}` ? 'Deleting...' : 'Delete User'}
              </Button>
            </Modal.Footer>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
};

export default UsersPage;
