// Shared design tokens for the Mare Nostrum dashboard.
// Keep every dashboard component importing colors from here so the
// palette stays in sync in one place.

export const COLORS = {
  navy: '#1A365D',
  navyDark: '#123049',
  teal: '#2A6F8A',
  aqua: '#4299E1',
  green: '#38A169',
  bg: '#F7FAFC',
};

export const STATUS_STYLES = {
  // fleet
  onRoute: { label: 'On route', bg: '#E8F4FB', color: COLORS.aqua },
  idle: { label: 'Idle', bg: '#EEF2F6', color: '#64748B' },
  maintenance: { label: 'Maintenance', bg: '#FDF2E9', color: '#C2703D' },
  atSea: { label: 'At sea', bg: '#E9F2F4', color: COLORS.teal },
  completed: { label: 'Completed', bg: '#E7F6EC', color: COLORS.green },

  // trip statuses (API values)
  draft: { label: 'Draft', bg: '#F1F5F9', color: '#64748B' },
  assigned: { label: 'Assigned', bg: '#EFF6FF', color: '#3B82F6' },
  in_transit_origin: { label: 'In Transit', bg: '#E8F4FB', color: COLORS.aqua },
  in_transit_destination: { label: 'Returning', bg: '#E8F4FB', color: COLORS.teal },
  at_origin_port: { label: 'At Port', bg: '#E9F2F4', color: COLORS.teal },
  on_ship: { label: 'On Ship', bg: '#EEF9F4', color: '#0EA5E9' },
  at_destination_port: { label: 'Arrived Port', bg: '#E9F2F4', color: COLORS.teal },
  arrived: { label: 'Arrived', bg: '#ECFDF5', color: COLORS.green },
  cancelled: { label: 'Cancelled', bg: '#FEF2F2', color: '#EF4444' },
};

export const CHECKPOINT_ICONS = {
  departed: '🚛',
  gps_ping: '📍',
  arrived_at_destination: '🏁',
  arrived_at_port: '⚓',
  arrived_final: '✅',
  truck_returned: '🔄',
};
