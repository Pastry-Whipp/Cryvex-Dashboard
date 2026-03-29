import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle2, XCircle, Clock, Loader2, Activity, X } from 'lucide-react';
import { pipelineExecutionService } from '../../services/pipelineExecution.service';
import './NotificationDropdown.css';

const STATUS_ICON = {
  pending:   { icon: Clock,        className: 'notif-icon-muted' },
  queued:    { icon: Clock,        className: 'notif-icon-info' },
  running:   { icon: Loader2,      className: 'notif-icon-warning spin' },
  success:   { icon: CheckCircle2, className: 'notif-icon-success' },
  failed:    { icon: XCircle,      className: 'notif-icon-error' },
  cancelled: { icon: XCircle,      className: 'notif-icon-muted' },
};

const NotificationDropdown = () => {
  const [open, setOpen] = useState(false);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Poll for active executions
  useEffect(() => {
    const interval = setInterval(() => {
      loadNotifications();
    }, 15000);
    loadNotifications();
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await pipelineExecutionService.getMyExecutions({ limit: 10 });
      setExecutions(data);
    } catch {}
    finally { setLoading(false); }
  };

  const activeCount = executions.filter(e =>
    ['running', 'queued', 'pending'].includes(e.status)
  ).length;

  const recentCount = executions.filter(e => {
    const age = Date.now() - new Date(e.created_at).getTime();
    return age < 24 * 60 * 60 * 1000; // last 24h
  }).length;

  const formatTime = (d) => {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const getStatusText = (status) => {
    const labels = {
      pending: 'is pending',
      queued: 'is queued',
      running: 'is running',
      success: 'completed successfully',
      failed: 'has failed',
      cancelled: 'was cancelled'
    };
    return labels[status] || status;
  };

  return (
    <div className="notif-wrapper" ref={dropdownRef}>
      <button className="navbar-icon-button notif-bell" onClick={() => setOpen(!open)}>
        <Bell size={20} />
        {activeCount > 0 && (
          <span className="notif-badge">{activeCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <h3>Notifications</h3>
            <button className="notif-close" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>

          {activeCount > 0 && (
            <div className="notif-active-banner">
              <Loader2 size={14} className="spin" />
              <span>{activeCount} pipeline{activeCount > 1 ? 's' : ''} running</span>
            </div>
          )}

          <div className="notif-list">
            {executions.length === 0 ? (
              <div className="notif-empty">
                <Activity size={24} />
                <p>No recent activity</p>
              </div>
            ) : (
              executions.slice(0, 8).map(exec => {
                const statusCfg = STATUS_ICON[exec.status] || STATUS_ICON.pending;
                const Icon = statusCfg.icon;
                return (
                  <Link
                    to="/executions"
                    key={exec.id}
                    className="notif-item"
                    onClick={() => setOpen(false)}
                  >
                    <div className={`notif-item-icon ${statusCfg.className}`}>
                      <Icon size={16} />
                    </div>
                    <div className="notif-item-content">
                      <span className="notif-item-title">
                        {exec.config_name || `Pipeline #${exec.pipeline_config_id}`}
                      </span>
                      <span className="notif-item-desc">
                        Execution {getStatusText(exec.status)}
                      </span>
                    </div>
                    <span className="notif-item-time">
                      {formatTime(exec.started_at || exec.created_at)}
                    </span>
                  </Link>
                );
              })
            )}
          </div>

          {executions.length > 0 && (
            <Link to="/executions" className="notif-footer" onClick={() => setOpen(false)}>
              View all executions
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
