import React from 'react';
import { Truck, MoreVertical, Fuel } from 'lucide-react';
import { COLORS, STATUS_STYLES } from './dashboardTheme';

const DEFAULT_TRUCKS = [
  { plate: 'BP 8213 KZ', model: 'Hino Dutro 130 HD', fuel: 'Diesel', status: 'onRoute' },
  { plate: 'BP 1187 AX', model: 'Isuzu Elf NLR', fuel: 'Diesel', status: 'onRoute' },
  { plate: 'BP 4402 QF', model: 'Mitsubishi Fuso Canter', fuel: 'Electric', status: 'idle' },
  { plate: 'BP 9950 LB', model: 'Hino Dutro 110 SD', fuel: 'Diesel', status: 'maintenance' },
];

const FleetStatus = ({ trucks = DEFAULT_TRUCKS }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 sm:p-6">
      <div className="flex items-start justify-between mb-5">
        <h3 className="text-sm font-semibold text-slate-800">Fleet Status</h3>
        <button className="text-slate-300 hover:text-slate-500">
          <MoreVertical size={18} />
        </button>
      </div>

      <ul className="divide-y divide-slate-100">
        {trucks.map((t) => {
          const s = STATUS_STYLES[t.status];
          return (
            <li key={t.plate} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${COLORS.navy}0D` }}
              >
                <Truck size={18} color={COLORS.navy} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{t.plate}</p>
                <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                  {t.model}
                  <span className="mx-1">·</span>
                  <Fuel size={11} />
                  {t.fuel}
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
    </div>
  );
};

export default FleetStatus;
