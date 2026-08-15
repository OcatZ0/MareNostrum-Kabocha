import React, { useState } from 'react';
import { Leaf, Truck, Flame, Award } from 'lucide-react';
import { COLORS } from './dashboardTheme';

const DEFAULT_TREND = [40, 55, 48, 62, 58, 70, 65, 74, 60, 68, 72, 80];

const EmissionOverview = ({
  totalLabel = '0 kg CO₂',
  subLabel = 'Emitted across all trips',
  delta = '-5% eco score',
  trend = DEFAULT_TREND,
  categoryEmissions = null,
  topTrucks = [],
}) => {
  const [activeTab, setActiveTab] = useState('categories'); // 'categories' | 'top_trucks'
  const safeTrend = trend && trend.length > 0 ? trend : DEFAULT_TREND;
  const max = Math.max(...safeTrend, 1);

  const lightCo2 = Number(categoryEmissions?.light?.total_co2_kg ?? 0).toFixed(1);
  const medCo2 = Number(categoryEmissions?.medium?.total_co2_kg ?? 0).toFixed(1);
  const heavyCo2 = Number(categoryEmissions?.heavy?.total_co2_kg ?? 0).toFixed(1);

  const lightCount = categoryEmissions?.light?.trips_count ?? 0;
  const medCount = categoryEmissions?.medium?.trips_count ?? 0;
  const heavyCount = categoryEmissions?.heavy?.trips_count ?? 0;

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-5 sm:p-6 flex flex-col justify-between shadow-sm">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
              style={{ backgroundColor: `${COLORS.green}14` }}
            >
              <Leaf size={18} color={COLORS.green} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Fleet Emissions Intelligence</h3>
              <p className="text-xs text-slate-400">{subLabel}</p>
            </div>
          </div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-medium text-slate-600">
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-2.5 py-1 rounded-md transition ${activeTab === 'categories' ? 'bg-white shadow-2xs text-slate-800 font-semibold' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Categories
            </button>
            <button
              onClick={() => setActiveTab('top_trucks')}
              className={`px-2.5 py-1 rounded-md transition ${activeTab === 'top_trucks' ? 'bg-white shadow-2xs text-slate-800 font-semibold' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Top Emitters
            </button>
          </div>
        </div>

        {/* Big metric & mini chart */}
        <div className="flex items-end justify-between gap-6 pb-5 border-b border-slate-100">
          <div>
            <p className="text-3xl font-bold text-slate-800 leading-none">{totalLabel}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                {delta}
              </span>
              <span className="text-[11px] text-slate-400">GHG Protocol standard</span>
            </div>
          </div>

          <div className="flex items-end gap-1.5 h-14">
            {safeTrend.map((v, i) => (
              <span
                key={i}
                className="w-2.5 rounded-sm transition-all duration-300 hover:opacity-80"
                style={{
                  height: `${Math.max((v / max) * 100, 12)}%`,
                  backgroundColor: i === safeTrend.length - 1 ? COLORS.green : `${COLORS.aqua}66`,
                }}
                title={`${v} kg CO₂`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Tab 1: Category Breakdown */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 font-medium truncate">Light Fleet</p>
            <p className="text-sm font-bold text-slate-800 mt-1">{lightCo2} <span className="text-[10px] font-normal text-slate-400">kg</span></p>
            <span className="inline-block mt-1 text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">
              {lightCount} trips
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 font-medium truncate">Medium Fleet</p>
            <p className="text-sm font-bold text-slate-800 mt-1">{medCo2} <span className="text-[10px] font-normal text-slate-400">kg</span></p>
            <span className="inline-block mt-1 text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">
              {medCount} trips
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 font-medium truncate">Heavy Fleet</p>
            <p className="text-sm font-bold text-slate-800 mt-1">{heavyCo2} <span className="text-[10px] font-normal text-slate-400">kg</span></p>
            <span className="inline-block mt-1 text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">
              {heavyCount} trips
            </span>
          </div>
        </div>
      )}

      {/* Tab 2: Top Emitting Trucks */}
      {activeTab === 'top_trucks' && (
        <div className="mt-4 space-y-2">
          {(!topTrucks || topTrucks.length === 0) ? (
            <p className="text-xs text-slate-400 py-3 text-center">No high-emission vehicle recorded yet.</p>
          ) : (
            topTrucks.slice(0, 3).map((tr, idx) => (
              <div key={tr.truck_id || idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{tr.plate_number || `Truck #${tr.truck_id}`}</p>
                    <p className="text-[10px] text-slate-400 truncate">{tr.brand} {tr.model || ''}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-slate-800">{tr.total_co2_kg} kg</p>
                  <p className="text-[10px] text-slate-400">{tr.trips_count} trips</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default EmissionOverview;
