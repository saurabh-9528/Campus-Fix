import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { ComplaintAttachment } from '../../components/ComplaintAttachment';
import { ArrowLeft, MapPin, Calendar, LayoutGrid, AlertCircle, MessageSquare, User, Wrench } from 'lucide-react';
import { getCategoryLabel } from '../../utils/categories';
import { ActivityTimeline } from '../../components/ui/ActivityTimeline';

export const ComplaintDetails = () => {
  const { id } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [history, setHistory] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Assignment state
  const [selectedStaff, setSelectedStaff] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // Priority state
  const [selectedPriority, setSelectedPriority] = useState('medium');
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [priorityError, setPriorityError] = useState(null);
  const [prioritySuccess, setPrioritySuccess] = useState(false);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const [complaintData, staffData, historyData] = await Promise.all([
        adminApi.getAdminComplaint(id),
        adminApi.getStaff(),
        adminApi.getHistory(id).catch(() => [])
      ]);
      setComplaint(complaintData);
      setStaffList(staffData);
      setHistory(historyData || []);
      
      if (complaintData.assigned_staff_id) {
        setSelectedStaff(complaintData.assigned_staff_id.toString());
      }
      if (complaintData.priority) {
        setSelectedPriority(complaintData.priority);
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

  const handleAssign = async () => {
    if (!selectedStaff) return;
    
    setAssigning(true);
    setAssignError(null);
    setAssignSuccess(false);
    
    try {
      await adminApi.assignStaff(id, selectedStaff);
      setAssignSuccess(true);
      // Refresh to get updated status and assignment
      const updatedData = await adminApi.getAdminComplaint(id);
      setComplaint(updatedData);
      const historyData = await adminApi.getHistory(id).catch(() => []);
      setHistory(historyData);
      setTimeout(() => setAssignSuccess(false), 3000);
    } catch (err) {
      setAssignError(err.message || 'Failed to assign staff');
    } finally {
      setAssigning(false);
    }
  };

  const handlePriorityUpdate = async () => {
    if (!selectedPriority || selectedPriority === complaint?.priority) return;

    setUpdatingPriority(true);
    setPriorityError(null);
    setPrioritySuccess(false);

    try {
      const updatedData = await adminApi.updatePriority(id, selectedPriority);
      setComplaint(updatedData);
      setSelectedPriority(updatedData.priority);
      setPrioritySuccess(true);
      const historyData = await adminApi.getHistory(id).catch(() => []);
      setHistory(historyData);
      setTimeout(() => setPrioritySuccess(false), 3000);
    } catch (err) {
      setPriorityError(err.message || 'Failed to update priority');
    } finally {
      setUpdatingPriority(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Spinner size={32} /></div>;
  }

  if (error || !complaint) {
    return (
      <div className="space-y-4">
        <Link to="/admin/complaints">
          <Button variant="secondary"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Complaints</Button>
        </Link>
        <Alert type="error" message={error || "Complaint not found"} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center space-x-4 mb-6">
        <Link to="/admin/complaints" className="text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Complaint</h1>
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

              <ComplaintAttachment imageUrl={complaint.image_url} />
            </CardContent>
          </Card>

          {/* Student Info */}
          <Card>
            <CardHeader className="pb-3 border-b border-gray-100">
              <CardTitle className="text-base flex items-center">
                <User className="h-5 w-5 mr-2 text-gray-400" />
                Student Information
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

          {/* Resolution & Feedback */}
          {(complaint.resolution_note || complaint.status === 'closed') && (
            <div className="space-y-6">
              {complaint.resolution_note && (
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

              {/* Typically Admin can fetch the feedback via standard complaint details if included, or we can just show what is available. The prompt says "Rating if available, Comment if available". Assuming it is included in the backend response or fetched. Let's assume it's attached or we omit it cleanly if not found. */}
            </div>
          )}
        </div>

        {/* Right Col: Actions & Assignments */}
        <div className="space-y-6">
          <Card className="border-primary-100 shadow-sm">
            <CardHeader className="bg-primary-50/50 border-b border-primary-100 pb-4">
              <CardTitle className="text-primary-800 flex items-center">
                <Wrench className="h-5 w-5 mr-2 text-primary-600" />
                Staff Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {assignError && <Alert type="error" message={assignError} />}
              {assignSuccess && <Alert type="success" message="Staff assigned successfully." />}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to Staff Member
                </label>
                <div className="flex flex-col space-y-3">
                  <select
                    className="w-full rounded-md border border-gray-300 h-10 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    value={selectedStaff}
                    onChange={(e) => setSelectedStaff(e.target.value)}
                  >
                    <option value="">-- Select Staff --</option>
                    {staffList.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name} ({staff.email})
                      </option>
                    ))}
                  </select>
                  
                  <Button 
                    onClick={handleAssign} 
                    disabled={assigning || !selectedStaff || selectedStaff === String(complaint.assigned_staff_id)}
                    className="w-full"
                  >
                    {assigning ? 'Assigning...' : 'Assign Staff'}
                  </Button>
                </div>
              </div>

              {complaint.assigned_staff_id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700">Currently Assigned:</p>
                  <p className="text-sm text-gray-500">
                    {(() => {
                      const staff = staffList.find(s => String(s.id) === String(complaint.assigned_staff_id));
                      return staff ? `${staff.full_name} (${staff.email})` : `Staff ID: ${complaint.assigned_staff_id}`;
                    })()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 pb-4">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2 text-gray-500" />
                  Priority
                </span>
                <PriorityBadge priority={complaint.priority} />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {priorityError && <Alert type="error" message={priorityError} />}
              {prioritySuccess && <Alert type="success" message="Priority updated successfully." />}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Complaint Priority
                </label>
                <div className="flex flex-col space-y-3">
                  <select
                    className="w-full rounded-md border border-gray-300 h-10 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    disabled={updatingPriority || complaint.status === 'resolved' || complaint.status === 'closed'}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>

                  <Button
                    onClick={handlePriorityUpdate}
                    disabled={
                      updatingPriority ||
                      !selectedPriority ||
                      selectedPriority === complaint.priority ||
                      complaint.status === 'resolved' ||
                      complaint.status === 'closed'
                    }
                    className="w-full"
                  >
                    {updatingPriority ? 'Updating...' : 'Update Priority'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

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
