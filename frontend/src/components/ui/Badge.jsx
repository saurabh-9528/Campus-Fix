import React from 'react';

export const Badge = ({ children, variant = 'neutral', className = '' }) => {
  const variants = {
    primary: "bg-primary-100 text-primary-700 ring-1 ring-primary-500/20",
    success: "bg-green-100 text-green-700 ring-1 ring-green-500/20",
    warning: "bg-orange-100 text-orange-700 ring-1 ring-orange-500/20",
    danger: "bg-red-100 text-red-700 ring-1 ring-red-500/20",
    progress: "bg-purple-100 text-purple-700 ring-1 ring-purple-500/20",
    neutral: "bg-gray-100 text-gray-700 ring-1 ring-gray-500/20",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
