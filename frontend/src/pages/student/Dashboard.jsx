import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { complaintApi } from '../../api/complaints';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { getCategoryLabel } from '../../utils/categories';
import {
  Armchair,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Droplets,
  FileText,
  Inbox,
  Lightbulb,
  MapPin,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Wifi,
  Zap,
} from 'lucide-react';

const QUICK_CATEGORIES = [
  { value: 'electrical', label: 'Electrical', icon: Zap },
  { value: 'water', label: 'Plumbing / Water', icon: Droplets },
  { value: 'internet', label: 'IT / Network', icon: Wifi },
  { value: 'furniture', label: 'Carpentry', icon: Armchair },
  { value: 'cleaning', label: 'Cleaning', icon: Sparkles },
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export const StudentDashboard = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const data = await complaintApi.getMyComplaints();
        setComplaints(data || []);
      } catch (err) {
        setError(err.message || 'Failed to load complaints');
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  const stats = useMemo(() => {
    const total = complaints.length;
    const pending = complaints.filter(
      (c) => c.status === 'submitted' || c.status === 'assigned'
    ).length;
    const inProgress = complaints.filter((c) => c.status === 'in_progress').length;
    const resolved = complaints.filter(
      (c) => c.status === 'resolved' || c.status === 'closed'
    ).length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, pending, inProgress, resolved, resolutionRate };
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

  const recentComplaints = complaints.slice(0, 5);
  const firstName = user?.full_name?.split(' ')[0] || 'Student';

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
      {/* Hero Greeting & Primary Actions */}
      <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/90 via-white to-slate-50 p-6 shadow-2xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {getGreeting()}, <span className="text-emerald-700">{firstName}</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-gray-600">
              Report campus maintenance issues, attach photos, and track real-time repair progress.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Link to="/student/complaints">
              <Button variant="secondary" size="sm" className="h-9 px-3.5 text-xs font-medium">
                My Complaints
              </Button>
            </Link>
            <Link to="/student/complaints/new">
              <Button variant="primary" size="sm" className="h-9 px-4 text-xs font-semibold">
                <PlusCircle className="mr-1.5 h-4 w-4" />
                + Report an Issue
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Report by Category Strip */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Quick Report by Category
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.value}
                to={`/student/complaints/new?category=${cat.value}`}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs font-medium text-gray-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50/70 hover:text-emerald-800"
              >
                <Icon className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="truncate">{cat.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 4 Status Summary Cards */}
      <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
        <Link
          to="/student/complaints"
          className="group rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-emerald-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Total Complaints</span>
            <FileText className="h-4 w-4 text-gray-400 group-hover:text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-gray-900">{stats.total}</span>
            <span className="text-xs text-gray-500">All submitted</span>
          </div>
        </Link>

        <Link
          to="/student/complaints?tab=active"
          className="group rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-2xs transition-all hover:border-amber-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-900">Pending</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-amber-950">
              {stats.pending}
            </span>
            <span className="text-xs font-medium text-amber-700">Awaiting work</span>
          </div>
        </Link>

        <Link
          to="/student/complaints?tab=in_progress"
          className="group rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 shadow-2xs transition-all hover:border-blue-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-900">In Progress</span>
            <RefreshCw className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-blue-950">
              {stats.inProgress}
            </span>
            <span className="text-xs font-medium text-blue-700">Being fixed</span>
          </div>
        </Link>

        <Link
          to="/student/complaints?tab=resolved"
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
              {stats.resolutionRate}% resolved
            </span>
          </div>
        </Link>
      </div>

      {/* Balanced Content Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Recent Complaints */}
        <div className="lg:col-span-8">
          <Card className="border border-slate-200 shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 py-4">
              <div>
                <CardTitle className="text-base">Recent Complaints</CardTitle>
                <p className="mt-0.5 text-xs text-gray-500">
                  Your latest submitted maintenance tickets and their current status.
                </p>
              </div>
              {recentComplaints.length > 0 && (
                <Link
                  to="/student/complaints"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  View All
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </CardHeader>

            {recentComplaints.length === 0 ? (
              <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Inbox className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">No complaints yet</h3>
                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  Report an issue around campus and track its progress here. Our maintenance team is
                  ready to help!
                </p>
                <Link to="/student/complaints/new" className="mt-4">
                  <Button variant="primary" size="sm" className="h-9 px-4 text-xs font-semibold">
                    + Create Your First Complaint
                  </Button>
                </Link>
              </CardContent>
            ) : (
              <CardContent className="divide-y divide-slate-100 p-0">
                {recentComplaints.map((complaint) => (
                  <div
                    key={complaint.id}
                    className="flex flex-col justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400">
                          #{complaint.id}
                        </span>
                        <h3 className="truncate text-sm font-semibold text-gray-900">
                          {complaint.title}
                        </h3>
                        <StatusBadge status={complaint.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="capitalize">{getCategoryLabel(complaint.category)}</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span className="truncate">{complaint.location}</span>
                        </span>
                        <span>
                          {new Date(complaint.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                      <PriorityBadge priority={complaint.priority} />
                      <Link to={`/student/complaints/${complaint.id}`}>
                        <Button variant="secondary" size="sm" className="h-8 px-3 text-xs">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right: Resolution Progress & Reporting Tips */}
        <div className="space-y-5 lg:col-span-4">
          <Card className="border border-slate-200 shadow-2xs">
            <CardHeader className="border-b border-slate-100 py-4">
              <CardTitle className="text-base">Resolution Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-gray-600">Completion rate</span>
                <span className="text-lg font-bold text-emerald-700">
                  {stats.resolutionRate}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${stats.resolutionRate}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                  <p className="text-gray-500">Active</p>
                  <p className="mt-0.5 text-base font-bold text-gray-900">
                    {stats.pending + stats.inProgress}
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
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Reporting Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs text-gray-600">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <p>Include exact building, floor, and room number so technicians arrive faster.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <p>Attach a clear photo of the issue when submitting to help with triage.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <p>Once resolved, leave feedback to help improve campus response times.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
