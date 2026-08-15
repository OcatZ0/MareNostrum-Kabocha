import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck, Plus, Search, RefreshCw, Edit2, Trash2,
  ChevronLeft, ChevronRight, Fuel, Calendar, Zap,
  X, Check, Loader2, AlertCircle, AlertTriangle, BarChart2,
} from 'lucide-react';
import DashboardSidebar from '../Componnent/dashboard/DashboardSidebar';
import DashboardTopbar  from '../Componnent/dashboard/DashboardTopbar';
import { COLORS }       from '../Componnent/dashboard/dashboardTheme';
import { getTrucks, createTruck, updateTruck, deleteTruck, truckEmissions } from '../api/trucksApi';

/* ── animation keyframes ─────────────────────────────────────── */
const ANIM = `
  @keyframes row-in     { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
  @keyframes modal-in   { from{opacity:0;transform:translateY(16px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes fade-in    { from{opacity:0} to{opacity:1} }
  @keyframes shake      { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-4px)} 40%,80%{transform:translateX(4px)} }
  @keyframes highlight  { 0%{background:#E0F7F4} 100%{background:transparent} }
`;

/* ── status badge ────────────────────────────────────────────── */
const STATUS = {
  active:      { label: 'Active',      bg: '#ECFDF5', color: COLORS.green },
  maintenance: { label: 'Maintenance', bg: '#FDF2E9', color: '#C2703D' },
};
const StatusBadge = ({ status }) => {
  const s = STATUS[status] ?? { label: status, bg: '#F1F5F9', color: '#64748B' };
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
  );
};

const FUEL_ICON  = { diesel: '⛽', petrol: '🔴', electric: '⚡' };
const FUEL_COLOR = { diesel: '#64748B', petrol: '#C2703D', electric: COLORS.teal };

/* ── filter pills config ─────────────────────────────────────── */
const STATUS_PILLS = [
  { key: 'all',         label: 'All' },
  { key: 'active',      label: 'Active' },
  { key: 'maintenance', label: 'Maintenance' },
];
const FUEL_PILLS = [
  { key: 'all',      label: 'All Fuel' },
  { key: 'diesel',   label: '⛽ Diesel' },
  { key: 'petrol',   label: '🔴 Petrol' },
  { key: 'electric', label: '⚡ Electric' },
];

