import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Ship, Anchor, Plus, Search, RefreshCw, Edit2, Trash2,
  ChevronLeft, ChevronRight, Calendar, Clock, Navigation,
  Radio, FileSpreadsheet, Download, AlertTriangle, CheckCircle2,
  Zap, ArrowRight, ShieldCheck, MapPin, Gauge, X, Bell
} from 'lucide-react';
import DashboardSidebar from '../Componnent/dashboard/DashboardSidebar';
import DashboardTopbar from '../Componnent/dashboard/DashboardTopbar';
import { COLORS } from '../Componnent/dashboard/dashboardTheme';
import { getVesselSchedules } from '../api/vesselSchedulesApi';
import { getPorts } from '../api/portsApi';
import VesselScheduleFormModal from '../Componnent/vesselSchedules/VesselScheduleFormModal';
import VesselScheduleImportModal from '../Componnent/vesselSchedules/VesselScheduleImportModal';
import VesselScheduleStatusModal from '../Componnent/vesselSchedules/VesselScheduleStatusModal';
import VesselScheduleDeleteModal from '../Componnent/vesselSchedules/VesselScheduleDeleteModal';

/* ── Animation Styles ─────────────────────────────────────────── */
const ANIM_CSS = `
  @keyframes row-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes modal-in { from{opacity:0;transform:translateY(16px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes fade-in { from{opacity:0} to{opacity:1} }
  .scrollbar-none::-webkit-scrollbar { display: none; }
  .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
`;

