import axiosClient from '../axios';

export const getTrucks    = (params = {}) => axiosClient.get('/api/trucks', { params });
export const getTruck     = (id)          => axiosClient.get(`/api/trucks/${id}`);
export const createTruck  = (payload)     => axiosClient.post('/api/trucks', payload);
export const updateTruck  = (id, payload) => axiosClient.put(`/api/trucks/${id}`, payload);
export const deleteTruck  = (id)          => axiosClient.delete(`/api/trucks/${id}`);
export const truckEmissions = (id)        => axiosClient.get(`/api/trucks/${id}/emissions`);
