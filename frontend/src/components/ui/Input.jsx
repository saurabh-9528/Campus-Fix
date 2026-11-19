import React, { forwardRef } from 'react';

export const Input = forwardRef(({ className = '', label, error, ...props }, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        className={`flex h-10 w-full rounded-md border ${error ? 'border-danger focus-visible:ring-danger' : 'border-gray-300 focus-visible:ring-primary-500'} bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        ref={ref}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-danger">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
