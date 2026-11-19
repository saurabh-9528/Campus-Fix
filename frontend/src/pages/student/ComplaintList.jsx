import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { complaintApi } from '../../api/complaints';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { 
  PlusCircle, 
  Search, 
  FilterX, 
  FileText, 
  ClipboardList, 
  ArrowRight, 
  X,
  ListFilter,
  Zap,
  Droplets,
  Hammer,
  Sparkles,
  Wifi,
  MoreHorizontal
} from 'lucide-react';
import { getCategoryLabel, CATEGORY_OPTIONS } from '../../utils/categories';

export const ComplaintList = () => {
  const [allComplaints, setAllComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Tabs & Filters
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Fetch initial data once
  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setLoading(true);
        const data = await complaintApi.getMyComplaints();
        setAllComplaints(data);
      } catch (err) {
        setError(err.message || 'Failed to load complaints');
      } finally {
        setLoading(false);
      }
    };
    
    fetchComplaints();
  }, []);

  // Compute derived state based on tabs and filters
  const filteredComplaints = useMemo(() => {
    let result = allComplaints;

    // Apply Tab Filter
    if (activeTab === 'active') {
      result = result.filter(c => c.status === 'submitted' || c.status === 'assigned');
    } else if (activeTab === 'in_progress') {
      result = result.filter(c => c.status === 'in_progress');
    } else if (activeTab === 'resolved') {
      result = result.filter(c => c.status === 'resolved');
    } else if (activeTab === 'closed') {
      result = result.filter(c => c.status === 'closed');
    }

    // Apply Dropdown Filters
    if (statusFilter) result = result.filter(c => c.status === statusFilter);
    if (priorityFilter) result = result.filter(c => c.priority === priorityFilter);
    if (categoryFilter) result = result.filter(c => c.category === categoryFilter);

    return result;
  }, [allComplaints, activeTab, statusFilter, priorityFilter, categoryFilter]);

  // Compute tab counts
  const counts = useMemo(() => {
    return {
      all: allComplaints.length,
      active: allComplaints.filter(c => c.status === 'submitted' || c.status === 'assigned').length,
      in_progress: allComplaints.filter(c => c.status === 'in_progress').length,
      resolved: allComplaints.filter(c => c.status === 'resolved').length,
      closed: allComplaints.filter(c => c.status === 'closed').length,
    };
  }, [allComplaints]);

  const clearFilters = () => {
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
  };

  const getCategoryDetails = (category) => {
    switch (category?.toLowerCase()) {
      case 'electrical': return { icon: Zap, bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' };
      case 'water': return { icon: Droplets, bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' };
      case 'furniture': return { icon: Hammer, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' };
      case 'cleaning': return { icon: Sparkles, bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' };
      case 'internet': return { icon: Wifi, bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' };
      case 'classroom_equipment': return { icon: PlusCircle, bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' };
      default: return { icon: MoreHorizontal, bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' };
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12 px-2 sm:px-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 pb-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">MY COMPLAINTS</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Keep track of every issue you've reported across campus.</p>
        </div>
        <Link to="/student/complaints/new" className="w-full sm:w-auto">
          <Button variant="primary" className="w-full sm:w-auto rounded-xl shadow-md bg-emerald-600 hover:bg-emerald-700 text-white border-0 h-11 px-6">
            <PlusCircle className="mr-2 h-4 w-4" />
            + Report an Issue
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
        <div className="flex space-x-2 min-w-max" role="tablist">
          {[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'active', label: 'Active', count: counts.active },
            { id: 'in_progress', label: 'In Progress', count: counts.in_progress },
            { id: 'resolved', label: 'Resolved', count: counts.resolved },
            { id: 'closed', label: 'Closed', count: counts.closed }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center px-4 py-2 rounded-full text-sm font-bold transition-all
                  ${isActive 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'bg-transparent text-gray-600 hover:bg-white hover:shadow-sm'
                  }
                `}
              >
                {tab.label}
                <span className={`
                  ml-2 px-2 py-0.5 rounded-full text-xs font-bold
                  ${isActive ? 'bg-emerald-700 text-emerald-50' : 'bg-gray-100 text-gray-500'}
                `}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Section */}
      <Card className="rounded-[1.5rem] border border-emerald-100 shadow-sm bg-cream-50 overflow-hidden relative">
        {/* Subtle decorative background for filter block */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100 rounded-full blur-3xl opacity-30 -mr-20 -mt-20 pointer-events-none"></div>
        <CardContent className="p-5 relative z-10">
          <div className="flex items-center mb-4">
            <div className="h-8 w-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mr-3 shadow-sm border border-emerald-200">
              <ListFilter className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Filter & Refine</h2>
              <p className="text-xs font-medium text-gray-500">Find a complaint quickly.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full sm:w-auto flex-1">
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Status</label>
              <select 
                className="w-full rounded-xl border border-gray-200 bg-white h-10 px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-emerald-500 shadow-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            
            <div className="w-full sm:w-auto flex-1">
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Priority</label>
              <select 
                className="w-full rounded-xl border border-gray-200 bg-white h-10 px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-emerald-500 shadow-sm"
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

            <div className="w-full sm:w-auto flex-1">
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Category</label>
              <select 
                className="w-full rounded-xl border border-gray-200 bg-white h-10 px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-emerald-500 shadow-sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {CATEGORY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <Button 
              variant="secondary" 
              onClick={clearFilters}
              className="w-full sm:w-auto rounded-xl bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm font-bold h-10"
              disabled={!statusFilter && !priorityFilter && !categoryFilter}
            >
              <FilterX className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          </div>

          {/* Active Filter Chips */}
          {(statusFilter || priorityFilter || categoryFilter) && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-200/50">
              <span className="text-xs font-bold text-gray-500 mr-1 uppercase tracking-wider">Active:</span>
              {statusFilter && (
                <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg text-xs font-bold border border-emerald-200">
                  Status: {statusFilter.replace('_', ' ')}
                  <button onClick={() => setStatusFilter('')} className="hover:text-emerald-900 hover:bg-emerald-200 rounded p-0.5"><X className="h-3 w-3" /></button>
                </span>
              )}
              {priorityFilter && (
                <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-800 px-2.5 py-1 rounded-lg text-xs font-bold border border-orange-200">
                  Priority: {priorityFilter}
                  <button onClick={() => setPriorityFilter('')} className="hover:text-orange-900 hover:bg-orange-200 rounded p-0.5"><X className="h-3 w-3" /></button>
                </span>
              )}
              {categoryFilter && (
                <span className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-800 px-2.5 py-1 rounded-lg text-xs font-bold border border-purple-200">
                  Category: {getCategoryLabel(categoryFilter)}
                  <button onClick={() => setCategoryFilter('')} className="hover:text-purple-900 hover:bg-purple-200 rounded p-0.5"><X className="h-3 w-3" /></button>
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {error && <Alert type="error" message={error} />}
      
      {loading ? (
        <div className="flex justify-center p-12"><Spinner size={32} /></div>
      ) : allComplaints.length === 0 ? (
        // STATE A: User has NEVER created a complaint
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center mt-6" style={{ minHeight: '380px' }}>
          <div className="relative mb-6 mt-4">
            <div className="absolute inset-0 bg-emerald-100 rounded-full blur-2xl opacity-60"></div>
            <div className="relative h-20 w-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
              <ClipboardList className="h-8 w-8" />
            </div>
            {/* Small decorative shapes */}
            <div className="absolute -top-1 -right-3 h-5 w-5 bg-orange-100 rounded-full border-2 border-white shadow-sm"></div>
            <div className="absolute -bottom-1 -left-2 h-4 w-4 bg-purple-100 rounded-full border-2 border-white shadow-sm"></div>
          </div>
          <h3 className="text-xl font-bold text-gray-900">No complaints yet</h3>
          <p className="text-gray-500 mt-2 font-medium text-sm max-w-sm px-4">
            You haven't reported any campus issues yet.
          </p>
          <p className="text-gray-500 mt-1 max-w-sm mb-6 text-sm px-4">
            Found something that needs attention? Report it and track its progress from here.
          </p>
          
          <Link to="/student/complaints/new">
            <Button variant="primary" className="rounded-xl shadow-md px-6 mb-2">
              + Report Your First Issue
            </Button>
          </Link>
          <p className="text-xs font-bold text-gray-400">It only takes a minute.</p>
        </div>
      ) : filteredComplaints.length === 0 ? (
        // STATE B: Filter/Tabs return zero results
        <div className="pt-2">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Your Complaints</h2>
            <span className="text-sm font-bold text-gray-500">0 complaints</span>
          </div>
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center p-12" style={{ minHeight: '320px' }}>
            <div className="h-16 w-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No matching complaints</h3>
            <p className="text-gray-500 mt-2 text-sm max-w-sm mb-6">
              Try changing your filters or selecting another tab to see your reports.
            </p>
            <Button variant="secondary" onClick={clearFilters} className="rounded-xl font-bold">
              <FilterX className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          </div>
        </div>
      ) : (
        // LIST STATE
        <div className="pt-2">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Your Complaints</h2>
            <span className="text-sm font-bold text-gray-500">
              Showing {filteredComplaints.length} of {allComplaints.length}
            </span>
          </div>
          
          <div className="space-y-4">
            {filteredComplaints.map(complaint => {
              const catDetails = getCategoryDetails(complaint.category);
              const CatIcon = catDetails.icon;
              return (
                <Link 
                  key={complaint.id} 
                  to={`/student/complaints/${complaint.id}`} 
                  className="group block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 p-5 sm:p-6 hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
                >
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    
                    {/* Left: Icon + Info */}
                    <div className="flex items-start space-x-4">
                      <div className={`h-12 w-12 ${catDetails.bg} ${catDetails.text} ${catDetails.border} border rounded-xl flex items-center justify-center shrink-0 transition-colors`}>
                        <CatIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-gray-900 group-hover:text-emerald-700 transition-colors mb-1">
                          {complaint.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <StatusBadge status={complaint.status} />
                        </div>
                        <div className="text-sm font-semibold text-gray-500 flex flex-wrap items-center gap-2">
                          <span className="capitalize">{getCategoryLabel(complaint.category)}</span>
                          <span className="text-gray-300 hidden sm:inline">&bull;</span>
                          <span className="text-gray-600 truncate max-w-[200px] sm:max-w-none">{complaint.location}</span>
                          <span className="text-gray-300 hidden sm:inline">&bull;</span>
                          <span>{new Date(complaint.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Right: Priority & Action */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-between w-full sm:w-auto pl-0 sm:pl-4 border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-50 mt-2 sm:mt-0">
                      <PriorityBadge priority={complaint.priority} />
                      
                      <div className="flex items-center text-sm font-extrabold text-emerald-600 sm:text-gray-400 group-hover:text-emerald-600 transition-colors">
                        View Details 
                        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>

                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

