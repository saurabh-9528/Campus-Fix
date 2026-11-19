import React from 'react';
import { Loader2 } from 'lucide-react';

export const Spinner = ({ className = '', size = 24 }) => {
  return (
    <Loader2 
      className={`animate-spin text-primary-600 ${className}`} 
      size={size} 
    />
  );
};

export const FullPageSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <Spinner size={48} />
  </div>
);
