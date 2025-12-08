import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  GitBranch, 
  Activity, 
  Shield, 
  Users, 
  FileText,
  Settings,
  FileCode2
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/pipelines', icon: GitBranch, label: 'Pipelines' },
    { to: '/my-configs', icon: FileCode2, label: 'My Configs' },
    { to: '/executions', icon: Activity, label: 'Executions' },
    { to: '/integrity', icon: Shield, label: 'Integrity' },
    { to: '/users', icon: Users, label: 'Users', adminOnly: true },
    { to: '/audit-logs', icon: FileText, label: 'Audit Logs' },
    { to: '/settings', icon: Settings, label: 'Settings' },
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
      </nav>
    </aside>
  );
};

export default Sidebar;
