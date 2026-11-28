import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { complaintApi } from '../../api/complaints';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Droplets,
  FilterX,
  Hammer,
  MapPin,
  Monitor,
  MoreHorizontal,
  PlusCircle,
  Search,
  Sparkles,
  Wifi,
  Zap,
} from 'lucide-react';
import { getCategoryLabel, CATEGORY_OPTIONS } from '../../utils/categories';

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

const getCategoryDetails = (category) => {
  switch (category?.toLowerCase()) {
    case 'electrical':
      return { icon: Zap, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200/80' };
    case 'water':
      return { icon: Droplets, bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200/80' };
    case 'furniture':
      return { icon: Hammer, bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200/80' };
    case 'cleaning':
      return { icon: Sparkles, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80' };
    case 'internet':
      return { icon: Wifi, bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200/80' };
    case 'classroom_equipment':
      return { icon: Monitor, bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200/80' };
    default:
      return { icon: MoreHorizontal, bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
  }
};

export const ComplaintList = () => {
  const [searchParams] = useSearchParams();
  const [allComplaints, setAllComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tabs, Search, Filters & Sort
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setLoading(true);
        const data = await complaintApi.getMyComplaints();
        setAllComplaints(data || []);
      } catch (err) {
        setError(err.message || 'Failed to load complaints');
      } finally {
        setLoading(false);
      }
    };

    fetchComplaints();
  }, []);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setStatusFilter('');
  };

  const handleStatusDropdownChange = (value) => {
    setStatusFilter(value);
    if (value === 'submitted' || value === 'assigned') {
      setActiveTab('active');
    } else if (value === 'in_progress' || value === 'invalid') {
      setActiveTab(value);
    } else if (value === 'resolved' || value === 'closed') {
      setActiveTab('resolved');
    } else {
      setActiveTab('all');
    }
  };

  const filteredComplaints = useMemo(() => {
    let result = allComplaints;

    if (activeTab === 'active') {
      result = result.filter((c) => c.status === 'submitted' || c.status === 'assigned');
    } else if (activeTab === 'in_progress') {
      result = result.filter((c) => c.status === 'in_progress');
    } else if (activeTab === 'resolved') {
      result = result.filter((c) => c.status === 'resolved' || c.status === 'closed');
    } else if (activeTab === 'invalid') {
      result = result.filter((c) => c.status === 'invalid');
    }

    if (statusFilter) result = result.filter((c) => c.status === statusFilter);
    if (priorityFilter) result = result.filter((c) => c.priority === priorityFilter);
    if (categoryFilter) result = result.filter((c) => c.category === categoryFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          String(c.id).includes(q) ||
          c.title?.toLowerCase().includes(q) ||
          c.location?.toLowerCase().includes(q)
      );
    }

    const sorted = [...result];
    if (sortBy === 'oldest') {
      sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sortBy === 'priority') {
      sorted.sort(
        (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
      );
    } else {
      sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return sorted;
  }, [
    allComplaints,
    activeTab,
    statusFilter,
    priorityFilter,
    categoryFilter,
    searchQuery,
    sortBy,
  ]);

  const counts = useMemo(
    () => ({
      all: allComplaints.length,
      active: allComplaints.filter((c) => c.status === 'submitted' || c.status === 'assigned')
        .length,
      in_progress: allComplaints.filter((c) => c.status === 'in_progress').length,
      resolved: allComplaints.filter((c) => c.status === 'resolved' || c.status === 'closed')
        .length,
      invalid: allComplaints.filter((c) => c.status === 'invalid').length,
    }),
    [allComplaints]
  );

  const hasFilters = Boolean(
    activeTab !== 'all' || searchQuery || statusFilter || priorityFilter || categoryFilter
  );

  const clearFilters = () => {
    setActiveTab('all');
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setSortBy('newest');
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Complaints</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track every maintenance issue you have reported across campus.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link to="/student/dashboard">
            <Button
              variant="secondary"
              size="sm"
              className="h-9 whitespace-nowrap px-3 text-xs font-medium"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Dashboard
            </Button>
          </Link>
          <Link to="/student/complaints/new">
            <Button
              variant="primary"
              size="sm"
              className="h-9 whitespace-nowrap px-3.5 text-xs font-semibold"
            >
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              + Report an Issue
            </Button>
          </Link>
        </div>
      </div>

      {/* Synced Status Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2" role="tablist">
          {[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'active', label: 'Pending', count: counts.active },
            { id: 'in_progress', label: 'In Progress', count: counts.in_progress },
            { id: 'resolved', label: 'Resolved', count: counts.resolved },
            { id: 'invalid', label: 'Invalid / Not Found', count: counts.invalid },
          ].map((pill) => {
            const isActive = activeTab === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(pill.id)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                    : 'border-slate-200 bg-white text-gray-600 hover:bg-slate-50 hover:text-gray-900'
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                    isActive ? 'bg-emerald-700 text-emerald-50' : 'bg-slate-100 text-gray-600'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>

        {!loading && (
          <span className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{filteredComplaints.length}</span>{' '}
            of <span className="font-semibold text-gray-700">{allComplaints.length}</span>
          </span>
        )}
      </div>

      {/* Single-Row Filter & Sort Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12 lg:items-center">
          <div className="sm:col-span-2 lg:col-span-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search title, location, or #ID..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by status"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              value={statusFilter}
              onChange={(e) => handleStatusDropdownChange(e.target.value)}
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
              aria-label="Filter by priority"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
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

          <div className="flex items-center gap-1.5 sm:col-span-2 lg:col-span-2">
            <select
              aria-label="Sort complaints"
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="priority">Priority</option>
            </select>

            <Button
              variant="secondary"
              onClick={clearFilters}
              className="h-9 w-9 shrink-0 p-0"
              disabled={!hasFilters && sortBy === 'newest'}
              title="Clear filters"
              aria-label="Clear filters"
            >
              <FilterX className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* List / Empty State */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Spinner size={32} />
        </div>
      ) : allComplaints.length === 0 ? (
        <Card className="border-dashed bg-gray-50/70">
          <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-2xs ring-1 ring-gray-200">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No complaints yet</h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Report your first campus maintenance issue and track its resolution progress here.
            </p>
            <Link to="/student/complaints/new" className="mt-4">
              <Button variant="primary" size="sm" className="h-9 px-4 text-xs font-semibold">
                <PlusCircle className="mr-1.5 h-4 w-4" />
                + Report Your First Issue
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : filteredComplaints.length === 0 ? (
        <Card className="border-dashed bg-gray-50/70">
          <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-2xs ring-1 ring-gray-200">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No matching complaints</h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Try adjusting your search or filter criteria to see more tickets.
            </p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={clearFilters}>
              <FilterX className="mr-1.5 h-4 w-4" />
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="divide-y divide-slate-100">
            {filteredComplaints.map((complaint) => {
              const cat = getCategoryDetails(complaint.category);
              const CatIcon = cat.icon;
              const dateLabel = new Date(
                complaint.updated_at || complaint.created_at
              ).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={complaint.id}
                  className="flex flex-col justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-gray-400">
                        #{complaint.id}
                      </span>
                      <Link
                        to={`/student/complaints/${complaint.id}`}
                        className="truncate text-sm font-semibold text-gray-900 hover:text-emerald-700"
                      >
                        {complaint.title}
                      </Link>
                      <StatusBadge status={complaint.status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${cat.bg} ${cat.text} ${cat.border}`}
                      >
                        <CatIcon className="h-3 w-3" />
                        {getCategoryLabel(complaint.category)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <span className="truncate">{complaint.location}</span>
                      </span>
                      <span>Updated {dateLabel}</span>
                    </div>

                    {/* Compact Stage Progress Indicator */}
                    {complaint.status === 'invalid' ? (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-red-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        <span>Submitted</span>
                        <span className="text-red-300">→</span>
                        <span className="font-semibold">Invalid / Not Found</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {[
                          { key: 'submitted', label: 'Submitted' },
                          { key: 'assigned', label: 'Assigned' },
                          { key: 'in_progress', label: 'In Progress' },
                          { key: 'resolved', label: 'Resolved' },
                        ].map((step, index) => {
                          const stageRank = {
                            submitted: 0,
                            assigned: 1,
                            in_progress: 2,
                            resolved: 3,
                            closed: 3,
                          };
                          const currentRank = stageRank[complaint.status] ?? 0;
                          const isReached = currentRank >= index;
                          return (
                            <React.Fragment key={step.key}>
                              {index > 0 && (
                                <span
                                  className={isReached ? 'text-emerald-400' : 'text-gray-300'}
                                >
                                  →
                                </span>
                              )}
                              <span
                                className={
                                  isReached
                                    ? 'font-semibold text-emerald-700'
                                    : 'text-gray-400'
                                }
                              >
                                {step.label}
                              </span>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}

                    {complaint.resolution_note &&
                      (complaint.status === 'invalid' ||
                        complaint.status === 'resolved' ||
                        complaint.status === 'closed') && (
                        <p
                          className={`rounded-md border px-2.5 py-1 text-xs ${
                            complaint.status === 'invalid'
                              ? 'border-red-200/80 bg-red-50/60 text-red-800'
                              : 'border-emerald-200/70 bg-emerald-50/50 text-emerald-900'
                          }`}
                        >
                          <span className="font-semibold">
                            {complaint.status === 'invalid'
                              ? 'Verification note:'
                              : 'Resolution note:'}
                          </span>{' '}
                          {complaint.resolution_note}
                        </p>
                      )}
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                    <PriorityBadge priority={complaint.priority} />
                    <Link to={`/student/complaints/${complaint.id}`}>
                      <Button variant="secondary" size="sm" className="h-8 px-3 text-xs">
                        View
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
