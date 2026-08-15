import React from 'react';
import {
  LayoutDashboard,
  Route,
  Truck,
  Users,
  Building2,
  Bell,
  Leaf,
  Settings,
  Anchor,
  X,
} from 'lucide-react';
import { COLORS } from './dashboardTheme';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Trips', icon: Route },
  { label: 'Trucks', icon: Truck },
  { label: 'Drivers', icon: Users },
  { label: 'Companies & Ports', icon: Building2 },
  { label: 'Notifications', icon: Bell, badge: 5 },
  { label: 'Emissions', icon: Leaf },
  { label: 'Settings', icon: Settings },
];

/**
 * open  - whether the mobile drawer is visible (ignored at lg breakpoint, always visible)
 * onClose - called when the mobile backdrop or a nav item is tapped
 */
const DashboardSidebar = ({ open = false, onClose = () => {} }) => {
  return (
    <>
      {/* mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 flex flex-col
        transform transition-transform duration-200 ease-out
        lg:static lg:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${COLORS.navy}14` }}
            >
              <Anchor size={17} color={COLORS.navy} strokeWidth={2} />
            </div>
            <div>
              <p
                className="font-semibold tracking-[0.18em] text-xs leading-none"
                style={{ color: COLORS.navy }}
              >
                MARE NOSTRUM
              </p>
              <p className="text-[10px] italic mt-1 leading-none" style={{ color: COLORS.teal }}>
                Our sea, our trade
              </p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <p className="px-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase mb-2">
            Menu
          </p>
          {NAV_ITEMS.map(({ label, icon: Icon, active, badge }) => (
            <button
              key={label}
              onClick={onClose}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition
                ${active ? '' : 'text-slate-600 hover:bg-slate-50'}`}
              style={
                active
                  ? { backgroundColor: `${COLORS.aqua}14`, color: COLORS.navy }
                  : undefined
              }
            >
              <span className="flex items-center gap-3">
                <Icon size={18} color={active ? COLORS.aqua : '#94A3B8'} />
                {label}
              </span>
              {badge && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: COLORS.green }}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Batam ↔ Singapore cross-border logistics visibility.
          </p>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;
