import axiosClient from '../axios';

export const getUsers    = (params = {}) => axiosClient.get('/api/users', { params });
export const getUser     = (id)          => axiosClient.get(`/api/users/${id}`);
export const createUser  = (payload)     => axiosClient.post('/api/users', payload);
export const updateUser  = (id, payload) => axiosClient.put(`/api/users/${id}`, payload);
export const deleteUser  = (id)          => axiosClient.delete(`/api/users/${id}`);
