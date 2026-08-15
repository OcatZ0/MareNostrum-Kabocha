import axiosClient from '../axios';

/**
 * GET /api/dashboard?period=all|today|this_week|this_month
 * Dedicated consolidated dashboard payload
 */
export const getDashboardData = (params = {}) =>
  axiosClient.get('/api/dashboard', { params });
