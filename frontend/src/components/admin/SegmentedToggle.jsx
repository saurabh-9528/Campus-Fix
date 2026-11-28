import React from 'react';

export const SegmentedToggle = ({ options, value, onChange, ariaLabel = 'View options' }) => (
  <div
    className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
    role="group"
    aria-label={ariaLabel}
  >
    {options.map((option) => {
      const isActive = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={isActive}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
            isActive
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
