import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Route, MapPin, Truck, Calendar, Ship, Clock,
  CheckCircle2, AlertCircle, RefreshCw, Navigation,
  ChevronDown, ChevronUp, Edit2, Anchor, Zap, BarChart2,
  Search, Check, Loader2, User,
} from 'lucide-react';
import { COLORS, STATUS_STYLES, CHECKPOINT_ICONS } from '../dashboard/dashboardTheme';
import {
  getTrip, updateTrip, recommendTrip, assignTrip,
  simulateTrip, setShipRef, getCheckpoints, getPosition,
} from '../../api/tripsApi';
import axiosClient from '../../axios';
import { useRouteComboForm, CompanyDropdown, PortDropdown, DropdownPortal, LockIcon, PORTS } from './routeCombo';
import { fetchRoutePath } from '../../utils/tomtomRoute';
import { getUser } from '../../api/usersApi';
import { getTruck } from '../../api/trucksApi';

const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || '';
// Simulate (driver dashboard) is the only thing that currently moves a trip
// — it writes a gps_ping every 1s over a fixed 10s run, not real GPS — so
// this polls at the same 1s cadence rather than the PRD's suggested 15-30s,
// or the admin would almost never see it actually move.
const POSITION_POLL_MS = 1000;

const pinSvg = (color) => `
  <svg width="26" height="34" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35))">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 12.75 17 27 17 27s17-14.25 17-27C34 7.6 26.4 0 17 0z" fill="${color}"/>
    <circle cx="17" cy="17" r="7" fill="white"/>
  </svg>`;

// Straight-line distance in meters — used only to turn a live GPS point into
// a rough "% of the way there" figure, not for anything precision-sensitive.
const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

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

// datetime-local's min/value are compared in the browser's LOCAL wall-clock
// time, not UTC — toISOString() would give a UTC string that gets
// misinterpreted as local, making "now" appear hours earlier than it really
// is for any UTC+ timezone (Batam/Singapore included), silently letting the
// picker accept a time that's already in the past by the time it reaches
// the backend's `after:now` check.
const toLocalDatetimeValue = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

