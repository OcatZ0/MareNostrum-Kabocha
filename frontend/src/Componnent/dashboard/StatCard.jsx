import React from 'react';
import { COLORS } from './dashboardTheme';

/**
 * icon      - lucide-react icon component
 * label     - metric label, e.g. "Active Trips"
 * value     - metric value, e.g. "128"
 * delta     - e.g. "+12%"
 * deltaGood - true renders the delta pill in green, false in a neutral amber
 */
const StatCard = ({ icon: Icon, label, value, delta, deltaGood = true }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 flex items-center gap-4">
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
