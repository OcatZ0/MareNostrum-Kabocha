import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Route, Truck, Users,
  Building2, Bell, Leaf, Settings, Anchor, X,
} from 'lucide-react';
import { COLORS } from './dashboardTheme';
import { getNotifications } from '../../api/notificationsApi';

const NAV_ITEMS = [
  { label: 'Dashboard',       icon: LayoutDashboard, to: '/app/dashboard' },
  { label: 'Trips',           icon: Route,           to: '/app/trips' },
  { label: 'Trucks',          icon: Truck,           to: '/app/trucks' },
  { label: 'Drivers',         icon: Users,           to: '/app/drivers' },
  { label: 'Companies & Ports', icon: Building2,     to: '/app/companies-ports' },
  { label: 'Notifications',   icon: Bell,            to: '/app/notifications', badgeKey: 'unread' },
  { label: 'Emissions',       icon: Leaf,            to: '#' },
  { label: 'Settings',        icon: Settings,        to: '#' },
];

const DashboardSidebar = ({ open = false, onClose = () => {} }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  /* poll unread count every 30 s */
  useEffect(() => {
    const load = () => {
      getNotifications({ per_page: 1, unread: true })
        .then((res) => setUnreadCount(res.data?.unread_count ?? 0))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 flex flex-col
        transform transition-transform duration-200 ease-out lg:static lg:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* brand */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${COLORS.navy}14` }}>
              <Anchor size={17} color={COLORS.navy} strokeWidth={2} />
            </div>
            <div>
              <p className="font-semibold tracking-[0.18em] text-xs leading-none" style={{ color: COLORS.navy }}>
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

        {/* nav */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <p className="px-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase mb-2">Menu</p>

          {NAV_ITEMS.map(({ label, icon: Icon, to, badgeKey }) => {
            const disabled = to === '#';
            const badge = badgeKey === 'unread' ? unreadCount : 0;

            if (disabled) {
              return (
                <div key={label}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 cursor-not-allowed select-none opacity-50">
                  <span className="flex items-center gap-3">
                    <Icon size={18} color="#CBD5E1" />{label}
                  </span>
                </div>
              );
            }

            return (
              <NavLink key={label} to={to} onClick={onClose}
                className={({ isActive }) =>
                  `w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition
                  ${isActive ? '' : 'text-slate-600 hover:bg-slate-50'}`
                }
                style={({ isActive }) =>
                  isActive ? { backgroundColor: `${COLORS.aqua}14`, color: COLORS.navy } : undefined
                }>
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-3">
                      <Icon size={18} color={isActive ? COLORS.aqua : '#94A3B8'} />
                      {label}
                    </span>
                    {badge > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white min-w-[18px] text-center"
                        style={{ backgroundColor: COLORS.teal }}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
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
