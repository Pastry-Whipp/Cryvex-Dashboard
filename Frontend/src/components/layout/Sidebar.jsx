import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  GitBranch,
  Activity,
  Shield,
  Database,
  Settings,
  FileCode2,
  FileText,
  Users
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './Sidebar.css';

const Sidebar = () => {
  const { user } = useAuth();

  const navItems = [
    { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/pipelines',       icon: GitBranch,       label: 'Pipelines' },
    { to: '/my-configs',      icon: FileCode2,        label: 'My Configs' },
    { to: '/executions',      icon: Activity,         label: 'Executions' },
    { to: '/verify-integrity',icon: Shield,           label: 'Integrity' },
    { to: '/data-explorer',   icon: Database,         label: 'Data Explorer' },
    { to: '/settings',        icon: Settings,         label: 'Settings' },
  ];

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <item.icon size={20} className="sidebar-icon" />
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
        {user?.is_admin === true && (
          <>
            <NavLink
              to="/audit-logs"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
            >
              <FileText size={20} className="sidebar-icon" />
              <span className="sidebar-label">Audit Logs</span>
            </NavLink>
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
            >
              <Users size={20} className="sidebar-icon" />
              <span className="sidebar-label">Users</span>
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;
