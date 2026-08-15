import React, { useState, useEffect } from 'react';
import {
  X, Route, MapPin, Truck, Calendar, Ship, Clock,
  CheckCircle2, AlertCircle, RefreshCw, Navigation,
  ChevronDown, ChevronUp, Edit2, Anchor, Zap, BarChart2,
} from 'lucide-react';
import { COLORS, STATUS_STYLES, CHECKPOINT_ICONS } from '../dashboard/dashboardTheme';
import {
  getTrip, updateTrip, recommendTrip, assignTrip,
  simulateTrip, setShipRef, getCheckpoints,
} from '../../api/tripsApi';

/* ── helpers ─────────────────────────────────────────────────── */
const ss = (status) =>
  STATUS_STYLES[status] ?? { label: status, bg: '#F1F5F9', color: '#64748B' };

const fmt = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const fmtDur = (min) => {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

/* ── shared sub-components ───────────────────────────────────── */
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
    <span className={`text-xs font-medium text-right text-slate-700 ${mono ? 'font-mono' : ''}`}>
      {value ?? '—'}
    </span>
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
    className="px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap"
    style={active ? { backgroundColor: `${COLORS.aqua}14`, color: COLORS.navy } : { color: '#64748B' }}
  >
    {children}
  </button>
);

/* ═══════════════════════════════════════════════════════════════ */
const TripDetailModal = ({ trip: initialTrip, onClose, onRefresh, onTripUpdated }) => {
  const [trip, setTrip]         = useState(initialTrip);
  const [tab, setTab]           = useState('info');
  const [refreshing, setRefreshing] = useState(false);

  const isCross = !!trip.ship_destination_port;
  const s = ss(trip.status);

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
              {isCross
                ? <Ship  size={14} color="rgba(255,255,255,0.7)" />
                : <Route size={14} color="rgba(255,255,255,0.7)" />}
              <span className="font-mono text-xs opacity-70">Trip #{trip.id}</span>
            </div>
            <h2 className="text-sm font-semibold leading-tight truncate">
              {trip.origin?.name ?? '—'} → {trip.destination?.name ?? '—'}
            </h2>
            {isCross && (
              <p className="text-[11px] opacity-60 mt-0.5">
                via ship → {trip.ship_destination_port?.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <span
              className="text-[11px] font-semibold px-2 py-1 rounded-full"
              style={{ backgroundColor: s.bg, color: s.color }}
            >
              {s.label}
            </span>
            <button
              onClick={refreshTrip}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
              title="Refresh"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
            >
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
          <TabBtn active={tab === 'info'}        onClick={() => setTab('info')}>Info</TabBtn>
          {trip.status === 'draft' && <TabBtn active={tab === 'update'}    onClick={() => setTab('update')}>Edit Route</TabBtn>}
          {trip.status === 'draft' && <TabBtn active={tab === 'recommend'} onClick={() => setTab('recommend')}>Recommend</TabBtn>}
          {trip.status === 'draft' && <TabBtn active={tab === 'simulate'}  onClick={() => setTab('simulate')}>Simulate</TabBtn>}
          {trip.status === 'draft' && <TabBtn active={tab === 'assign'}    onClick={() => setTab('assign')}>Assign</TabBtn>}
          {isCross && !['completed', 'cancelled'].includes(trip.status) && (
            <TabBtn active={tab === 'ship'} onClick={() => setTab('ship')}>Vessel</TabBtn>
          )}
          <TabBtn active={tab === 'checkpoints'} onClick={() => setTab('checkpoints')}>Checkpoints</TabBtn>
        </div>

        {/* ── tab body ── */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'info'        && <InfoTab       trip={trip} />}
          {tab === 'update'      && <UpdateTab     trip={trip} onUpdated={(t) => { setTrip(t); onTripUpdated?.(t); }} />}
          {tab === 'recommend'   && <RecommendTab  trip={trip} onUpdated={(t) => { setTrip(t); onTripUpdated?.(t); setTab('assign'); }} />}
          {tab === 'simulate'    && <SimulateTab   trip={trip} />}
          {tab === 'assign'      && <AssignTab     trip={trip} onUpdated={(t) => { setTrip(t); onTripUpdated?.(t); setTab('info'); }} />}
          {tab === 'ship'        && <ShipTab       trip={trip} onUpdated={(t) => { setTrip(t); onTripUpdated?.(t); }} />}
          {tab === 'checkpoints' && <CheckpointsTab trip={trip} />}
        </div>

        {/* ── footer ── */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">Created {fmt(trip.created_at)}</p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
          >
            Close
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
  const pct    = PROGRESS[trip.status] ?? 50;
  const isCross = !!trip.ship_destination_port;
  const Icon   = isCross && pct >= 50 ? Ship : Truck;
  return (
    <div
      className="relative rounded-xl px-5 py-5 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${COLORS.navyDark} 0%, ${COLORS.teal} 100%)` }}
    >
      <div className="relative h-px w-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(to right, ${COLORS.aqua} 0 5px, transparent 5px 12px)`,
            height: '1px',
          }}
        />
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
    <Section title="Route" icon={Route}>
      <Row label="Origin"      value={`${trip.origin?.name} (${trip.origin?.type})`} />
      <Row label="Destination" value={`${trip.destination?.name} (${trip.destination?.type})`} />
      {trip.ship_destination_port && (
        <Row label="Ship Destination" value={trip.ship_destination_port.name} />
      )}
      <Row label="Distance"     value={trip.distance_km ? `${trip.distance_km} km` : null} />
      <Row label="Est. Duration" value={fmtDur(trip.estimated_duration_min)} />
      <Row label="Est. CO₂"     value={trip.estimated_co2_kg ? `${Number(trip.estimated_co2_kg).toFixed(2)} kg` : null} />
      {trip.ship_ref_id && <Row label="Vessel Ref." value={trip.ship_ref_id} mono />}
    </Section>

    <Section title="Schedule & Assignment" icon={Calendar}>
      <Row label="Departure (planned)" value={fmt(trip.chosen_departure_at)} />
      <Row label="Departure (actual)"  value={fmt(trip.actual_departure_at)} />
      <Row label="Arrival (actual)"    value={fmt(trip.actual_arrival_at)} />
      {trip.ship_destination_port && (
        <Row label="Truck returned" value={fmt(trip.truck_returned_at)} />
      )}
      <Row label="Driver ID" value={trip.driver_id ?? null} />
      <Row label="Truck ID"  value={trip.truck_id  ?? null} />
    </Section>

    {Array.isArray(trip.recommended_slots) && trip.recommended_slots.length > 0 && (
      <div className="sm:col-span-2">
        <Section title="Recommended Slots" icon={Clock}>
          <div className="space-y-2">
            {trip.recommended_slots.map((slot, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-3 rounded-lg border text-xs"
                style={{
                  borderColor:       slot.is_recommended ? COLORS.aqua : '#E2E8F0',
                  backgroundColor:   slot.is_recommended ? `${COLORS.aqua}0D` : 'white',
                }}
              >
                <div className="flex items-center gap-2">
                  {slot.is_recommended && <CheckCircle2 size={12} color={COLORS.green} />}
                  <span className="font-medium text-slate-700">{slot.reason}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 shrink-0">
                  <span>Score: <strong className="text-slate-700">{slot.score}</strong></span>
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
  { key: 'domestic',        label: 'Domestic',        fields: ['origin_company_id', 'destination_company_id'] },
  { key: 'cross_border',    label: 'Cross-border',    fields: ['origin_company_id', 'destination_port_id', 'ship_destination_port_id'] },
  { key: 'port_to_company', label: 'Port → Company',  fields: ['origin_port_id', 'destination_company_id'] },
];
const FIELD_LABELS = {
  origin_company_id:        'Origin Company ID',
  destination_company_id:   'Destination Company ID',
  origin_port_id:           'Origin Port ID',
  destination_port_id:      'Destination Port ID (Truck)',
  ship_destination_port_id: 'Ship Destination Port ID',
};

const UpdateTab = ({ trip, onUpdated }) => {
  const [comboType, setComboType] = useState('domestic');
  const [form, setForm]           = useState({});
  const [errors, setErrors]       = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]   = useState(null);
  const activeCombo = COMBO_TYPES.find((c) => c.key === comboType);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    activeCombo.fields.forEach((f) => {
      if (!form[f] || isNaN(Number(form[f])) || Number(form[f]) < 1)
        errs[f] = 'A valid numeric ID is required';
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
      if (d?.errors) {
        const m = {};
        Object.entries(d.errors).forEach(([k, v]) => { m[k] = Array.isArray(v) ? v[0] : v; });
        setErrors(m);
      } else {
        setApiError(d?.message ?? 'Failed to update trip.');
      }
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-slate-500">
        Only editable while the trip is in <strong>draft</strong> status.
        Changing the route will clear any existing recommendations.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {COMBO_TYPES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setComboType(key); setForm({}); setErrors({}); }}
            className="px-2 py-2 rounded-lg border text-xs font-semibold text-center transition"
            style={{
              borderColor:     comboType === key ? COLORS.aqua : '#E2E8F0',
              backgroundColor: comboType === key ? `${COLORS.aqua}0D` : 'white',
              color:           comboType === key ? COLORS.navy : '#64748B',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {activeCombo.fields.map((f) => (
        <div key={f}>
          <label className="block text-xs font-medium text-slate-600 mb-1">{FIELD_LABELS[f]}</label>
          <input
            type="number" min={1} value={form[f] ?? ''}
            onChange={(e) => { setForm((p) => ({ ...p, [f]: e.target.value })); setErrors((p) => ({ ...p, [f]: null })); }}
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none transition"
            style={{ borderColor: errors[f] ? '#EF4444' : '#E2E8F0' }}
          />
          {errors[f] && <p className="mt-1 text-xs text-red-500">{errors[f]}</p>}
        </div>
      ))}
      <ApiError msg={apiError} />
      <div className="flex justify-end">
        <button
          type="submit" disabled={submitting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-70"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}
        >
          {submitting ? <><Spinner /> Saving…</> : <><Edit2 size={14} /> Save Changes</>}
        </button>
      </div>
    </form>
  );
};

/* ── RECOMMEND tab ────────────────────────────────────────────── */
const RecommendTab = ({ trip, onUpdated }) => {
  const [date, setDate]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]   = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setApiError(null);
    try {
      const res = await recommendTrip(trip.id, date ? { date } : {});
      onUpdated(res.data?.data);
    } catch (err) {
      setApiError(err?.response?.data?.message ?? 'Failed to fetch recommendations.');
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="px-4 py-3 rounded-lg text-xs text-slate-600" style={{ backgroundColor: `${COLORS.navy}08` }}>
        The system will call the <strong>TomTom API</strong> to find the 3 best departure slots
        (06:00–12:00, 12:00–18:00, 18:00–05:00). This may take ~10–30 seconds.
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Date <span className="text-slate-400">(optional — defaults to tomorrow)</span>
        </label>
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none transition"
          onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${COLORS.aqua}40`)}
          onBlur={(e)  => (e.target.style.boxShadow = 'none')}
        />
      </div>
      <ApiError msg={apiError} />
      <div className="flex justify-end">
        <button
          type="submit" disabled={submitting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-70"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}
        >
          {submitting
            ? <><Spinner /> Processing (may take a while)…</>
            : <><Zap size={14} /> Generate Recommendations</>}
        </button>
      </div>
    </form>
  );
};

/* ── SIMULATE tab ─────────────────────────────────────────────── */
const SimulateTab = ({ trip }) => {
  const [departureAt, setDepartureAt] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [apiError, setApiError]       = useState(null);
  const [result, setResult]           = useState(null);

  if (!Array.isArray(trip.recommended_slots) || trip.recommended_slots.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
        <AlertCircle size={15} color={COLORS.teal} />
        Run <strong className="mx-1">Recommend</strong> first before simulating a custom departure time.
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!departureAt) { setApiError('Please select a departure time.'); return; }
    setSubmitting(true); setApiError(null); setResult(null);
    try {
      const res = await simulateTrip(trip.id, { departure_at: new Date(departureAt).toISOString() });
      setResult(res.data?.data);
    } catch (err) {
      setApiError(err?.response?.data?.message ?? 'Simulation failed.');
    } finally { setSubmitting(false); }
  };

  const diffColor = (v) => (v > 0 ? '#C2703D' : v < 0 ? COLORS.green : '#64748B');
  const diffSign  = (v) => (v > 0 ? '+' : '');

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Compare a custom departure time against the nearest recommended slot. Nothing is saved.
      </p>
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Departure Time</label>
          <input
            type="datetime-local" value={departureAt} onChange={(e) => setDepartureAt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
            onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${COLORS.aqua}40`)}
            onBlur={(e)  => (e.target.style.boxShadow = 'none')}
          />
        </div>
        <button
          type="submit" disabled={submitting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-70 whitespace-nowrap"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}
        >
          {submitting ? <><Spinner /> Simulating…</> : <><BarChart2 size={14} /> Simulate</>}
        </button>
      </form>
      <ApiError msg={apiError} />

      {result && (
        <div className="space-y-3">
          {/* simulated slot */}
          <div className="px-4 py-3 rounded-xl border border-slate-200 space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Simulation Result</p>
            <Row label="Time"           value={fmt(result.simulated?.departure_at)} />
            <Row label="Score"          value={result.simulated?.score} />
            <Row label="Distance"       value={result.simulated?.distance_km ? `${result.simulated.distance_km} km` : null} />
            <Row label="Est. arrival"   value={fmt(result.simulated?.estimated_arrival_at)} />
            <Row label="Reason"         value={result.simulated?.reason} />
          </div>

          {/* nearest recommended */}
          <div
            className="px-4 py-3 rounded-xl border text-xs"
            style={{ borderColor: COLORS.aqua, backgroundColor: `${COLORS.aqua}08` }}
          >
            <p className="font-semibold text-slate-500 uppercase tracking-wide mb-2">Nearest Recommended Slot</p>
            <Row label="Time"  value={fmt(result.nearest_recommended?.departure_at)} />
            <Row label="Score" value={result.nearest_recommended?.score} />
          </div>

          {/* diff */}
          <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Difference vs Recommendation
            </p>
            <div className="grid grid-cols-2 gap-x-4">
              {[
                { label: 'Score diff',    v: result.diff?.score, raw: result.diff?.score },
                { label: 'Travel time',   v: result.diff?.travel_time_seconds != null ? `${diffSign(result.diff.travel_time_seconds)}${Math.round(result.diff.travel_time_seconds / 60)}m` : null, raw: result.diff?.travel_time_seconds },
                { label: 'Distance diff', v: result.diff?.distance_km != null ? `${diffSign(result.diff.distance_km)}${result.diff.distance_km} km` : null, raw: result.diff?.distance_km },
                { label: 'Minutes from rec.', v: result.diff?.minutes_from_nearest_recommended != null ? `${diffSign(result.diff.minutes_from_nearest_recommended)}${result.diff.minutes_from_nearest_recommended}m` : '0m', raw: result.diff?.minutes_from_nearest_recommended },
              ].map(({ label, v, raw }) => (
                <div key={label} className="py-1.5 border-b border-slate-100 last:border-0">
                  <p className="text-[11px] text-slate-400">{label}</p>
                  <p className="text-sm font-semibold" style={{ color: diffColor(raw) }}>
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
  const [form, setForm]           = useState({ truck_id: '', driver_id: '', chosen_departure_at: '' });
  const [errors, setErrors]       = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]   = useState(null);

  const slots = Array.isArray(trip.recommended_slots) ? trip.recommended_slots : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.truck_id  || isNaN(Number(form.truck_id)))  errs.truck_id  = 'Truck ID is required';
    if (!form.driver_id || isNaN(Number(form.driver_id))) errs.driver_id = 'Driver ID is required';
    if (!form.chosen_departure_at) errs.chosen_departure_at = 'Please select a departure time';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true); setApiError(null);
    try {
      const res = await assignTrip(trip.id, {
        truck_id:             Number(form.truck_id),
        driver_id:            Number(form.driver_id),
        chosen_departure_at:  form.chosen_departure_at,
      });
      onUpdated(res.data?.data);
    } catch (err) {
      const d = err?.response?.data;
      if (d?.errors) {
        const m = {};
        Object.entries(d.errors).forEach(([k, v]) => { m[k] = Array.isArray(v) ? v[0] : v; });
        setErrors(m);
      } else {
        setApiError(d?.message ?? 'Failed to assign trip.');
      }
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {slots.length === 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs"
          style={{ backgroundColor: `${COLORS.teal}12`, color: COLORS.teal }}
        >
          <AlertCircle size={13} />
          Run <strong className="mx-1">Recommend</strong> first to get available departure slots.
        </div>
      )}

      {slots.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Select Departure Time</label>
          <div className="space-y-2">
            {slots.map((slot, i) => (
              <label
                key={i}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition"
                style={{
                  borderColor:     form.chosen_departure_at === slot.departure_at ? COLORS.aqua : '#E2E8F0',
                  backgroundColor: form.chosen_departure_at === slot.departure_at ? `${COLORS.aqua}0D` : 'white',
                }}
              >
                <input
                  type="radio" name="chosen_departure_at" value={slot.departure_at}
                  checked={form.chosen_departure_at === slot.departure_at}
                  onChange={(e) => { setForm((p) => ({ ...p, chosen_departure_at: e.target.value })); setErrors((p) => ({ ...p, chosen_departure_at: null })); }}
                  className="shrink-0" style={{ accentColor: COLORS.teal }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {slot.is_recommended && <CheckCircle2 size={11} color={COLORS.green} />}
                    <span className="text-xs font-medium text-slate-700">{slot.reason}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Score: {slot.score}</span>
                </div>
              </label>
            ))}
          </div>
          {errors.chosen_departure_at && (
            <p className="mt-1 text-xs text-red-500">{errors.chosen_departure_at}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { field: 'truck_id',  label: 'Truck ID' },
          { field: 'driver_id', label: 'Driver ID (role: driver)' },
        ].map(({ field, label }) => (
          <div key={field}>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <input
              type="number" min={1} value={form[field]}
              onChange={(e) => { setForm((p) => ({ ...p, [field]: e.target.value })); setErrors((p) => ({ ...p, [field]: null })); }}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ borderColor: errors[field] ? '#EF4444' : '#E2E8F0' }}
            />
            {errors[field] && <p className="mt-1 text-xs text-red-500">{errors[field]}</p>}
          </div>
        ))}
      </div>

      <ApiError msg={apiError} />
      <div className="flex justify-end">
        <button
          type="submit" disabled={submitting || slots.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}
        >
          {submitting ? <><Spinner /> Saving…</> : <><CheckCircle2 size={14} /> Assign Trip</>}
        </button>
      </div>
    </form>
  );
};

/* ── VESSEL tab ───────────────────────────────────────────────── */
const ShipTab = ({ trip, onUpdated }) => {
  const [shipRefId, setShipRefId] = useState(trip.ship_ref_id ?? '');
  const [error, setError]         = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]   = useState(null);
  const [success, setSuccess]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = shipRefId.trim();
    if (!trimmed) { setError('Vessel reference ID is required'); return; }
    if (!/^(\d{9}|(IMO)?\d{7})$/i.test(trimmed)) {
      setError('Must be MMSI (9 digits) or IMO (7 digits, optionally prefixed "IMO")');
      return;
    }
    setSubmitting(true); setApiError(null); setError(null); setSuccess(false);
    try {
      const res = await setShipRef(trip.id, { ship_ref_id: trimmed });
      onUpdated(res.data?.data);
      setSuccess(true);
    } catch (err) {
      setApiError(err?.response?.data?.message ?? 'Failed to save vessel reference.');
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="px-4 py-3 rounded-lg text-xs text-slate-600" style={{ backgroundColor: `${COLORS.navy}08` }}>
        The <strong>vessel reference ID</strong> is the MMSI or IMO number of the ship used for the
        sea crossing (Batam–Singapore). It can be updated at any time while the trip is not yet
        completed or cancelled.
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">MMSI / IMO Number</label>
        <input
          type="text" value={shipRefId}
          onChange={(e) => { setShipRefId(e.target.value); setError(null); setSuccess(false); }}
          placeholder="563123456 or IMO1234567"
          className="w-full px-3 py-2 rounded-lg border text-sm font-mono outline-none transition"
          style={{ borderColor: error ? '#EF4444' : '#E2E8F0' }}
          onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${COLORS.aqua}40`)}
          onBlur={(e)  => (e.target.style.boxShadow = 'none')}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
      {success && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-xs text-green-700">
          <CheckCircle2 size={12} /> Vessel reference saved successfully.
        </div>
      )}
      <ApiError msg={apiError} />
      <div className="flex justify-end">
        <button
          type="submit" disabled={submitting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-70"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}
        >
          {submitting ? <><Spinner /> Saving…</> : <><Anchor size={14} /> Save Vessel Ref</>}
        </button>
      </div>
    </form>
  );
};

/* ── CHECKPOINTS tab ─────────────────────────────────────────── */
const CheckpointsTab = ({ trip }) => {
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [showAll, setShowAll]         = useState(false);

  const load = () => {
    setLoading(true); setError(null);
    getCheckpoints(trip.id)
      .then((res) => setCheckpoints(res.data?.data ?? []))
      .catch((err) => setError(err?.response?.data?.message ?? 'Failed to load checkpoints.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [trip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = showAll ? checkpoints : checkpoints.slice(0, 6);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{checkpoints.length} checkpoint{checkpoints.length !== 1 ? 's' : ''} recorded</p>
        <button
          onClick={load}
          className="flex items-center gap-1 text-xs font-medium transition"
          style={{ color: COLORS.teal }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
          <RefreshCw size={14} className="animate-spin" />Loading…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle size={13} />{error}
        </div>
      )}
      {!loading && !error && checkpoints.length === 0 && (
        <p className="text-sm text-slate-400 py-4">No checkpoints recorded yet.</p>
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
                    <p className="text-xs font-semibold text-slate-700 capitalize">
                      {cp.event_type.replace(/_/g, ' ')}
                    </p>
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
            <button
              onClick={() => setShowAll((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium mt-1"
              style={{ color: COLORS.teal }}
            >
              {showAll
                ? <><ChevronUp size={13} />Show less</>
                : <><ChevronDown size={13} />View all {checkpoints.length} checkpoints</>}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default TripDetailModal;
