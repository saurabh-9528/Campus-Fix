import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { complaintApi } from '../../api/complaints';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { PlusCircle, FileText, CheckCircle2, Clock, Inbox, RefreshCw } from 'lucide-react';

export const StudentDashboard = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const data = await complaintApi.getMyComplaints();
        setComplaints(data);
      } catch (err) {
        setError(err.message || 'Failed to load complaints');
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

  const total = complaints.length;
  const pending = complaints.filter(c => c.status === 'submitted' || c.status === 'assigned').length;
  const inProgress = complaints.filter(c => c.status === 'in_progress').length;
  const resolved = complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length;

  const recentComplaints = complaints.slice(0, 5); // Assuming already ordered by recent

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-50 to-white p-8 sm:p-10 rounded-[2rem] border border-primary-100/50 flex flex-col md:flex-row justify-between items-start md:items-center space-y-6 md:space-y-0 shadow-sm relative overflow-hidden">
        {/* Decorative background shape */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
        <div className="absolute -bottom-24 -right-8 w-48 h-48 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40"></div>
        
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Good morning, <span className="text-primary-600">{user?.full_name?.split(' ')[0]}</span> 👋
          </h1>
          <p className="text-base text-gray-600 mt-2 font-medium max-w-lg">
            Welcome to the CampusFix Student Portal. Track and manage your campus complaints efficiently.
          </p>
        </div>
        <Link to="/student/complaints/new" className="relative z-10 w-full md:w-auto">
          <Button variant="primary" size="lg" className="w-full md:w-auto shadow-md rounded-2xl">
            <PlusCircle className="mr-2 h-5 w-5" />
            + Report an Issue
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-[1.5rem] border-0 ring-1 ring-primary-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <div className="h-14 w-14 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center shrink-0 mb-3">
              <FileText className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap mb-1">Total Complaints</p>
            <p className="text-4xl font-extrabold text-gray-900">{total}</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-[1.5rem] border-0 ring-1 ring-orange-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <div className="h-14 w-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0 mb-3">
              <Clock className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap mb-1">Pending</p>
            <p className="text-4xl font-extrabold text-gray-900">{pending}</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-[1.5rem] border-0 ring-1 ring-purple-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <div className="h-14 w-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0 mb-3">
              <RefreshCw className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap mb-1">In Progress</p>
            <p className="text-4xl font-extrabold text-gray-900">{inProgress}</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-[1.5rem] border-0 ring-1 ring-green-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <div className="h-14 w-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center shrink-0 mb-3">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap mb-1">Resolved</p>
            <p className="text-4xl font-extrabold text-gray-900">{resolved}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Complaints */}
      <div className="pt-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Recent Complaints</h2>
          {recentComplaints.length > 0 && (
            <Link to="/student/complaints" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
              View All &rarr;
            </Link>
          )}
        </div>
        
        {recentComplaints.length === 0 ? (
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-12 flex flex-col items-center text-center">
            <div className="h-24 w-24 bg-primary-50 text-primary-300 rounded-full flex items-center justify-center mb-6">
              <Inbox className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No complaints yet</h3>
            <p className="text-gray-500 mt-2 max-w-sm mb-8 text-sm">
              Report an issue around campus and track its progress here. Our team is ready to help!
            </p>
            <Link to="/student/complaints/new">
              <Button variant="primary" size="lg" className="rounded-2xl shadow-md px-8">
                + Create Your First Complaint
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {recentComplaints.map(complaint => (
                <div key={complaint.id} className="p-5 sm:p-6 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-4">
                    <div className="h-10 w-10 bg-gray-100 text-gray-500 rounded-xl flex items-center justify-center shrink-0 mt-1">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3 mb-1">
                        <h3 className="text-base font-bold text-gray-900">
                          {complaint.title}
                        </h3>
                        <StatusBadge status={complaint.status} />
                      </div>
                      <div className="text-sm text-gray-500 font-medium flex items-center space-x-2">
                        <span>{complaint.category}</span>
                        <span>&bull;</span>
                        <span className="truncate">{complaint.location}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6 sm:pl-4">
                    <div className="text-right flex flex-col items-start sm:items-end">
                      <PriorityBadge priority={complaint.priority} />
                      <p className="text-xs font-medium text-gray-400 mt-2">
                        {new Date(complaint.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <Link to={`/student/complaints/${complaint.id}`}>
                      <Button variant="secondary" size="sm" className="rounded-lg shadow-none">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
