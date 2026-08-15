import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Route,
  Truck,
  Ship,
  Users,
  Building2,
  Bell,
  Leaf,
  Settings,
  X,
} from 'lucide-react';

import { COLORS } from './dashboardTheme';
import { getNotifications } from '../../api/notificationsApi';
import logo from '../../assets/logo.png';

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: '/app/dashboard',
  },
  {
    label: 'Trips',
    icon: Route,
    to: '/app/trips',
  },
  {
    label: 'Trucks',
    icon: Truck,
    to: '/app/trucks',
  },
  {
    label: 'Jadwal Kapal',
    icon: Ship,
    to: '/app/vessel-schedules',
  },
  {
    label: 'Drivers',
    icon: Users,
    to: '/app/drivers',
  },
  {
    label: 'Companies & Ports',
    icon: Building2,
    to: '/app/companies-ports',
  },
  {
    label: 'Notifications',
    icon: Bell,
    to: '/app/notifications',
    badgeKey: 'unread',
  },
];

const DashboardSidebar = ({
  open = false,
  onClose = () => {},
  unreadCountProp = null,
}) => {
  const [unreadCount, setUnreadCount] = useState(unreadCountProp ?? 0);

  useEffect(() => {
    if (unreadCountProp !== null && unreadCountProp !== undefined) {
      setUnreadCount(unreadCountProp);
    }
  }, [unreadCountProp]);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64
          border-r-2 border-slate-200
          flex flex-col
          transform transition-transform duration-200 ease-out
          lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          backgroundColor: '#ffffff',
          backgroundImage: `
            radial-gradient(circle at top left, ${COLORS.aqua}1A, transparent 45%),
            linear-gradient(180deg, ${COLORS.navy}08 0%, transparent 35%)
          `,
        }}
      >
        {/* Decorative maritime wave pattern — purely visual, sits behind content */}
        <svg
          className="absolute inset-x-0 bottom-0 w-full pointer-events-none select-none"
          style={{ height: '180px', zIndex: 0 }}
          viewBox="0 0 256 180"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,90 C40,60 80,120 128,90 C176,60 216,120 256,90 L256,180 L0,180 Z"
            fill={COLORS.aqua}
            opacity="0.07"
          />
          <path
            d="M0,120 C40,95 80,145 128,120 C176,95 216,145 256,120 L256,180 L0,180 Z"
            fill={COLORS.teal}
            opacity="0.09"
          />
          <path
            d="M0,150 C40,130 80,165 128,150 C176,130 216,165 256,150 L256,180 L0,180 Z"
            fill={COLORS.navy}
            opacity="0.05"
          />
        </svg>

        {/* =====================================================
            BRAND / LOGO
        ====================================================== */}
        <div className="relative z-10 flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            
            {/* Logo image */}
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <img
                src={logo}
                alt="Mare Nostrum Logo"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Brand text */}
            <div>
              <p
                className="font-semibold tracking-[0.18em] text-xs leading-none"
                style={{ color: COLORS.navy }}
              >
                MARE NOSTRUM
              </p>

              <p
                className="text-[10px] italic mt-1 leading-none"
                style={{ color: COLORS.teal }}
              >
                Our sea, our trade
              </p>
            </div>
          </div>

          {/* Close button - mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-slate-600"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* =====================================================
            NAVIGATION
        ====================================================== */}
        <nav className="relative z-10 flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          
          {/* Menu title */}
          <p className="px-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase mb-2">
            Menu
          </p>

          {/* Navigation items */}
          {NAV_ITEMS.map(({ label, icon: Icon, to, badgeKey }) => {
            const badge = badgeKey === 'unread' ? unreadCount : 0;  

            /* =================================================
               Active / enabled menu
            ================================================== */
            return (
              <NavLink
                key={label}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `
                    w-full flex items-center justify-between gap-2
                    px-3 py-2.5 rounded-lg
                    text-sm font-medium
                    transition
                    ${
                      isActive
                        ? ''
                        : 'text-slate-600 hover:bg-slate-50'
                    }
                  `
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        backgroundColor: `${COLORS.aqua}14`,
                        color: COLORS.navy,
                      }
                    : undefined
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Menu icon + label */}
                    <span className="flex items-center gap-3">
                      <Icon
                        size={18}
                        color={
                          isActive
                            ? COLORS.aqua
                            : '#94A3B8'
                        }
                      />

                      {label}
                    </span>

                    {/* Notification badge */}
                    {badge > 0 && (
                      <span
                        className="
                          text-[10px] font-bold
                          px-1.5 py-0.5
                          rounded-full
                          text-white
                          min-w-[18px]
                          text-center
                        "
                        style={{
                          backgroundColor: COLORS.teal,
                        }}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* =====================================================
            SIDEBAR FOOTER
        ====================================================== */}
        <div className="relative z-10 px-5 py-4 border-t-2 border-slate-200">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Batam ↔ Singapore cross-border logistics visibility.
          </p>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;