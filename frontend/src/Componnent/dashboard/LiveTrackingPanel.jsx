import React, { useState, useEffect, useRef } from 'react';
import {
  Truck,
  Ship,
  MapPin,
  PackageCheck,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  User,
  Loader2,
} from 'lucide-react';
import { COLORS, STATUS_STYLES } from './dashboardTheme';
import { getPosition } from '../../api/tripsApi';
import { fetchRoutePath } from '../../utils/tomtomRoute';

const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || '';

// Right now the only thing that ever moves a trip's position is the driver
// dashboard's Simulate feature, which writes a gps_ping every 1s over a
// fixed 10s run (not real GPS) — polling at the PRD's suggested 15-30s would
// mean this panel never visibly catches the movement, so it matches that
// cadence instead.
const POSITION_POLL_MS = 1000;

const DEFAULT_TRIP = {
  id: 'TRIP-2026-0842',
  origin: 'Company A, Batam',
  destination: 'Jurong Port, Singapore',
  status: 'Ship at sea',
};

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

// Teardrop pin marker, matching the driver dashboard's map styling.
const pinSvg = (color) => `
  <svg width="26" height="34" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35))">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 12.75 17 27 17 27s17-14.25 17-27C34 7.6 26.4 0 17 0z" fill="${color}"/>
    <circle cx="17" cy="17" r="7" fill="white"/>
  </svg>`;

const LiveTrackingPanel = ({
  trip = null,
  activeTrips = [],
  checkpoints = [],
  onSelectTrip = () => {},
  onViewDetails = () => {},
  onRefresh = () => {},
  refreshing = false,
}) => {
  const currentTrip = trip || DEFAULT_TRIP;
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

  /* ── live map ─────────────────────────────────────────────── */
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const liveMarkerRef = useRef(null);
  const sdkLoadingRef = useRef(null);
  const pollRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [livePosition, setLivePosition] = useState(null);

  // Load SDK once
  useEffect(() => {
    if (sdkLoadingRef.current) return;
    sdkLoadingRef.current = true;

    if (!TOMTOM_API_KEY) {
      setMapError('TomTom API key not set');
      return;
    }
    if (window.tt) {
      setMapReady(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js';
    script.onload = () => setMapReady(true);
    script.onerror = () => setMapError('Failed to load map SDK');
    document.body.appendChild(script);
  }, []);

  // Init map once
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

  // Origin/destination pins — reset whenever the tracked trip changes
  useEffect(() => {
    if (!mapReady || !mapRef.current || !trip) return;
    const map = mapRef.current;

    document.querySelectorAll('.mapboxgl-marker').forEach((m) => m.remove());
    liveMarkerRef.current = null;
    setLivePosition(null);

    const originLat = trip.origin?.latitude;
    const originLng = trip.origin?.longitude;
    const destLat = trip.destination?.latitude;
    const destLng = trip.destination?.longitude;
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

  // Poll live position every 1s while the trip is still moving
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
        // No position recorded yet for this trip — fine, just wait for the next tick.
      }
    };

    poll();
    pollRef.current = setInterval(poll, POSITION_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [trip?.id, trip?.status, mapReady]);

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-5 sm:p-6 h-full flex flex-col justify-between shadow-sm">
      <div>
        {/* Panel Header */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
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
          <div className="mb-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <span className="text-[11px] text-slate-400 font-medium shrink-0 mr-1">Active:</span>
              {activeTrips.slice(0, 4).map((t) => {
                const isSelected = t.id === currentTrip?.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onSelectTrip(t)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition shrink-0 ${
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

        {/* Live TomTom Map */}
        <div className="relative rounded-lg overflow-hidden bg-slate-100 border border-slate-200" style={{ height: 135 }}>
          <div ref={mapElRef} className="w-full h-full" />

          {!mapReady && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80">
              <Loader2 size={18} className="animate-spin" style={{ color: COLORS.teal }} />
            </div>
          )}
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-red-500 bg-slate-50">
              {mapError}
            </div>
          )}

          <span
            className="absolute top-2.5 right-2.5 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white capitalize shadow-xs"
            style={{ backgroundColor: 'rgba(15,23,42,0.75)' }}
          >
            {statusInfo.label}
          </span>

          {livePosition && (
            <span
              className="absolute bottom-2.5 left-2.5 flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white shadow-xs"
              style={{ backgroundColor: 'rgba(15,23,42,0.75)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live · {livePosition.source === 'api' ? 'Vessel' : 'GPS'}
            </span>
          )}
        </div>

        {/* Origin & Destination Labels */}
        <div className="flex justify-between items-center mt-2 text-[11px] text-slate-600 font-medium">
          <span className="flex items-center gap-1 truncate max-w-[47%]">
            <MapPin size={11} className="shrink-0 text-emerald-600" />
            <span className="truncate text-slate-700">{originName}</span>
          </span>
          <span className="text-slate-300 font-normal">→</span>
          <span className="flex items-center gap-1 truncate max-w-[47%] justify-end">
            <span className="truncate text-slate-700">{destName}</span>
            <MapPin size={11} className="shrink-0 text-blue-600" />
          </span>
        </div>

        {/* Truck & Driver Info Footer (if available) */}
        {(currentTrip?.truck || currentTrip?.driver) && (
          <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            {currentTrip.truck && (
              <span className="flex items-center gap-1 truncate max-w-[48%]">
                <Truck size={11} className="text-teal-600 shrink-0" />
                <span className="font-mono text-slate-600 font-medium truncate">
                  {currentTrip.truck.plate_number || currentTrip.truck.plate || 'Vehicle'}
                </span>
                {currentTrip.truck.model && <span className="text-slate-400 truncate">({currentTrip.truck.model})</span>}
              </span>
            )}
            {currentTrip.driver && (
              <span className="flex items-center gap-1 truncate max-w-[48%] justify-end">
                <User size={11} className="text-slate-400 shrink-0" />
                <span className="text-slate-600 font-medium truncate">
                  {currentTrip.driver.name || currentTrip.driver.username}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Checkpoint history */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Operational Checkpoints
          </p>
          <span className="text-[10px] text-slate-400 font-normal">
            {historyItems.length} recorded
          </span>
        </div>

        <div className="flex-1 overflow-y-auto max-h-24 pr-1 space-y-2 text-xs">
          {historyItems.length === 0 ? (
            <p className="text-xs text-slate-400 py-2 text-center">No checkpoints logged yet.</p>
          ) : (
            historyItems.map(({ icon: Icon, label, time, description }, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-2xs mt-0.5"
                  style={{ backgroundColor: `${COLORS.aqua}1A` }}
                >
                  <Icon size={11} color={COLORS.teal} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] text-slate-700 font-semibold leading-tight capitalize truncate">{label}</p>
                    {time && <span className="text-[9px] text-slate-400 shrink-0">{time}</span>}
                  </div>
                  {description && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{description}</p>}
                </div>
              </div>
            ))
          )}

          {!isCompleted && currentTrip && (
            <div className="flex items-center gap-2 opacity-60 pt-0.5">
              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-slate-100 border border-slate-200">
                <CheckCircle2 size={11} className="text-slate-400" />
              </span>
              <p className="text-[10px] text-slate-500 font-medium truncate">
                Awaiting next checkpoint…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveTrackingPanel;
