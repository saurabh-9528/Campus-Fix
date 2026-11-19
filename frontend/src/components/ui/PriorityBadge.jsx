import React from 'react';
import { Badge } from './Badge';

export const PriorityBadge = ({ priority, className = '' }) => {
  const priorityConfig = {
    low: { variant: 'neutral', label: 'Low' },
    medium: { variant: 'primary', label: 'Medium' },
    high: { variant: 'warning', label: 'High' },
    critical: { variant: 'danger', label: 'Critical' }
  };

  const config = priorityConfig[priority?.toLowerCase()] || { variant: 'neutral', label: priority };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
};
