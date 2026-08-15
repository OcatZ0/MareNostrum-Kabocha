import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, RefreshCw, CheckCheck, Check, ChevronLeft, ChevronRight,
  Truck, Ship, MapPin, AlertTriangle, Info, Package,
} from 'lucide-react';
import DashboardSidebar from '../Componnent/dashboard/DashboardSidebar';
import DashboardTopbar  from '../Componnent/dashboard/DashboardTopbar';
import { COLORS }       from '../Componnent/dashboard/dashboardTheme';
import { getNotifications, markAsRead, markAllAsRead } from '../api/notificationsApi';

/* ── animation ───────────────────────────────────────────────── */
const ANIM = `
  @keyframes item-in  { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fade-in  { from{opacity:0} to{opacity:1} }
  @keyframes badge-in { from{transform:scale(0)} to{transform:scale(1)} }
`;

/* ── notification type config ────────────────────────────────── */
const TYPE_CONFIG = {
  trip_assigned:           { icon: Truck,         bg: `${COLORS.teal}14`,  color: COLORS.teal,  label: 'Trip Assigned' },
  arrived_at_point:        { icon: MapPin,         bg: `${COLORS.green}14`, color: COLORS.green, label: 'Arrived' },
  trip_completed:          { icon: Check,          bg: `${COLORS.green}14`, color: COLORS.green, label: 'Completed' },
  location_validation_failed: { icon: AlertTriangle, bg: '#FEF3C714',       color: '#D97706',    label: 'Location Error' },
  ship_departed:           { icon: Ship,           bg: `${COLORS.aqua}14`, color: COLORS.aqua,  label: 'Ship Departed' },
  ship_arrived:            { icon: Ship,           bg: `${COLORS.green}14`, color: COLORS.green, label: 'Ship Arrived' },
};

const getTypeConf = (type) =>
  TYPE_CONFIG[type] ?? { icon: Info, bg: `${COLORS.navy}0D`, color: COLORS.navy, label: type?.replace(/_/g, ' ') ?? 'Notification' };

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)    return `${diffD}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ═══════════════════════════════════════════════════════════════ */
const NotificationsPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [notifs, setNotifs]     = useState([]);
  const [meta, setMeta]         = useState({ current_page: 1, total: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [page, setPage]         = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await getNotifications({
        page, per_page: 20,
        ...(unreadOnly ? { unread: true } : {}),
      });
      setNotifs(res.data?.data ?? []);
      if (res.data?.meta)         setMeta(res.data.meta);
      if (res.data?.unread_count != null) setUnreadCount(res.data.unread_count);
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to load notifications.');
    } finally { setLoading(false); }
  }, [page, unreadOnly]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleMarkOne = async (id) => {
    await markAsRead(id).catch(() => {});
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllAsRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (_) {}
    setMarkingAll(false);
  };

  const totalPages = Math.ceil(meta.total / 20) || 1;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: COLORS.bg }}>
      <style>{ANIM}</style>
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col lg:pl-64">
        <DashboardTopbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 px-4 sm:px-6 py-6 space-y-5">

          {/* header */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: COLORS.navy }}>
                Notifications
                {unreadCount > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: COLORS.teal, animation: 'badge-in 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
                    {unreadCount}
                  </span>
                )}
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">{meta.total} notification{meta.total !== 1 ? 's' : ''} total</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={fetch} title="Refresh"
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              {unreadCount > 0 && (
                <button onClick={handleMarkAll} disabled={markingAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}>
                  {markingAll ? <RefreshCw size={14} className="animate-spin" /> : <CheckCheck size={15} />}
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* filter pills */}
          <div className="flex items-center gap-2">
            {[
              { key: false, label: 'All' },
              { key: true,  label: 'Unread only' },
            ].map(({ key, label }) => (
              <button key={String(key)} onClick={() => { setUnreadOnly(key); setPage(1); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border transition"
                style={unreadOnly === key
                  ? { backgroundColor: `${COLORS.navy}14`, color: COLORS.navy, borderColor: COLORS.navy }
                  : { backgroundColor: 'white', color: '#64748B', borderColor: '#E2E8F0' }}>
                {label}
              </button>
            ))}
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          {/* notifications list */}
          <div className="space-y-2" style={{ animation: 'fade-in 0.2s ease-out' }}>
            {loading && (
              <div className="py-14 text-center text-slate-400">
                <RefreshCw size={20} className="animate-spin inline mr-2" />Loading…
              </div>
            )}
            {!loading && notifs.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-100 py-16 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${COLORS.navy}0A` }}>
                  <Bell size={24} color={COLORS.navy} strokeWidth={1.5} />
                </div>
                <p className="text-slate-500 text-sm font-medium">No notifications{unreadOnly ? ' unread' : ''}</p>
                <p className="text-slate-400 text-xs">You're all caught up!</p>
              </div>
            )}
            {!loading && notifs.map((n, i) => {
              const conf = getTypeConf(n.type);
              const Icon = conf.icon;
              return (
                <div key={n.id}
                  className={`flex items-start gap-4 px-4 py-4 rounded-xl border transition-all ${n.is_read ? 'bg-white border-slate-100' : 'bg-white border-slate-200 shadow-sm'}`}
                  style={{ animation: `item-in 0.16s ease-out ${i * 20}ms both` }}>
                  {/* unread dot */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: conf.bg }}>
                      <Icon size={16} color={conf.color} />
                    </div>
                    {!n.is_read && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white"
                        style={{ backgroundColor: COLORS.teal }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md capitalize"
                        style={{ backgroundColor: conf.bg, color: conf.color }}>
                        {conf.label}
                      </span>
                      {n.trip_id && (
                        <span className="font-mono text-[11px] text-slate-400">Trip #{n.trip_id}</span>
                      )}
                    </div>
                    <p className={`text-sm leading-snug ${n.is_read ? 'text-slate-500' : 'text-slate-800 font-medium'}`}>
                      {n.message}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">{fmtTime(n.created_at)}</p>
                  </div>

                  {!n.is_read && (
                    <button onClick={() => handleMarkOne(n.id)}
                      className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition"
                      title="Mark as read">
                      <Check size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* pagination */}
          {!loading && meta.total > 0 && (
            <div className="flex items-center justify-between text-sm text-slate-500 pt-1">
              <span>Page {meta.current_page} of {totalPages} · {meta.total} total</span>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50 transition"><ChevronLeft size={15} /></button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50 transition"><ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default NotificationsPage;
