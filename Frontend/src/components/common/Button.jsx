import React from 'react';
import './Button.css';
import clsx from 'clsx';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false,
  fullWidth = false,
  onClick,
  type = 'button',
  className,
  ...props 
}) => {
  const buttonClass = clsx(
    'button',
    `button-${variant}`,
    `button-${size}`,
    {
      'button-full-width': fullWidth,
      'button-disabled': disabled
    },
    className
  );

  return (
    <button
      type={type}
      className={buttonClass}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
