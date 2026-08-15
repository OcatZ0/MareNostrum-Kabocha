/**
 * Wrappers for every /api/ports endpoint.
 * Fields: name, country (indonesia|singapore), unlocode (optional), latitude, longitude
 */
import axiosClient from '../axios';

/** GET /api/ports?page=N&per_page=N&country=...&search=... */
export const getPorts = (params = {}) =>
  axiosClient.get('/api/ports', { params });

/** GET /api/ports/:id */
export const getPort = (id) =>
  axiosClient.get(`/api/ports/${id}`);

/** POST /api/ports  (admin only) */
export const createPort = (payload) =>
  axiosClient.post('/api/ports', payload);

/** PUT /api/ports/:id  (admin only) */
export const updatePort = (id, payload) =>
  axiosClient.put(`/api/ports/${id}`, payload);

/** DELETE /api/ports/:id  (admin only) */
export const deletePort = (id) =>
  axiosClient.delete(`/api/ports/${id}`);