// Shows where a recommend/simulate score actually comes from — base 100
// minus whichever penalties applied (TripController::scoreSlot) — instead
// of just the final number, which on its own doesn't explain e.g. why a
// slot with more traffic still scored higher than one with a night penalty.
const ScoreBreakdown = ({ breakdown }) => {
  if (!breakdown) return null;
  const penalties = [
    { label: 'Traffic', value: breakdown.traffic_penalty },
    { label: 'Delay',   value: breakdown.delay_penalty },
    { label: 'Night',   value: breakdown.night_penalty },
  ].filter(({ value }) => value > 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
        +{breakdown.base} Base
      </span>
      {penalties.map(({ label, value }) => (
        <span key={label} className="text-[10px] font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
          −{value} {label}
        </span>
      ))}
      {breakdown.historical_sample_size > 0 && (
        <span className="text-[10px] text-slate-400">
          · based on {breakdown.historical_sample_size} past trip{breakdown.historical_sample_size !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
};

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
    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap border ${
      active ? 'shadow-sm' : 'hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700'
    }`}
    style={active
      ? { backgroundColor: COLORS.teal, color: 'white', borderColor: COLORS.teal }
      : { color: '#64748B', borderColor: '#E2E8F0', backgroundColor: 'white' }}
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
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(48px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .modal-backdrop {
          animation: fadeIn 0.3s ease-out;
        }
        .modal-content {
          animation: slideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1);
        }
        @media (min-width: 640px) {
          .modal-content {
            animation: slideDown 0.4s cubic-bezier(0.32, 0.72, 0, 1);
          }
        }
        .tab-content {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm modal-backdrop" onClick={onClose} />

        <div
          className="relative z-10 w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col bg-white sm:rounded-2xl shadow-2xl overflow-hidden rounded-t-2xl modal-content"
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
        <div className="flex-1 overflow-y-auto p-5 tab-content">
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
    </>
  );
};

/* ── route visual ─────────────────────────────────────────────── */
const PROGRESS = {
  draft: 4, assigned: 8, in_transit_origin: 38, at_origin_port: 50,
  on_ship: 65, at_destination_port: 82, in_transit_destination: 55,
  arrived: 88, completed: 96, cancelled: 4,
};

const RouteVisual = ({ trip }) => {
  const isMoving = ['in_transit_origin', 'in_transit_destination'].includes(trip.status);

  // Return leg (in_transit_destination) runs destination -> origin, not
  // origin -> destination — mirrors TripCheckpointController::recordArrival's
  // own target selection for that status.
  const from = trip.status === 'in_transit_destination' ? trip.destination : trip.origin;
  const to   = trip.status === 'in_transit_destination' ? trip.origin      : trip.destination;

  const [livePct, setLivePct] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    clearInterval(pollRef.current);
    setLivePct(null);
    if (!isMoving || !from?.latitude || !to?.latitude) return;

    const totalMeters = haversineMeters(from.latitude, from.longitude, to.latitude, to.longitude);
    if (!totalMeters) return;

    const poll = async () => {
      try {
        const res = await getPosition(trip.id);
        const pos = res.data?.data;
        if (!pos) return;
        const travelled = haversineMeters(from.latitude, from.longitude, pos.lat, pos.lng);
        setLivePct(Math.min(100, Math.max(0, Math.round((travelled / totalMeters) * 100))));
      } catch {
        // No position recorded yet — keep showing the status-based estimate below.
      }
    };

    poll();
    pollRef.current = setInterval(poll, POSITION_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [trip.id, trip.status, isMoving, from?.latitude, from?.longitude, to?.latitude, to?.longitude]);

  // Real distance-travelled percentage while in transit and a live position
  // exists; otherwise fall back to the static per-status estimate (there's
  // nothing to measure yet before departure, or after arrival).
  const pct    = livePct ?? (PROGRESS[trip.status] ?? 50);
  const isCross = !!trip.ship_destination_port;
  const Icon   = isCross && pct >= 50 ? Ship : Truck;
  return (
    <div
      className="relative rounded-xl px-5 py-5 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${COLORS.navyDark} 0%, ${COLORS.teal} 100%)` }}
    >
      {livePct !== null && (
        <span
          className="absolute top-2.5 right-3 flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live · {pct}%
        </span>
      )}
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
const InfoTab = ({ trip }) => {
  const [driverName, setDriverName] = useState(null);
  const [truckLabel, setTruckLabel] = useState(null);

  useEffect(() => {
    setDriverName(null);
    if (trip.driver_id) {
      getUser(trip.driver_id)
        .then((res) => setDriverName(res.data?.data?.name ?? null))
        .catch(() => setDriverName(null));
    }
  }, [trip.driver_id]);

  useEffect(() => {
    setTruckLabel(null);
    if (trip.truck_id) {
      getTruck(trip.truck_id)
        .then((res) => {
          const t = res.data?.data;
          setTruckLabel(t ? `${t.plate_number} (${t.brand})` : null);
        })
        .catch(() => setTruckLabel(null));
    }
  }, [trip.truck_id]);

  return (
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
        <Row label="Driver" value={trip.driver_id ? (driverName ?? `ID ${trip.driver_id}`) : null} />
        <Row label="Truck"  value={trip.truck_id  ? (truckLabel ?? `ID ${trip.truck_id}`)  : null} />
      </Section>

      {Array.isArray(trip.recommended_slots) && trip.recommended_slots.length > 0 && (
        <div className="sm:col-span-2">
          <Section title="Recommended Slots" icon={Clock}>
            <div className="space-y-2">
              {trip.recommended_slots.map((slot, i) => (
                <div
                  key={i}
                  className="px-3 py-3 rounded-lg border text-xs"
                  style={{
                    borderColor:       slot.is_recommended ? COLORS.aqua : '#E2E8F0',
                    backgroundColor:   slot.is_recommended ? `${COLORS.aqua}0D` : 'white',
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {slot.is_recommended && <CheckCircle2 size={12} color={COLORS.green} />}
                      <span className="font-medium text-slate-700">{slot.reason}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400 shrink-0">
                      <span>Score: <strong className="text-slate-700">{slot.score}</strong></span>
                      {slot.distance_km && <span>{slot.distance_km} km</span>}
                    </div>
                  </div>
                  <ScoreBreakdown breakdown={slot.breakdown} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
};

/* ── UPDATE ROUTE tab ─────────────────────────────────────────── */
const COMBO_LABELS = { domestic: 'Domestic', cross_border: 'Cross-border', port_to_company: 'Port → Company' };

// Figure out which combo an already-created trip is using, from its
// origin/destination point types (TripResource's {type: 'company'|'port', ...}).
const inferCombo = (trip) => {
  if (trip.origin?.type === 'company' && trip.destination?.type === 'port') return 'cross_border';
  if (trip.origin?.type === 'port' && trip.destination?.type === 'company') return 'port_to_company';
  return 'domestic';
};

const inferFormData = (trip, combo) => {
  if (combo === 'cross_border') {
    return {
      origin_company_id: trip.origin?.id,
      destination_port_id: trip.destination?.id,
      ship_destination_port_id: trip.ship_destination_port?.id,
    };
  }
  if (combo === 'port_to_company') {
    return { origin_port_id: trip.origin?.id, destination_company_id: trip.destination?.id };
  }
  return { origin_company_id: trip.origin?.id, destination_company_id: trip.destination?.id };
};

const UpdateTab = ({ trip, onUpdated }) => {
  const initialCombo = inferCombo(trip);
  const {
    comboType, setComboType, activeCombo,
    formData, metaData, errors, setErrors, setMetaData,
    handleFieldChange, getAllowedRegion, getDisabledIds, validate,
  } = useRouteComboForm(initialCombo, inferFormData(trip, initialCombo));

  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]     = useState(null);

  // Resolve metaData (region etc.) for the trip's current origin/destination so
  // cross-field validation is correct even if the user only touches one field —
  // without this, validate() would compare an unresolved origin region against a
  // resolved destination region and misfire a false "different region" error.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      const companyIds = activeCombo.fields.filter((f) => f.type === 'company').map((f) => formData[f.key]).filter(Boolean);
      let companies = [];
      if (companyIds.length) {
        try {
          const res = await axiosClient.get('/api/companies', { params: { per_page: 100 } });
          companies = res.data?.data ?? [];
        } catch (_) { /* leave region unresolved — non-fatal, see comment above */ }
      }
      activeCombo.fields.forEach(({ key, type }) => {
        const id = formData[key];
        if (!id) return;
        if (type === 'company') {
          const c = companies.find((x) => x.id === id);
          if (c) next[key] = { id, region: (c.city ?? '').toLowerCase().includes('singap') ? 'singapore' : 'batam', city: c.city, name: c.name };
        } else {
          const p = PORTS.find((x) => x.id === id);
          if (p) next[key] = { id, region: p.region, name: p.name };
        }
      });
      if (!cancelled) setMetaData((prev) => ({ ...next, ...prev }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true); setApiError(null);
    const payload = {};
    activeCombo.fields.forEach(({ key }) => { payload[key] = Number(formData[key]); });
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
        {Object.entries(COMBO_LABELS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setComboType(key)}
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
      {activeCombo.fields.map(({ key, type, label, placeholder }, i) => {
        const isPrevEmpty  = activeCombo.fields.slice(0, i).some(({ key: k }) => !formData[k]);
        const allowedRegion = getAllowedRegion(key);
        const blockedIds    = getDisabledIds(key);
        return type === 'company' ? (
          <CompanyDropdown
            key={key} label={label} placeholder={placeholder}
            value={formData[key] ?? null}
            onSelectMeta={(meta) => handleFieldChange(key, meta.id, meta)}
            error={errors[key]} disabled={isPrevEmpty}
            allowedRegion={allowedRegion} disabledIds={blockedIds}
          />
        ) : (
          <PortDropdown
            key={key} label={label} placeholder={placeholder}
            value={formData[key] ?? null}
            onSelectMeta={(meta) => handleFieldChange(key, meta.id, meta)}
            error={errors[key]} disabled={isPrevEmpty}
            allowedRegion={allowedRegion} disabledIds={blockedIds}
          />
        );
      })}
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
const todayStr = () => new Date().toISOString().split('T')[0];

const RecommendTab = ({ trip, onUpdated }) => {
  // Defaults to today so the field is never blank when the tab opens — the
  // backend's own default (when no date is sent at all) is tomorrow, but this
  // just pre-fills a starting value for the admin to see/adjust. Nothing is
  // submitted until the button below is clicked, no auto-launch to the API.
  const [date, setDate]           = useState(todayStr());
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
        <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          min={todayStr()}
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
      const d = err?.response?.data;
      // Every validation failure across the API shares the same generic
      // top-level message ("Validation error", bootstrap/app.php) — the
      // actual reason only lives in `errors`, so that has to be read first
      // or the real cause never surfaces.
      const fieldError = d?.errors?.departure_at?.[0];
      setApiError(fieldError ?? d?.message ?? 'Simulation failed.');
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
            // +2min buffer: datetime-local only has minute precision, and the
            // backend's after:now check runs whenever the user actually
            // submits — without slack, picking the earliest allowed (current)
            // minute can tick past "now" during normal deliberation/network
            // time and get rejected despite looking valid when selected.
            min={toLocalDatetimeValue(new Date(Date.now() + 2 * 60000))}
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
            <ScoreBreakdown breakdown={result.simulated?.breakdown} />
          </div>

          {/* nearest recommended */}
          <div
            className="px-4 py-3 rounded-xl border text-xs"
            style={{ borderColor: COLORS.aqua, backgroundColor: `${COLORS.aqua}08` }}
          >
            <p className="font-semibold text-slate-500 uppercase tracking-wide mb-2">Nearest Recommended Slot</p>
            <Row label="Time"  value={fmt(result.nearest_recommended?.departure_at)} />
            <Row label="Score" value={result.nearest_recommended?.score} />
            <ScoreBreakdown breakdown={result.nearest_recommended?.breakdown} />
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

/* ── truck/driver dropdowns (Assign tab only — search + list, no region
   filtering, so kept local rather than pulled into the shared routeCombo
   module) ────────────────────────────────────────────────────── */
const TruckDropdown = ({ label, placeholder, value, onSelectMeta, error }) => {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [selected, setSelected] = useState(null);

  const triggerRef   = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const panel = document.getElementById('truck-dp-' + label);
      if (containerRef.current && !containerRef.current.contains(e.target) && !(panel && panel.contains(e.target))) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, label]);

  const fetchTrucks = useCallback(async (search = '') => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/api/trucks', { params: { status: 'active', per_page: 100, ...(search ? { search } : {}) } });
      setOptions(res.data?.data ?? []);
    } catch (_) { setOptions([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchTrucks(query), 300);
    return () => clearTimeout(t);
  }, [query, open, fetchTrucks]);

  useEffect(() => {
    if (value && !selected && !fetched) {
      setFetched(true);
      (async () => {
        try {
          const res = await axiosClient.get('/api/trucks', { params: { per_page: 100 } });
          const match = (res.data?.data ?? []).find((t) => t.id === value);
          if (match) setSelected(match);
        } catch (_) {}
      })();
    }
  }, [value, selected, fetched]);

  const handleOpen = () => {
    setOpen(true);
    if (!fetched) { setFetched(true); fetchTrucks(''); }
  };

  const handleSelect = (truck) => {
    onSelectMeta?.(truck);
    setSelected(truck);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-all duration-150 ${
          error ? 'bg-white border-red-300 ring-2 ring-red-100'
          : open ? 'bg-white border-slate-400 ring-2 ring-slate-100'
          : 'bg-white border-slate-200 hover:border-slate-300'
        }`}>
        <span className={selected ? 'text-slate-800 font-medium flex items-center gap-2 min-w-0' : 'text-slate-400'}>
          {selected ? (
            <>
              <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${COLORS.teal}14` }}>
                <Truck size={11} color={COLORS.teal} />
              </span>
              <span className="truncate">{selected.plate_number}</span>
              <span className="text-xs text-slate-400 shrink-0">{selected.brand}</span>
            </>
          ) : placeholder}
        </span>
        <ChevronDown size={15} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} text-slate-400`} />
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      <DropdownPortal triggerRef={triggerRef} open={open}>
        <div id={`truck-dp-${label}`} className="bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plate, brand, model…"
              className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 outline-none bg-transparent" />
            {loading && <Loader2 size={13} className="animate-spin text-slate-400 shrink-0" />}
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {!loading && options.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400 text-center">No active trucks found</li>
            )}
            {options.map((truck) => (
              <li key={truck.id}>
                <button type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(truck)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${COLORS.teal}14` }}>
                    <Truck size={13} color={COLORS.teal} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{truck.plate_number}</p>
                    <p className="text-xs text-slate-400 truncate">{truck.brand}{truck.model ? ` · ${truck.model}` : ''} · {truck.fuel_type}</p>
                  </div>
                  {value === truck.id && <Check size={14} color={COLORS.green} className="shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DropdownPortal>
    </div>
  );
};

const DriverDropdown = ({ label, placeholder, value, onSelectMeta, error }) => {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [selected, setSelected] = useState(null);

  const triggerRef   = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const panel = document.getElementById('driver-dp-' + label);
      if (containerRef.current && !containerRef.current.contains(e.target) && !(panel && panel.contains(e.target))) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, label]);

  const fetchDrivers = useCallback(async (search = '') => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/api/users', { params: { role: 'driver', per_page: 100, ...(search ? { search } : {}) } });
      setOptions(res.data?.data ?? []);
    } catch (_) { setOptions([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchDrivers(query), 300);
    return () => clearTimeout(t);
  }, [query, open, fetchDrivers]);

  useEffect(() => {
    if (value && !selected && !fetched) {
      setFetched(true);
      (async () => {
        try {
          const res = await axiosClient.get('/api/users', { params: { role: 'driver', per_page: 100 } });
          const match = (res.data?.data ?? []).find((u) => u.id === value);
          if (match) setSelected(match);
        } catch (_) {}
      })();
    }
  }, [value, selected, fetched]);

  const handleOpen = () => {
    setOpen(true);
    if (!fetched) { setFetched(true); fetchDrivers(''); }
  };

  const handleSelect = (driver) => {
    onSelectMeta?.(driver);
    setSelected(driver);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-all duration-150 ${
          error ? 'bg-white border-red-300 ring-2 ring-red-100'
          : open ? 'bg-white border-slate-400 ring-2 ring-slate-100'
          : 'bg-white border-slate-200 hover:border-slate-300'
        }`}>
        <span className={selected ? 'text-slate-800 font-medium flex items-center gap-2 min-w-0' : 'text-slate-400'}>
          {selected ? (
            <>
              <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${COLORS.aqua}14` }}>
                <User size={11} color={COLORS.aqua} />
              </span>
              <span className="truncate">{selected.name}</span>
              {selected.phone && <span className="text-xs text-slate-400 shrink-0">{selected.phone}</span>}
            </>
          ) : placeholder}
        </span>
        <ChevronDown size={15} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} text-slate-400`} />
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      <DropdownPortal triggerRef={triggerRef} open={open}>
        <div id={`driver-dp-${label}`} className="bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, username, phone…"
              className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 outline-none bg-transparent" />
            {loading && <Loader2 size={13} className="animate-spin text-slate-400 shrink-0" />}
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {!loading && options.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400 text-center">No drivers found</li>
            )}
            {options.map((driver) => (
              <li key={driver.id}>
                <button type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(driver)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${COLORS.aqua}14` }}>
                    <User size={13} color={COLORS.aqua} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{driver.name}</p>
                    <p className="text-xs text-slate-400 truncate">@{driver.username}{driver.phone ? ` · ${driver.phone}` : ''}</p>
                  </div>
                  {value === driver.id && <Check size={14} color={COLORS.green} className="shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DropdownPortal>
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
        <TruckDropdown
          label="Truck" placeholder="Select an active truck"
          value={form.truck_id || null}
          onSelectMeta={(truck) => { setForm((p) => ({ ...p, truck_id: truck.id })); setErrors((p) => ({ ...p, truck_id: null })); }}
          error={errors.truck_id}
        />
        <DriverDropdown
          label="Driver" placeholder="Select a driver"
          value={form.driver_id || null}
          onSelectMeta={(driver) => { setForm((p) => ({ ...p, driver_id: driver.id })); setErrors((p) => ({ ...p, driver_id: null })); }}
          error={errors.driver_id}
        />
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

/* ── live position map — embedded in Checkpoints tab, scoped to whichever
   trip's modal is currently open (not a single dashboard-wide "active
   trip") ──────────────────────────────────────────────────────── */
const TripLiveMap = ({ trip }) => {
  const mapElRef       = useRef(null);
  const mapRef         = useRef(null);
  const liveMarkerRef  = useRef(null);
  const sdkLoadingRef  = useRef(null);
  const pollRef        = useRef(null);
  const [mapReady, setMapReady]         = useState(false);
  const [mapError, setMapError]         = useState(null);
  const [livePosition, setLivePosition] = useState(null);

  useEffect(() => {
    if (sdkLoadingRef.current) return;
    sdkLoadingRef.current = true;

    if (!TOMTOM_API_KEY) { setMapError('TomTom API key not set'); return; }
    if (window.tt) { setMapReady(true); return; }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js';
    script.onload  = () => setMapReady(true);
    script.onerror = () => setMapError('Failed to load map SDK');
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapReady || !mapElRef.current || mapRef.current || !window.tt) return;
    try {
      mapRef.current = window.tt.map({
        key: TOMTOM_API_KEY,
        container: mapElRef.current,
        center: [104.0305, 1.1301],
        zoom: 11,
      });
    } catch (err) {
      setMapError(err.message);
    }
  }, [mapReady]);

  // origin/destination pins for this specific trip
  useEffect(() => {
    if (!mapReady || !mapRef.current || !trip) return;
    const map = mapRef.current;

    document.querySelectorAll('.mapboxgl-marker').forEach((m) => m.remove());
    liveMarkerRef.current = null;
    setLivePosition(null);

    const originLat = trip.origin?.latitude, originLng = trip.origin?.longitude;
    const destLat    = trip.destination?.latitude, destLng = trip.destination?.longitude;
    if (!originLat || !originLng || !destLat || !destLng) return;

    const markerA = document.createElement('div');
    markerA.innerHTML = pinSvg('#10b981');
    new window.tt.Marker({ element: markerA, anchor: 'bottom' }).setLngLat([originLng, originLat]).addTo(map);

    const markerB = document.createElement('div');
    markerB.innerHTML = pinSvg('#1e40af');
    new window.tt.Marker({ element: markerB, anchor: 'bottom' }).setLngLat([destLng, destLat]).addTo(map);

    const bounds = new window.tt.LngLatBounds();
    bounds.extend([originLng, originLat]);
    bounds.extend([destLng, destLat]);
    map.fitBounds(bounds, { padding: 40 });

    if (map.getLayer('route-layer')) map.removeLayer('route-layer');
    if (map.getSource('route-src'))  map.removeSource('route-src');

    fetchRoutePath(originLat, originLng, destLat, destLng)
      .then((coords) => {
        if (!mapRef.current) return;
        map.addSource('route-src', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } },
        });
        map.addLayer({
          id: 'route-layer',
          type: 'line',
          source: 'route-src',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': COLORS.teal, 'line-width': 4 },
        });
      })
      .catch(() => {
        // No route line is a cosmetic loss only — the pins/live marker still work.
      });
  }, [trip?.id, mapReady]);

  // poll this trip's live position every 1s
  useEffect(() => {
    clearInterval(pollRef.current);
    if (!trip?.id || !mapReady || ['completed', 'cancelled'].includes(trip.status)) return;

    const poll = async () => {
      try {
        const res = await getPosition(trip.id);
        const pos = res.data?.data;
        if (!pos || !mapRef.current) return;

        setLivePosition(pos);
        if (!liveMarkerRef.current) {
          const el = document.createElement('div');
          el.style.cssText = `width:16px;height:16px;border-radius:50%;background:${COLORS.aqua};border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.45);`;
          liveMarkerRef.current = new window.tt.Marker({ element: el }).setLngLat([pos.lng, pos.lat]).addTo(mapRef.current);
        } else {
          liveMarkerRef.current.setLngLat([pos.lng, pos.lat]);
        }
      } catch {
        // No position recorded for this trip yet — fine, wait for the next tick.
      }
    };

    poll();
    pollRef.current = setInterval(poll, POSITION_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [trip?.id, trip?.status, mapReady]);

  return (
    <div className="relative rounded-lg overflow-hidden bg-slate-100" style={{ height: 200 }}>
      <div ref={mapElRef} className="w-full h-full" />
      {!mapReady && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin" style={{ color: COLORS.teal }} />
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-red-500">
          {mapError}
        </div>
      )}
      {livePosition && (
        <span
          className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full text-white"
          style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live · {livePosition.source === 'api' ? 'Vessel' : 'GPS'} · {fmt(livePosition.recorded_at)}
        </span>
      )}
    </div>
  );
};

