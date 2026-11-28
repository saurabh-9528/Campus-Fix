import { CATEGORY_OPTIONS } from './categories';

export const STATUS_META = {
  submitted: { label: 'Submitted', color: '#f59e0b' },
  assigned: { label: 'Assigned', color: '#fb923c' },
  in_progress: { label: 'In Progress', color: '#a78bfa' },
  resolved: { label: 'Resolved', color: '#10b981' },
  closed: { label: 'Closed', color: '#94a3b8' },
};

export const STATUS_ORDER = ['submitted', 'assigned', 'in_progress', 'resolved', 'closed'];

export const PRIORITY_META = {
  critical: { label: 'Critical', color: '#ef4444' },
  high: { label: 'High', color: '#fb923c' },
  medium: { label: 'Medium', color: '#10b981' },
  low: { label: 'Low', color: '#94a3b8' },
};

export const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];

const CATEGORY_COLORS = ['#059669', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#94a3b8'];

export const countOf = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

export const sumDistribution = (distribution = {}) =>
  Object.values(distribution || {}).reduce((sum, value) => sum + countOf(value), 0);

export const getStatusItems = (distribution = {}) =>
  STATUS_ORDER.map((key) => ({
    key,
    label: STATUS_META[key].label,
    color: STATUS_META[key].color,
    value: countOf(distribution?.[key]),
  }));

export const getPriorityItems = (distribution = {}) =>
  PRIORITY_ORDER.map((key) => ({
    key,
    label: PRIORITY_META[key].label,
    color: PRIORITY_META[key].color,
    value: countOf(distribution?.[key]),
  }));

export const getCategoryItems = (distribution = {}) =>
  CATEGORY_OPTIONS.map((option, index) => ({
    key: option.value,
    label: option.label,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    value: countOf(distribution?.[option.value]),
  }));

export const getAnalyticsTotals = (analytics = {}) => {
  const statusDistribution = analytics.status_distribution || {};
  const staff = Array.isArray(analytics.staff_workload) ? analytics.staff_workload : [];
  const total = countOf(analytics.total_complaints) || sumDistribution(statusDistribution);
  const pending = countOf(statusDistribution.submitted) + countOf(statusDistribution.assigned);
  const inProgress = countOf(statusDistribution.in_progress);
  const resolved = countOf(statusDistribution.resolved) + countOf(statusDistribution.closed);
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return {
    total,
    pending,
    inProgress,
    resolved,
    open: pending + inProgress,
    resolutionRate,
    staff,
    activeStaff: staff.length,
    averageRating: analytics.average_feedback_rating ?? null,
    averageResolutionHours: analytics.average_resolution_hours ?? null,
  };
};

export const getTrendTotals = (points = []) =>
  (Array.isArray(points) ? points : []).reduce(
    (totals, point) => ({
      submitted: totals.submitted + countOf(point?.submitted),
      resolved: totals.resolved + countOf(point?.resolved),
    }),
    { submitted: 0, resolved: 0 }
  );

export const getRecentTrendTotals = (points = [], count = 7) =>
  getTrendTotals((Array.isArray(points) ? points : []).slice(-count));

export const getStaffResolutionRate = (staff = {}) => {
  const total = countOf(staff.total_assigned);
  return total > 0 ? Math.round((countOf(staff.resolved_complaints) / total) * 100) : 0;
};

export const formatNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat().format(numeric) : '0';
};

export const formatPercent = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric)}%` : '0%';
};

export const formatHours = (hours) => {
  const numeric = Number(hours);
  if (!Number.isFinite(numeric) || numeric < 0) return '—';
  if (numeric < 1) return '< 1h';
  if (numeric < 24) return `${Math.round(numeric)}h`;
  const days = numeric / 24;
  return `${days >= 10 ? Math.round(days) : days.toFixed(1)}d`;
};

export const formatPeriodLabel = (period, granularity = 'daily') => {
  if (!period) return '';
  const [year, month, day] = String(period).split('-').map(Number);
  if (!year || !month || !day) return String(period);
  const date = new Date(year, month - 1, day);
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return granularity === 'weekly' ? `Wk ${label}` : label;
};

export const getInitials = (name) => {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]).join('').toUpperCase() || '?';
};
