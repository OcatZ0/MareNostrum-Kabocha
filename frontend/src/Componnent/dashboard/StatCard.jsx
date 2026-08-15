import React from 'react';
import { COLORS } from './dashboardTheme';

/**
 * icon      - lucide-react icon component
 * label     - metric label, e.g. "Active Trips"
 * value     - metric value, e.g. "128"
 * delta     - e.g. "+12%"
 * deltaGood - true renders the delta pill in green, false in a neutral amber
 */
const StatCard = ({ icon: Icon, label, value, delta, deltaGood = true, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border-2 border-slate-200 p-5 flex items-center gap-4 shadow-sm animate-pulse">
        <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-6 bg-slate-200 rounded w-20" />
          <div className="h-3.5 bg-slate-100 rounded w-28" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-5 flex items-center gap-4 shadow-sm">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${COLORS.navy}0D` }}
      >
        <Icon size={20} color={COLORS.navy} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-slate-800 leading-none">{value}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm text-slate-500">{label}</span>
          {delta && (
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: deltaGood ? '#E7F6EC' : '#FDF2E9',
                color: deltaGood ? COLORS.green : '#C2703D',
              }}
            >
              {delta}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
