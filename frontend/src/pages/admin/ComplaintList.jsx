import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import {
  Armchair,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Droplets,
  ExternalLink,
  Eye,
  FilterX,
  Inbox,
  MapPin,
  Monitor,
  RefreshCw,
  Search,
  Sparkles,
  UserPlus,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import { getCategoryLabel, CATEGORY_OPTIONS } from '../../utils/categories';
import { downloadCsv } from '../../utils/csv';
import { getInitials } from '../../utils/analytics';
import { ComplaintDetailDrawer } from './ComplaintDetailDrawer';

const CATEGORY_STYLES = {
  electrical: { badge: 'bg-amber-50 text-amber-700 border-amber-200/80', icon: Zap },
  water: { badge: 'bg-sky-50 text-sky-700 border-sky-200/80', icon: Droplets },
  furniture: { badge: 'bg-orange-50 text-orange-700 border-orange-200/80', icon: Armchair },
  cleaning: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', icon: Sparkles },
  internet: { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/80', icon: Wifi },
  classroom_equipment: { badge: 'bg-purple-50 text-purple-700 border-purple-200/80', icon: Monitor },
  other: { badge: 'bg-gray-100 text-gray-700 border-gray-200', icon: Wrench },
};

const PRIORITY_STYLES = {
  critical: { label: 'Urgent', classes: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  high: { label: 'High', classes: 'bg-amber-50 text-amber-700 border-amber-200', dot: null },
  medium: { label: 'Medium', classes: 'bg-gray-100 text-gray-700 border-gray-200', dot: null },
  low: { label: 'Low', classes: 'bg-slate-50 text-slate-600 border-slate-200', dot: null },
};

const formatRelativeTime = (dateValue) => {
  if (!dateValue) return '—';
  const created = new Date(dateValue);
  if (Number.isNaN(created.getTime())) return '—';
  const diffMs = Date.now() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getSlaHint = (complaint) => {
  if (complaint.status === 'resolved' || complaint.status === 'closed') {
    return { text: 'Completed', tone: 'text-emerald-600' };
  }
  if (!complaint.assigned_staff_id) {
    return { text: 'Awaiting assignment', tone: 'text-amber-600' };
  }
  if (complaint.priority === 'critical' || complaint.priority === 'high') {
    return { text: 'Priority SLA', tone: 'text-red-600' };
  }
  return { text: 'On track', tone: 'text-emerald-600' };
};

export const ComplaintList = () => {
  const [allComplaints, setAllComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Detail drawer state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailComplaintId, setDetailComplaintId] = useState('');

  // Quick assign inline state
  const [quickAssignId, setQuickAssignId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStaffId, setBulkStaffId] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const [searchParams] = useSearchParams();

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState(() => searchParams.get('priority') || '');
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') || '');
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [assigneeFilter, setAssigneeFilter] = useState(() => searchParams.get('assignee') || '');
  const [staffList, setStaffList] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const searchInputRef = useRef(null);

  const fetchComplaints = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await adminApi.getAdminComplaints();
      setAllComplaints(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load complaints');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const data = await adminApi.getStaff(false);
        setStaffList(data || []);
      } catch {
        setStaffList([]);
      }
    };

    fetchStaff();
  }, []);

  useEffect(() => {
    const handleSlashShortcut = (event) => {
      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleSlashShortcut);
    return () => window.removeEventListener('keydown', handleSlashShortcut);
  }, []);

  const staffById = useMemo(() => {
    const map = new Map();
    staffList.forEach((staff) => {
      map.set(String(staff.id), staff);
    });
    return map;
  }, [staffList]);

  const complaints = useMemo(() => {
    let filtered = allComplaints;
    if (statusFilter) filtered = filtered.filter((c) => c.status === statusFilter);
    if (priorityFilter) filtered = filtered.filter((c) => c.priority === priorityFilter);
    if (categoryFilter) filtered = filtered.filter((c) => c.category === categoryFilter);
    if (assigneeFilter) {
      if (assigneeFilter === 'unassigned') {
        filtered = filtered.filter((c) => !c.assigned_staff_id);
      } else {
        filtered = filtered.filter((c) => String(c.assigned_staff_id) === assigneeFilter);
      }
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          String(c.id).includes(query) ||
          c.title?.toLowerCase().includes(query) ||
          c.location?.toLowerCase().includes(query) ||
          (c.student?.full_name?.toLowerCase() || '').includes(query)
      );
    }
    return filtered;
  }, [allComplaints, statusFilter, priorityFilter, categoryFilter, assigneeFilter, searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, categoryFilter, assigneeFilter, searchQuery, pageSize]);

  const totalPages = Math.max(1, Math.ceil(complaints.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedComplaints = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return complaints.slice(start, start + pageSize);
  }, [complaints, currentPage, pageSize]);

  const summary = useMemo(() => {
    const total = allComplaints.length;
    const unassigned = allComplaints.filter((c) => !c.assigned_staff_id).length;
    const urgent = allComplaints.filter(
      (c) => c.priority === 'high' || c.priority === 'critical'
    ).length;
    const inProgress = allComplaints.filter((c) => c.status === 'in_progress').length;
    const resolved = allComplaints.filter(
      (c) => c.status === 'resolved' || c.status === 'closed'
    ).length;
    const open = total - resolved;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, unassigned, urgent, inProgress, resolved, open, resolutionRate };
  }, [allComplaints]);

  const hasFilters = Boolean(
    statusFilter || priorityFilter || categoryFilter || assigneeFilter || searchQuery
  );

  const pageIds = useMemo(
    () => paginatedComplaints.map((c) => c.id),
    [paginatedComplaints]
  );
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenDetail = (complaintId) => {
    setDetailComplaintId(String(complaintId));
    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setDetailComplaintId('');
  };

  const clearFilters = () => {
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setAssigneeFilter('');
    setSearchQuery('');
  };

  const handleQuickAssign = async (complaintId, staffId) => {
    if (!staffId) return;
    setAssigningId(complaintId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await adminApi.assignStaff(complaintId, staffId);
      setQuickAssignId(null);
      const staff = staffById.get(String(staffId));
      setActionSuccess(
        `Assigned ticket #${complaintId} to ${staff?.full_name || 'staff member'}.`
      );
      await fetchComplaints({ silent: true });
    } catch (err) {
      setActionError(err.message || 'Failed to assign staff');
    } finally {
      setAssigningId(null);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedIds.length === 0 || !bulkStaffId) return;
    setBulkUpdating(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await adminApi.bulkAssignComplaints(selectedIds, bulkStaffId);
      setActionSuccess(
        `Assigned ${result.updated_count} complaint(s)${
          result.skipped_count ? ` (${result.skipped_count} skipped)` : ''
        }.`
      );
      setSelectedIds([]);
      setBulkStaffId('');
      await fetchComplaints({ silent: true });
    } catch (err) {
      setActionError(err.message || 'Failed to bulk assign complaints');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedIds.length === 0 || !bulkStatus) return;
    setBulkUpdating(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await adminApi.bulkUpdateStatus(selectedIds, bulkStatus);
      setActionSuccess(
        `Updated status on ${result.updated_count} complaint(s)${
          result.skipped_count ? ` (${result.skipped_count} skipped)` : ''
        }.`
      );
      setSelectedIds([]);
      setBulkStatus('');
      await fetchComplaints({ silent: true });
    } catch (err) {
      setActionError(err.message || 'Failed to bulk update status');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleExportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `campusfix-complaints-${stamp}.csv`,
      ['ID', 'Title', 'Category', 'Location', 'Student', 'Assignee', 'Priority', 'Status', 'Created At'],
      complaints.map((c) => {
        const staff = c.assigned_staff_id ? staffById.get(String(c.assigned_staff_id)) : null;
        return [
          c.id,
          c.title,
          getCategoryLabel(c.category),
          c.location,
          c.student?.full_name || `ID: ${c.student_id}`,
          staff?.full_name || (c.assigned_staff_id ? `Staff #${c.assigned_staff_id}` : 'Unassigned'),
          c.priority,
          c.status,
          c.created_at ? new Date(c.created_at).toISOString() : '',
        ];
      })
    );
  };

  const startEntry = complaints.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, complaints.length);

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Complaints Registry</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage, track, and assign campus maintenance requests and facility tickets.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link to="/admin/dashboard">
            <Button variant="secondary" size="sm" className="h-9 whitespace-nowrap px-3 text-xs font-medium">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Dashboard
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 whitespace-nowrap px-3 text-xs font-medium"
            onClick={handleExportCsv}
            disabled={loading || complaints.length === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="h-9 whitespace-nowrap px-3.5 text-xs font-semibold"
            onClick={() => fetchComplaints({ silent: true })}
            disabled={loading || refreshing}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* 5 Summary Metric Cards */}
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Total Tickets</span>
            <span className="h-2 w-2 rounded-full bg-gray-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-gray-900">{summary.total}</span>
            <span className="text-xs font-medium text-emerald-600">{summary.open} open</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-900">Unassigned</span>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-amber-950">
              {summary.unassigned}
            </span>
            <span className="text-xs font-medium text-amber-700">Action needed</span>
          </div>
        </div>

        <div className="rounded-xl border border-red-200/80 bg-red-50/40 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-900">High / Urgent</span>
            <span className="h-2 w-2 rounded-full bg-red-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-red-950">{summary.urgent}</span>
            <span className="text-xs font-medium text-red-700">Immediate</span>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-900">In Progress</span>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-blue-950">
              {summary.inProgress}
            </span>
            <span className="text-xs font-medium text-blue-700">Active tasks</span>
          </div>
        </div>

        <div className="col-span-2 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 shadow-2xs sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-900">Resolved</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-emerald-950">
              {summary.resolved}
            </span>
            <span className="text-xs font-medium text-emerald-700">
              {summary.resolutionRate}% rate
            </span>
          </div>
        </div>
      </div>

      {/* Single-Row Non-Wrapping Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12 lg:items-center">
          <div className="sm:col-span-2 lg:col-span-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search title, location, student..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-9 text-xs text-gray-900 placeholder:text-gray-400 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 sm:inline-block">
                /
              </kbd>
            </div>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by status"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="invalid">Invalid / Not Found</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by category"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by priority"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Urgent / Critical</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 sm:col-span-2 lg:col-span-2">
            <select
              aria-label="Filter by assignee"
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              value={assigneeFilter || ''}
              onChange={(e) => setAssigneeFilter(e.target.value)}
            >
              <option value="">All Staff</option>
              <option value="unassigned">Unassigned</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={String(staff.id)}>
                  {staff.full_name}
                </option>
              ))}
            </select>

            <Button
              variant="secondary"
              onClick={clearFilters}
              className="h-9 w-9 shrink-0 p-0"
              disabled={!hasFilters}
              title="Reset all filters"
              aria-label="Reset all filters"
            >
              <FilterX className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}
      {actionError && <Alert type="error" message={actionError} />}
      {actionSuccess && <Alert type="success" message={actionSuccess} />}

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary-200 bg-primary-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-900">
            <span>{selectedIds.length} ticket{selectedIds.length === 1 ? '' : 's'} selected</span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs font-medium text-primary-700 underline hover:text-primary-900"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Bulk assign staff"
              value={bulkStaffId}
              onChange={(e) => setBulkStaffId(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 focus:border-emerald-600 focus:outline-none"
            >
              <option value="">Assign staff...</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={String(staff.id)}>
                  {staff.full_name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleBulkAssign}
              disabled={!bulkStaffId || bulkUpdating}
            >
              Assign Selected
            </Button>

            <select
              aria-label="Bulk update status"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 focus:border-emerald-600 focus:outline-none"
            >
              <option value="">Set status...</option>
              <option value="submitted">Submitted</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="invalid">Invalid / Not Found</option>
            </select>
            <Button
              size="sm"
              variant="primary"
              onClick={handleBulkStatusUpdate}
              disabled={!bulkStatus || bulkUpdating}
            >
              Update Status
            </Button>
          </div>
        </div>
      )}

      {/* List / Empty State */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Spinner size={32} />
        </div>
      ) : complaints.length === 0 ? (
        <Card className="border-dashed bg-gray-50/70">
          <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-2xs ring-1 ring-gray-200">
              {hasFilters ? (
                <Search className="h-5 w-5 text-gray-400" />
              ) : (
                <Inbox className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              {hasFilters ? 'No matching complaints' : 'No complaints found'}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              {hasFilters
                ? 'Try adjusting or clearing your filters to see more complaints.'
                : 'Maintenance complaints submitted by students will appear here.'}
            </p>
            <div className="mt-4">
              {hasFilters ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  <FilterX className="mr-1.5 h-4 w-4" />
                  Reset Filters
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fetchComplaints({ silent: true })}
                >
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  Refresh
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-2xs">
          {/* Table Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Active Records</h2>
              <span className="text-xs text-gray-500">
                (Showing {startEntry}–{endEntry} of {complaints.length} complaint
                {complaints.length === 1 ? '' : 's'})
              </span>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all complaints on page"
                      checked={allPageSelected}
                      onChange={toggleSelectAllPage}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Complaint Details &amp; Location
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Assigned Staff
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    SLA / Reported
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {paginatedComplaints.map((complaint) => {
                  const assignedStaff = complaint.assigned_staff_id
                    ? staffById.get(String(complaint.assigned_staff_id))
                    : null;
                  const catStyle = CATEGORY_STYLES[complaint.category] || CATEGORY_STYLES.other;
                  const CatIcon = catStyle.icon;
                  const prioStyle = PRIORITY_STYLES[complaint.priority] || PRIORITY_STYLES.medium;
                  const sla = getSlaHint(complaint);
                  const isUnassignedSubmitted =
                    !complaint.assigned_staff_id && complaint.status === 'submitted';

                  return (
                    <tr
                      key={complaint.id}
                      className="transition-colors hover:bg-gray-50/80"
                    >
                      <td className="px-4 py-3.5 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Select complaint #${complaint.id}`}
                          checked={selectedIds.includes(complaint.id)}
                          onChange={() => toggleSelectRow(complaint.id)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 text-xs font-semibold text-gray-400">
                              #CF-{complaint.id}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(complaint.id)}
                              className="line-clamp-1 text-left text-sm font-semibold text-gray-900 hover:text-emerald-700"
                            >
                              {complaint.title}
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-gray-400" />
                              <span className="max-w-[160px] truncate">{complaint.location}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span>
                                Student:{' '}
                                <span className="font-medium text-gray-700">
                                  {complaint.student?.full_name || `ID: ${complaint.student_id}`}
                                </span>
                              </span>
                              {(complaint.invalid_complaint_count || 0) >= 2 && (
                                <span
                                  className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700"
                                  title="Repeat invalid/prank flag"
                                >
                                  {complaint.invalid_complaint_count} Invalid
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${catStyle.badge}`}
                        >
                          <CatIcon className="h-3.5 w-3.5" />
                          {getCategoryLabel(complaint.category)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${prioStyle.classes}`}
                        >
                          {prioStyle.dot && (
                            <span className={`h-1.5 w-1.5 rounded-full ${prioStyle.dot}`} />
                          )}
                          {prioStyle.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {isUnassignedSubmitted ? (
                          <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                            Unassigned
                          </span>
                        ) : (
                          <StatusBadge status={complaint.status} />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {assignedStaff ? (
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
                              {getInitials(assignedStaff.full_name)}
                            </span>
                            <span className="max-w-[130px] truncate text-xs font-medium text-gray-800">
                              {assignedStaff.full_name}
                            </span>
                          </div>
                        ) : quickAssignId === complaint.id ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              aria-label={`Assign staff to #${complaint.id}`}
                              defaultValue=""
                              disabled={assigningId === complaint.id}
                              onChange={(e) => handleQuickAssign(complaint.id, e.target.value)}
                              className="h-8 w-36 rounded-md border border-emerald-500 bg-white px-2 text-xs text-gray-800 focus:outline-none"
                            >
                              <option value="">Select staff...</option>
                              {staffList.map((staff) => (
                                <option key={staff.id} value={String(staff.id)}>
                                  {staff.full_name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setQuickAssignId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setQuickAssignId(complaint.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Quick Assign
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="flex flex-col text-xs">
                          <span className="font-medium text-gray-800">
                            {formatRelativeTime(complaint.created_at)}
                          </span>
                          <span className={`text-[11px] font-medium ${sla.tone}`}>{sla.text}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(complaint.id)}
                            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                            title="Quick View"
                            aria-label={`Quick view complaint #${complaint.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <Link
                            to={`/admin/complaints/${complaint.id}`}
                            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                            title="Open full complaint page"
                            aria-label={`Manage complaint #${complaint.id}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="divide-y divide-gray-100 md:hidden">
            {paginatedComplaints.map((complaint) => {
              const assignedStaff = complaint.assigned_staff_id
                ? staffById.get(String(complaint.assigned_staff_id))
                : null;
              const prioStyle = PRIORITY_STYLES[complaint.priority] || PRIORITY_STYLES.medium;

              return (
                <div key={complaint.id} className="p-4 transition-colors hover:bg-gray-50/70">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        aria-label={`Select complaint #${complaint.id}`}
                        checked={selectedIds.includes(complaint.id)}
                        onChange={() => toggleSelectRow(complaint.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600"
                      />
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold text-gray-400">
                          #CF-{complaint.id}
                        </span>
                        <h3 className="truncate text-sm font-semibold text-gray-900">
                          {complaint.title}
                        </h3>
                      </div>
                    </div>
                    <StatusBadge status={complaint.status} />
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 pl-6 text-xs text-gray-500">
                    <span className="truncate">{getCategoryLabel(complaint.category)}</span>
                    <span className="truncate">{complaint.location}</span>
                    <span className="truncate">
                      Student: {complaint.student?.full_name || `ID: ${complaint.student_id}`}
                    </span>
                    <span className="truncate">
                      Staff: {assignedStaff?.full_name || 'Unassigned'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between pl-6">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${prioStyle.classes}`}
                    >
                      {prioStyle.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDetail(complaint.id)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        View
                      </Button>
                      <Link to={`/admin/complaints/${complaint.id}`}>
                        <Button variant="secondary" size="sm">
                          Manage
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                Showing <span className="font-semibold text-gray-700">{startEntry}</span> to{' '}
                <span className="font-semibold text-gray-700">{endEntry}</span> of{' '}
                <span className="font-semibold text-gray-700">{complaints.length}</span> entries
              </span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:border-emerald-600 focus:outline-none"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-xs font-medium text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <ComplaintDetailDrawer
        open={detailOpen}
        complaintId={detailComplaintId}
        onClose={handleCloseDetail}
        onAssign={() => fetchComplaints({ silent: true })}
        onPriorityUpdate={() => fetchComplaints({ silent: true })}
      />
    </div>
  );
};
