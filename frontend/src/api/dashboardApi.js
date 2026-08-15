import axiosClient from '../axios';

/**
 * GET /api/dashboard?period=all|today|this_week|this_month&section=primary
 * Tier 1: Instant priority data (summary cards, live ops, recent dispatches, unread badges)
 */
export const getDashboardPrimaryData = (params = {}) =>
  axiosClient.get('/api/dashboard', { params: { ...params, section: 'primary' } });

/**
 * GET /api/dashboard?period=all|today|this_week|this_month&section=secondary
 * Tier 2: Deferred analytics data (12-month volume chart, fleet emissions, fleet vehicles)
 */
export const getDashboardSecondaryData = (params = {}) =>
  axiosClient.get('/api/dashboard', { params: { ...params, section: 'secondary' } });

/**
 * GET /api/dashboard?period=all|today|this_week|this_month
 * Full consolidated dashboard payload
 */
export const getDashboardData = (params = {}) =>
  axiosClient.get('/api/dashboard', { params });

