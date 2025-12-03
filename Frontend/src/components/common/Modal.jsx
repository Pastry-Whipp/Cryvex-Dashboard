import React, { useEffect } from 'react';
import './Modal.css';
import clsx from 'clsx';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, children, size = 'md', className }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={clsx('modal', `modal-${size}`, className)} 
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
};

const ModalHeader = ({ children, className }) => {
  return <div className={clsx('modal-header', className)}>{children}</div>;
};

const ModalTitle = ({ children, className }) => {
  return <h2 className={clsx('modal-title', className)}>{children}</h2>;
};

const ModalBody = ({ children, className }) => {
  return <div className={clsx('modal-body', className)}>{children}</div>;
};

const ModalFooter = ({ children, className }) => {
  return <div className={clsx('modal-footer', className)}>{children}</div>;
};

Modal.Header = ModalHeader;
Modal.Title = ModalTitle;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export default Modal;