/* ═══════════════════════════════════════════════════════════════ */
const TrucksPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* list state */
  const [trucks, setTrucks]     = useState([]);
  const [meta, setMeta]         = useState({ current_page: 1, total: 0 });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [page, setPage]         = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]     = useState('');
  const [statusF, setStatusF]   = useState('all');
  const [fuelF, setFuelF]       = useState('all');

  /* modals */
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [emissionsTarget, setEmissionsTarget] = useState(null);
  const [newId, setNewId] = useState(null);

  /* fetch */
  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await getTrucks({
        page, per_page: 15,
        ...(search              ? { search }            : {}),
        ...(statusF !== 'all'   ? { status:   statusF } : {}),
        ...(fuelF   !== 'all'   ? { fuel_type: fuelF  } : {}),
      });
      setTrucks(res.data?.data ?? []);
      if (res.data?.meta) setMeta(res.data.meta);
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to load trucks.');
    } finally { setLoading(false); }
  }, [page, search, statusF, fuelF]);

  useEffect(() => { fetch(); }, [fetch]);

  /* debounce search */
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.ceil(meta.total / 15) || 1;

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
              <h1 className="text-xl font-semibold" style={{ color: COLORS.navy }}>Trucks</h1>
              <p className="text-sm text-slate-400 mt-0.5">{meta.total} truck{meta.total !== 1 ? 's' : ''} registered</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={fetch} title="Refresh"
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}>
                <Plus size={16} /><span className="hidden sm:inline">Add Truck</span><span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>

          {/* filter bar — search full width, pills scroll on mobile */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input type="text" placeholder="Search plate, brand, model…"
                value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400" />
            </div>
            {/* status pills row */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-nowrap">
              {STATUS_PILLS.map(({ key, label }) => (
                <button key={key} onClick={() => { setStatusF(key); setPage(1); }}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition"
                  style={statusF === key
                    ? key === 'maintenance'
                      ? { backgroundColor: '#FDF2E9', color: '#C2703D', borderColor: '#C2703D' }
                      : { backgroundColor: `${COLORS.green}18`, color: COLORS.green, borderColor: COLORS.green }
                    : { backgroundColor: 'white', color: '#64748B', borderColor: '#E2E8F0' }}>
                  {label}
                </button>
              ))}
              <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />
              {FUEL_PILLS.map(({ key, label }) => (
                <button key={key} onClick={() => { setFuelF(key); setPage(1); }}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition"
                  style={fuelF === key
                    ? { backgroundColor: `${COLORS.teal}14`, color: COLORS.teal, borderColor: COLORS.teal }
                    : { backgroundColor: 'white', color: '#64748B', borderColor: '#E2E8F0' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          {/* table */}
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['ID', 'Plate', 'Brand / Model', 'Year', 'Fuel', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading && <tr><td colSpan={7} className="px-4 py-14 text-center text-slate-400"><RefreshCw size={18} className="animate-spin inline mr-2" />Loading…</td></tr>}
                  {!loading && trucks.length === 0 && <tr><td colSpan={7} className="px-4 py-14 text-center text-slate-400 text-sm">No trucks found.</td></tr>}
                  {!loading && trucks.map((t, i) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors group"
                      style={{
                        animation: t.id === newId
                          ? 'highlight 1.8s ease-out forwards'
                          : `row-in 0.16s ease-out ${i * 25}ms both`,
                      }}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">#{t.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${COLORS.navy}0D` }}>
                            <Truck size={14} color={COLORS.navy} />
                          </span>
                          <span className="font-mono font-semibold text-slate-800 text-sm">{t.plate_number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{t.brand}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{t.model ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1"><Calendar size={11} />{t.year}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs font-medium capitalize"
                          style={{ color: FUEL_COLOR[t.fuel_type] ?? '#64748B' }}>
                          {FUEL_ICON[t.fuel_type] ?? <Fuel size={11} />} {t.fuel_type}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEmissionsTarget(t)} title="CO₂ emissions"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition">
                            <BarChart2 size={13} />
                          </button>
                          <button onClick={() => setEditTarget(t)} title="Edit"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => setDeleteTarget(t)} title="Delete"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {loading && <div className="py-12 text-center text-slate-400"><RefreshCw size={18} className="animate-spin inline mr-2" />Loading…</div>}
              {!loading && trucks.length === 0 && <div className="py-12 text-center text-slate-400 text-sm">No trucks found.</div>}
              {!loading && trucks.map((t, i) => (
                <div key={t.id} className="px-4 py-4"
                  style={{
                    animation: t.id === newId ? 'highlight 1.8s ease-out forwards' : `row-in 0.16s ease-out ${i * 25}ms both`,
                  }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${COLORS.navy}0D` }}>
                        <Truck size={18} color={COLORS.navy} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-slate-800">{t.plate_number}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t.brand} {t.model} · {t.year}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={t.status} />
                          <span className="text-xs capitalize" style={{ color: FUEL_COLOR[t.fuel_type] }}>
                            {FUEL_ICON[t.fuel_type]} {t.fuel_type}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEmissionsTarget(t)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition"><BarChart2 size={14} /></button>
                      <button onClick={() => setEditTarget(t)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"><Edit2 size={14} /></button>
                      <button onClick={() => setDeleteTarget(t)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* pagination */}
            {!loading && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
                <span>Page {meta.current_page} of {totalPages} · {meta.total} total</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50 transition"><ChevronLeft size={15} /></button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50 transition"><ChevronRight size={15} /></button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {showCreate   && <TruckFormModal mode="create"               onClose={() => setShowCreate(false)}   onSaved={(t) => { setShowCreate(false); setTrucks((prev) => [t, ...prev]); setMeta((m) => ({ ...m, total: m.total + 1 })); setNewId(t.id); }} />}
      {editTarget   && <TruckFormModal mode="edit" truck={editTarget} onClose={() => setEditTarget(null)} onSaved={(t) => { setEditTarget(null);   setTrucks((prev) => prev.map((x) => x.id === t.id ? t : x)); setNewId(t.id); }} />}
      {deleteTarget && <TruckDeleteModal truck={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => { setDeleteTarget(null); fetch(); }} />}
      {emissionsTarget && <TruckEmissionsModal truck={emissionsTarget} onClose={() => setEmissionsTarget(null)} />}
    </div>
  );
};

/* ── TruckFormModal ──────────────────────────────────────────── */
const TruckFormModal = ({ mode, truck, onClose, onSaved }) => {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    plate_number: truck?.plate_number ?? '',
    brand:        truck?.brand        ?? '',
    model:        truck?.model        ?? '',
    year:         truck?.year         != null ? String(truck.year) : '',
    fuel_type:    truck?.fuel_type    ?? 'diesel',
    status:       truck?.status       ?? 'active',
  });
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]     = useState(null);
  const [success, setSuccess]       = useState(false);
  const [mounted, setMounted]       = useState(false);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setErrors((p) => { const n = { ...p }; delete n[k]; return n; }); setApiError(null); };

  const validate = () => {
    const e = {};
    if (!form.plate_number.trim()) e.plate_number = 'Plate number is required';
    if (!form.brand.trim())        e.brand        = 'Brand is required';
    const yr = parseInt(form.year);
    if (!form.year || isNaN(yr) || yr < 1990 || yr > new Date().getFullYear() + 1) e.year = `Year must be between 1990 and ${new Date().getFullYear() + 1}`;
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true); setApiError(null);
    const payload = { ...form, year: parseInt(form.year), model: form.model || undefined };
    try {
      let saved;
      if (isEdit) { const r = await updateTruck(truck.id, payload); saved = r.data?.data; }
      else        { const r = await createTruck(payload);            saved = r.data?.data; }
      setSuccess(true);
      setTimeout(() => onSaved(saved ?? payload), 600);
    } catch (err) {
      const d = err?.response?.data;
      if (d?.errors) { const m = {}; Object.entries(d.errors).forEach(([k, v]) => { m[k] = Array.isArray(v) ? v[0] : v; }); setErrors(m); }
      else setApiError(d?.message ?? 'Something went wrong.');
    } finally { setSubmitting(false); }
  };

  const inputCls = (k) => `w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-700 outline-none transition-all ${errors[k] ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200 hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh', animation: mounted ? 'modal-in 0.22s cubic-bezier(0.34,1.2,0.64,1)' : 'none' }}
        onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${COLORS.navy}0D` }}>
              <Truck size={16} color={COLORS.navy} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">{isEdit ? 'Edit Truck' : 'Add Truck'}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{isEdit ? `Editing ${truck.plate_number}` : 'Register a new truck'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* plate */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Plate Number *</label>
            <input type="text" value={form.plate_number} onChange={(e) => set('plate_number', e.target.value.toUpperCase())}
              placeholder="e.g. BP 1004 XY" className={`${inputCls('plate_number')} font-mono uppercase`} />
            {errors.plate_number && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.plate_number}</p>}
          </div>

          {/* brand + model */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Brand *</label>
              <input type="text" value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="e.g. Hino" className={inputCls('brand')} />
              {errors.brand && <p className="mt-1 text-xs text-red-500"><AlertCircle size={11} className="inline mr-1" />{errors.brand}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Model</label>
              <input type="text" value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="e.g. Dutro 130 HD" className={inputCls('model')} />
            </div>
          </div>

          {/* year */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Year *</label>
            <input type="number" value={form.year} onChange={(e) => set('year', e.target.value)}
              min={1990} max={new Date().getFullYear() + 1} placeholder="e.g. 2022" className={inputCls('year')} />
            {errors.year && <p className="mt-1 text-xs text-red-500"><AlertCircle size={11} className="inline mr-1" />{errors.year}</p>}
          </div>

          {/* fuel type */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fuel Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {['diesel', 'petrol', 'electric'].map((f) => (
                <button key={f} type="button" onClick={() => set('fuel_type', f)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all capitalize"
                  style={form.fuel_type === f
                    ? { borderColor: FUEL_COLOR[f], backgroundColor: `${FUEL_COLOR[f]}14`, color: FUEL_COLOR[f] }
                    : { borderColor: '#E2E8F0', color: '#64748B' }}>
                  {FUEL_ICON[f]} {f}
                  {form.fuel_type === f && <Check size={11} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* status */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATUS).map(([key, { label, bg, color }]) => (
                <button key={key} type="button" onClick={() => set('status', key)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all"
                  style={form.status === key ? { borderColor: color, backgroundColor: bg, color } : { borderColor: '#E2E8F0', color: '#64748B' }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: form.status === key ? color : '#CBD5E1' }} />
                  {label}
                  {form.status === key && <Check size={12} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {apiError && <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700"><AlertCircle size={13} />{apiError}</div>}
        </form>

        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 transition">Cancel</button>
          <button type="submit" onClick={handleSubmit} disabled={submitting || success}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ backgroundColor: success ? COLORS.green : COLORS.teal, boxShadow: `0 2px 8px ${COLORS.teal}30` }}>
            {success ? <><Check size={15} />{isEdit ? 'Saved!' : 'Added!'}</> : submitting ? <><Loader2 size={15} className="animate-spin" />Saving…</> : isEdit ? 'Save Changes' : 'Add Truck'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── TruckDeleteModal ────────────────────────────────────────── */
const TruckDeleteModal = ({ truck, onClose, onDeleted }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handle = async () => {
    setLoading(true); setError(null);
    try { await deleteTruck(truck.id); onDeleted(); }
    catch (e) { setError(e?.response?.data?.message ?? 'Cannot delete this truck.'); setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ animation: 'modal-in 0.18s ease-out' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"><X size={14} /></button>
        <div className="p-6 pt-8">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4"><Trash2 size={22} color="#EF4444" /></div>
          <h3 className="text-base font-semibold text-slate-800 text-center">Delete Truck</h3>
          <p className="text-sm text-slate-500 text-center mt-2">Are you sure you want to delete <strong className="text-slate-700">{truck.plate_number}</strong>?</p>
          <div className="flex items-start gap-2 mt-4 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />Trucks assigned to existing trips cannot be deleted.
          </div>
          {error && <div className="mt-3 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700">{error}</div>}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handle} disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: '#EF4444' }}>
            {loading ? <><Loader2 size={14} className="animate-spin" />Deleting…</> : <><Trash2 size={14} />Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── TruckEmissionsModal ─────────────────────────────────────── */
const TruckEmissionsModal = ({ truck, onClose }) => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    truckEmissions(truck.id)
      .then((res) => setData(res.data?.data))
      .catch((e) => setError(e?.response?.data?.message ?? 'Failed to load emissions.'))
      .finally(() => setLoading(false));
  }, [truck.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '85vh', animation: 'modal-in 0.22s ease-out' }} onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${COLORS.teal}14` }}>
              <BarChart2 size={16} color={COLORS.teal} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">CO₂ Emissions</h2>
              <p className="text-xs text-slate-400 mt-0.5">{truck.plate_number} · {truck.brand} {truck.model}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"><X size={15} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <div className="flex items-center gap-2 text-slate-400 py-8 justify-center"><RefreshCw size={16} className="animate-spin" />Loading…</div>}
          {error   && <div className="text-red-500 text-sm py-8 text-center">{error}</div>}
          {data && (
            <div className="space-y-5">
              {/* summary cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Trips',   value: data.summary.total_trips },
                  { label: 'Total Distance', value: `${data.summary.total_distance_km} km` },
                  { label: 'Total CO₂',     value: `${data.summary.total_co2_kg} kg` },
                  { label: 'Avg CO₂/Trip',  value: `${data.summary.average_co2_per_trip_kg} kg` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl p-3 border border-slate-100 bg-slate-50">
                    <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                    <p className="text-base font-semibold text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
              {/* emission factor */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500">Emission factor</span>
                <span className="text-sm font-semibold" style={{ color: COLORS.teal }}>
                  {data.emission_factor_kg_per_km ?? '—'} kg/km
                </span>
              </div>
              {/* trip list */}
              {data.trips?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Trip Breakdown</p>
                  <ul className="space-y-2">
                    {data.trips.map((t) => (
                      <li key={t.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 text-xs">
                        <span className="font-mono text-slate-500">#{t.id}</span>
                        <span className="text-slate-600 capitalize">{t.status.replace(/_/g, ' ')}</span>
                        <span className="font-medium text-slate-700">{t.estimated_co2_kg != null ? `${t.estimated_co2_kg} kg` : '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 flex justify-end px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition">Close</button>
        </div>
      </div>
    </div>
  );
};

export default TrucksPage;
