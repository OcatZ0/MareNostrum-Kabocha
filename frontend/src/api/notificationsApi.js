import axiosClient from '../axios';

export const getNotifications = (params = {}) => axiosClient.get('/api/notifications', { params });
export const markAsRead       = (id)           => axiosClient.post(`/api/notifications/${id}/read`);
export const markAllAsRead    = (params = {})  => axiosClient.post('/api/notifications/read-all', {}, { params });
