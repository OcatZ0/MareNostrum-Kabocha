import React, { useState, useEffect } from 'react';
import {
  X, Route, MapPin, Truck, Calendar, Ship, Clock,
  Leaf, CheckCircle2, AlertCircle, RefreshCw, Navigation,
  ChevronDown, ChevronUp, Edit2, Anchor, Zap, BarChart2,
} from 'lucide-react';
import { COLORS, STATUS_STYLES, CHECKPOINT_ICONS } from '../dashboard/dashboardTheme';
import {
  getTrip, updateTrip, recommendTrip, assignTrip,
  simulateTrip, setShipRef, getCheckpoints,
} from '../../api/tripsApi';

/* ── tiny helpers ────────────────────────────────────────────── */
const ss = (status) =>
  STATUS_STYLES[status] ?? { label: status, bg: '#F1F5F9', color: '#64748B' };

const fmt = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const fmtDur = (min) => {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}j ${m}m` : `${m}m`;
};

/* ── sub-components ──────────────────────────────────────────── */
const Section = ({ title, icon: Icon, children }) => (
  <div>
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon size={13} color={COLORS.teal} />}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
    </div>
    {children}
  </div>
);

const Row = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0">
    <span className="text-xs text-slate-400 shrink-0">{label}</span>
    <span className={`text-xs font-medium text-right text-slate-700 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
  </div>
);

const ApiError = ({ msg }) =>
  msg ? (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
      <AlertCircle size={12} className="shrink-0" />{msg}
    </div>
  ) : null;

const Spinner = () => (
  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
);

const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className="px-3 py-1.5 text-xs font-semibold rounded-lg transition"
    style={
      active
        ? { backgroundColor: `${COLORS.aqua}14`, color: COLORS.navy }
        : { color: '#64748B' }
    }
  >
    {children}
  </button>
);

