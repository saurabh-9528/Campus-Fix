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
      staff_id: staffId
    });
  },

  // Get all active staff members
  getStaff: async () => {
    return await apiClient.get('/admin/staff');
  },

  // Get history for a complaint
  getHistory: async (id) => {
    return await apiClient.get(`/admin/complaints/${id}/history`);
  }
};
