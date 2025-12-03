import React from 'react';
import './Card.css';
import clsx from 'clsx';

const Card = ({ children, className, onClick, hover = false }) => {
  return (
    <div 
      className={clsx('card', { 'card-hover': hover }, className)}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

const CardHeader = ({ children, className }) => {
  return <div className={clsx('card-header', className)}>{children}</div>;
};

const CardTitle = ({ children, className }) => {
  return <h3 className={clsx('card-title', className)}>{children}</h3>;
};

const CardBody = ({ children, className }) => {
  return <div className={clsx('card-body', className)}>{children}</div>;
};

const CardFooter = ({ children, className }) => {
  return <div className={clsx('card-footer', className)}>{children}</div>;
};

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
