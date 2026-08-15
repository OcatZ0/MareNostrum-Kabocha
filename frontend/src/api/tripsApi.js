/**
 * Thin wrappers around every /api/trips endpoint.
 * All functions return the full axios response so callers can read
 * res.data.data, res.data.meta, res.data.message, etc.
 */
import axiosClient from '../axios';

/* ── list & single ───────────────────────────────────────────── */

/** GET /api/trips?page=N&per_page=N */
export const getTrips = (params = {}) =>
  axiosClient.get('/api/trips', { params });

/** GET /api/trips/:id */
export const getTrip = (id) =>
  axiosClient.get(`/api/trips/${id}`);

/* ── mutations (admin only) ──────────────────────────────────── */

/**
 * POST /api/trips
 * payload: one of the 3 combo shapes:
 *   { origin_company_id, destination_company_id }
 *   { origin_company_id, destination_port_id, ship_destination_port_id }
 *   { origin_port_id, destination_company_id }
 */
export const createTrip = (payload) =>
  axiosClient.post('/api/trips', payload);

/**
 * PUT /api/trips/:id
 * Same combo shapes as createTrip, draft-only.
 */
export const updateTrip = (id, payload) =>
  axiosClient.put(`/api/trips/${id}`, payload);

/**
 * POST /api/trips/:id/recommend
 * payload: { date?: 'YYYY-MM-DD' }  — defaults to tomorrow
 */
export const recommendTrip = (id, payload = {}) =>
  axiosClient.post(`/api/trips/${id}/recommend`, payload);

/**
 * POST /api/trips/:id/assign
 * payload: { truck_id, driver_id, chosen_departure_at }
 */
export const assignTrip = (id, payload) =>
  axiosClient.post(`/api/trips/${id}/assign`, payload);

/**
 * POST /api/trips/:id/simulate
 * payload: { departure_at: ISO string }
 */
export const simulateTrip = (id, payload) =>
  axiosClient.post(`/api/trips/${id}/simulate`, payload);

/**
 * POST /api/trips/:id/ship
 * payload: { ship_ref_id: string }  — MMSI (9 digits) or IMO (7 digits)
 */
export const setShipRef = (id, payload) =>
  axiosClient.post(`/api/trips/${id}/ship`, payload);

/* ── checkpoints ─────────────────────────────────────────────── */

/** GET /api/trips/:id/checkpoints */
export const getCheckpoints = (tripId) =>
  axiosClient.get(`/api/trips/${tripId}/checkpoints`);

/** GET /api/trips/:id/position — single current point, meant to be polled */
export const getPosition = (tripId) =>
  axiosClient.get(`/api/trips/${tripId}/position`);

/**
 * POST /api/trips/:id/checkpoints  (driver only)
 * payload: { event_type, latitude, longitude }
 */
export const storeCheckpoint = (tripId, payload) =>
  axiosClient.post(`/api/trips/${tripId}/checkpoints`, payload);
