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
  onRoute: { label: 'On route', bg: '#E8F4FB', color: COLORS.aqua },
  idle: { label: 'Idle', bg: '#EEF2F6', color: '#64748B' },
  maintenance: { label: 'Maintenance', bg: '#FDF2E9', color: '#C2703D' },
  atSea: { label: 'At sea', bg: '#E9F2F4', color: COLORS.teal },
  completed: { label: 'Completed', bg: '#E7F6EC', color: COLORS.green },
};
