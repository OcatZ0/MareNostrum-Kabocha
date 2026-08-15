import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck, Plus, Search, RefreshCw, Edit2, Trash2,
  ChevronLeft, ChevronRight, Fuel, Calendar, Zap,
  BarChart2, X, Check, AlertCircle, AlertTriangle,
  RotateCcw, ShieldCheck, Wrench, CheckCircle2,
} from 'lucide-react';
import DashboardSidebar from '../Componnent/dashboard/DashboardSidebar';
import DashboardTopbar from '../Componnent/dashboard/DashboardTopbar';
import { COLORS } from '../Componnent/dashboard/dashboardTheme';
import { getTrucks, updateTruck } from '../api/trucksApi';
import TruckFormModal from '../Componnent/Trucks/TruckFormModal';
import TruckDeleteModal from '../Componnent/Trucks/TruckDeleteModal';
import TruckEmissionsModal from '../Componnent/Trucks/TruckEmissionsModal';

/* ── Animation Styles ─────────────────────────────────────────── */
const ANIM_CSS = `
  @keyframes row-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes modal-in { from{opacity:0;transform:translateY(16px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes fade-in { from{opacity:0} to{opacity:1} }
  @keyframes highlight-pulse { 0%{background-color:#E0F7F4} 100%{background-color:transparent} }
  .scrollbar-none::-webkit-scrollbar { display: none; }
  .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
`;

/* ── Status and Fuel Badge Configurations ─────────────────────── */
const STATUS_CONFIG = {
  active: {
    label: 'Active',
    bg: '#ECFDF5',
    color: COLORS.green,
    border: '#A7F3D0',
    dot: '#10B981',
  },
  maintenance: {
    label: 'Maintenance',
    bg: '#FDF2E9',
    color: '#C2703D',
    border: '#FED7AA',
    dot: '#F97316',
  },
};

const FUEL_CONFIG = {
  diesel: {
    label: 'Diesel',
    color: '#475569',
    bg: '#F1F5F9',
    icon: Fuel,
  },
  gasoline: {
    label: 'Gasoline',
    color: '#C2703D',
    bg: '#FDF2E9',
    icon: Fuel,
  },
  electric: {
    label: 'Electric',
    color: '#0284C7',
    bg: '#E0F2FE',
    icon: Zap,
  },
};

const StatusBadge = ({ status }) => {
  const conf = STATUS_CONFIG[status] ?? {
    label: status,
    bg: '#F1F5F9',
    color: '#64748B',
    border: '#E2E8F0',
    dot: '#94A3B8',
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border"
      style={{
        backgroundColor: conf.bg,
        color: conf.color,
        borderColor: conf.border,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: conf.dot }}
      />
      {conf.label}
    </span>
  );
};

const FuelBadge = ({ fuelType }) => {
  const conf = FUEL_CONFIG[fuelType] ?? {
    label: fuelType,
    color: '#64748B',
    bg: '#F1F5F9',
    icon: Fuel,
  };
  const Icon = conf.icon;

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
      style={{ backgroundColor: conf.bg, color: conf.color }}
    >
      <Icon size={12} />
      {conf.label}
    </span>
  );
};

/* ── Filter Pills Configurations ──────────────────────────────── */
const STATUS_PILLS = [
  { key: 'all', label: 'All Status' },
  { key: 'active', label: 'Active' },
  { key: 'maintenance', label: 'Maintenance' },
];

const FUEL_PILLS = [
  { key: 'all', label: 'All Fuel' },
  { key: 'diesel', label: 'Diesel', icon: Fuel },
  { key: 'gasoline', label: 'Gasoline', icon: Fuel },
  { key: 'electric', label: 'Electric', icon: Zap },
];

