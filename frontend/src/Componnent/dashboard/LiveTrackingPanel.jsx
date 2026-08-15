import React, { useState, useEffect, useRef } from 'react';
import { Truck, Ship, MapPin, PackageCheck, CheckCircle2, Loader2 } from 'lucide-react';
import { COLORS } from './dashboardTheme';
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

// Teardrop pin marker, matching the driver dashboard's map styling.
const pinSvg = (color) => `
  <svg width="26" height="34" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35))">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 12.75 17 27 17 27s17-14.25 17-27C34 7.6 26.4 0 17 0z" fill="${color}"/>
    <circle cx="17" cy="17" r="7" fill="white"/>
  </svg>`;

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
    <div className="bg-white rounded-xl border-2 border-slate-200 p-5 sm:p-6 h-full flex flex-col shadow-sm">
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-800">Live Tracking</h3>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-sm text-slate-400 mt-0.5">{tripId}</p>
        </div>
      </div>

      {/* live map */}
      <div className="relative mt-4 rounded-lg overflow-hidden bg-slate-100" style={{ height: 180 }}>
        <div ref={mapElRef} className="w-full h-full" />

        {!mapReady && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin" style={{ color: COLORS.teal }} />
          </div>
        )}
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-red-500">
            {mapError}
          </div>
        )}

        <span
          className="absolute top-3 right-3 text-[11px] font-semibold px-2 py-1 rounded-full text-white capitalize"
          style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}
        >
          {rawStatus.replace(/_/g, ' ')}
        </span>

        {livePosition && (
          <span
            className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full text-white"
            style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live · {livePosition.source === 'api' ? 'Vessel' : 'GPS'}
          </span>
        )}
      </div>

      <div className="flex justify-between mt-2.5 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 truncate max-w-[48%]">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{originName}</span>
        </span>
        <span className="flex items-center gap-1.5 truncate max-w-[48%] justify-end">
          <span className="truncate">{destName}</span>
          <MapPin size={11} className="shrink-0" />
        </span>
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
