import React from 'react';
import { Link } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import NotificationDropdown from './NotificationDropdown';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/dashboard" className="navbar-logo">
          <span className="navbar-logo-text">CRYVEX</span>
        </Link>

        <div className="navbar-right">
          <NotificationDropdown />

          <Link to="/profile" className="navbar-user">
            <div className="navbar-user-info">
              <span className="navbar-user-name">{user?.full_name || 'User'}</span>
              <span className="navbar-user-role">{user?.role || 'Operator'}</span>
            </div>
            <div className="navbar-user-avatar">
              <User size={20} />
            </div>
          </Link>

          <button className="navbar-icon-button" onClick={logout}>
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
