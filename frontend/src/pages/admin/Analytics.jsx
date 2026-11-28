import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { KpiCard } from '../../components/admin/KpiCard';
import { SegmentedToggle } from '../../components/admin/SegmentedToggle';
import { BarList, DonutChart, TrendChart } from '../../components/admin/AnalyticsCharts';
import { downloadCsv } from '../../utils/csv';
import {
  countOf,
  formatHours,
  formatNumber,
  formatPercent,
  getAnalyticsTotals,
  getCategoryItems,
  getInitials,
  getPriorityItems,
  getRecentTrendTotals,
  getStaffResolutionRate,
  getStatusItems,
  getTrendTotals,
  sumDistribution,
} from '../../utils/analytics';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Gauge,
  RefreshCw,
  Star,
  Timer,
  UserPlus,
  Users,
} from 'lucide-react';

const todayStamp = () => new Date().toISOString().slice(0, 10);

const TREND_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

const SummaryStat = ({ label, value, detail }) => (
  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
    <p className="mt-1 text-xl font-bold tracking-tight text-gray-900">{value}</p>
    {detail && <p className="mt-0.5 text-[11px] text-gray-500">{detail}</p>}
  </div>
);

export const AdminAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [trendView, setTrendView] = useState('weekly');

  const loadAnalytics = useCallback(async () => {
    const data = await adminApi.getAnalytics();
    setAnalytics(data);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        const data = await adminApi.getAnalytics();
        if (active) setAnalytics(data);
      } catch (err) {
        if (active) setError(err.message || 'Failed to load analytics');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await loadAnalytics();
    } catch (err) {
      setError(err.message || 'Failed to refresh analytics');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportStaff = () => {
    setActionError(null);
    setActionSuccess(null);
    const staff = analytics?.staff_workload || [];
    if (!staff.length) {
      setActionError('There is no staff performance data to export yet.');
      return;
    }

    try {
      downloadCsv(
        `campusfix-staff-performance-${todayStamp()}.csv`,
        [
          'Staff ID',
          'Staff Name',
          'Active Tasks',
          'Resolved Complaints',
          'Total Assigned',
          'Resolution Rate (%)',
        ],
        staff.map((member) => [
          member.staff_id,
          member.staff_name,
          member.active_complaints,
          member.resolved_complaints ?? 0,
          member.total_assigned ?? 0,
          getStaffResolutionRate(member),
        ])
      );
      setActionSuccess(`Exported performance data for ${staff.length} staff member(s).`);
    } catch (err) {
      setActionError(err.message || 'Failed to export staff performance.');
    }
  };

  const analyticsData = useMemo(() => analytics || {}, [analytics]);
  const totals = useMemo(() => getAnalyticsTotals(analyticsData), [analyticsData]);
  const statusItems = useMemo(
    () => getStatusItems(analyticsData.status_distribution || {}),
    [analyticsData.status_distribution]
  );
  const priorityItems = useMemo(
    () => getPriorityItems(analyticsData.priority_distribution || {}),
    [analyticsData.priority_distribution]
  );
  const categoryItems = useMemo(
    () => getCategoryItems(analyticsData.category_distribution || {}),
    [analyticsData.category_distribution]
  );
  const dailyTrend = useMemo(
    () => (Array.isArray(analyticsData.daily_trend) ? analyticsData.daily_trend : []),
    [analyticsData.daily_trend]
  );
  const weeklyTrend = useMemo(
    () => (Array.isArray(analyticsData.weekly_trend) ? analyticsData.weekly_trend : []),
    [analyticsData.weekly_trend]
  );
  const trendPoints = trendView === 'daily' ? dailyTrend : weeklyTrend;
  const trendTotals = useMemo(() => getTrendTotals(trendPoints), [trendPoints]);
  const weekTotals = useMemo(() => getRecentTrendTotals(dailyTrend, 7), [dailyTrend]);
  const categoryTotal = sumDistribution(analyticsData.category_distribution || {});
  const priorityDistribution = analyticsData.priority_distribution || {};
  const priorityTotal = sumDistribution(priorityDistribution);
  const criticalHigh =
    countOf(priorityDistribution.critical) + countOf(priorityDistribution.high);
  const criticalHighPercent =
    priorityTotal > 0 ? Math.round((criticalHigh / priorityTotal) * 100) : 0;
  const staffWorkload = totals.staff;
  const totalAssignedToStaff = staffWorkload.reduce(
    (sum, member) => sum + countOf(member.total_assigned),
    0
  );
  const averageRating =
    totals.averageRating !== null && Number.isFinite(Number(totals.averageRating))
      ? Number(totals.averageRating).toFixed(1)
      : '—';

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size={32} />
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="space-y-4">
        <Alert type="error" message={error} />
        <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Try again
        </Button>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Total Complaints',
      value: formatNumber(totals.total),
      detail: `${formatNumber(totals.open)} currently open`,
      icon: FileText,
      tone: 'primary',
    },
    {
      label: 'Resolution Rate',
      value: formatPercent(totals.resolutionRate),
      detail: `${formatNumber(totals.resolved)} resolved or closed`,
      icon: CheckCircle2,
      tone: 'green',
    },
    {
      label: 'Avg. Resolution Time',
      value: formatHours(totals.averageResolutionHours),
      detail: averageRating === '—' ? 'Based on status history' : `Avg rating ${averageRating} / 5`,
      icon: Timer,
      tone: 'purple',
    },
    {
      label: 'Open / High-Urgent',
      value: formatNumber(totals.open),
      detail: `${formatNumber(criticalHigh)} high or critical priority`,
      icon: AlertTriangle,
      tone: 'amber',
    },
  ];

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
            Understand complaint volume, resolution performance, and staff capacity.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-2xs">
              <Gauge className="h-3.5 w-3.5 text-emerald-600" />
              {formatPercent(totals.resolutionRate)} resolution rate
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-2xs">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              {formatNumber(weekTotals.resolved)} resolved this week
            </span>
            {averageRating !== '—' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                <Star className="h-3.5 w-3.5 fill-current" />
                {averageRating} / 5 rating
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link to="/admin/dashboard">
            <Button
              variant="secondary"
              size="sm"
              className="h-9 whitespace-nowrap px-3 text-xs font-medium"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Dashboard
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 whitespace-nowrap px-3 text-xs font-medium"
            onClick={handleExportStaff}
            disabled={!staffWorkload.length}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="h-9 whitespace-nowrap px-3.5 text-xs font-semibold"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}
      {actionError && <Alert type="error" message={actionError} />}
      {actionSuccess && <Alert type="success" message={actionSuccess} />}

      <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Card className="h-full">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Complaint Volume & Resolution
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Submitted complaints compared with resolutions over time.
                </p>
              </div>
              <SegmentedToggle
                options={TREND_OPTIONS}
                value={trendView}
                onChange={setTrendView}
                ariaLabel="Trend granularity"
              />
            </div>
            <div className="p-5">
              <TrendChart points={trendPoints} granularity={trendView} height={250} />
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SummaryStat
                  label="Submitted in range"
                  value={formatNumber(trendTotals.submitted)}
                  detail={trendView === 'daily' ? 'Last 30 days' : 'Last 8 weeks'}
                />
                <SummaryStat
                  label="Resolved in range"
                  value={formatNumber(trendTotals.resolved)}
                  detail="Resolved or closed"
                />
                <SummaryStat
                  label="Resolution coverage"
                  value={
                    trendTotals.submitted > 0
                      ? formatPercent((trendTotals.resolved / trendTotals.submitted) * 100)
                      : '—'
                  }
                  detail="Resolved vs. submitted"
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-4">
          <Card className="h-full">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Status Breakdown</h2>
              <p className="mt-0.5 text-xs text-gray-500">Where complaints currently sit.</p>
            </div>
            <div className="p-5">
              <DonutChart
                segments={statusItems}
                total={totals.total}
                centerLabel="Complaints"
                centerValue={formatNumber(totals.total)}
                emptyTitle="No complaints yet"
                emptyDescription="Status distribution will appear after the first complaint is submitted."
              />
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Open workload
                  </p>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {formatNumber(totals.open)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Completed
                  </p>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {formatNumber(totals.resolved)}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="h-full">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">Category Distribution</h2>
            <p className="mt-0.5 text-xs text-gray-500">Complaint mix by maintenance category.</p>
          </div>
          <div className="p-5">
            <DonutChart
              segments={categoryItems}
              total={categoryTotal}
              centerLabel="Complaints"
              centerValue={formatNumber(categoryTotal)}
              emptyTitle="No category data yet"
              emptyDescription="Category distribution will appear after the first complaint is submitted."
            />
          </div>
        </Card>

        <Card className="h-full">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">Priority Breakdown</h2>
            <p className="mt-0.5 text-xs text-gray-500">Urgency mix across all complaints.</p>
          </div>
          <div className="p-5">
            <BarList
              items={priorityItems}
              emptyTitle="No priority data yet"
              emptyDescription="Priority distribution will appear after the first complaint is submitted."
            />
            {priorityTotal > 0 && (
              <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50/70 p-3.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <div>
                    <p className="text-xs font-semibold text-amber-900">
                      {formatNumber(criticalHigh)} critical or high-priority complaint(s)
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-amber-700">
                      {formatPercent(criticalHighPercent)} of all complaints need urgent attention.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Staff Workload & Resolution</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Active assignments, completed work, and resolution rates by staff member.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportStaff}
            disabled={!staffWorkload.length}
          >
            <Download className="mr-2 h-4 w-4" />
            Export performance
          </Button>
        </div>

        {staffWorkload.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="rounded-2xl bg-gray-50 p-4">
              <Users className="h-9 w-9 text-gray-300" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-900">No active staff</h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Add staff accounts so complaints can be assigned and resolution performance can be
              tracked.
            </p>
            <Link to="/admin/staff" className="mt-5">
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Manage Staff
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      Staff Member
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      Active
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      Resolved
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      Total Assigned
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      Resolution Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {staffWorkload.map((member) => {
                    const active = countOf(member.active_complaints);
                    const resolved = countOf(member.resolved_complaints);
                    const totalAssigned = countOf(member.total_assigned);
                    const resolutionRate = getStaffResolutionRate(member);
                    return (
                      <tr key={member.staff_id} className="transition-colors hover:bg-gray-50/70">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700 ring-1 ring-primary-100">
                              {getInitials(member.staff_name)}
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {member.staff_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              active > 0
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {active}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-gray-700">{resolved}</td>
                        <td className="px-5 py-4 text-sm text-gray-500">{totalAssigned}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-primary-500"
                                style={{ width: `${resolutionRate}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-700">
                              {resolutionRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-100 md:hidden">
              {staffWorkload.map((member) => {
                const active = countOf(member.active_complaints);
                const resolved = countOf(member.resolved_complaints);
                const totalAssigned = countOf(member.total_assigned);
                const resolutionRate = getStaffResolutionRate(member);
                return (
                  <div key={member.staff_id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700 ring-1 ring-primary-100">
                          {getInitials(member.staff_name)}
                        </div>
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {member.staff_name}
                        </p>
                      </div>
                      <span
                        className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          active > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {active} active
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-gray-500">Resolved</p>
                        <p className="mt-0.5 font-semibold text-gray-900">{resolved}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Assigned</p>
                        <p className="mt-0.5 font-semibold text-gray-900">{totalAssigned}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Resolution</p>
                        <p className="mt-0.5 font-semibold text-gray-900">{resolutionRate}%</p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{ width: `${resolutionRate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {formatNumber(totalAssignedToStaff)} total assignments across{' '}
                {formatNumber(staffWorkload.length)} active staff member(s).
              </span>
              <Link
                to="/admin/staff"
                className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:text-primary-800"
              >
                Manage staff
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