/* ═══════════════════════════════════════════════════════════════ */
const TripDetailModal = ({ trip: initialTrip, onClose, onRefresh, onTripUpdated }) => {
  const [trip, setTrip] = useState(initialTrip);
  const [tab, setTab] = useState('info'); // info | recommend | assign | simulate | ship | checkpoints
  const [refreshing, setRefreshing] = useState(false);

  const isCross = !!trip.ship_destination_port;
  const s = ss(trip.status);

  /* refresh trip from API */
  const refreshTrip = async () => {
    setRefreshing(true);
    try {
      const res = await getTrip(trip.id);
      const updated = res.data?.data;
      setTrip(updated);
      onTripUpdated?.(updated);
    } catch (_) {}
    setRefreshing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative z-10 w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col bg-white sm:rounded-2xl shadow-2xl overflow-hidden rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── header ── */}
        <div
          className="flex items-start justify-between px-5 py-4 text-white shrink-0"
          style={{ background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.teal} 100%)` }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {isCross ? <Ship size={14} color="rgba(255,255,255,0.7)" /> : <Route size={14} color="rgba(255,255,255,0.7)" />}
              <span className="font-mono text-xs opacity-70">Trip #{trip.id}</span>
            </div>
            <h2 className="text-sm font-semibold leading-tight truncate">
              {trip.origin?.name ?? '—'} → {trip.destination?.name ?? '—'}
            </h2>
            {isCross && <p className="text-[11px] opacity-60 mt-0.5">via kapal → {trip.ship_destination_port?.name}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
            <button onClick={refreshTrip} className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition" title="Refresh">
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── route visual ── */}
        <div className="shrink-0 px-5 pt-4 pb-2">
          <RouteVisual trip={trip} />
        </div>

        {/* ── tabs ── */}
        <div className="shrink-0 flex items-center gap-1 px-4 pb-2 border-b border-slate-100 overflow-x-auto">
          <TabBtn active={tab === 'info'} onClick={() => setTab('info')}>Info</TabBtn>
          {trip.status === 'draft' && <TabBtn active={tab === 'update'} onClick={() => setTab('update')}>Edit Rute</TabBtn>}
          {trip.status === 'draft' && <TabBtn active={tab === 'recommend'} onClick={() => setTab('recommend')}>Rekomendasi</TabBtn>}
          {trip.status === 'draft' && <TabBtn active={tab === 'simulate'} onClick={() => setTab('simulate')}>Simulasi</TabBtn>}
          {trip.status === 'draft' && <TabBtn active={tab === 'assign'} onClick={() => setTab('assign')}>Assign</TabBtn>}
          {isCross && !['completed', 'cancelled'].includes(trip.status) && (
            <TabBtn active={tab === 'ship'} onClick={() => setTab('ship')}>Kapal</TabBtn>
          )}
          <TabBtn active={tab === 'checkpoints'} onClick={() => setTab('checkpoints')}>Checkpoint</TabBtn>
        </div>

        {/* ── tab body ── */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'info' && <InfoTab trip={trip} />}
          {tab === 'update' && <UpdateTab trip={trip} onUpdated={(t) => { setTrip(t); onTripUpdated?.(t); }} />}
          {tab === 'recommend' && <RecommendTab trip={trip} onUpdated={(t) => { setTrip(t); onTripUpdated?.(t); setTab('assign'); }} />}
          {tab === 'simulate' && <SimulateTab trip={trip} />}
          {tab === 'assign' && <AssignTab trip={trip} onUpdated={(t) => { setTrip(t); onTripUpdated?.(t); setTab('info'); }} />}
          {tab === 'ship' && <ShipTab trip={trip} onUpdated={(t) => { setTrip(t); onTripUpdated?.(t); }} />}
          {tab === 'checkpoints' && <CheckpointsTab trip={trip} />}
        </div>

        {/* ── footer ── */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">Dibuat {fmt(trip.created_at)}</p>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── route visual ─────────────────────────────────────────────── */
const PROGRESS = {
  draft: 4, assigned: 8, in_transit_origin: 38, at_origin_port: 50,
  on_ship: 65, at_destination_port: 82, in_transit_destination: 55,
  arrived: 88, completed: 96, cancelled: 4,
};
const RouteVisual = ({ trip }) => {
  const pct = PROGRESS[trip.status] ?? 50;
  const isCross = !!trip.ship_destination_port;
  const Icon = isCross && pct >= 50 ? Ship : Truck;
  return (
    <div className="relative rounded-xl px-5 py-5 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${COLORS.navyDark} 0%, ${COLORS.teal} 100%)` }}>
      <div className="relative h-px w-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(to right, ${COLORS.aqua} 0 5px, transparent 5px 12px)`,
          height: '1px',
        }} />
        <div className="absolute -top-2" style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}>
          <Icon size={15} color={COLORS.green} fill={COLORS.green} />
        </div>
      </div>
      <div className="flex justify-between mt-3 text-[11px]" style={{ color: '#B9D3E0' }}>
        <span className="flex items-center gap-1"><MapPin size={10} />{trip.origin?.name ?? '—'}</span>
        <span className="flex items-center gap-1">{trip.destination?.name ?? '—'}<MapPin size={10} /></span>
      </div>
    </div>
  );
};

