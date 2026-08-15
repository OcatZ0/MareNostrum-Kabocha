/**
 * Wrappers for every /api/companies endpoint.
 */
import axiosClient from '../axios';

/** GET /api/companies?page=N&per_page=N&type=...&search=... */
export const getCompanies = (params = {}) =>
  axiosClient.get('/api/companies', { params });

/** GET /api/companies/:id */
export const getCompany = (id) =>
  axiosClient.get(`/api/companies/${id}`);

/** POST /api/companies  (admin only) */
export const createCompany = (payload) =>
  axiosClient.post('/api/companies', payload);

/** PUT /api/companies/:id  (admin only) */
export const updateCompany = (id, payload) =>
  axiosClient.put(`/api/companies/${id}`, payload);

/** DELETE /api/companies/:id  (admin only) */
export const deleteCompany = (id) =>
  axiosClient.delete(`/api/companies/${id}`);
