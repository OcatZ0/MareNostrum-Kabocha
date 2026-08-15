import React from 'react';
import { Leaf, MoreVertical } from 'lucide-react';
import { COLORS } from './dashboardTheme';

const DEFAULT_TREND = [40, 55, 48, 62, 58, 70, 65, 74, 60, 68, 72, 80];

const EmissionOverview = ({
  totalLabel = '0 kg CO₂',
  subLabel = 'Emitted across all trips',
  delta = '-5% vs target',
  trend = DEFAULT_TREND,
  categoryEmissions = null,
}) => {
  const safeTrend = trend && trend.length > 0 ? trend : DEFAULT_TREND;
  const max = Math.max(...safeTrend, 1);

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 sm:p-6 flex flex-col justify-between">
      <div>
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

          <div className="flex items-end gap-1.5 h-16">
            {safeTrend.map((v, i) => (
              <span
                key={i}
                className="w-2.5 rounded-sm transition-all duration-300"
                style={{
                  height: `${Math.max((v / max) * 100, 10)}%`,
                  backgroundColor: i === safeTrend.length - 1 ? COLORS.green : `${COLORS.aqua}55`,
                }}
                title={`${v} kg`}
              />
            ))}
          </div>
        </div>
      </div>

      {categoryEmissions && (
        <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-slate-100 text-center">
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-[10px] text-slate-400 font-medium">Light Trucks</p>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">
              {categoryEmissions.light?.total_co2_kg ?? 0} kg
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-[10px] text-slate-400 font-medium">Medium Trucks</p>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">
              {categoryEmissions.medium?.total_co2_kg ?? 0} kg
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-[10px] text-slate-400 font-medium">Heavy Trucks</p>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">
              {categoryEmissions.heavy?.total_co2_kg ?? 0} kg
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmissionOverview;
