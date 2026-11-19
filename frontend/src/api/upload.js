import { apiClient } from './client';

export const uploadApi = {
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return await apiClient.post('/upload/', formData);
  }
};
