import { apiClient } from './client';

export const complaintApi = {
  // Get all complaints for the current student
  getMyComplaints: async () => {
    return await apiClient.get('/complaints/student/');
  },

  // Get a single complaint by ID
  getComplaint: async (id) => {
    return await apiClient.get(`/complaints/student/${id}`);
  },

  // Create a new complaint
  createComplaint: async (data) => {
    return await apiClient.post('/complaints/student/', data);
  },

  // Submit feedback for a resolved complaint
  submitFeedback: async (id, data) => {
    return await apiClient.post(`/complaints/student/${id}/feedback`, data);
  },

  getFeedback: async (id) => {
    return await apiClient.get(`/complaints/student/${id}/feedback`);
  },

  // Get history for a complaint
  getHistory: async (id) => {
    return await apiClient.get(`/complaints/student/${id}/history`);
  }
};
