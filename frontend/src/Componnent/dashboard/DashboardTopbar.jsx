import React from 'react';
import { Menu, Search, Bell, ChevronDown } from 'lucide-react';
import { COLORS } from './dashboardTheme';

/** onMenuClick - opens the mobile sidebar drawer */
const DashboardTopbar = ({ onMenuClick = () => {} }) => {
  return (
    <header className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-white border-b border-slate-100">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 shrink-0"
        >
          <Menu size={18} />
        </button>

        <div className="hidden md:flex items-center flex-1 max-w-md px-3.5 py-2 rounded-lg border border-slate-200 text-slate-400">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search trips, trucks, drivers…"
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400 px-2"
          />
          <kbd className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-200 text-slate-400">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <button className="relative w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500">
          <Bell size={16} />
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: COLORS.green }}
          />
        </button>

        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
            style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}
          >
            RP
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-sm font-semibold text-slate-800">Rangga Putra</p>
            <p className="text-xs text-slate-400">Admin · Company A</p>
          </div>
          <ChevronDown size={14} className="hidden sm:block text-slate-400" />
        </div>
      </div>
    </header>
  );
};

export default DashboardTopbar;
