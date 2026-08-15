import React from 'react';
import { Truck, MoreVertical, Fuel } from 'lucide-react';
import { COLORS, STATUS_STYLES } from './dashboardTheme';

const DEFAULT_TRUCKS = [
  { plate: 'BP 8213 KZ', model: 'Hino Dutro 130 HD', fuel: 'Diesel', status: 'onRoute' },
  { plate: 'BP 1187 AX', model: 'Isuzu Elf NLR', fuel: 'Diesel', status: 'onRoute' },
  { plate: 'BP 4402 QF', model: 'Mitsubishi Fuso Canter', fuel: 'Electric', status: 'idle' },
  { plate: 'BP 9950 LB', model: 'Hino Dutro 110 SD', fuel: 'Diesel', status: 'maintenance' },
];

const FleetStatus = ({ trucks = [], loading = false }) => {
  const displayTrucks = trucks.length > 0 ? trucks : (loading ? [] : DEFAULT_TRUCKS);

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-5 sm:p-6 shadow-sm">
      <div className="flex items-start justify-between mb-5">
        <h3 className="text-sm font-semibold text-slate-800">Fleet Status</h3>
        <span className="text-xs font-medium text-slate-400">
          {displayTrucks.length} Trucks
        </span>
      </div>

      {loading && displayTrucks.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading fleet data...</div>
      ) : displayTrucks.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">No fleet data found.</div>
      ) : (
        <ul className="divide-y-2 divide-slate-100">
          {displayTrucks.map((t, idx) => {
            const plate = t.plate_number || t.plate || `Truck #${idx + 1}`;
            const model = t.brand ? `${t.brand} ${t.model || ''}`.trim() : (t.model || 'Commercial Truck');
            const fuel = t.fuel_type || t.fuel || 'Diesel';
            const statusKey = t.status || 'active';
            const s = STATUS_STYLES[statusKey] || {
              label: statusKey,
              bg: '#E8F4FB',
              color: COLORS.aqua,
            };

            return (
              <li key={t.id || plate || idx} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${COLORS.navy}0D` }}
                >
                  <Truck size={18} color={COLORS.navy} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{plate}</p>
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                    {model}
                    <span className="mx-1">·</span>
                    <Fuel size={11} />
                    <span className="capitalize">{fuel}</span>
                  </p>
                </div>
                <span
                  className="text-[11px] font-semibold px-2 py-1 rounded-full shrink-0"
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
  );
};

export default FleetStatus;
