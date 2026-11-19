import React from 'react';

export const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseStyles = "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow hover:-translate-y-0.5",
    secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm hover:shadow",
    danger: "bg-danger text-white hover:bg-red-600 shadow-sm hover:shadow hover:-translate-y-0.5",
    ghost: "hover:bg-gray-100 text-gray-700",
  };
  
  const sizes = {
    default: "h-11 px-5 py-2",
    sm: "h-9 px-4 text-xs",
    lg: "h-14 px-8 text-base",
    icon: "h-11 w-11"
  };

  const size = props.size || 'default';
  
  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
