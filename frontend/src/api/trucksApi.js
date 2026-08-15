// NOTE: adjust this import to match whatever axios instance tripsApi.js
// actually uses in your repo (e.g. '../api/http' or '../api/axios').
import http from './http';

export const getTrucks = (params) => http.get('/trucks', { params });
export const getTruck = (id) => http.get(`/trucks/${id}`);
export const createTruck = (payload) => http.post('/trucks', payload);
export const updateTruck = (id, payload) => http.put(`/trucks/${id}`, payload);
export const deleteTruck = (id) => http.delete(`/trucks/${id}`);