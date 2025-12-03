import React from 'react';
import './Badge.css';
import clsx from 'clsx';

const Badge = ({ children, variant = 'neutral', className }) => {
  return (
    <span className={clsx('badge', `badge-${variant}`, className)}>
      {children}
    </span>
  );
};

export default Badge;