/* ── Status Badge Configurations ─────────────────────────────── */
const STATUS_CONFIG = {
  scheduled: {
    label: 'Scheduled',
    bg: '#F8FAFC',
    color: '#64748B',
    border: '#E2E8F0',
    dot: '#94A3B8',
  },
  departed: {
    label: 'Departed',
    bg: '#F0FDFA',
    color: '#0D9488',
    border: '#99F6E4',
    dot: '#14B8A6',
  },
  on_time: {
    label: 'On Time',
    bg: '#ECFDF5',
    color: '#059669',
    border: '#A7F3D0',
    dot: '#10B981',
  },
  delayed: {
    label: 'Delayed',
    bg: '#FEF2F2',
    color: '#DC2626',
    border: '#FECACA',
    dot: '#EF4444',
  },
  early: {
    label: 'Early Arrival',
    bg: '#EFF6FF',
    color: '#2563EB',
    border: '#BFDBFE',
    dot: '#3B82F6',
  },
  berthing: {
    label: 'Berthing',
    bg: '#FFFBEB',
    color: '#D97706',
    border: '#FDE68A',
    dot: '#F59E0B',
  },
  arrived: {
    label: 'Arrived',
    bg: '#F0FDF4',
    color: '#16A34A',
    border: '#BBF7D0',
    dot: '#22C55E',
  },
  cancelled: {
    label: 'Cancelled',
    bg: '#F1F5F9',
    color: '#475569',
    border: '#CBD5E1',
    dot: '#64748B',
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

const STATUS_FILTER_PILLS = [
  { key: '', label: 'All Statuses' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'on_time', label: 'On Time' },
  { key: 'delayed', label: 'Delayed' },
  { key: 'early', label: 'Early Arrival' },
  { key: 'berthing', label: 'Berthing' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'cancelled', label: 'Cancelled' },
];

const VesselSchedulesPage = () => {
  const [schedules, setSchedules] = useState([]);
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current_page: 1, total: 0, per_page: 15 });

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [originPortFilter, setOriginPortFilter] = useState('');
  const [destPortFilter, setDestPortFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedScheduleForEdit, setSelectedScheduleForEdit] = useState(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedScheduleForStatus, setSelectedScheduleForStatus] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedScheduleForDelete, setSelectedScheduleForDelete] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load Ports
  useEffect(() => {
    const fetchPorts = async () => {
      try {
        const res = await getPorts({ per_page: 100 });
        setPorts(res.data?.data || []);
      } catch {
        // ignore
      }
    };
    fetchPorts();
  }, []);

  // Fetch Vessel Schedules
  const fetchSchedules = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        per_page: pagination.per_page,
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (statusFilter) params.status = statusFilter;
      if (originPortFilter) params.origin_port_id = originPortFilter;
      if (destPortFilter) params.destination_port_id = destPortFilter;
      if (dateFilter) params.date = dateFilter;

      const res = await getVesselSchedules(params);
      const data = res.data?.data || [];
      const meta = res.data?.meta || {
        current_page: page,
        total: data.length,
        per_page: pagination.per_page,
      };

      setSchedules(data);
      setPagination(meta);
    } catch {
      showToast('Failed to load vessel schedules.', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, originPortFilter, destPortFilter, dateFilter, pagination.per_page]);

  useEffect(() => {
    fetchSchedules(1);
  }, [fetchSchedules]);

  // Summary Metrics calculations
  const metrics = useMemo(() => {
    const total = pagination.total || schedules.length;
    const onTimeCount = schedules.filter((s) => s.status === 'on_time' || s.status === 'berthing' || s.status === 'arrived').length;
    const delayedCount = schedules.filter((s) => s.status === 'delayed').length;
    const earlyCount = schedules.filter((s) => s.status === 'early').length;

    return {
      total,
      onTimeCount,
      delayedCount,
      earlyCount,
    };
  }, [schedules, pagination.total]);

  const handleOpenCreate = () => {
    setSelectedScheduleForEdit(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (sch) => {
    setSelectedScheduleForEdit(sch);
    setFormModalOpen(true);
  };

  const handleOpenStatusCheck = (sch) => {
    setSelectedScheduleForStatus(sch);
    setStatusModalOpen(true);
  };

  const handleOpenDelete = (sch) => {
    setSelectedScheduleForDelete(sch);
    setDeleteModalOpen(true);
  };

  const handleDownloadTemplate = (format = 'xlsx') => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    window.open(`${baseUrl}/api/vessel-schedules/template?format=${format}`, '_blank');
  };

  const handleFormSaved = (msg) => {
    showToast(msg);
    fetchSchedules(pagination.current_page);
  };

  const handleImportSuccess = (msg) => {
    showToast(msg);
    fetchSchedules(1);
  };

  const handleStatusUpdated = () => {
    fetchSchedules(pagination.current_page);
  };

  const handleDeleteSuccess = (msg) => {
    showToast(msg);
    fetchSchedules(pagination.current_page);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <style>{ANIM_CSS}</style>

      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <DashboardTopbar />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div
                  className="p-2.5 rounded-2xl text-white shadow-md shadow-teal-500/20"
                  style={{ backgroundColor: COLORS.teal }}
                >
                  <Ship size={24} />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    Vessel Arrival & Departure Schedule
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Manage cargo/ferry vessel voyages, import Excel files, and monitor punctuality tolerance
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleDownloadTemplate('xlsx')}
                type="button"
                className="px-3 py-2.5 rounded-xl text-xs font-bold bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition flex items-center gap-1.5 shadow-sm"
                title="Download Excel template with clean layout and wide columns"
              >
                <Download size={14} className="text-emerald-600" />
                <span>Excel Template (.XLSX)</span>
              </button>

              <button
                onClick={() => handleDownloadTemplate('csv')}
                type="button"
                className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition flex items-center gap-1.5 shadow-sm"
                title="Download standard CSV template"
              >
                <Download size={14} className="text-slate-500" />
                <span>CSV Template</span>
              </button>

              <button
                onClick={() => setImportModalOpen(true)}
                type="button"
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <FileSpreadsheet size={15} />
                <span>Import Spreadsheet</span>
              </button>

              <button
                onClick={handleOpenCreate}
                type="button"
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition flex items-center gap-2 shadow-lg"
                style={{
                  backgroundColor: COLORS.teal,
                  boxShadow: `0 4px 14px ${COLORS.teal}40`,
                }}
              >
                <Plus size={16} />
                <span>Add Schedule</span>
              </button>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Total Voyages</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{metrics.total}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Recorded schedules</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-100 text-slate-600">
                <Ship size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-600">On Time / Berthing</p>
                <p className="text-2xl font-black text-emerald-700 mt-1">{metrics.onTimeCount}</p>
                <p className="text-[11px] text-emerald-600/80 mt-0.5">As estimated</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-rose-600">Delayed</p>
                <p className="text-2xl font-black text-rose-700 mt-1">{metrics.delayedCount}</p>
                <p className="text-[11px] text-rose-500 mt-0.5">&gt; Tolerance limit</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600">Early Arrival</p>
                <p className="text-2xl font-black text-blue-700 mt-1">{metrics.earlyCount}</p>
                <p className="text-[11px] text-blue-500 mt-0.5">&lt; Scheduled time</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                <Zap size={20} />
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-3.5">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search vessel name, MMSI, voyage number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-cyan-500 transition outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Origin Port Filter */}
              <select
                value={originPortFilter}
                onChange={(e) => setOriginPortFilter(e.target.value)}
                className="text-xs sm:text-sm px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-cyan-500 transition outline-none"
              >
                <option value="">All Origin Ports</option>
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.country === 'singapore' ? '🇸🇬' : '🇮🇩'} {p.name}
                  </option>
                ))}
              </select>

              {/* Destination Port Filter */}
              <select
                value={destPortFilter}
                onChange={(e) => setDestPortFilter(e.target.value)}
                className="text-xs sm:text-sm px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-cyan-500 transition outline-none"
              >
                <option value="">All Destination Ports</option>
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.country === 'singapore' ? '🇸🇬' : '🇮🇩'} {p.name}
                  </option>
                ))}
              </select>

              {/* Date Filter */}
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="text-xs sm:text-sm px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-cyan-500 transition outline-none"
              />

              {/* Refresh Button */}
              <button
                onClick={() => fetchSchedules(pagination.current_page)}
                disabled={loading}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition shrink-0 flex items-center justify-center disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
              {STATUS_FILTER_PILLS.map((pill) => {
                const active = statusFilter === pill.key;
                return (
                  <button
                    key={pill.key}
                    onClick={() => setStatusFilter(pill.key)}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0
                      ${
                        active
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }
                    `}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Schedules Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
                <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold">Loading vessel schedules...</p>
              </div>
            ) : schedules.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-slate-400 space-y-3 text-center">
                <div className="p-4 rounded-2xl bg-slate-50 text-slate-400">
                  <Ship size={36} />
                </div>
                <p className="text-sm font-bold text-slate-700">No vessel schedules found</p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Try changing the search keyword or add a new vessel schedule.
                </p>
                <button
                  onClick={handleOpenCreate}
                  className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition flex items-center gap-1.5"
                  style={{ backgroundColor: COLORS.teal }}
                >
                  <Plus size={14} />
                  <span>Add Schedule Now</span>
                </button>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] uppercase tracking-wider font-bold text-slate-400">
                        <th className="py-3.5 px-4">Vessel & MMSI</th>
                        <th className="py-3.5 px-4">Port Route</th>
                        <th className="py-3.5 px-4">Scheduled Departure</th>
                        <th className="py-3.5 px-4">Scheduled Arrival & ETA</th>
                        <th className="py-3.5 px-4">Remaining Distance & Speed</th>
                        <th className="py-3.5 px-4">Status & Deviation</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {schedules.map((sch) => {
                        const variance = sch.variance_minutes ?? 0;
                        const tolerance = sch.tolerance_minutes ?? 30;
                        const isLate = sch.status === 'delayed' || variance > tolerance;
                        const isEarly = sch.status === 'early' || variance < -tolerance;

                        return (
                          <tr
                            key={sch.id}
                            className="hover:bg-slate-50/80 transition group"
                            style={{ animation: 'row-in 0.2s ease-out' }}
                          >
                            {/* Vessel & MMSI */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-teal-50 text-teal-600 shrink-0">
                                  <Ship size={16} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-800">{sch.vessel_name}</span>
                                    {sch.voyage_number && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-600">
                                        {sch.voyage_number}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                    MMSI: {sch.ship_ref_id}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Route */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                  <span className="text-[11px]">{sch.origin_port?.country === 'singapore' ? '🇸🇬' : '🇮🇩'}</span>
                                  <span className="truncate max-w-[140px]" title={sch.origin_port?.name}>
                                    {sch.origin_port?.name || 'Origin Port'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                  <span className="text-[11px]">{sch.destination_port?.country === 'singapore' ? '🇸🇬' : '🇮🇩'}</span>
                                  <span className="truncate max-w-[140px] font-bold text-slate-800" title={sch.destination_port?.name}>
                                    {sch.destination_port?.name || 'Destination Port'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Scheduled Departure */}
                            <td className="py-3.5 px-4">
                              <p className="font-semibold text-slate-700">
                                {sch.scheduled_departure_at ? new Date(sch.scheduled_departure_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {sch.scheduled_departure_at ? new Date(sch.scheduled_departure_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : ''}
                              </p>
                            </td>

                            {/* Scheduled Arrival & ETA */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-800">
                                  {sch.scheduled_arrival_at ? new Date(sch.scheduled_arrival_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </p>
                                {sch.estimated_arrival_at && (
                                  <p className="text-[10px] text-teal-600 font-medium">
                                    ETA: {new Date(sch.estimated_arrival_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                )}
                              </div>
                            </td>

                            {/* Distance & Speed */}
                            <td className="py-3.5 px-4">
                              <p className="font-bold text-slate-800">
                                {sch.distance_to_destination_km !== null ? `${sch.distance_to_destination_km} km` : '-'}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {sch.current_speed_knots !== null ? `${sch.current_speed_knots} Knots` : sch.distance_to_destination_nm ? `${sch.distance_to_destination_nm} NM` : '-'}
                              </p>
                            </td>

                            {/* Status & Variance */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <StatusBadge status={sch.status} />
                                {variance !== 0 && (
                                  <p
                                    className={`text-[10px] font-semibold ${
                                      isLate ? 'text-rose-600' : isEarly ? 'text-blue-600' : 'text-slate-500'
                                    }`}
                                  >
                                    {variance > 0 ? `+${variance} min late` : `${Math.abs(variance)} min early`}
                                  </p>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                                <button
                                  onClick={() => handleOpenStatusCheck(sch)}
                                  className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition"
                                  title="Check Radar / Evaluate Punctuality"
                                >
                                  <Radio size={15} />
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(sch)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
                                  title="Edit Schedule"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => handleOpenDelete(sch)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                                  title="Delete Schedule"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {schedules.map((sch) => (
                    <div key={sch.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                            <Ship size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-800">{sch.vessel_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">MMSI: {sch.ship_ref_id}</p>
                          </div>
                        </div>
                        <StatusBadge status={sch.status} />
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 text-xs space-y-1">
                        <p className="text-slate-600">
                          {sch.origin_port?.name} ➔ <b>{sch.destination_port?.name}</b>
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                          <span>
                            Arrival: <b>{sch.scheduled_arrival_at ? new Date(sch.scheduled_arrival_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</b>
                          </span>
                          <span>
                            Remaining Distance: <b>{sch.distance_to_destination_km ?? '-'} km</b>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => handleOpenStatusCheck(sch)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 flex items-center gap-1"
                        >
                          <Radio size={13} />
                          <span>Radar Status</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(sch)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(sch)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Showing <b>{schedules.length}</b> of <b>{pagination.total}</b> schedules
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchSchedules(pagination.current_page - 1)}
                      disabled={pagination.current_page <= 1 || loading}
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-semibold text-slate-700">
                      Page {pagination.current_page}
                    </span>
                    <button
                      onClick={() => fetchSchedules(pagination.current_page + 1)}
                      disabled={schedules.length < pagination.per_page || loading}
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition disabled:opacity-40"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      <VesselScheduleFormModal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        schedule={selectedScheduleForEdit}
        ports={ports}
        onSaved={handleFormSaved}
      />

      <VesselScheduleImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      <VesselScheduleStatusModal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        schedule={selectedScheduleForStatus}
        onStatusUpdated={handleStatusUpdated}
      />

      <VesselScheduleDeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        schedule={selectedScheduleForDelete}
        onDeleted={handleDeleteSuccess}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
            toast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
          style={{ animation: 'fade-in 0.2s ease-out' }}
        >
          {toast.type === 'error' ? (
            <AlertTriangle size={16} className="text-rose-400" />
          ) : (
            <CheckCircle2 size={16} className="text-teal-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default VesselSchedulesPage;
