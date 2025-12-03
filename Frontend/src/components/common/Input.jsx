import React, { useState } from 'react';
import './Input.css';
import clsx from 'clsx';

const Input = ({ 
  label, 
  type = 'text', 
  placeholder,
  error,
  required = false,
  disabled = false,
  value,
  onChange,
  name,
  className,
  ...props 
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className={clsx('input-wrapper', className)}>
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}
      <div className="input-field-wrapper">
        <input
          type={inputType}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={clsx('input-field', {
            'input-error': error,
            'input-disabled': disabled
          })}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className="input-eye-button"
            onClick={() => setShowPassword((prev) => !prev)}
            tabIndex={-1}
          >
            <span className="input-eye-icon">
              {showPassword ? '🙈' : '👁️'}
            </span>
          </button>
        )}
      </div>
      {error && <span className="input-error-message">{error}</span>}
    </div>
  );
};

export default Input;