/* ── INFO tab ─────────────────────────────────────────────────── */
const InfoTab = ({ trip }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
    <Section title="Rute" icon={Route}>
      <Row label="Asal" value={`${trip.origin?.name} (${trip.origin?.type})`} />
      <Row label="Tujuan" value={`${trip.destination?.name} (${trip.destination?.type})`} />
      {trip.ship_destination_port && <Row label="Tujuan Kapal" value={trip.ship_destination_port.name} />}
      <Row label="Jarak" value={trip.distance_km ? `${trip.distance_km} km` : null} />
      <Row label="Est. Durasi" value={fmtDur(trip.estimated_duration_min)} />
      <Row label="Est. CO₂" value={trip.estimated_co2_kg ? `${Number(trip.estimated_co2_kg).toFixed(2)} kg` : null} />
      {trip.ship_ref_id && <Row label="Ref. Kapal" value={trip.ship_ref_id} mono />}
    </Section>
    <Section title="Jadwal & Penugasan" icon={Calendar}>
      <Row label="Keberangkatan (plan)" value={fmt(trip.chosen_departure_at)} />
      <Row label="Keberangkatan (aktual)" value={fmt(trip.actual_departure_at)} />
      <Row label="Kedatangan (aktual)" value={fmt(trip.actual_arrival_at)} />
      {trip.ship_destination_port && <Row label="Truk kembali" value={fmt(trip.truck_returned_at)} />}
      <Row label="Driver ID" value={trip.driver_id ?? null} />
      <Row label="Truk ID" value={trip.truck_id ?? null} />
    </Section>
    {Array.isArray(trip.recommended_slots) && trip.recommended_slots.length > 0 && (
      <div className="sm:col-span-2">
        <Section title="Slot Rekomendasi" icon={Clock}>
          <div className="space-y-2">
            {trip.recommended_slots.map((slot, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-3 rounded-lg border text-xs"
                style={{ borderColor: slot.is_recommended ? COLORS.aqua : '#E2E8F0', backgroundColor: slot.is_recommended ? `${COLORS.aqua}0D` : 'white' }}>
                <div className="flex items-center gap-2">
                  {slot.is_recommended && <CheckCircle2 size={12} color={COLORS.green} />}
                  <span className="font-medium text-slate-700">{slot.reason}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 shrink-0">
                  <span>Skor: <strong className="text-slate-700">{slot.score}</strong></span>
                  {slot.distance_km && <span>{slot.distance_km} km</span>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    )}
  </div>
);

/* ── UPDATE ROUTE tab ─────────────────────────────────────────── */
const COMBO_TYPES = [
  { key: 'domestic', label: 'Domestik', fields: ['origin_company_id', 'destination_company_id'] },
  { key: 'cross_border', label: 'Lintas Negara', fields: ['origin_company_id', 'destination_port_id', 'ship_destination_port_id'] },
  { key: 'port_to_company', label: 'Port → Company', fields: ['origin_port_id', 'destination_company_id'] },
];
const FIELD_LABELS = {
  origin_company_id: 'ID Company Asal', destination_company_id: 'ID Company Tujuan',
  origin_port_id: 'ID Port Asal', destination_port_id: 'ID Port Tujuan (Truk)',
  ship_destination_port_id: 'ID Port Tujuan Kapal',
};

const UpdateTab = ({ trip, onUpdated }) => {
  const [comboType, setComboType] = useState('domestic');
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const activeCombo = COMBO_TYPES.find((c) => c.key === comboType);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    activeCombo.fields.forEach((f) => {
      if (!form[f] || isNaN(Number(form[f])) || Number(form[f]) < 1)
        errs[f] = 'ID angka valid diperlukan';
    });
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true); setApiError(null);
    const payload = {};
    activeCombo.fields.forEach((f) => { payload[f] = Number(form[f]); });
    try {
      const res = await updateTrip(trip.id, payload);
      onUpdated(res.data?.data);
    } catch (err) {
      const d = err?.response?.data;
      if (d?.errors) { const m = {}; Object.entries(d.errors).forEach(([k, v]) => { m[k] = Array.isArray(v) ? v[0] : v; }); setErrors(m); }
      else setApiError(d?.message ?? 'Gagal mengupdate trip.');
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-slate-500">Hanya bisa diubah saat status <strong>draft</strong>. Mengubah rute akan menghapus rekomendasi yang ada.</p>
      <div className="grid grid-cols-3 gap-2">
        {COMBO_TYPES.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => { setComboType(key); setForm({}); setErrors({}); }}
            className="px-2 py-2 rounded-lg border text-xs font-semibold text-center transition"
            style={{ borderColor: comboType === key ? COLORS.aqua : '#E2E8F0', backgroundColor: comboType === key ? `${COLORS.aqua}0D` : 'white', color: comboType === key ? COLORS.navy : '#64748B' }}>
            {label}
          </button>
        ))}
      </div>
      {activeCombo.fields.map((f) => (
        <div key={f}>
          <label className="block text-xs font-medium text-slate-600 mb-1">{FIELD_LABELS[f]}</label>
          <input type="number" min={1} value={form[f] ?? ''} onChange={(e) => { setForm((p) => ({ ...p, [f]: e.target.value })); setErrors((p) => ({ ...p, [f]: null })); }}
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none transition"
            style={{ borderColor: errors[f] ? '#EF4444' : '#E2E8F0' }} />
          {errors[f] && <p className="mt-1 text-xs text-red-500">{errors[f]}</p>}
        </div>
      ))}
      <ApiError msg={apiError} />
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-70"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}>
          {submitting ? <><Spinner /> Menyimpan…</> : <><Edit2 size={14} /> Simpan Perubahan</>}
        </button>
      </div>
    </form>
  );
};

