import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { staffApi } from '../../api/staff';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { ActivityTimeline } from '../../components/ui/ActivityTimeline';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { getCategoryLabel } from '../../utils/categories';
import { ArrowLeft, MapPin, Calendar, LayoutGrid, AlertCircle, MessageSquare, User, Wrench } from 'lucide-react';

export const ComplaintDetails = () => {
  const { id } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [history, setHistory] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Status workflow state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  
  // Resolution state
  const [resolutionNote, setResolutionNote] = useState('');

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const data = await staffApi.getAssignedComplaint(id);
      setComplaint(data);
      try {
        const historyData = await staffApi.getHistory(id);
        setHistory(historyData);
      } catch (hErr) {
        console.error("Failed to fetch history", hErr);
      }
    } catch (err) {
      setError(err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleStartWorking = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await staffApi.updateComplaintStatus(id, { status: 'in_progress' });
      await fetchDetails();
    } catch (err) {
      setActionError(err.message || 'Failed to update status');
      setActionLoading(false);
    }
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!resolutionNote.trim()) {
      setActionError("Resolution note is required.");
      return;
    }
    
    setActionLoading(true);
    setActionError(null);
    try {
      await staffApi.updateComplaintStatus(id, { 
        status: 'resolved',
        resolution_note: resolutionNote
      });
      await fetchDetails();
    } catch (err) {
      setActionError(err.message || 'Failed to resolve complaint');
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Spinner size={32} /></div>;
  }

  if (error || !complaint) {
    return (
      <div className="space-y-4">
        <Link to="/staff/complaints">
          <Button variant="secondary"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Complaints</Button>
        </Link>
        <Alert type="error" message={error || "Complaint not found"} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center space-x-4 mb-6">
        <Link to="/staff/complaints" className="text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Details</h1>
          <p className="text-sm text-gray-600">ID: #{complaint.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">{complaint.title}</h2>
                <StatusBadge status={complaint.status} />
              </div>
              
              <p className="text-gray-700 whitespace-pre-wrap mb-6">
                {complaint.description}
              </p>

              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div className="flex items-center text-gray-600">
                  <LayoutGrid className="mr-2 h-4 w-4 text-gray-400" />
                  <span className="font-medium mr-2">Category:</span>
                  <span className="capitalize">{getCategoryLabel(complaint.category)}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <MapPin className="mr-2 h-4 w-4 text-gray-400" />
                  <span className="font-medium mr-2">Location:</span>
                  <span>{complaint.location}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <AlertCircle className="mr-2 h-4 w-4 text-gray-400" />
                  <span className="font-medium mr-2">Priority:</span>
                  <PriorityBadge priority={complaint.priority} />
                </div>
                <div className="flex items-center text-gray-600">
                  <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                  <span className="font-medium mr-2">Submitted:</span>
                  <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {complaint.image_url && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Attached Image</h3>
                  <div className="mb-2">
                    <img src={complaint.image_url} alt="Complaint Attachment" className="max-w-full h-auto max-h-96 rounded-md shadow-sm border border-gray-200" />
                  </div>
                  <a href={complaint.image_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-sm break-all">
                    {complaint.image_url}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Student Info */}
          <Card>
            <CardHeader className="pb-3 border-b border-gray-100">
              <CardTitle className="text-base flex items-center">
                <User className="h-5 w-5 mr-2 text-gray-400" />
                Student Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold uppercase">
                  {complaint.student?.full_name?.charAt(0) || 'S'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{complaint.student?.full_name || 'Unknown'}</p>
                  <p className="text-sm text-gray-500">{complaint.student?.email || `Student ID: ${complaint.student_id}`}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workflow Actions */}
          <div className="space-y-4">
            {actionError && <Alert type="error" message={actionError} />}
            
            {/* 1. Start Working */}
            {complaint.status === 'assigned' && (
              <Card className="border-primary-200 bg-primary-50/30">
                <CardContent className="p-6 flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Start Resolution</h3>
                    <p className="text-gray-600 text-sm">Mark this task as In Progress to begin work.</p>
                  </div>
                  <Button 
                    variant="primary" 
                    onClick={handleStartWorking} 
                    disabled={actionLoading}
                    className="w-full sm:w-auto"
                  >
                    {actionLoading ? 'Starting...' : 'Start Working'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* 2. Resolve Complaint Form */}
            {complaint.status === 'in_progress' && (
              <Card className="border-warning/30 shadow-sm">
                <CardHeader className="bg-warning/10 border-b border-warning/20 pb-4">
                  <CardTitle className="text-amber-800 flex items-center">
                    <Wrench className="h-5 w-5 mr-2" />
                    Complete Task
                  </CardTitle>
                  <p className="text-sm text-amber-700">Provide resolution details before marking as resolved.</p>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleResolve} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Note <span className="text-red-500">*</span></label>
                      <textarea
                        required
                        className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        rows={4}
                        placeholder="Detail what was fixed, parts replaced, etc."
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                      />
                    </div>
                    
                    <div className="flex justify-end">
                      <Button type="submit" disabled={actionLoading}>
                        {actionLoading ? 'Saving...' : 'Mark as Resolved'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* 3. Read-only Resolution */}
            {(complaint.status === 'resolved' || complaint.status === 'closed') && complaint.resolution_note && (
              <Card className="border-success/20 bg-green-50/30">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-2">
                    <MessageSquare className="mr-2 h-5 w-5 text-success" />
                    Resolution Note
                  </h3>
                  <p className="text-gray-700">{complaint.resolution_note}</p>
                </CardContent>
              </Card>
            )}

            {/* 4. Closed Notice */}
            {complaint.status === 'closed' && (
              <Alert type="success" message="This complaint has been closed by the student." />
            )}
          </div>
        </div>

        {/* Right Col: Timeline */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline history={history} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
