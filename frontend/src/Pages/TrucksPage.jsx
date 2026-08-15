import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, RefreshCw, ChevronLeft, ChevronRight,
  Truck, Fuel, Eye,
} from 'lucide-react';
import DashboardSidebar from '../Componnent/dashboard/DashboardSidebar';
import DashboardTopbar from '../Componnent/dashboard/DashboardTopbar';
import { COLORS } from '../Componnent/dashboard/dashboardTheme';
import { getTrucks } from '../api/trucksApi';
import TruckDetailModal from '../Componnent/trucks/TruckDetailModal';
import CreateTruckModal from '../Componnent/trucks/CreateTruckModal';

/* ── helpers ─────────────────────────────────────────────────── */
const TRUCK_STATUS_STYLES = {
  active: { label: 'Aktif', bg: '#E7F5EC', color: '#38A169' },
  maintenance: { label: 'Maintenance', bg: '#FBF1DE', color: '#C08A1E' },
};

const FUEL_LABELS = {
  diesel: 'Diesel',
  petrol: 'Petrol',
  electric: 'Electric',
};

const statusStyle = (status) =>
  TRUCK_STATUS_STYLES[status] ?? { label: status, bg: '#F1F5F9', color: '#64748B' };

/* ── filter pills ─────────────────────────────────────────────── */
const STATUS_FILTERS = ['all', 'active', 'maintenance'];

/* ═══════════════════════════════════════════════════════════════ */
const TrucksPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* data */
  const [trucks, setTrucks] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, total: 0, per_page: 15 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* filters */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  /* modals */
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  /* ── fetch ───────────────────────────────────────────────────── */
  const fetchTrucks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTrucks({ per_page: 15, page });
      setTrucks(res.data?.data ?? []);
      if (res.data?.meta) setMeta(res.data.meta);
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Gagal memuat data truk.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchTrucks(); }, [fetchTrucks]);

  /* ── client-side filter ──────────────────────────────────────── */
  const filtered = trucks.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.plate_number?.toLowerCase().includes(q) ||
      t.brand?.toLowerCase().includes(q) ||
      t.model?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
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
                Trucks
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">{meta.total} truk terdaftar</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchTrucks}
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
                <Plus size={16} /> Buat Truk
              </button>
            </div>
          </div>

          {/* ── filter bar ── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm px-3 py-2 rounded-lg border border-slate-200 bg-white">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Cari plat, brand, model…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 flex-nowrap">
              {STATUS_FILTERS.map((s) => {
                const active = s === statusFilter;
                const style = s !== 'all' ? statusStyle(s) : null;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition"
                    style={
                      active
                        ? { backgroundColor: style?.bg ?? `${COLORS.navy}14`, color: style?.color ?? COLORS.navy, borderColor: style?.color ?? COLORS.navy }
                        : { backgroundColor: 'white', color: '#64748B', borderColor: '#E2E8F0' }
                    }
                  >
                    {s === 'all' ? 'Semua' : (style?.label ?? s)}
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
                    {['ID', 'Plat / Brand', 'Model', 'Tahun', 'Bahan Bakar', 'Total Trip', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw size={18} className="animate-spin inline mr-2" />Memuat…
                    </td></tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Tidak ada truk ditemukan.</td></tr>
                  )}
                  {!loading && filtered.map((truck) => {
                    const s = statusStyle(truck.status);
                    return (
                      <tr key={truck.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">#{truck.id}</td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate">
                            <Truck size={13} color={COLORS.teal} className="shrink-0" />
                            <span className="truncate">{truck.plate_number}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 truncate">{truck.brand}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{truck.model ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{truck.year}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Fuel size={12} />
                            {FUEL_LABELS[truck.fuel_type] ?? truck.fuel_type}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{truck.trips_count ?? 0}</td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedTruck(truck)}
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
              {!loading && filtered.length === 0 && <div className="py-12 text-center text-slate-400">Tidak ada truk ditemukan.</div>}
              {!loading && filtered.map((truck) => {
                const s = statusStyle(truck.status);
                return (
                  <button key={truck.id} onClick={() => setSelectedTruck(truck)} className="w-full text-left px-4 py-4 hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Truck size={12} color={COLORS.teal} />
                          <span className="font-mono text-xs" style={{ color: COLORS.teal }}>#{truck.id}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 truncate">{truck.plate_number}</p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{truck.brand} · {truck.model ?? '—'} · {truck.year}</p>
                        <p className="text-xs text-slate-400 mt-1">{FUEL_LABELS[truck.fuel_type] ?? truck.fuel_type} · {truck.trips_count ?? 0} trip</p>
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

      {selectedTruck && (
        <TruckDetailModal
          truck={selectedTruck}
          onClose={() => setSelectedTruck(null)}
          onRefresh={() => { fetchTrucks(); setSelectedTruck(null); }}
          onTruckUpdated={(updated) => setSelectedTruck(updated)}
        />
      )}
      {showCreate && (
        <CreateTruckModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchTrucks(); }}
        />
      )}
    </div>
  );
};

export default TrucksPage;
