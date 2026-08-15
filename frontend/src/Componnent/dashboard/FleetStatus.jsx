import React from 'react';
import { Truck, Fuel, ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { COLORS, STATUS_STYLES } from './dashboardTheme';

const FleetStatus = ({ trucks = [], loading = false }) => {
  const navigate = useNavigate();
  const displayTrucks = trucks.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
              style={{ backgroundColor: `${COLORS.navy}0D` }}
            >
              <Truck size={18} color={COLORS.navy} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Fleet Operations</h3>
              <p className="text-xs text-slate-400">
                {trucks.length} total vehicles registered
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/app/trucks')}
            className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-800 transition"
          >
            Manage Fleet
            <ArrowRight size={13} />
          </button>
        </div>

        {loading && displayTrucks.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            <div className="w-5 h-5 mx-auto border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin mb-2" />
            Loading fleet data...
          </div>
        ) : displayTrucks.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">No fleet vehicles recorded.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {displayTrucks.map((t, idx) => {
              const plate = t.plate_number || t.plate || `Truck #${idx + 1}`;
              const model = t.brand ? `${t.brand} ${t.model || ''}`.trim() : (t.model || 'Commercial Vehicle');
              const fuel = t.fuel_type || t.fuel || 'Diesel';
              const capacity = t.capacity_tons ? `${t.capacity_tons} tons` : null;
              const statusKey = t.status || 'active';
              const s = STATUS_STYLES[statusKey] || {
                label: statusKey.replace(/_/g, ' '),
                bg: '#E8F4FB',
                color: COLORS.aqua,
              };

              return (
                <li
                  key={t.id || plate || idx}
                  onClick={() => navigate('/app/trucks')}
                  className="flex items-center gap-3 py-3 first:pt-1 last:pb-1 cursor-pointer hover:bg-slate-50/70 px-2 -mx-2 rounded-lg transition"
                >
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${COLORS.navy}0A` }}
                  >
                    <Truck size={16} color={COLORS.navy} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{plate}</p>
                      {capacity && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded font-mono">
                          {capacity}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                      <span>{model}</span>
                      <span className="text-slate-300">·</span>
                      <Fuel size={10} className="text-slate-400" />
                      <span className="capitalize">{fuel}</span>
                    </p>
                  </div>

                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 capitalize"
                    style={{ backgroundColor: s.bg, color: s.color }}
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {trucks.length > 5 && (
        <div className="pt-3 mt-2 border-t border-slate-100 text-center">
          <button
            onClick={() => navigate('/app/trucks')}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium"
          >
            + {trucks.length - 5} more vehicles in fleet
          </button>
        </div>
      )}
    </div>
  );
};

export default FleetStatus;
