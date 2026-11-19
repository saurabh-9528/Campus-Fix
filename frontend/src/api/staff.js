import { apiClient } from './client';

export const staffApi = {
  // Get all complaints assigned to the logged-in staff
  getAssignedComplaints: async () => {
    return await apiClient.get('/staff/complaints');
  },

  // Get a single assigned complaint by ID
  getAssignedComplaint: async (id) => {
    return await apiClient.get(`/staff/complaints/${id}`);
  },

  // Update complaint status (and resolution note)
  updateComplaintStatus: async (id, data) => {
    return await apiClient.patch(`/staff/complaints/${id}/status`, data);
  },

  // Get history for a complaint
  getHistory: async (id) => {
    return await apiClient.get(`/staff/complaints/${id}/history`);
  }
};
