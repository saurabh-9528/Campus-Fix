import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { staffApi } from '../../api/staff';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { CheckCircle2, Clock, Inbox, Wrench } from 'lucide-react';

export const StaffDashboard = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const data = await staffApi.getAssignedComplaints();
        setComplaints(data);
      } catch (err) {
        setError(err.message || 'Failed to load assigned complaints');
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  if (loading) {
    return <div className="flex justify-center p-12"><Spinner size={32} /></div>;
  }

  if (error) {
    return <Alert type="error" message={error} />;
  }

  const assigned = complaints.filter(c => c.status === 'assigned').length;
  const inProgress = complaints.filter(c => c.status === 'in_progress').length;
  const resolved = complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length;

  // Sort complaints: assigned/in_progress first, then resolved
  const sortedComplaints = [...complaints].sort((a, b) => {
    const priorityMap = { 'assigned': 1, 'in_progress': 2, 'resolved': 3, 'closed': 4 };
    const pA = priorityMap[a.status] || 5;
    const pB = priorityMap[b.status] || 5;
    return pA - pB;
  });

  const recentComplaints = sortedComplaints.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage and resolve your assigned campus complaints.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Inbox className="h-8 w-8 text-primary-400 mb-2" />
            <p className="text-3xl font-bold text-primary-600">{assigned}</p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Clock className="h-8 w-8 text-warning mb-2" />
            <p className="text-3xl font-bold text-amber-600">{inProgress}</p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col items-center text-center">
            <CheckCircle2 className="h-8 w-8 text-success mb-2" />
            <p className="text-3xl font-bold text-green-600">{resolved}</p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Complaints List */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Active Assignments</h2>
          <Link to="/staff/complaints">
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </div>
        
        {recentComplaints.length === 0 ? (
          <Card className="bg-gray-50 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Wrench className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No complaints assigned</h3>
              <p className="text-gray-500 mt-1 max-w-sm mb-6">
                New complaints assigned to you will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {recentComplaints.map(complaint => (
              <Card key={complaint.id} className="hover:shadow-md transition-shadow border-l-4" style={{
                borderLeftColor: complaint.status === 'in_progress' ? '#f59e0b' : 
                                 complaint.status === 'assigned' ? '#4f46e5' : '#e5e7eb'
              }}>
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {complaint.title}
                      </h3>
                      <StatusBadge status={complaint.status} />
                    </div>
                    <div className="text-sm text-gray-500 flex items-center space-x-2">
                      <span className="capitalize">{complaint.category.replace('_', ' ')}</span>
                      <span>•</span>
                      <span className="truncate">{complaint.location}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto space-x-4">
                    <div className="text-right">
                      <PriorityBadge priority={complaint.priority} />
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(complaint.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Link to={`/staff/complaints/${complaint.id}`}>
                      <Button variant={complaint.status === 'assigned' || complaint.status === 'in_progress' ? "primary" : "secondary"} size="sm">
                        {complaint.status === 'assigned' ? 'Start' : complaint.status === 'in_progress' ? 'Resolve' : 'View'}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
