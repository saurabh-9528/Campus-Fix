import { apiClient } from './client';

export const notificationApi = {
  getNotifications: async (limit = 20) => {
    return await apiClient.get(`/notifications?limit=${limit}`);
  },
  
  getUnreadCount: async () => {
    return await apiClient.get('/notifications/unread-count');
  },
  
  markAsRead: async (id) => {
    return await apiClient.patch(`/notifications/${id}/read`);
  },
  
  markAllAsRead: async () => {
    return await apiClient.patch('/notifications/read-all');
  }
};
