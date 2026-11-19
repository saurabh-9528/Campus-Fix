import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { staffApi } from '../../api/staff';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Wrench, FilterX } from 'lucide-react';
import { getCategoryLabel, CATEGORY_OPTIONS } from '../../utils/categories';

export const ComplaintList = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setLoading(true);
        const data = await staffApi.getAssignedComplaints();
        
        let filtered = data;
        if (statusFilter) filtered = filtered.filter(c => c.status === statusFilter);
        if (priorityFilter) filtered = filtered.filter(c => c.priority === priorityFilter);
        if (categoryFilter) filtered = filtered.filter(c => c.category === categoryFilter);
        
        setComplaints(filtered);
      } catch (err) {
        setError(err.message || 'Failed to load assigned complaints');
      } finally {
        setLoading(false);
      }
    };
    
    fetchComplaints();
  }, [statusFilter, priorityFilter, categoryFilter]);

  const clearFilters = () => {
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Assigned Complaints</h1>
        <p className="text-sm text-gray-600 mt-1">Review and resolve your pending tasks.</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full sm:w-auto flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select 
                className="w-full rounded-md border border-gray-300 h-10 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            
            <div className="w-full sm:w-auto flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
              <select 
                className="w-full rounded-md border border-gray-300 h-10 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select 
                className="w-full rounded-md border border-gray-300 h-10 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
              className="w-full sm:w-auto"
              disabled={!statusFilter && !priorityFilter && !categoryFilter}
            >
              <FilterX className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {error && <Alert type="error" message={error} />}
      
      {loading ? (
        <div className="flex justify-center p-12"><Spinner size={32} /></div>
      ) : complaints.length === 0 ? (
        <Card className="bg-gray-50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Wrench className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No complaints found</h3>
            <p className="text-gray-500 mt-1 max-w-sm mb-6">
              You have no assignments matching these filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Complaint</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {complaints.map(complaint => (
                  <tr key={complaint.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900 truncate max-w-[300px]">{complaint.title}</span>
                        <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                          <span className="capitalize">{getCategoryLabel(complaint.category)}</span>
                          <span>•</span>
                          <span className="truncate max-w-[200px]">{complaint.location}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <PriorityBadge priority={complaint.priority} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={complaint.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link to={`/staff/complaints/${complaint.id}`}>
                        <Button variant={complaint.status === 'assigned' || complaint.status === 'in_progress' ? "primary" : "secondary"} size="sm">
                          {complaint.status === 'assigned' ? 'Start' : complaint.status === 'in_progress' ? 'Resolve' : 'View'}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-200">
            {complaints.map(complaint => (
              <div key={complaint.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-semibold text-gray-900 truncate pr-2">{complaint.title}</h3>
                  <StatusBadge status={complaint.status} />
                </div>
                <div className="flex flex-col space-y-1 text-xs text-gray-500 mb-3">
                  <span className="capitalize">Category: {getCategoryLabel(complaint.category)}</span>
                  <span>Location: {complaint.location}</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <PriorityBadge priority={complaint.priority} />
                  <Link to={`/staff/complaints/${complaint.id}`}>
                    <Button variant={complaint.status === 'assigned' || complaint.status === 'in_progress' ? "primary" : "secondary"} size="sm">
                      {complaint.status === 'assigned' ? 'Start' : complaint.status === 'in_progress' ? 'Resolve' : 'View'}
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
