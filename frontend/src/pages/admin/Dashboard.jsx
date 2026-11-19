import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { FileText, CheckCircle2, Clock, Inbox, ShieldCheck, Star } from 'lucide-react';
import { getCategoryLabel, CATEGORY_OPTIONS } from '../../utils/categories';

export const AdminDashboard = () => {
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [complaintsData, analyticsData] = await Promise.all([
          adminApi.getAdminComplaints(5), // Fetch only recent 5 complaints
          adminApi.getAnalytics()
        ]);
        setRecentComplaints(complaintsData);
        setAnalytics(analyticsData);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="flex justify-center p-12"><Spinner size={32} /></div>;
  }

  if (error) {
    return <Alert type="error" message={error} />;
  }

  const {
    total_complaints: total,
    status_distribution,
    category_distribution,
    average_feedback_rating,
    staff_workload
  } = analytics;

  const pending = (status_distribution['submitted'] || 0) + (status_distribution['assigned'] || 0);
  const inProgress = status_distribution['in_progress'] || 0;
  const resolved = (status_distribution['resolved'] || 0) + (status_distribution['closed'] || 0);

  const categories = CATEGORY_OPTIONS.map(opt => opt.value);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor and manage campus maintenance complaints.
          </p>
        </div>
        {average_feedback_rating !== null && (
          <div className="flex items-center space-x-2 bg-yellow-50 text-yellow-700 px-4 py-2 rounded-lg font-medium shadow-sm border border-yellow-100">
            <Star className="h-5 w-5 fill-current" />
            <span>Avg Rating: {average_feedback_rating.toFixed(1)} / 5</span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 flex flex-col items-center text-center">
            <FileText className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-3xl font-bold text-gray-900">{total}</p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Inbox className="h-8 w-8 text-primary-400 mb-2" />
            <p className="text-3xl font-bold text-primary-600">{pending}</p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Pending</p>
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
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Resolved/Closed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Complaints */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Complaints</h2>
            <Link to="/admin/complaints">
              <Button variant="ghost" size="sm">View All Complaints</Button>
            </Link>
          </div>
          
          {recentComplaints.length === 0 ? (
            <Card className="bg-gray-50 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ShieldCheck className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No complaints found</h3>
                <p className="text-gray-500 mt-1">
                  The system currently has no complaints.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Complaint</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentComplaints.map(complaint => (
                      <tr key={complaint.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{complaint.title}</span>
                            <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                              <span className="capitalize">{getCategoryLabel(complaint.category)}</span>
                              <span>•</span>
                              <PriorityBadge priority={complaint.priority} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{complaint.student?.full_name || `ID: ${complaint.student_id}`}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={complaint.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link to={`/admin/complaints/${complaint.id}`}>
                            <Button variant="secondary" size="sm">View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-200">
                {recentComplaints.map(complaint => (
                  <div key={complaint.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate pr-2">{complaint.title}</h3>
                      <StatusBadge status={complaint.status} />
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500 mb-2">
                      <span>{complaint.student?.full_name || `ID: ${complaint.student_id}`}</span>
                      <span>•</span>
                      <span className="capitalize">{getCategoryLabel(complaint.category)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <PriorityBadge priority={complaint.priority} />
                      <Link to={`/admin/complaints/${complaint.id}`}>
                        <Button variant="secondary" size="sm">View</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Analytics */}
        <div className="space-y-6">
          {/* Category Overview */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Category Overview</h2>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {categories.map(category => {
                    const count = category_distribution[category] || 0;
                    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={category}>
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-sm font-medium text-gray-700 capitalize">{getCategoryLabel(category)}</span>
                          <span className="text-sm text-gray-500">{count} ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary-500 h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Staff Workload */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Staff Workload</h2>
            <Card>
              <CardContent className="p-0 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Active Tasks</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {staff_workload.length === 0 ? (
                      <tr>
                        <td colSpan="2" className="px-6 py-4 text-center text-sm text-gray-500">
                          No active staff members.
                        </td>
                      </tr>
                    ) : (
                      staff_workload.map(staff => (
                        <tr key={staff.staff_id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {staff.staff_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                            {staff.active_complaints > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
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

      </div>
    </div>
  );
};
