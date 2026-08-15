import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, RefreshCw, ChevronLeft, ChevronRight,
  Phone, Eye,
} from 'lucide-react';
import DashboardSidebar from '../Componnent/dashboard/DashboardSidebar';
import DashboardTopbar from '../Componnent/dashboard/DashboardTopbar';
import { COLORS } from '../Componnent/dashboard/dashboardTheme';
import { getUsers } from '../api/usersApi';
import DriverDetailModal from '../Componnent/drivers/DriverDetailModal';
import CreateDriverModal from '../Componnent/drivers/CreateDriverModal';

/* ── helpers ─────────────────────────────────────────────────── */
const ROLE_STYLES = {
  admin: { label: 'Admin', bg: '#EEF3F8', color: '#1A365D' },
  driver: { label: 'Driver', bg: '#E7F5EC', color: '#38A169' },
};

const roleStyle = (role) =>
  ROLE_STYLES[role] ?? { label: role, bg: '#F1F5F9', color: '#64748B' };

const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();

/* ── filter pills ─────────────────────────────────────────────── */
const ROLE_FILTERS = ['all', 'driver', 'admin'];

/* ═══════════════════════════════════════════════════════════════ */
const DriversPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* data */
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, total: 0, per_page: 15 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* filters */
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);

  /* modals */
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  /* ── fetch ───────────────────────────────────────────────────── */
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getUsers({ per_page: 15, page });
      setUsers(res.data?.data ?? []);
      if (res.data?.meta) setMeta(res.data.meta);
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Gagal memuat data driver.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /* ── client-side filter ──────────────────────────────────────── */
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalPages = Math.ceil(meta.total / 15) || 1;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: COLORS.bg }}>
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        <DashboardTopbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 px-4 sm:px-6 py-6 space-y-5">
          {/* ── header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold" style={{ color: COLORS.navy }}>
                Drivers
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {meta.total} user · {users.filter((u) => u.role === 'driver').length} driver
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchUsers}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                title="Refresh"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}
              >
                <Plus size={16} /> Buat User
              </button>
            </div>
          </div>

          {/* ── filter bar ── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm px-3 py-2 rounded-lg border border-slate-200 bg-white">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Cari nama, username…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 flex-nowrap">
              {ROLE_FILTERS.map((r) => {
                const active = r === roleFilter;
                const style = r !== 'all' ? roleStyle(r) : null;
                return (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition"
                    style={
                      active
                        ? { backgroundColor: style?.bg ?? `${COLORS.navy}14`, color: style?.color ?? COLORS.navy, borderColor: style?.color ?? COLORS.navy }
                        : { backgroundColor: 'white', color: '#64748B', borderColor: '#E2E8F0' }
                    }
                  >
                    {r === 'all' ? 'Semua' : (style?.label ?? r)}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* ── table ── */}
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            {/* desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['ID', 'Nama', 'Username', 'Telepon', 'Role', 'Total Trip', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw size={18} className="animate-spin inline mr-2" />Memuat…
                    </td></tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Tidak ada user ditemukan.</td></tr>
                  )}
                  {!loading && filtered.map((user) => {
                    const s = roleStyle(user.role);
                    return (
                      <tr key={user.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">#{user.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                              style={{ backgroundColor: `${COLORS.navy}14`, color: COLORS.navy }}
                            >
                              {initials(user.name)}
                            </div>
                            <span className="text-slate-700 font-medium truncate">{user.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{user.username}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Phone size={11} />
                            {user.phone ?? '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{user.trips_count ?? 0}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            title="Detail & Aksi"
                          >
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {loading && <div className="py-12 text-center text-slate-400"><RefreshCw size={18} className="animate-spin inline mr-2" />Memuat…</div>}
              {!loading && filtered.length === 0 && <div className="py-12 text-center text-slate-400">Tidak ada user ditemukan.</div>}
              {!loading && filtered.map((user) => {
                const s = roleStyle(user.role);
                return (
                  <button key={user.id} onClick={() => setSelectedUser(user)} className="w-full text-left px-4 py-4 hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                          style={{ backgroundColor: `${COLORS.navy}14`, color: COLORS.navy }}
                        >
                          {initials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
                          <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">{user.username}</p>
                          <p className="text-xs text-slate-400 mt-1">{user.phone ?? '—'} · {user.trips_count ?? 0} trip</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* pagination */}
            {!loading && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
                <span>Hal. {meta.current_page} / {totalPages} · {meta.total} total</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50 transition">
                    <ChevronLeft size={15} />
                  </button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50 transition">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedUser && (
        <DriverDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onRefresh={() => { fetchUsers(); setSelectedUser(null); }}
          onUserUpdated={(updated) => setSelectedUser(updated)}
        />
      )}
      {showCreate && (
        <CreateDriverModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchUsers(); }}
        />
      )}
    </div>
  );
};

export default DriversPage;