/* ── RECOMMEND tab ────────────────────────────────────────────── */
const RecommendTab = ({ trip, onUpdated }) => {
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setApiError(null);
    try {
      const payload = date ? { date } : {};
      const res = await recommendTrip(trip.id, payload);
      onUpdated(res.data?.data);
    } catch (err) {
      setApiError(err?.response?.data?.message ?? 'Gagal mengambil rekomendasi.');
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="px-4 py-3 rounded-lg text-xs text-slate-600" style={{ backgroundColor: `${COLORS.navy}08` }}>
        Sistem akan menghubungi <strong>TomTom API</strong> untuk mencari 3 slot keberangkatan terbaik
        (06:00–12:00, 12:00–18:00, 18:00–05:00). Proses ini bisa memakan waktu ~10–30 detik.
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal (opsional, default besok)</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none transition"
          onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${COLORS.aqua}40`)}
          onBlur={(e) => (e.target.style.boxShadow = 'none')} />
      </div>
      <ApiError msg={apiError} />
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-70"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}>
          {submitting ? <><Spinner /> Memproses (dapat lama)…</> : <><Zap size={14} /> Generate Rekomendasi</>}
        </button>
      </div>
    </form>
  );
};

/* ── SIMULATE tab ─────────────────────────────────────────────── */
const SimulateTab = ({ trip }) => {
  const [departureAt, setDepartureAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [result, setResult] = useState(null);

  if (!Array.isArray(trip.recommended_slots) || trip.recommended_slots.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
        <AlertCircle size={15} color={COLORS.teal} />
        Jalankan <strong className="ml-1">Rekomendasi</strong> terlebih dahulu sebelum mensimulasikan waktu kustom.
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!departureAt) { setApiError('Pilih waktu keberangkatan.'); return; }
    setSubmitting(true); setApiError(null); setResult(null);
    try {
      const res = await simulateTrip(trip.id, { departure_at: new Date(departureAt).toISOString() });
      setResult(res.data?.data);
    } catch (err) {
      setApiError(err?.response?.data?.message ?? 'Simulasi gagal.');
    } finally { setSubmitting(false); }
  };

  const diffColor = (v) => (v > 0 ? '#C2703D' : v < 0 ? COLORS.green : '#64748B');
  const diffSign = (v) => (v > 0 ? '+' : '');

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Bandingkan waktu keberangkatan kustom dengan slot rekomendasi terdekat. Tidak ada yang disimpan.</p>
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Waktu Keberangkatan</label>
          <input type="datetime-local" value={departureAt} onChange={(e) => setDepartureAt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
            onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${COLORS.aqua}40`)}
            onBlur={(e) => (e.target.style.boxShadow = 'none')} />
        </div>
        <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-70 whitespace-nowrap"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}>
          {submitting ? <><Spinner /> Simulasi…</> : <><BarChart2 size={14} /> Simulasi</>}
        </button>
      </form>
      <ApiError msg={apiError} />

      {result && (
        <div className="space-y-3">
          {/* simulated */}
          <div className="px-4 py-3 rounded-xl border border-slate-200 space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hasil Simulasi</p>
            <Row label="Waktu" value={fmt(result.simulated?.departure_at)} />
            <Row label="Skor" value={result.simulated?.score} />
            <Row label="Jarak" value={result.simulated?.distance_km ? `${result.simulated.distance_km} km` : null} />
            <Row label="Estimasi tiba" value={fmt(result.simulated?.estimated_arrival_at)} />
            <Row label="Alasan" value={result.simulated?.reason} />
          </div>
          {/* nearest recommended */}
          <div className="px-4 py-3 rounded-xl border text-xs" style={{ borderColor: COLORS.aqua, backgroundColor: `${COLORS.aqua}08` }}>
            <p className="font-semibold text-slate-500 uppercase tracking-wide mb-2">Slot Rekomendasi Terdekat</p>
            <Row label="Waktu" value={fmt(result.nearest_recommended?.departure_at)} />
            <Row label="Skor" value={result.nearest_recommended?.score} />
          </div>
          {/* diff */}
          <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Selisih vs Rekomendasi</p>
            <div className="grid grid-cols-2 gap-x-4">
              {[
                { label: 'Selisih Skor', v: result.diff?.score },
                { label: 'Selisih Waktu', v: result.diff?.travel_time_seconds ? `${diffSign(result.diff.travel_time_seconds)}${Math.round(result.diff.travel_time_seconds / 60)}m` : null, raw: result.diff?.travel_time_seconds },
                { label: 'Selisih Jarak', v: result.diff?.distance_km ? `${diffSign(result.diff.distance_km)}${result.diff.distance_km} km` : null, raw: result.diff?.distance_km },
                { label: 'Menit dari rekomendasi', v: result.diff?.minutes_from_nearest_recommended ? `${diffSign(result.diff.minutes_from_nearest_recommended)}${result.diff.minutes_from_nearest_recommended}m` : '0m', raw: result.diff?.minutes_from_nearest_recommended },
              ].map(({ label, v, raw }) => (
                <div key={label} className="py-1.5 border-b border-slate-100 last:border-0">
                  <p className="text-[11px] text-slate-400">{label}</p>
                  <p className="text-sm font-semibold" style={{ color: diffColor(raw ?? v) }}>
                    {typeof v === 'number' ? `${diffSign(v)}${v}` : (v ?? '—')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── ASSIGN tab ───────────────────────────────────────────────── */
const AssignTab = ({ trip, onUpdated }) => {
  const [form, setForm] = useState({ truck_id: '', driver_id: '', chosen_departure_at: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  const slots = Array.isArray(trip.recommended_slots) ? trip.recommended_slots : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.truck_id || isNaN(Number(form.truck_id))) errs.truck_id = 'ID truk diperlukan';
    if (!form.driver_id || isNaN(Number(form.driver_id))) errs.driver_id = 'ID driver diperlukan';
    if (!form.chosen_departure_at) errs.chosen_departure_at = 'Pilih waktu keberangkatan';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true); setApiError(null);
    try {
      const res = await assignTrip(trip.id, {
        truck_id: Number(form.truck_id),
        driver_id: Number(form.driver_id),
        chosen_departure_at: form.chosen_departure_at,
      });
      onUpdated(res.data?.data);
    } catch (err) {
      const d = err?.response?.data;
      if (d?.errors) { const m = {}; Object.entries(d.errors).forEach(([k, v]) => { m[k] = Array.isArray(v) ? v[0] : v; }); setErrors(m); }
      else setApiError(d?.message ?? 'Gagal assign trip.');
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {slots.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs" style={{ backgroundColor: `${COLORS.teal}12`, color: COLORS.teal }}>
          <AlertCircle size={13} />Panggil <strong className="mx-1">Rekomendasi</strong> terlebih dahulu untuk mendapatkan slot keberangkatan.
        </div>
      )}

      {/* slot picker */}
      {slots.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Pilih Waktu Keberangkatan</label>
          <div className="space-y-2">
            {slots.map((slot, i) => (
              <label key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition"
                style={{
                  borderColor: form.chosen_departure_at === slot.departure_at ? COLORS.aqua : '#E2E8F0',
                  backgroundColor: form.chosen_departure_at === slot.departure_at ? `${COLORS.aqua}0D` : 'white',
                }}>
                <input type="radio" name="chosen_departure_at" value={slot.departure_at}
                  checked={form.chosen_departure_at === slot.departure_at}
                  onChange={(e) => { setForm((p) => ({ ...p, chosen_departure_at: e.target.value })); setErrors((p) => ({ ...p, chosen_departure_at: null })); }}
                  className="shrink-0" style={{ accentColor: COLORS.teal }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {slot.is_recommended && <CheckCircle2 size={11} color={COLORS.green} />}
                    <span className="text-xs font-medium text-slate-700">{slot.reason}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Skor: {slot.score}</span>
                </div>
              </label>
            ))}
          </div>
          {errors.chosen_departure_at && <p className="mt-1 text-xs text-red-500">{errors.chosen_departure_at}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[{ field: 'truck_id', label: 'ID Truk' }, { field: 'driver_id', label: 'ID Driver (role: driver)' }].map(({ field, label }) => (
          <div key={field}>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <input type="number" min={1} value={form[field]}
              onChange={(e) => { setForm((p) => ({ ...p, [field]: e.target.value })); setErrors((p) => ({ ...p, [field]: null })); }}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ borderColor: errors[field] ? '#EF4444' : '#E2E8F0' }} />
            {errors[field] && <p className="mt-1 text-xs text-red-500">{errors[field]}</p>}
          </div>
        ))}
      </div>

      <ApiError msg={apiError} />
      <div className="flex justify-end">
        <button type="submit" disabled={submitting || slots.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}>
          {submitting ? <><Spinner /> Menyimpan…</> : <><CheckCircle2 size={14} /> Assign Trip</>}
        </button>
      </div>
    </form>
  );
};

/* ── SHIP tab ─────────────────────────────────────────────────── */
const ShipTab = ({ trip, onUpdated }) => {
  const [shipRefId, setShipRefId] = useState(trip.ship_ref_id ?? '');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = shipRefId.trim();
    if (!trimmed) { setError('ship_ref_id diperlukan'); return; }
    if (!/^(\d{9}|(IMO)?\d{7})$/i.test(trimmed)) {
      setError('Harus MMSI (9 digit) atau IMO (7 digit, boleh diawali "IMO")');
      return;
    }
    setSubmitting(true); setApiError(null); setError(null); setSuccess(false);
    try {
      const res = await setShipRef(trip.id, { ship_ref_id: trimmed });
      onUpdated(res.data?.data);
      setSuccess(true);
    } catch (err) {
      setApiError(err?.response?.data?.message ?? 'Gagal menyimpan ship_ref_id.');
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="px-4 py-3 rounded-lg text-xs text-slate-600" style={{ backgroundColor: `${COLORS.navy}08` }}>
        <strong>ship_ref_id</strong> adalah nomor MMSI atau IMO kapal yang digunakan untuk segmen laut (Batam–Singapura).
        Bisa diperbarui kapan saja selama trip belum completed/cancelled.
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">MMSI / IMO Number</label>
        <input type="text" value={shipRefId} onChange={(e) => { setShipRefId(e.target.value); setError(null); setSuccess(false); }}
          placeholder="563123456 atau IMO1234567"
          className="w-full px-3 py-2 rounded-lg border text-sm font-mono outline-none transition"
          style={{ borderColor: error ? '#EF4444' : '#E2E8F0' }}
          onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${COLORS.aqua}40`)}
          onBlur={(e) => (e.target.style.boxShadow = 'none')} />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
      {success && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-xs text-green-700">
          <CheckCircle2 size={12} />Ship reference ID berhasil disimpan.
        </div>
      )}
      <ApiError msg={apiError} />
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-70"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}>
          {submitting ? <><Spinner /> Menyimpan…</> : <><Anchor size={14} /> Simpan Ship Ref</>}
        </button>
      </div>
    </form>
  );
};

/* ── CHECKPOINTS tab ─────────────────────────────────────────── */
const CheckpointsTab = ({ trip }) => {
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setLoading(true); setError(null);
    getCheckpoints(trip.id)
      .then((res) => setCheckpoints(res.data?.data ?? []))
      .catch((err) => setError(err?.response?.data?.message ?? 'Gagal memuat checkpoint.'))
      .finally(() => setLoading(false));
  }, [trip.id]);

  const visible = showAll ? checkpoints : checkpoints.slice(0, 6);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{checkpoints.length} checkpoint tercatat</p>
        <button onClick={() => {
          setLoading(true);
          getCheckpoints(trip.id).then((r) => setCheckpoints(r.data?.data ?? [])).catch(() => {}).finally(() => setLoading(false));
        }} className="flex items-center gap-1 text-xs font-medium transition" style={{ color: COLORS.teal }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </div>

      {loading && <div className="flex items-center gap-2 text-sm text-slate-400 py-4"><RefreshCw size={14} className="animate-spin" />Memuat…</div>}
      {error && <div className="flex items-center gap-2 text-sm text-red-500"><AlertCircle size={13} />{error}</div>}
      {!loading && !error && checkpoints.length === 0 && (
        <p className="text-sm text-slate-400 py-4">Belum ada checkpoint.</p>
      )}
      {!loading && !error && checkpoints.length > 0 && (
        <>
          <ul className="space-y-2">
            {visible.map((cp) => (
              <li key={cp.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-slate-50">
                <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm bg-white border border-slate-100">
                  {CHECKPOINT_ICONS[cp.event_type] ?? '📌'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-700">{cp.event_type.replace(/_/g, ' ')}</p>
                    <span className="text-[11px] text-slate-400 shrink-0">{fmt(cp.recorded_at)}</span>
                  </div>
                  {cp.latitude != null && (
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {Number(cp.latitude).toFixed(5)}, {Number(cp.longitude).toFixed(5)} · {cp.source}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {checkpoints.length > 6 && (
            <button onClick={() => setShowAll((v) => !v)} className="flex items-center gap-1 text-xs font-medium mt-1" style={{ color: COLORS.teal }}>
              {showAll ? <><ChevronUp size={13} />Tampilkan lebih sedikit</> : <><ChevronDown size={13} />Lihat semua {checkpoints.length} checkpoint</>}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default TripDetailModal;
