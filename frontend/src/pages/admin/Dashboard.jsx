import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { SegmentedToggle } from '../../components/admin/SegmentedToggle';
import { BarList, TrendChart } from '../../components/admin/AnalyticsCharts';
import { UserFormModal } from '../../components/admin/UserFormModal';
import { ComplaintDetailDrawer } from './ComplaintDetailDrawer';
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Eye,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Star,
  Upload,
  UserPlus,
} from 'lucide-react';
import { getCategoryLabel } from '../../utils/categories';
import {
  getAnalyticsTotals,
  getCategoryItems,
  getInitials,
} from '../../utils/analytics';

const TREND_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

export const AdminDashboard = () => {
  const [allComplaints, setAllComplaints] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [trendView, setTrendView] = useState('weekly');
  const [modal, setModal] = useState(null);

  // Quick assign & drawer state
  const [quickAssignId, setQuickAssignId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailComplaintId, setDetailComplaintId] = useState('');

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const [complaintsData, analyticsData, activeStaffData] = await Promise.all([
        adminApi.getAdminComplaints(),
        adminApi.getAnalytics(),
        adminApi.getStaff(false, false).catch(() => []),
      ]);
      setAllComplaints(complaintsData || []);
      setAnalytics(analyticsData);
      setStaffList(activeStaffData || []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const analyticsData = useMemo(() => analytics || {}, [analytics]);
  const totals = useMemo(() => getAnalyticsTotals(analyticsData), [analyticsData]);
  const categoryItems = useMemo(
    () => getCategoryItems(analyticsData.category_distribution || {}),
    [analyticsData.category_distribution]
  );
  const trendPoints = useMemo(() => {
    const source =
      trendView === 'daily' ? analyticsData.daily_trend : analyticsData.weekly_trend;
    return Array.isArray(source) ? source : [];
  }, [analyticsData.daily_trend, analyticsData.weekly_trend, trendView]);

  const kpiSummary = useMemo(() => {
    const total = allComplaints.length || totals.total;
    const unassigned = allComplaints.filter(
      (c) => !c.assigned_staff_id && c.status !== 'resolved' && c.status !== 'closed'
    ).length;
    const urgent = allComplaints.filter(
      (c) =>
        (c.priority === 'high' || c.priority === 'critical') &&
        c.status !== 'resolved' &&
        c.status !== 'closed'
    ).length;
    const inProgress =
      allComplaints.filter((c) => c.status === 'in_progress').length || totals.inProgress;
    const resolved =
      allComplaints.filter((c) => c.status === 'resolved' || c.status === 'closed').length ||
      totals.resolved;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, unassigned, urgent, inProgress, resolved, resolutionRate };
  }, [allComplaints, totals]);

  const actionQueue = useMemo(() => {
    const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };
    return allComplaints
      .filter(
        (c) =>
          c.status !== 'resolved' &&
          c.status !== 'closed' &&
          (!c.assigned_staff_id || c.priority === 'critical' || c.priority === 'high')
      )
      .sort((a, b) => {
        const aUnassigned = a.assigned_staff_id ? 1 : 0;
        const bUnassigned = b.assigned_staff_id ? 1 : 0;
        if (aUnassigned !== bUnassigned) return aUnassigned - bUnassigned;
        return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      })
      .slice(0, 6);
  }, [allComplaints]);

  const handleQuickAssign = async (complaintId, staffId) => {
    if (!staffId) return;
    setAssigningId(complaintId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await adminApi.assignStaff(complaintId, staffId);
      setQuickAssignId(null);
      const staff = staffList.find((s) => String(s.id) === String(staffId));
      setActionSuccess(
        `Assigned #CF-${complaintId} to ${staff?.full_name || 'staff member'}.`
      );
      await loadDashboard({ silent: true });
    } catch (err) {
      setActionError(err.message || 'Failed to assign staff');
    } finally {
      setAssigningId(null);
    }
  };

  const handleUserCreated = (result, userType, meta) => {
    setActionError(null);
    const label = userType === 'staff' ? 'staff' : 'student';
    if (meta?.bulk) {
      setActionSuccess(`Created ${result.created_count} ${label} account(s).`);
    } else {
      setActionSuccess(`Created ${label} account for ${result.full_name}.`);
    }
    loadDashboard({ silent: true });
  };

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

  const staffWorkload = totals.staff;

  return (
    <div className="w-full space-y-5">
      {/* Top Header & Quick Action Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Admin Dashboard</h1>
            {totals.averageRating !== null && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                <Star className="h-3.5 w-3.5 fill-current" />
                {Number(totals.averageRating).toFixed(1)} / 5
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Monitor campus maintenance operations, triage urgent tickets, and manage accounts.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 whitespace-nowrap px-3 text-xs font-medium"
            onClick={() => loadDashboard({ silent: true })}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 whitespace-nowrap px-3 text-xs font-medium"
            onClick={() => setModal({ userType: 'student', initialMode: 'single' })}
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            + Add Student
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 whitespace-nowrap px-3 text-xs font-medium"
            onClick={() => setModal({ userType: 'staff', initialMode: 'single' })}
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            + Add Staff
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 whitespace-nowrap px-3 text-xs font-medium"
            onClick={() => setModal({ userType: 'student', initialMode: 'bulk' })}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Bulk CSV
          </Button>
          <Link to="/admin/analytics">
            <Button
              variant="primary"
              size="sm"
              className="h-9 whitespace-nowrap px-3.5 text-xs font-semibold"
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              Analytics
            </Button>
          </Link>
        </div>
      </div>

      {actionError && (
        <Alert type="error" message={actionError} onClose={() => setActionError(null)} />
      )}
      {actionSuccess && (
        <Alert type="success" message={actionSuccess} onClose={() => setActionSuccess(null)} />
      )}

      {/* Interactive 5-Card KPI Strip */}
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Link
          to="/admin/complaints"
          className="group rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition-all hover:border-emerald-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Total</span>
            <span className="h-2 w-2 rounded-full bg-gray-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-gray-900">
              {kpiSummary.total}
            </span>
            <span className="text-xs text-gray-500 group-hover:text-emerald-700">All tickets</span>
          </div>
        </Link>

        <Link
          to="/admin/complaints?assignee=unassigned"
          className="group rounded-xl border border-amber-200/80 bg-amber-50/40 p-3.5 shadow-2xs transition-all hover:border-amber-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-900">Unassigned</span>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-amber-950">
              {kpiSummary.unassigned}
            </span>
            <span className="text-xs font-medium text-amber-700">Needs dispatch</span>
          </div>
        </Link>

        <Link
          to="/admin/complaints?priority=critical"
          className="group rounded-xl border border-red-200/80 bg-red-50/40 p-3.5 shadow-2xs transition-all hover:border-red-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-900">High / Urgent</span>
            <span className="h-2 w-2 rounded-full bg-red-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-red-950">
              {kpiSummary.urgent}
            </span>
            <span className="text-xs font-medium text-red-700">Priority open</span>
          </div>
        </Link>

        <Link
          to="/admin/complaints?status=in_progress"
          className="group rounded-xl border border-blue-200/80 bg-blue-50/40 p-3.5 shadow-2xs transition-all hover:border-blue-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-900">In Progress</span>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-blue-950">
              {kpiSummary.inProgress}
            </span>
            <span className="text-xs font-medium text-blue-700">Active work</span>
          </div>
        </Link>

        <Link
          to="/admin/complaints?status=resolved"
          className="group col-span-2 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 shadow-2xs transition-all hover:border-emerald-300 hover:shadow-sm sm:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-900">Resolved</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-emerald-950">
              {kpiSummary.resolved}
            </span>
            <span className="text-xs font-medium text-emerald-700">
              {kpiSummary.resolutionRate}% rate
            </span>
          </div>
        </Link>
      </div>

      {/* Operations Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Action Queue & Trend */}
        <div className="space-y-5 lg:col-span-8">
          {/* Unassigned / Urgent Queue */}
          <Card className="border border-slate-200 shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 py-4">
              <div>
                <CardTitle className="text-base">Unassigned &amp; Urgent Queue</CardTitle>
                <p className="mt-0.5 text-xs text-gray-500">
                  Tickets awaiting staff assignment or marked high/urgent priority.
                </p>
              </div>
              <Link to="/admin/complaints">
                <Button variant="ghost" size="sm" className="text-xs">
                  View Registry
                  <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>

            {actionQueue.length === 0 ? (
              <CardContent className="flex flex-col items-center justify-center px-6 py-8 text-center">
                <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  {allComplaints.length === 0 ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {allComplaints.length === 0
                    ? 'No complaints submitted yet'
                    : 'Queue is clear'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {allComplaints.length === 0
                    ? 'Student maintenance tickets will appear here for triage.'
                    : 'All open complaints are assigned and within normal priority.'}
                </p>
              </CardContent>
            ) : (
              <CardContent className="divide-y divide-slate-100 p-0">
                {actionQueue.map((complaint) => {
                  const assignedStaff = complaint.assigned_staff_id
                    ? staffList.find((s) => String(s.id) === String(complaint.assigned_staff_id))
                    : null;

                  return (
                    <div
                      key={complaint.id}
                      className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-xs font-semibold text-gray-400">
                            #CF-{complaint.id}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDetailComplaintId(String(complaint.id));
                              setDetailOpen(true);
                            }}
                            className="truncate text-left text-sm font-semibold text-gray-900 hover:text-emerald-700"
                          >
                            {complaint.title}
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          <span className="capitalize">{getCategoryLabel(complaint.category)}</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            {complaint.location}
                          </span>
                          <span>
                            {complaint.student?.full_name || `Student #${complaint.student_id}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <PriorityBadge priority={complaint.priority} />
                        <StatusBadge status={complaint.status} />

                        {!complaint.assigned_staff_id ? (
                          quickAssignId === complaint.id ? (
                            <select
                              aria-label={`Quick assign staff to #CF-${complaint.id}`}
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
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 px-2.5 text-xs"
                              onClick={() => setQuickAssignId(complaint.id)}
                            >
                              + Quick Assign
                            </Button>
                          )
                        ) : (
                          <span className="text-xs font-medium text-gray-600">
                            {assignedStaff?.full_name || `Staff #${complaint.assigned_staff_id}`}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setDetailComplaintId(String(complaint.id));
                            setDetailOpen(true);
                          }}
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                          title="Open quick view"
                          aria-label={`View complaint #CF-${complaint.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>

          {/* Complaint Trend Preview */}
          <Card className="border border-slate-200 shadow-2xs">
            <CardHeader className="flex flex-col gap-3 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Complaint Trend</CardTitle>
                <p className="mt-0.5 text-xs text-gray-500">
                  Submitted vs. resolved volume over time.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedToggle
                  options={TREND_OPTIONS}
                  value={trendView}
                  onChange={setTrendView}
                  ariaLabel="Trend granularity"
                />
                <Link to="/admin/analytics">
                  <Button variant="ghost" size="sm" className="text-xs">
                    Full Analytics
                    <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <TrendChart
                points={trendPoints}
                granularity={trendView}
                height={210}
                compact
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: Category Breakdown & Staff Workload */}
        <div className="space-y-5 lg:col-span-4">
          <Card className="border border-slate-200 shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 py-4">
              <CardTitle className="text-base">Category Breakdown</CardTitle>
              <Link to="/admin/analytics">
                <Button variant="ghost" size="sm" className="text-xs">
                  Analytics
                  <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-4">
              <BarList
                items={categoryItems}
                total={totals.total}
                emptyTitle="No categories recorded"
              />
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 py-4">
              <CardTitle className="text-base">Staff Workload</CardTitle>
              <Link to="/admin/staff">
                <Button variant="ghost" size="sm" className="text-xs">
                  Manage Staff
                  <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="overflow-hidden p-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Staff Member
                    </th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Active
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {staffWorkload.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="px-5 py-6 text-center text-xs text-gray-500">
                        No active staff members.
                      </td>
                    </tr>
                  ) : (
                    staffWorkload.map((staff) => (
                      <tr key={staff.staff_id}>
                        <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-900">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
                              {getInitials(staff.staff_name)}
                            </span>
                            <span className="truncate text-xs font-medium">{staff.staff_name}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-xs font-medium">
                          {staff.active_complaints > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                              {staff.active_complaints}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>

      {modal && (
        <UserFormModal
          userType={modal.userType}
          initialMode={modal.initialMode}
          onClose={() => setModal(null)}
          onCreated={handleUserCreated}
        />
      )}

      <ComplaintDetailDrawer
        open={detailOpen}
        complaintId={detailComplaintId}
        onClose={() => {
          setDetailOpen(false);
          setDetailComplaintId('');
        }}
        onAssign={() => loadDashboard({ silent: true })}
        onPriorityUpdate={() => loadDashboard({ silent: true })}
      />
    </div>
  );
};