/* ═══════════════════════════════════════════════════════════════ */
const TrucksPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* List & pagination state */
  const [trucks, setTrucks] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, total: 0, per_page: 15 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  /* Search and Filter state */
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fuelFilter, setFuelFilter] = useState('all');

  /* Modals */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [emissionsTarget, setEmissionsTarget] = useState(null);
  const [highlightId, setHighlightId] = useState(null);

  /* Toast notification */
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Fetch Trucks from Backend ────────────────────────────────── */
  const fetchTrucks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTrucks({
        page,
        per_page: 15,
        ...(search ? { search } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(fuelFilter !== 'all' ? { fuel_type: fuelFilter } : {}),
      });

      setTrucks(res.data?.data ?? []);
      if (res.data?.meta) {
        setMeta(res.data.meta);
      }
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to load trucks fleet data.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, fuelFilter]);

  useEffect(() => {
    fetchTrucks();
  }, [fetchTrucks]);

  /* Debounce Search Input */
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  /* ── Quick Status Toggle ──────────────────────────────────────── */
  const handleToggleStatus = async (truck) => {
    const nextStatus = truck.status === 'active' ? 'maintenance' : 'active';
    try {
      const payload = {
        plate_number: truck.plate_number,
        brand: truck.brand,
        model: truck.model ?? undefined,
        year: truck.year,
        fuel_type: truck.fuel_type,
        status: nextStatus,
      };
      await updateTruck(truck.id, payload);
      setTrucks((prev) =>
        prev.map((t) => (t.id === truck.id ? { ...t, status: nextStatus } : t))
      );
      setHighlightId(truck.id);
      showToast(
        `Truck ${truck.plate_number} status updated to ${nextStatus === 'active' ? 'Active' : 'Maintenance'}.`
      );
    } catch (err) {
      showToast(err?.response?.data?.message ?? 'Failed to toggle status.', 'error');
    }
  };

  /* Reset all filters */
  const handleResetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('all');
    setFuelFilter('all');
    setPage(1);
  };

  const hasActiveFilters = search || statusFilter !== 'all' || fuelFilter !== 'all';
  const totalPages = Math.ceil(meta.total / (meta.per_page || 15)) || 1;

  /* Fleet Stats Calculations */
  const totalCount = meta.total;
  const activeCount = trucks.filter((t) => t.status === 'active').length;
  const maintenanceCount = trucks.filter((t) => t.status === 'maintenance').length;
  const electricCount = trucks.filter((t) => t.fuel_type === 'electric').length;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: COLORS.bg }}>
      <style>{ANIM_CSS}</style>

      {/* Sidebar navigation */}
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content wrapper */}
      <div className="flex-1 min-w-0 flex flex-col lg:pl-64">
        {/* Topbar header */}
        <DashboardTopbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 px-4 sm:px-6 py-6 space-y-6">
          {/* Toast Notification Banner */}
          {toast && (
            <div
              className={`
                fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold
                animate-[fade-in_0.2s_ease-out]
                ${toast.type === 'error'
                  ? 'bg-red-600 text-white shadow-red-200'
                  : 'bg-slate-900 text-white shadow-slate-300'
                }
              `}
            >
              {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} className="text-teal-400" />}
              <span>{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Page Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.teal})` }}
                >
                  <Truck size={20} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900" style={{ color: COLORS.navy }}>
                    Fleet Vehicles & Trucks
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage logistics fleet, monitor vehicle fuel types & carbon emission rates
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
              <button
                onClick={fetchTrucks}
                title="Refresh vehicle list"
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-sm"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin text-teal-600' : ''} />
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white transition shadow-md hover:opacity-95 active:scale-95"
                style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}
              >
                <Plus size={16} />
                <span>Register Truck</span>
              </button>
            </div>
          </div>

          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Total Fleet */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Fleet</p>
                <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{totalCount}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Registered vehicles</p>
              </div>
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${COLORS.navy}0F`, color: COLORS.navy }}
              >
                <Truck size={20} />
              </div>
            </div>

            {/* Card 2: Active Vehicles */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Fleet</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1 font-mono">{activeCount}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Ready for assignment</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
            </div>

            {/* Card 3: In Maintenance */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Maintenance</p>
                <p className="text-2xl font-bold text-amber-600 mt-1 font-mono">{maintenanceCount}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Under repair / service</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Wrench size={20} />
              </div>
            </div>

            {/* Card 4: Clean & Electric */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Electric / Eco</p>
                <p className="text-2xl font-bold text-sky-600 mt-1 font-mono">{electricCount}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Zero emission vehicles</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <Zap size={20} />
              </div>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Search Bar */}
              <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm">
                <Search size={16} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search by license plate (e.g. BP 1001), brand, or model…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-slate-800 placeholder:text-slate-400"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput('')}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition shrink-0"
                >
                  <RotateCcw size={13} />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="relative">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap pb-1">
                {/* Status Pills */}
                {STATUS_PILLS.map(({ key, label }) => {
                  const active = statusFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setStatusFilter(key);
                        setPage(1);
                      }}
                      className={`
                        shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all
                        ${active
                          ? key === 'maintenance'
                            ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }
                      `}
                    >
                      {label}
                    </button>
                  );
                })}

                <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />

                {/* Fuel Pills */}
                {FUEL_PILLS.map(({ key, label, icon: Icon }) => {
                  const active = fuelFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setFuelFilter(key);
                        setPage(1);
                      }}
                      className={`
                        shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all
                        ${active
                          ? 'bg-teal-50 text-teal-800 border-teal-300 ring-1 ring-teal-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }
                      `}
                    >
                      {Icon && <Icon size={12} />}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Error Banner if fetch failed */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-700 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Unable to fetch trucks</p>
                  <p className="text-red-600 text-xs mt-0.5">{error}</p>
                </div>
              </div>
              <button
                onClick={fetchTrucks}
                className="px-3 py-1 bg-white border border-red-200 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                Retry
              </button>
            </div>
          )}

          {/* Table Container Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider w-16">
                      ID
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      License Plate
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Brand & Model
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Year / Age
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Fuel Type
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-slate-400">
                        <RefreshCw size={20} className="animate-spin inline mr-2.5 text-teal-600" />
                        <span className="text-sm font-medium">Loading fleet data…</span>
                      </td>
                    </tr>
                  )}

                  {!loading && trucks.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-slate-400">
                        <Truck size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-semibold text-slate-600">No trucks found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {hasActiveFilters
                            ? 'Try adjusting your search query or filter pills.'
                            : 'Click "Register Truck" to add your first vehicle to the fleet.'}
                        </p>
                        {hasActiveFilters && (
                          <button
                            onClick={handleResetFilters}
                            className="mt-3 text-xs font-semibold text-teal-600 hover:underline"
                          >
                            Clear all filters
                          </button>
                        )}
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    trucks.map((truck, idx) => (
                      <tr
                        key={truck.id}
                        className={`hover:bg-slate-50/70 transition-colors group ${
                          truck.id === highlightId ? 'animate-[highlight-pulse_2s_ease-out]' : ''
                        }`}
                        style={{
                          animation: `row-in 0.2s ease-out ${idx * 25}ms both`,
                        }}
                      >
                        {/* ID */}
                        <td className="px-5 py-4 font-mono text-xs text-slate-400">
                          #{truck.id}
                        </td>

                        {/* Plate Number */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span
                              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${COLORS.navy}0D`, color: COLORS.navy }}
                            >
                              <Truck size={16} />
                            </span>
                            <div>
                              <span className="font-mono font-bold text-slate-900 text-sm tracking-wide">
                                {truck.plate_number}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Brand & Model */}
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-800 text-sm">{truck.brand}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{truck.model || 'Standard'}</p>
                        </td>

                        {/* Year & Age */}
                        <td className="px-5 py-4 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-400" />
                            <span className="font-medium">{truck.year}</span>
                            {truck.age_years != null && (
                              <span className="text-slate-400">({truck.age_years}y old)</span>
                            )}
                          </div>
                        </td>

                        {/* Fuel Type */}
                        <td className="px-5 py-4">
                          <FuelBadge fuelType={truck.fuel_type} />
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <StatusBadge status={truck.status} />
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                            {/* CO2 Emissions */}
                            <button
                              onClick={() => setEmissionsTarget(truck)}
                              title="View CO₂ Carbon Intelligence"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition border border-transparent hover:border-teal-200"
                            >
                              <BarChart2 size={15} />
                            </button>

                            {/* Quick Status Toggle */}
                            <button
                              onClick={() => handleToggleStatus(truck)}
                              title={`Toggle status to ${truck.status === 'active' ? 'Maintenance' : 'Active'}`}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition border border-transparent hover:border-amber-200"
                            >
                              <Wrench size={14} />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => setEditTarget(truck)}
                              title="Edit truck"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
                            >
                              <Edit2 size={14} />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setDeleteTarget(truck)}
                              title="Delete truck"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition border border-transparent hover:border-red-200"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-slate-100">
              {loading && (
                <div className="py-14 text-center text-slate-400">
                  <RefreshCw size={20} className="animate-spin inline mr-2 text-teal-600" />
                  <span className="text-xs font-medium">Loading fleet…</span>
                </div>
              )}

              {!loading && trucks.length === 0 && (
                <div className="py-14 text-center text-slate-400 px-4">
                  <Truck size={30} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-600">No trucks found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {hasActiveFilters
                      ? 'Try adjusting your search or filters.'
                      : 'Click "Register Truck" to add a vehicle.'}
                  </p>
                </div>
              )}

              {!loading &&
                trucks.map((truck, idx) => (
                  <div
                    key={truck.id}
                    className={`p-4 hover:bg-slate-50/80 transition-colors ${
                      truck.id === highlightId ? 'animate-[highlight-pulse_2s_ease-out]' : ''
                    }`}
                    style={{ animation: `row-in 0.2s ease-out ${idx * 25}ms both` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-slate-700"
                          style={{ backgroundColor: `${COLORS.navy}0D` }}
                        >
                          <Truck size={18} color={COLORS.navy} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {truck.plate_number}
                            </span>
                            <span className="text-[11px] text-slate-400">#{truck.id}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {truck.brand} {truck.model} · {truck.year}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <StatusBadge status={truck.status} />
                            <FuelBadge fuelType={truck.fuel_type} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEmissionsTarget(truck)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 border border-slate-200"
                        >
                          <BarChart2 size={14} />
                        </button>
                        <button
                          onClick={() => setEditTarget(truck)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 border border-slate-200"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(truck)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Pagination Controls */}
            {!loading && totalCount > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/30">
                <div>
                  Showing page <span className="font-semibold text-slate-700">{meta.current_page}</span> of{' '}
                  <span className="font-semibold text-slate-700">{totalPages}</span> ({totalCount} total vehicles)
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition shadow-sm"
                  >
                    <ChevronLeft size={14} />
                    <span>Previous</span>
                  </button>

                  <div className="px-2 font-semibold text-slate-700">
                    {page} / {totalPages}
                  </div>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition shadow-sm"
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}

      {/* Create Truck Modal */}
      {showCreateModal && (
        <TruckFormModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSaved={(newTruck) => {
            setShowCreateModal(false);
            setTrucks((prev) => [newTruck, ...prev]);
            setMeta((m) => ({ ...m, total: m.total + 1 }));
            setHighlightId(newTruck.id);
            showToast(`Truck ${newTruck.plate_number} created successfully!`);
          }}
        />
      )}

      {/* Edit Truck Modal */}
      {editTarget && (
        <TruckFormModal
          mode="edit"
          truck={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updatedTruck) => {
            setEditTarget(null);
            setTrucks((prev) =>
              prev.map((t) => (t.id === updatedTruck.id ? updatedTruck : t))
            );
            setHighlightId(updatedTruck.id);
            showToast(`Truck ${updatedTruck.plate_number} updated successfully!`);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <TruckDeleteModal
          truck={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(deletedId) => {
            setDeleteTarget(null);
            setTrucks((prev) => prev.filter((t) => t.id !== deletedId));
            setMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) }));
            showToast('Truck deleted successfully.');
          }}
        />
      )}

      {/* CO2 Emissions Analytics Modal */}
      {emissionsTarget && (
        <TruckEmissionsModal
          truck={emissionsTarget}
          onClose={() => setEmissionsTarget(null)}
        />
      )}
    </div>
  );
};

export default TrucksPage;