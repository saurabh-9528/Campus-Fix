import { apiClient } from './client';

export const adminApi = {
  // Get all complaints for the entire system (optionally limited)
  getAdminComplaints: async (limit) => {
    const url = limit ? `/admin/complaints?limit=${limit}` : '/admin/complaints';
    return await apiClient.get(url);
  },

  // Get admin dashboard analytics
  getAnalytics: async () => {
    return await apiClient.get('/admin/analytics');
  },

  // Get a single complaint by ID for admin
  getAdminComplaint: async (id) => {
    return await apiClient.get(`/admin/complaints/${id}`);
  },

  // Assign staff to a complaint
  assignStaff: async (complaintId, staffId) => {
    return await apiClient.patch(`/admin/complaints/${complaintId}/assign`, {
      staff_id: staffId ? Number(staffId) : null,
    });
  },

  // Update complaint status as admin
  updateComplaintStatus: async (complaintId, status, resolutionNote = null) => {
    return await apiClient.patch(`/admin/complaints/${complaintId}/status`, {
      status,
      ...(resolutionNote ? { resolution_note: resolutionNote } : {}),
    });
  },

  // Bulk assign complaints to a staff member (or unassign with null)
  bulkAssignComplaints: async (complaintIds, staffId) => {
    return await apiClient.patch('/admin/complaints/bulk/assign', {
      complaint_ids: complaintIds,
      staff_id: staffId ? Number(staffId) : null,
    });
  },

  // Bulk update complaint status
  bulkUpdateStatus: async (complaintIds, status, resolutionNote = null) => {
    return await apiClient.patch('/admin/complaints/bulk/status', {
      complaint_ids: complaintIds,
      status,
      ...(resolutionNote ? { resolution_note: resolutionNote } : {}),
    });
  },

  // Update complaint priority
  updatePriority: async (complaintId, priority) => {
    return await apiClient.patch(`/admin/complaints/${complaintId}/priority`, {
      priority,
    });
  },

  // Get staff members (optionally including pending activation and/or inactive)
  getStaff: async (includePending = false, includeInactive = false) => {
    const params = new URLSearchParams();
    if (includePending) params.set('include_pending', 'true');
    if (includeInactive) params.set('include_inactive', 'true');
    const qs = params.toString();
    return await apiClient.get(qs ? `/admin/staff?${qs}` : '/admin/staff');
  },

  // Activate a pending staff account
  activateStaff: async (staffId) => {
    return await apiClient.patch(`/admin/staff/${staffId}/activate`);
  },

  // Create a single staff account
  createStaff: async (payload) => {
    return await apiClient.post('/admin/staff', payload);
  },

  // Bulk create staff accounts
  bulkCreateStaff: async (items) => {
    return await apiClient.post('/admin/staff/bulk', { items });
  },

  // Toggle staff active status
  setStaffStatus: async (staffId, isActive) => {
    return await apiClient.patch(`/admin/staff/${staffId}/status`, { is_active: isActive });
  },

  // Get students
  getStudents: async () => {
    return await apiClient.get('/admin/students');
  },

  // Create a single student account
  createStudent: async (payload) => {
    return await apiClient.post('/admin/students', payload);
  },

  // Bulk create student accounts
  bulkCreateStudents: async (items) => {
    return await apiClient.post('/admin/students/bulk', { items });
  },

  // Toggle student active status
  setStudentStatus: async (studentId, isActive) => {
    return await apiClient.patch(`/admin/students/${studentId}/status`, { is_active: isActive });
  },

  // Get history for a complaint
  getHistory: async (id) => {
    return await apiClient.get(`/admin/complaints/${id}/history`);
  },
};
