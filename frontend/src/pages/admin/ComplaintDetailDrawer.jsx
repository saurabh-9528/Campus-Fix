import React, { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { ComplaintAttachment } from '../../components/ComplaintAttachment';
import { MapPin, Calendar, AlertCircle, User, Wrench, Clock, X } from 'lucide-react';
import { getCategoryLabel } from '../../utils/categories';
import { ActivityTimeline } from '../../components/ui/ActivityTimeline';

export const ComplaintDetailDrawer = ({
  open,
  complaintId,
  onClose,
  onAssign,
  onPriorityUpdate,
}) => {
  const [complaint, setComplaint] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('medium');
  const [selectedStatus, setSelectedStatus] = useState('submitted');
  const [verificationNote, setVerificationNote] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!complaintId) return;
    try {
      setLoading(true);
      setError('');
      const [complaintData, staffData, historyData] = await Promise.all([
        adminApi.getAdminComplaint(complaintId),
        adminApi.getStaff(false),
        adminApi.getHistory(complaintId).catch(() => []),
      ]);
      setComplaint(complaintData);
      setStaffList(staffData || []);
      setHistory(historyData || complaintData.history || []);
      setSelectedStaff(complaintData.assigned_staff_id ? String(complaintData.assigned_staff_id) : '');
      setSelectedPriority(complaintData.priority || 'medium');
      setSelectedStatus(complaintData.status || 'submitted');
      setVerificationNote(complaintData.resolution_note || '');
    } catch (err) {
      setError(err.message || 'Failed to load complaint details');
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    if (open && complaintId) {
      fetchDetails();
    }
  }, [open, complaintId, fetchDetails]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const elapsed = complaint
    ? (() => {
        const createdAt = new Date(complaint.created_at);
        const now = new Date();
        const diffMs = now - createdAt;
        const diffDays = Math.floor(diffMs / 86400000);
        const diffHours = Math.floor((diffMs % 86400000) / 3600000);
        return diffDays > 0
          ? `${diffDays}d ${diffHours}h ago`
          : diffHours > 0
            ? `${diffHours}h ago`
            : 'Just now';
      })()
    : '';

  const handleAssign = async () => {
    if (!complaint || !selectedStaff) return;
    setUpdating(true);
    setError('');
    try {
      await adminApi.assignStaff(complaint.id, selectedStaff);
      await fetchDetails();
      onAssign?.();
    } catch (err) {
      setError(err.message || 'Failed to assign staff');
    } finally {
      setUpdating(false);
    }
  };

  const handlePriorityUpdate = async () => {
    if (!complaint || !selectedPriority) return;
    setUpdating(true);
    setError('');
    try {
      await adminApi.updatePriority(complaint.id, selectedPriority);
      await fetchDetails();
      onPriorityUpdate?.();
    } catch (err) {
      setError(err.message || 'Failed to update priority');
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!complaint || !selectedStatus) return;
    if (selectedStatus === 'invalid' && !verificationNote.trim()) {
      setError('Please provide a brief verification reason when marking as Invalid / Not Found.');
      return;
    }
    setUpdating(true);
    setError('');
    try {
      await adminApi.updateComplaintStatus(
        complaint.id,
        selectedStatus,
        verificationNote.trim() || null
      );
      await fetchDetails();
      onAssign?.();
    } catch (err) {
      setError(err.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Complaint details"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className="relative w-full max-w-4xl bg-gray-50 h-full overflow-y-auto shadow-2xl p-6 space-y-6">
        <div className="flex items-start justify-between border-b border-gray-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {complaint ? `Complaint #${complaint.id} - ${complaint.title}` : 'Complaint Details'}
            </h2>
            {complaint && (
              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-500">
                <StatusBadge status={complaint.status} />
                <PriorityBadge priority={complaint.priority} />
                <span>•</span>
                <span className="capitalize">{getCategoryLabel(complaint.category)}</span>
                <span>•</span>
                <span>Submitted {new Date(complaint.created_at).toLocaleDateString()} ({elapsed})</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center p-12">
            <Spinner size={32} />
            <span className="ml-3 text-sm text-gray-500">Loading complaint...</span>
          </div>
        ) : error && !complaint ? (
          <div className="space-y-4">
            <Alert type="error" message={error} />
            <Button variant="secondary" onClick={() => onClose?.()}>
              Close
            </Button>
          </div>
        ) : !complaint ? (
          <Alert type="error" message="Complaint not found" />
        ) : (
          <>
            {error && <Alert type="error" message={error} />}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Main Details */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardContent className="p-5">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">{complaint.title}</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                      <div className="flex items-center text-gray-600">
                        <MapPin className="mr-2 h-4 w-4 text-gray-400" />
                        <span>Location: {complaint.location}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                        <span>Submitted: {new Date(complaint.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <p className="text-gray-700 whitespace-pre-wrap mb-4">
                      {complaint.description}
                    </p>

                    <ComplaintAttachment imageUrl={complaint.image_url} />
                  </CardContent>
                </Card>

                {/* Student Info */}
                <Card>
                  <CardHeader className="pb-3 border-b border-gray-100">
                    <CardTitle className="text-base flex items-center">
                      <User className="h-5 w-5 mr-2 text-gray-400" /> Student Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold uppercase">
                        {complaint.student?.full_name?.charAt(0) || 'S'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {complaint.student?.full_name || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {complaint.student?.email || `Student ID: ${complaint.student_id}`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Activity Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-base">
                      <Clock className="h-5 w-5 mr-2 text-gray-400" /> Activity History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ActivityTimeline history={history} />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Actions */}
              <div className="lg:col-span-1 space-y-4">
                {/* Staff Assignment */}
                <Card className="border-primary-100 shadow-sm">
                  <CardHeader className="bg-primary-50/50 border-b border-primary-100 pb-3">
                    <CardTitle className="text-primary-800 flex items-center text-base">
                      <Wrench className="h-5 w-5 mr-2 text-primary-600" /> Staff Assignment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assign to Staff
                      </label>
                      <select
                        className="w-full rounded-md border border-gray-300 h-10 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 mb-3"
                        value={selectedStaff}
                        onChange={(e) => setSelectedStaff(e.target.value)}
                      >
                        <option value="">-- Select Staff --</option>
                        {staffList.map(staff => (
                          <option key={staff.id} value={String(staff.id)}>
                            {staff.full_name} ({staff.email})
                          </option>
                        ))}
                      </select>

                      <Button
                        onClick={handleAssign}
                        disabled={updating || !selectedStaff}
                        className="w-full"
                      >
                        {updating ? 'Assigning...' : 'Assign Staff'}
                      </Button>
                    </div>

                    {complaint.assigned_staff_id && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-sm font-medium text-gray-700">Currently Assigned:</p>
                        <p className="text-sm text-gray-500">
                          {(() => {
                            const staff = staffList.find(
                              s => String(s.id) === String(complaint.assigned_staff_id)
                            );
                            return staff
                              ? `${staff.full_name} (${staff.email})`
                              : `Staff ID: ${complaint.assigned_staff_id}`;
                          })()}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Priority Update */}
                <Card className="border-gray-200 shadow-sm">
                  <CardHeader className="border-b border-gray-100 pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center">
                        <AlertCircle className="h-5 w-5 mr-2 text-gray-500" /> Priority
                      </span>
                      <PriorityBadge priority={selectedPriority} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <select
                      className="w-full rounded-md border border-gray-300 h-10 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={selectedPriority}
                      onChange={(e) => setSelectedPriority(e.target.value)}
                      disabled={complaint.status === 'resolved' || complaint.status === 'closed'}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>

                    <Button
                      onClick={handlePriorityUpdate}
                      disabled={
                        updating ||
                        complaint.status === 'resolved' ||
                        complaint.status === 'closed' ||
                        complaint.status === 'invalid' ||
                        selectedPriority === complaint.priority
                      }
                      className="w-full"
                    >
                      {updating ? 'Updating...' : 'Update Priority'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Status & Verification Update */}
                <Card className="border-gray-200 shadow-sm">
                  <CardHeader className="border-b border-gray-100 pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>Status &amp; Verification</span>
                      <StatusBadge status={complaint.status} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5">
                    <select
                      className="h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                    >
                      <option value="submitted">Submitted</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                      <option value="invalid">Invalid / Not Found</option>
                    </select>

                    {selectedStatus === 'invalid' && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          Verification Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          rows={2}
                          maxLength={500}
                          placeholder="E.g., No issue found on inspection / Duplicate or prank entry"
                          value={verificationNote}
                          onChange={(e) => setVerificationNote(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        />
                      </div>
                    )}

                    <Button
                      onClick={handleStatusUpdate}
                      disabled={updating}
                      variant={selectedStatus === 'invalid' ? 'danger' : 'secondary'}
                      className="w-full"
                    >
                      {updating
                        ? 'Updating...'
                        : selectedStatus === 'invalid'
                          ? 'Mark Invalid / Not Found'
                          : 'Update Status'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