/* ── CHECKPOINTS tab ─────────────────────────────────────────── */
const CheckpointsTab = ({ trip }) => {
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [showAll, setShowAll]         = useState(false);

  // silent=true is used for the background poll below — a manual refresh
  // (or first load) shows the spinner/error, a poll tick just quietly swaps
  // the list in so it doesn't flicker every second.
  const load = useCallback((silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    getCheckpoints(trip.id)
      .then((res) => setCheckpoints(res.data?.data ?? []))
      .catch((err) => { if (!silent) setError(err?.response?.data?.message ?? 'Failed to load checkpoints.'); })
      .finally(() => { if (!silent) setLoading(false); });
  }, [trip.id]);

  useEffect(() => { load(); }, [load]);

  // Poll every 1s, same cadence as the live map above — Simulate is the only
  // thing currently generating checkpoints (gps_ping every 1s over a fixed
  // 10s run), so this is how the list actually keeps up with it.
  useEffect(() => {
    if (['completed', 'cancelled'].includes(trip.status)) return;
    const id = setInterval(() => load(true), POSITION_POLL_MS);
    return () => clearInterval(id);
  }, [trip.id, trip.status, load]);

  const visible = showAll ? checkpoints : checkpoints.slice(0, 6);

  return (
    <div className="space-y-3">
      <TripLiveMap trip={trip} />

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{checkpoints.length} checkpoint{checkpoints.length !== 1 ? 's' : ''} recorded</p>
        <button
          onClick={() => load()}
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
