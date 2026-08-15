import React from 'react';
import { Truck, Ship, MapPin, PackageCheck, CheckCircle2, ChevronDown, ExternalLink, RefreshCw, User } from 'lucide-react';
import { COLORS, STATUS_STYLES } from './dashboardTheme';

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

const LiveTrackingPanel = ({
  trip = null,
  activeTrips = [],
  checkpoints = [],
  onSelectTrip = () => {},
  onViewDetails = () => {},
  onRefresh = () => {},
  refreshing = false,
}) => {
  const currentTrip = trip;
  const tripId = currentTrip?.id
    ? (typeof currentTrip.id === 'string' && currentTrip.id.startsWith('TRIP') ? currentTrip.id : `TRIP-${currentTrip.id}`)
    : 'NO ACTIVE TRIP';

  const originName = currentTrip?.origin?.name || currentTrip?.origin || 'Origin Terminal';
  const destName = currentTrip?.destination?.name || currentTrip?.destination || 'Destination Port';
  const rawStatus = currentTrip?.status || 'idle';
  const isShipRoute = Boolean(
    currentTrip?.ship_ref_id ||
    currentTrip?.destination_port_id ||
    currentTrip?.origin_port_id ||
    rawStatus === 'on_ship'
  );

  const statusInfo = STATUS_STYLES[rawStatus] || {
    label: rawStatus.replace(/_/g, ' '),
    bg: '#F1F5F9',
    color: '#64748B',
  };

  // Derive history items
  let historyItems = [];
  if (checkpoints && checkpoints.length > 0) {
    historyItems = checkpoints.map((cp) => ({
      icon: cp.event_type?.includes('port') ? Ship : (cp.event_type?.includes('destination') || cp.event_type?.includes('arrival') ? PackageCheck : Truck),
      label: cp.event_type?.replace(/_/g, ' ') || 'Checkpoint Ping',
      time: fmtTime(cp.created_at || cp.recorded_at),
      description: cp.notes || (cp.latitude && cp.longitude ? `GPS: ${Number(cp.latitude).toFixed(4)}, ${Number(cp.longitude).toFixed(4)}` : ''),
    }));
  } else if (currentTrip) {
    if (currentTrip.created_at) {
      historyItems.push({
        icon: PackageCheck,
        label: `Trip initialized`,
        time: fmtTime(currentTrip.created_at),
      });
    }
    if (currentTrip.actual_departure_at || currentTrip.chosen_departure_at) {
      historyItems.push({
        icon: isShipRoute ? Ship : Truck,
        label: `Departed origin (${originName})`,
        time: fmtTime(currentTrip.actual_departure_at || currentTrip.chosen_departure_at),
      });
    }
    if (currentTrip.actual_arrival_at) {
      historyItems.push({
        icon: CheckCircle2,
        label: `Arrived at destination (${destName})`,
        time: fmtTime(currentTrip.actual_arrival_at),
      });
    }
  }

  const isCompleted = rawStatus === 'completed' || rawStatus === 'arrived';
  const isInTransit = ['in_transit_origin', 'in_transit_destination', 'on_ship', 'at_origin_port', 'at_destination_port'].includes(rawStatus);

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-5 sm:p-6 h-full flex flex-col shadow-sm">
      {/* Panel Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-800">Live Operations</h3>
            {isInTransit && (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">{tripId}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh tracking data"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-teal-600' : ''} />
          </button>

          {currentTrip && (
            <button
              onClick={() => onViewDetails(currentTrip)}
              title="Open full trip detail"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition"
            >
              Details
              <ExternalLink size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Multiple Active Trips Switcher (if available) */}
      {activeTrips && activeTrips.length > 1 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[11px] text-slate-400 font-medium shrink-0 mr-1">Active:</span>
            {activeTrips.slice(0, 4).map((t) => {
              const isSelected = t.id === currentTrip?.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTrip(t)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition shrink-0 ${
                    isSelected
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  #{t.id} ({t.origin?.name?.split(' ')[0] || 'Origin'} → {t.destination?.name?.split(' ')[0] || 'Dest'})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Route card visual */}
      <div
        className="relative rounded-xl overflow-hidden px-5 py-6"
        style={{
          background: `linear-gradient(160deg, ${COLORS.navy} 0%, ${COLORS.navyDark} 60%, ${COLORS.teal} 100%)`,
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white capitalize shadow-xs"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          >
            {statusInfo.label}
          </span>

          {currentTrip?.ship_ref_id && (
            <span className="text-[10px] font-mono text-cyan-200 bg-cyan-900/50 px-2 py-0.5 rounded border border-cyan-400/30 flex items-center gap-1">
              <Ship size={10} />
              Ref: {currentTrip.ship_ref_id}
            </span>
          )}
        </div>

        {/* Animated Progress Route Line */}
        <div className="relative h-1 w-full mt-6 bg-white/20 rounded-full overflow-visible">
          <div
            className="absolute top-0 bottom-0 left-0 bg-teal-400 rounded-full transition-all duration-700"
            style={{
              width: isCompleted ? '100%' : (rawStatus === 'draft' ? '15%' : (rawStatus === 'assigned' ? '30%' : '65%')),
            }}
          />
          <div
            className="absolute -top-2.5 transition-all duration-700"
            style={{
              left: isCompleted ? '96%' : (rawStatus === 'draft' ? '15%' : (rawStatus === 'assigned' ? '30%' : '65%')),
              transform: 'translateX(-50%)',
            }}
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg ring-4 ring-emerald-400/30">
              {isShipRoute ? (
                <Ship size={12} fill="white" />
              ) : (
                <Truck size={12} fill="white" />
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-4 text-[11px]" style={{ color: '#B9D3E0' }}>
          <span className="flex items-center gap-1.5 truncate max-w-[48%]">
            <MapPin size={11} className="shrink-0 text-teal-300" />
            <span className="truncate font-medium text-white">{originName}</span>
          </span>
          <span className="flex items-center gap-1.5 truncate max-w-[48%] justify-end">
            <span className="truncate font-medium text-white">{destName}</span>
            <MapPin size={11} className="shrink-0 text-emerald-300" />
          </span>
        </div>

        {/* Truck & Driver Info Footer */}
        {(currentTrip?.truck || currentTrip?.driver) && (
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
            {currentTrip.truck && (
              <span className="flex items-center gap-1">
                <Truck size={12} className="text-teal-300" />
                <span className="font-mono text-white font-medium">{currentTrip.truck.plate_number || currentTrip.truck.plate || 'Vehicle'}</span>
                {currentTrip.truck.model && <span className="opacity-70">({currentTrip.truck.model})</span>}
              </span>
            )}
            {currentTrip.driver && (
              <span className="flex items-center gap-1">
                <User size={12} className="text-cyan-300" />
                <span className="text-white">{currentTrip.driver.name || currentTrip.driver.username}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Checkpoint history */}
      <div className="mt-5 flex-1 flex flex-col min-h-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center justify-between">
          <span>Operational Checkpoints</span>
          <span className="text-[10px] text-slate-400 font-normal">
            {historyItems.length} recorded
          </span>
        </p>

        <div className="flex-1 overflow-y-auto max-h-56 pr-1 space-y-3.5">
          {historyItems.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No checkpoints logged yet.</p>
          ) : (
            historyItems.map(({ icon: Icon, label, time, description }, i) => (
              <div key={i} className="flex items-start gap-3">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-2xs"
                  style={{ backgroundColor: `${COLORS.aqua}1A` }}
                >
                  <Icon size={13} color={COLORS.teal} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs text-slate-700 font-semibold leading-tight capitalize">{label}</p>
                    {time && <span className="text-[10px] text-slate-400 shrink-0">{time}</span>}
                  </div>
                  {description && <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>}
                </div>
              </div>
            ))
          )}

          {!isCompleted && currentTrip && (
            <div className="flex items-start gap-3 opacity-60">
              <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-slate-100 border border-slate-200">
                <CheckCircle2 size={13} className="text-slate-400" />
              </span>
              <div className="min-w-0 pt-1">
                <p className="text-xs text-slate-500 font-medium">
                  Awaiting next checkpoint confirmation…
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveTrackingPanel;
