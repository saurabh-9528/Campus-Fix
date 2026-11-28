import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { staffApi } from '../../api/staff';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { getCategoryLabel } from '../../utils/categories';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Inbox,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Wrench,
} from 'lucide-react';

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

export const StaffDashboard = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [error, setError] = useState(null);

  const fetchComplaints = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await staffApi.getAssignedComplaints();
      setComplaints(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load assigned complaints');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleStartWork = async (complaint) => {
    if (startingId !== null) return;
    setStartingId(complaint.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await staffApi.updateComplaintStatus(complaint.id, { status: 'in_progress' });
      setActionSuccess(`Started work on #${complaint.id} (${complaint.title}).`);
      await fetchComplaints({ silent: true });
    } catch (err) {
      setActionError(err.message || 'Failed to start work on ticket');
    } finally {
      setStartingId(null);
    }
  };

  const stats = useMemo(() => {
    const total = complaints.length;
    const assigned = complaints.filter((c) => c.status === 'assigned').length;
    const inProgress = complaints.filter((c) => c.status === 'in_progress').length;
    const highUrgent = complaints.filter(
      (c) =>
        (c.status === 'assigned' || c.status === 'in_progress') &&
        (c.priority === 'high' || c.priority === 'critical')
    ).length;
    const resolved = complaints.filter(
      (c) => c.status === 'resolved' || c.status === 'closed'
    ).length;
    const completionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, assigned, inProgress, highUrgent, resolved, completionRate };
  }, [complaints]);

  const activeAssignments = useMemo(() => {
    return complaints
      .filter((c) => c.status === 'assigned' || c.status === 'in_progress')
      .sort((a, b) => {
        const rankA = PRIORITY_RANK[a.priority] ?? 9;
        const rankB = PRIORITY_RANK[b.priority] ?? 9;
        if (rankA !== rankB) return rankA - rankB;
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      })
      .slice(0, 6);
  }, [complaints]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return <Alert type="error" message={error} />;
  }

  const firstName = user?.full_name?.split(' ')[0] || 'Technician';

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
      {/* Header & Quick Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Review your assigned campus maintenance queue and complete field inspections.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 whitespace-nowrap px-3 text-xs font-medium"
            onClick={() => fetchComplaints({ silent: true })}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Link to="/staff/complaints">
            <Button
              variant="primary"
              size="sm"
              className="h-9 whitespace-nowrap px-3.5 text-xs font-semibold"
            >
              Assigned Complaints
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* 4-Card Workload KPI Strip */}
      <div className="grid w-full grid-cols-2 gap-4 lg:grid-cols-4">
        <Link
          to="/staff/complaints?status=assigned"
          className="group rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-emerald-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Assigned</span>
            <Inbox className="h-4 w-4 text-gray-400 group-hover:text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-gray-900">
              {stats.assigned}
            </span>
            <span className="text-xs text-gray-500">Ready to start</span>
          </div>
        </Link>

        <Link
          to="/staff/complaints?status=in_progress"
          className="group rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 shadow-2xs transition-all hover:border-blue-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-900">In Progress</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-blue-950">
              {stats.inProgress}
            </span>
            <span className="text-xs font-medium text-blue-700">Active work</span>
          </div>
        </Link>

        <Link
          to="/staff/complaints?priority=critical"
          className="group rounded-xl border border-red-200/80 bg-red-50/40 p-4 shadow-2xs transition-all hover:border-red-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-900">High / Critical</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-red-950">
              {stats.highUrgent}
            </span>
            <span className="text-xs font-medium text-red-700">Urgent open</span>
          </div>
        </Link>

        <Link
          to="/staff/complaints?status=resolved"
          className="group rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-2xs transition-all hover:border-emerald-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-900">Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-950">
              {stats.resolved}
            </span>
            <span className="text-xs font-medium text-emerald-700">
              {stats.completionRate}% completed
            </span>
          </div>
        </Link>
      </div>

      {/* 12-Column Content Layout */}
      {actionError && (
        <Alert type="error" message={actionError} onClose={() => setActionError(null)} />
      )}
      {actionSuccess && (
        <Alert type="success" message={actionSuccess} onClose={() => setActionSuccess(null)} />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Active Assignments */}
        <div className="lg:col-span-8">
          <Card className="border border-slate-200 shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">Active Assignments</CardTitle>
                  {stats.highUrgent > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      {stats.highUrgent} urgent
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  Prioritized by urgency (Critical &amp; High priority tickets first).
                </p>
              </div>
              <Link
                to="/staff/complaints"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                View All
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>

            {activeAssignments.length === 0 ? (
              <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Wrench className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">No active assignments</h3>
                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  All assigned tasks are resolved or none have been dispatched to you yet.
                </p>
                <Link to="/staff/complaints" className="mt-4">
                  <Button variant="secondary" size="sm" className="h-9 px-4 text-xs">
                    View Historical Assignments
                  </Button>
                </Link>
              </CardContent>
            ) : (
              <CardContent className="divide-y divide-slate-100 p-0">
                {activeAssignments.map((complaint) => {
                  const dateLabel = new Date(
                    complaint.updated_at || complaint.created_at
                  ).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  const hasCoords =
                    (complaint.latitude !== undefined &&
                      complaint.latitude !== null &&
                      complaint.longitude !== undefined &&
                      complaint.longitude !== null) ||
                    /\(-?\d+\.\d+,\s*-?\d+\.\d+\)/.test(complaint.location || '');

                  return (
                    <div
                      key={complaint.id}
                      className="flex flex-col justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-gray-400">
                            #{complaint.id}
                          </span>
                          <Link
                            to={`/staff/complaints/${complaint.id}`}
                            className="truncate text-sm font-semibold text-gray-900 hover:text-emerald-700"
                          >
                            {complaint.title}
                          </Link>
                          <StatusBadge status={complaint.status} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          <span className="capitalize">{getCategoryLabel(complaint.category)}</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            <span className="truncate">{complaint.location}</span>
                          </span>
                          {hasCoords && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                              Pin attached
                            </span>
                          )}
                          <span>Updated {dateLabel}</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                        <PriorityBadge priority={complaint.priority} />
                        {complaint.status === 'assigned' && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 px-2.5 text-xs"
                            disabled={startingId !== null}
                            onClick={() => handleStartWork(complaint)}
                          >
                            {startingId === complaint.id ? 'Starting...' : 'Start Work'}
                          </Button>
                        )}
                        <Link to={`/staff/complaints/${complaint.id}`}>
                          <Button variant="primary" size="sm" className="h-8 px-3 text-xs">
                            Open Ticket
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right: Completion Summary & Inspection Checklist */}
        <div className="space-y-5 lg:col-span-4">
          <Card className="border border-slate-200 shadow-2xs">
            <CardHeader className="border-b border-slate-100 py-4">
              <CardTitle className="text-base">Completion Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-gray-600">
                  Resolution rate ({stats.resolved} / {stats.total} assigned)
                </span>
                <span className="text-lg font-bold text-emerald-700">
                  {stats.completionRate}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                  <p className="text-gray-500">Open Queue</p>
                  <p className="mt-0.5 text-base font-bold text-gray-900">
                    {stats.assigned + stats.inProgress}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5">
                  <p className="text-emerald-800">Resolved</p>
                  <p className="mt-0.5 text-base font-bold text-emerald-900">{stats.resolved}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-2xs">
            <CardHeader className="border-b border-slate-100 py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                Field Inspection Checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs text-gray-600">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <p>Verify the exact room, floor, and equipment condition on-site before starting.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <p>Log clear resolution notes detailing parts replaced or repairs completed.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <p>
                  If no issue exists on inspection, mark as{' '}
                  <span className="font-semibold text-gray-800">Invalid / Not Found</span> with a
                  brief verification reason.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
