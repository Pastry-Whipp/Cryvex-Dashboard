import React from 'react';
import './Alert.css';
import clsx from 'clsx';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const Alert = ({ children, variant = 'info', dismissible = false, onDismiss, className }) => {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info
  };

  const Icon = icons[variant];

  return (
    <div className={clsx('alert', `alert-${variant}`, className)}>
      <Icon size={20} className="alert-icon" />
      <div className="alert-content">{children}</div>
      {dismissible && (
        <button onClick={onDismiss} className="alert-dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default Alert;
