import React from 'react';
import './EmptyState.css';

const EmptyState = ({ icon: Icon, title, description, action }) => {
  return (
    <div className="empty-state">
      {Icon && <Icon size={48} className="empty-state-icon" />}
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
};

export default EmptyState;
