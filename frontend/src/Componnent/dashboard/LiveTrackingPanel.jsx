import React from 'react';
import { MoreVertical, Truck, Ship, MapPin, PackageCheck, CheckCircle2 } from 'lucide-react';
import { COLORS } from './dashboardTheme';

const DEFAULT_TRIP = {
  id: 'TRIP-2026-0842',
  origin: 'Company A, Batam',
  destination: 'Jurong Port, Singapore',
  status: 'Ship at sea',
};

const DEFAULT_HISTORY = [
  { icon: PackageCheck, label: 'Picked up at Company A', time: 'Aug 14, 08:05' },
  { icon: Truck, label: 'Arrived at Batam Center Port', time: 'Aug 14, 08:52' },
  { icon: Ship, label: 'Ship departed for Singapore', time: 'Aug 14, 10:15' },
];

const fmtTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const LiveTrackingPanel = ({ trip = null, checkpoints = [] }) => {
  const currentTrip = trip || DEFAULT_TRIP;
  const tripId = currentTrip.id
    ? (typeof currentTrip.id === 'string' && currentTrip.id.startsWith('TRIP') ? currentTrip.id : `TRIP-${currentTrip.id}`)
    : 'TRIP-LIVE';

  const originName = currentTrip.origin?.name || currentTrip.origin || 'Origin Terminal';
  const destName = currentTrip.destination?.name || currentTrip.destination || 'Destination Port';
  const rawStatus = currentTrip.status || 'Active';
  const isShipRoute = Boolean(
    currentTrip.ship_ref_id ||
    currentTrip.destination_port_id ||
    currentTrip.origin_port_id ||
    rawStatus === 'on_ship'
  );

  // Derive history items
  let historyItems = [];
  if (checkpoints && checkpoints.length > 0) {
    historyItems = checkpoints.map((cp) => ({
      icon: cp.event_type?.includes('port') ? Ship : (cp.event_type?.includes('destination') || cp.event_type?.includes('arrival') ? PackageCheck : Truck),
      label: cp.event_type?.replace(/_/g, ' ') || 'Checkpoint Ping',
      time: fmtTime(cp.created_at || cp.recorded_at),
    }));
  } else if (trip) {
    // Generate history from trip timestamps if available
    if (trip.created_at) {
      historyItems.push({
        icon: PackageCheck,
        label: `Trip created at ${originName}`,
        time: fmtTime(trip.created_at),
      });
    }
    if (trip.actual_departure_at || trip.chosen_departure_at) {
      historyItems.push({
        icon: isShipRoute ? Ship : Truck,
        label: `Departed towards ${destName}`,
        time: fmtTime(trip.actual_departure_at || trip.chosen_departure_at),
      });
    }
    if (trip.actual_arrival_at) {
      historyItems.push({
        icon: PackageCheck,
        label: `Arrived at ${destName}`,
        time: fmtTime(trip.actual_arrival_at),
      });
    }
  }

  if (historyItems.length === 0) {
    historyItems = DEFAULT_HISTORY;
  }

  const isCompleted = rawStatus === 'completed' || rawStatus === 'arrived';

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 sm:p-6 h-full flex flex-col">
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-800">Live Tracking</h3>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-sm text-slate-400 mt-0.5">{tripId}</p>
        </div>
      </div>

      {/* stylized route visual */}
      <div
        className="relative mt-4 rounded-lg overflow-hidden px-5 py-8"
        style={{
          background: `linear-gradient(160deg, ${COLORS.navy} 0%, ${COLORS.navyDark} 55%, ${COLORS.teal} 100%)`,
        }}
      >
        <span
          className="absolute top-3 right-3 text-[11px] font-semibold px-2 py-1 rounded-full text-white capitalize"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        >
          {rawStatus.replace(/_/g, ' ')}
        </span>

        <div className="relative h-px w-full mt-6" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(to right, ${COLORS.aqua} 0 6px, transparent 6px 14px)`,
              height: '1px',
            }}
          />
          <div
            className="absolute -top-2 transition-all duration-700"
            style={{ left: isCompleted ? '95%' : (rawStatus === 'draft' ? '10%' : '55%'), transform: 'translateX(-50%)' }}
          >
            {isShipRoute ? (
              <Ship size={16} color={COLORS.green} fill={COLORS.green} />
            ) : (
              <Truck size={16} color={COLORS.green} fill={COLORS.green} />
            )}
          </div>
        </div>

        <div className="flex justify-between mt-3 text-[11px]" style={{ color: '#B9D3E0' }}>
          <span className="flex items-center gap-1.5 truncate max-w-[48%]">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{originName}</span>
          </span>
          <span className="flex items-center gap-1.5 truncate max-w-[48%] justify-end">
            <span className="truncate">{destName}</span>
            <MapPin size={11} className="shrink-0" />
          </span>
        </div>
      </div>

      <div className="mt-5 flex-1">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
          Checkpoint history
        </p>
        <ul className="space-y-4">
          {historyItems.map(({ icon: Icon, label, time }, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${COLORS.aqua}14` }}
              >
                <Icon size={14} color={COLORS.teal} />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-slate-700 font-medium leading-tight capitalize">{label}</p>
                {time && <p className="text-xs text-slate-400 mt-0.5">{time}</p>}
              </div>
            </li>
          ))}
          {!isCompleted && (
            <li className="flex items-start gap-3 opacity-40">
              <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-slate-100">
                <CheckCircle2 size={14} className="text-slate-400" />
              </span>
              <p className="text-sm text-slate-500 font-medium leading-tight pt-1.5">
                Awaiting arrival confirmation…
              </p>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default LiveTrackingPanel;
