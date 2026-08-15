import axiosClient from '../axios';

/**
 * GET /api/analytics/dashboard?period=all|today|this_week|this_month
 */
export const getAnalyticsDashboard = (params = {}) =>
  axiosClient.get('/api/analytics/dashboard', { params });

/**
 * GET /api/analytics/trips?status=...&search=...&per_page=...
 */
export const getAnalyticsTrips = (params = {}) =>
  axiosClient.get('/api/analytics/trips', { params });
