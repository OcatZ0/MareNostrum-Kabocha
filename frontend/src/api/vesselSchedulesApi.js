import axiosClient from '../axios';

/**
 * GET /api/vessel-schedules
 * params: { page, per_page, search, origin_port_id, destination_port_id, status, date, from_date, to_date }
 */
export const getVesselSchedules = (params = {}) =>
  axiosClient.get('/api/vessel-schedules', { params });

/**
 * GET /api/vessel-schedules/:id
 */
export const getVesselSchedule = (id) =>
  axiosClient.get(`/api/vessel-schedules/${id}`);

/**
 * POST /api/vessel-schedules
 */
export const createVesselSchedule = (payload) =>
  axiosClient.post('/api/vessel-schedules', payload);

/**
 * PUT /api/vessel-schedules/:id
 */
export const updateVesselSchedule = (id, payload) =>
  axiosClient.put(`/api/vessel-schedules/${id}`, payload);

/**
 * DELETE /api/vessel-schedules/:id
 */
export const deleteVesselSchedule = (id) =>
  axiosClient.delete(`/api/vessel-schedules/${id}`);

/**
 * POST /api/vessel-schedules/import
 * formData with file (.xlsx, .xls, .csv)
 */
export const importVesselSchedules = (formData) =>
  axiosClient.post('/api/vessel-schedules/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

/**
 * GET /api/vessel-schedules/template
 * params: { download: 1 } for raw CSV download
 */
export const getVesselScheduleTemplate = (params = {}) =>
  axiosClient.get('/api/vessel-schedules/template', { params });

/**
 * POST /api/vessel-schedules/:id/check-status
 * payload: { latitude, longitude, speed_knots, notify }
 */
export const checkVesselScheduleStatus = (id, payload = {}) =>
  axiosClient.post(`/api/vessel-schedules/${id}/check-status`, payload);
