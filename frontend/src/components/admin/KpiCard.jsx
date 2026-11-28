import React from 'react';

const TONES = {
  primary: {
    icon: 'bg-primary-50 text-primary-600 ring-primary-100',
    accent: 'bg-primary-500',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600 ring-amber-100',
    accent: 'bg-amber-500',
  },
  purple: {
    icon: 'bg-purple-50 text-purple-600 ring-purple-100',
    accent: 'bg-purple-400',
  },
  green: {
    icon: 'bg-green-50 text-green-600 ring-green-100',
    accent: 'bg-green-500',
  },
  blue: {
    icon: 'bg-blue-50 text-blue-600 ring-blue-100',
    accent: 'bg-blue-500',
  },
};

export const KpiCard = ({ icon: Icon, label, value, detail, tone = 'primary', className = '' }) => {
  const styles = TONES[tone] || TONES.primary;

  return (
    <div
      className={`relative h-full overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      <span className={`absolute inset-x-0 top-0 h-0.5 ${styles.accent}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{value}</p>
        </div>
        <span
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ring-1 ${styles.icon}`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {detail && <p className="mt-3 text-xs leading-5 text-gray-500">{detail}</p>}
    </div>
  );
};
