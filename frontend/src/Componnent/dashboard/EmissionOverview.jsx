import React from 'react';
import { Leaf, MoreVertical } from 'lucide-react';
import { COLORS } from './dashboardTheme';

const DEFAULT_TREND = [40, 55, 48, 62, 58, 70, 65, 74, 60, 68, 72, 80];

const EmissionOverview = ({
  totalLabel = '3.2t CO₂',
  subLabel = 'Emitted this month, all trucks',
  delta = '-5% vs last month',
  trend = DEFAULT_TREND,
}) => {
  const max = Math.max(...trend);

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 sm:p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${COLORS.green}14` }}
          >
            <Leaf size={18} color={COLORS.green} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Fleet Emissions</h3>
            <p className="text-xs text-slate-400">{subLabel}</p>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-3xl font-semibold text-slate-800 leading-none">{totalLabel}</p>
          <p className="text-xs mt-2 font-medium" style={{ color: COLORS.green }}>
            {delta}
          </p>
        </div>

        <div className="flex items-end gap-1 h-16">
          {trend.map((v, i) => (
            <span
              key={i}
              className="w-2 rounded-sm"
              style={{
                height: `${(v / max) * 100}%`,
                backgroundColor: i === trend.length - 1 ? COLORS.green : `${COLORS.aqua}55`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmissionOverview;
