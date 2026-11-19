import React from 'react';
import { Badge } from './Badge';

export const StatusBadge = ({ status, className = '' }) => {
  const statusConfig = {
    submitted: { variant: 'warning', label: 'Submitted' },
    assigned: { variant: 'warning', label: 'Assigned' },
    in_progress: { variant: 'progress', label: 'In Progress' },
    resolved: { variant: 'success', label: 'Resolved' },
    closed: { variant: 'neutral', label: 'Closed' }
  };

  const config = statusConfig[status?.toLowerCase()] || { variant: 'neutral', label: status };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
};
