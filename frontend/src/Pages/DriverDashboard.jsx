import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Truck, Clock, LogOut, Menu, X, AlertCircle, Loader2, Zap, Anchor } from 'lucide-react';
import { getTrips, getTrip, storeCheckpoint } from '../api/tripsApi';
import { COLORS, STATUS_STYLES } from '../Componnent/dashboard/dashboardTheme';

const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || '';

const ANIM = `
  @keyframes fade-in { from{opacity:0} to{opacity:1} }
  @keyframes slide-in-left { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
  @keyframes slide-in-right { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
`;

const statusStyle = (status) =>
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

/* ── trip simulation (demo speed: always 10s regardless of real distance) ── */
const SIMULATE_DURATION_MS = 10000;
const SIMULATE_PING_INTERVAL_MS = 1000;
// Vessel crossing gets its own, longer demo duration — a sea crossing "feels"
// like it should take longer than a truck leg even in fast-forward.
const SIMULATE_VESSEL_DURATION_MS = 20000;

// Which leg is "in motion" depends on trip.status — mirrors the backend's own
// state machine (TripCheckpointController::recordArrival/recordGpsPing), so
// the event_type submitted at the end is always the one the backend expects
// for the trip's current status, and the coords sent are always the real
// endpoint (never an animated/interpolated point), so the Haversine arrival
// check always passes regardless of the fake 10s "distance".
const getSimulateConfig = (trip) => {
  if (!trip) return null;
  if (trip.status === 'in_transit_origin') {
    return {
      from: trip.origin, to: trip.destination,
      // TripResource exposes this as a nested `ship_destination_port` object
      // ({id, name, latitude, longitude}), not a flat _id field.
      eventType: trip.ship_destination_port ? 'arrived_at_port' : 'arrived_at_destination',
      reversed: false,
      // gps_ping is only accepted while status is in_transit_origin/destination
      allowGpsPing: true,
      label: 'Simulate Arrival',
    };
  }
  if (trip.status === 'in_transit_destination') {
    return { from: trip.destination, to: trip.origin, eventType: 'arrived_final', reversed: true, allowGpsPing: true, label: 'Simulate Arrival' };
  }
  if (trip.status === 'at_origin_port') {
    // Cross-border truck's return leg — status stays at_origin_port (that
    // field tracks the ship, not the truck), so gps_ping would 422 here.
    return { from: trip.destination, to: trip.origin, eventType: 'truck_returned', reversed: true, allowGpsPing: false, label: 'Send Truck Back to Company' };
  }
  return null;
};

// Equal-time-per-segment interpolation along a [lng,lat] polyline — good
// enough for a demo animation, doesn't need to be equal-distance.
const interpolateAlongPath = (path, t) => {
  if (!path || path.length < 2) return null;
  const scaledT = Math.min(Math.max(t, 0), 1) * (path.length - 1);
  const i = Math.floor(scaledT);
  const frac = scaledT - i;
  const a = path[Math.min(i, path.length - 1)];
  const b = path[Math.min(i + 1, path.length - 1)];
  return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
};

/* ── Trip Card Component ─────────────────────────────────────── */
const TripCard = ({ trip, selected, onClick }) => {
  const s = statusStyle(trip.status);
  const from = trip.origin?.name ?? 'Origin';
  const to = trip.destination?.name ?? 'Destination';

  return (
    <div
      onClick={onClick}
      className="p-3.5 rounded-xl cursor-pointer transition-all border"
      style={{
        backgroundColor: selected ? `${COLORS.teal}0D` : COLORS.bg,
        borderColor: selected ? COLORS.teal : 'transparent',
        boxShadow: selected ? `0 1px 3px ${COLORS.teal}20` : 'none',
        animation: 'slide-in-left 0.3s ease-out',
      }}>
      <div className="flex items-center gap-3 mb-3">
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${COLORS.navy}0D` }}
        >
          <Truck size={16} color={COLORS.navy} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 text-sm leading-tight">Trip #{trip.id}</h3>
        </div>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: s.bg, color: s.color }}
        >
          {s.label}
        </span>
      </div>
      <div className="space-y-1.5 text-xs pl-0.5">
        <div className="flex items-center gap-2">
          <MapPin size={13} style={{ color: COLORS.teal }} className="shrink-0" />
          <span className="text-slate-500 truncate"><span className="text-slate-400">From</span> · {from}</span>
        </div>
        <div className="flex items-center gap-2">
          <Navigation size={13} style={{ color: COLORS.teal }} className="shrink-0" />
          <span className="text-slate-500 truncate"><span className="text-slate-400">To</span> · {to}</span>
        </div>
      </div>
    </div>
  );
};

/* ── Map Component ───────────────────────────────────────────── */
const MapView = ({ trip, onStartTrip, starting, onSimulateComplete }) => {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const sdkLoadingRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [routeSummary, setRouteSummary] = useState(null);

  // Simulate-trip animation state — refs (not state) since they don't need
  // to trigger re-renders, just persist across the 10s of rAF/interval ticks.
  const routeCoordsRef = useRef(null);
  const truckMarkerRef = useRef(null);
  const simulateRafRef = useRef(null);
  const simulatePingTimerRef = useRef(null);
  const [simulating, setSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState(null);

  // Simulate Vessel — separate ref set from the truck's, since the ship
  // crossing and the truck's return leg are independent and could plausibly
  // run at the same time (truck driving home while the ship is at sea).
  const vesselMarkerRef = useRef(null);
  const vesselRafRef = useRef(null);
  const vesselPingTimerRef = useRef(null);
  const [simulatingVessel, setSimulatingVessel] = useState(false);
  const [vesselError, setVesselError] = useState(null);

  // Cross-border return leg: status stays at_origin_port the whole time
  // (that field tracks the ship, not the truck), so the only way to tell
  // "has the truck left the port yet" is a second 'departed' checkpoint —
  // there's no status value or column for it.
  const [returnDeparted, setReturnDeparted] = useState(false);

  useEffect(() => {
    if (!trip?.id || trip.status !== 'at_origin_port' || trip.truck_returned_at) {
      setReturnDeparted(false);
      return;
    }
    getCheckpoints(trip.id)
      .then((res) => {
        const departedCount = (res.data?.data ?? []).filter((cp) => cp.event_type === 'departed').length;
        setReturnDeparted(departedCount >= 2);
      })
      .catch(() => setReturnDeparted(false));
  }, [trip]);

  // Load SDK once
  useEffect(() => {
    if (sdkLoadingRef.current) return;
    sdkLoadingRef.current = true;

    if (!TOMTOM_API_KEY || TOMTOM_API_KEY === 'MASUKKAN_API_KEY_TOMTOM') {
      setMapError('TomTom API key not set. Add VITE_TOMTOM_API_KEY to .env.local');
      return;
    }

    console.log('Loading TomTom SDK...');

    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css';
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js';
    script.onload = () => {
      console.log('✓ TomTom SDK loaded');
      setMapReady(true);
    };
    script.onerror = () => {
      console.error('✗ TomTom SDK load failed');
      setMapError('Failed to load TomTom SDK');
    };
    document.body.appendChild(script);
  }, []);

  // Init map when SDK ready
  useEffect(() => {
    if (!mapReady || !mapElRef.current || mapRef.current) return;
    if (!window.tt) {
      setMapError('TomTom SDK not available');
      return;
    }

    console.log('Initializing map...');
    try {
      mapRef.current = window.tt.map({
        key: TOMTOM_API_KEY,
        container: mapElRef.current,
        center: [104.0305, 1.1301],
        zoom: 12,
      });
      mapRef.current.addControl(new window.tt.NavigationControl());
      console.log('✓ Map ready');
    } catch (err) {
      console.error('Map init error:', err);
      setMapError(err.message);
    }
  }, [mapReady]);

  // Draw route when trip changes
  useEffect(() => {
    if (!trip || !mapRef.current || !mapReady) return;

    const map = mapRef.current;

    // Extract coordinates
    const originLat = trip.origin?.latitude;
    const originLng = trip.origin?.longitude;
    const destLat = trip.destination?.latitude;
    const destLng = trip.destination?.longitude;

    console.log('Trip:', trip.id, 'Origin:', [originLng, originLat], 'Dest:', [destLng, destLat]);

    if (!originLat || !originLng || !destLat || !destLng) {
      setMapError('Trip missing coordinates');
      return;
    }

    // Clear old markers and route
    document.querySelectorAll('.mapboxgl-marker').forEach(m => m.remove());
    if (map.getLayer('route-layer')) map.removeLayer('route-layer');
    if (map.getSource('route-src')) map.removeSource('route-src');
    setRouteSummary(null);

    // Cancel any in-flight simulation — its marker/coords belonged to the
    // previous trip and just got wiped above.
    cancelAnimationFrame(simulateRafRef.current);
    clearInterval(simulatePingTimerRef.current);
    truckMarkerRef.current = null;
    routeCoordsRef.current = null;
    setSimulating(false);
    setSimulateError(null);

    cancelAnimationFrame(vesselRafRef.current);
    clearInterval(vesselPingTimerRef.current);
    vesselMarkerRef.current = null;
    setSimulatingVessel(false);
    setVesselError(null);

    const from = trip.origin?.name || 'Origin';
    const to = trip.destination?.name || 'Destination';

    // Pin-shaped markers (teardrop, matching TomTom's own map UI) instead of
    // plain dots — a small SVG per marker, no extra dependency needed.
    // Colors pulled from the shared brand palette so they match every other
    // "origin/destination" pairing in the app (green = start, navy = end).
    const pinSvg = (color) => `
      <svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35))">
        <path d="M17 0C7.6 0 0 7.6 0 17c0 12.75 17 27 17 27s17-14.25 17-27C34 7.6 26.4 0 17 0z" fill="${color}"/>
        <circle cx="17" cy="17" r="7" fill="white"/>
      </svg>`;

    const markerA = document.createElement('div');
    markerA.innerHTML = pinSvg(COLORS.green);
    new window.tt.Marker({ element: markerA, anchor: 'bottom' })
      .setLngLat([originLng, originLat])
      .setPopup(new window.tt.Popup().setHTML(`<strong style="color:${COLORS.navy}">${from}</strong>`))
      .addTo(map);

    const markerB = document.createElement('div');
    markerB.innerHTML = pinSvg(COLORS.navy);
    new window.tt.Marker({ element: markerB, anchor: 'bottom' })
      .setLngLat([destLng, destLat])
      .setPopup(new window.tt.Popup().setHTML(`<strong style="color:${COLORS.navy}">${to}</strong>`))
      .addTo(map);

    // Calculate route — live traffic every time, no caching: this is the
    // driver's actual navigation view, so it always needs the current road
    // situation rather than whatever was true when the trip was recommended.
    // Orbis v3 route-planning endpoint (distinct from the legacy v1
    // calculateRoute used for backend recommendation scoring) — requires
    // apiVersion=3 and an "Attributes: routes" header to select the
    // top-level response field; geometry comes back as GeoJSON
    // [lng, lat] pairs at routes[].legs[].path.coordinates (verified against
    // a live call — the publicly documented Orbis v2 calculateRoute page
    // describes a different, path-based endpoint with a points[] shape).
    const url = `https://api.tomtom.com/maps/orbis/routing/routes/calculate?key=${TOMTOM_API_KEY}&apiVersion=3`;

    console.log('Fetching route (live traffic)...');

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Attributes': 'routes' },
      body: JSON.stringify({
        routePlanningLocations: {
          origin:      { type: 'Point', coordinates: [originLng, originLat] },
          destination: { type: 'Point', coordinates: [destLng, destLat] },
        },
        routeType: 'efficient',
        traffic: 'live',
      }),
    })
      .then(r => r.json())
      .then(data => {
        const route = data.routes?.[0];
        if (!route) throw new Error(data.detailedError?.message || 'No route found');

        const coords = route.legs.flatMap(leg => leg.path.coordinates);
        routeCoordsRef.current = coords;

        // Add route line
        map.addSource('route-src', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } },
        });
        map.addLayer({
          id: 'route-layer',
          type: 'line',
          source: 'route-src',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': COLORS.teal, 'line-width': 6 },
        });

        // Zoom to route
        const bounds = new window.tt.LngLatBounds();
        coords.forEach(c => bounds.extend(c));
        map.fitBounds(bounds, { padding: 100 });

        setRouteSummary({
          distanceKm:      route.summary.lengthInMeters / 1000,
          durationMin:     Math.round(route.summary.travelDurationInSeconds / 60),
          trafficDelayMin: Math.round(route.summary.trafficDelayDurationInSeconds / 60),
        });
        console.log('✓ Route drawn — traffic delay:', route.summary.trafficDelayDurationInSeconds, 's');
        setMapError(null);
      })
      .catch(err => {
        console.error('Route error:', err);
        setMapError(err.message);
      });
  }, [trip, mapReady]);

  const handleSimulate = () => {
    if (!trip || simulating || !mapRef.current) return;
    const config = getSimulateConfig(trip);
    if (!config) return;

    if (!config.to?.latitude || !config.to?.longitude || !config.from?.latitude || !config.from?.longitude) {
      setSimulateError('Trip missing coordinates.');
      return;
    }

    const path = routeCoordsRef.current
      ? (config.reversed ? [...routeCoordsRef.current].reverse() : routeCoordsRef.current)
      : [
          [config.from.longitude, config.from.latitude],
          [config.to.longitude, config.to.latitude],
        ];

    setSimulating(true);
    setSimulateError(null);

    const el = document.createElement('div');
    el.style.cssText = `width:22px;height:22px;border-radius:50%;background:${COLORS.aqua};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);`;
    const marker = new window.tt.Marker({ element: el }).setLngLat(path[0]).addTo(mapRef.current);
    truckMarkerRef.current = marker;

    const startTime = performance.now();

    const finishSimulate = async () => {
      clearInterval(simulatePingTimerRef.current);
      try {
        await storeCheckpoint(trip.id, {
          event_type: config.eventType,
          latitude: config.to.latitude,
          longitude: config.to.longitude,
        });
        const res = await getTrip(trip.id);
        onSimulateComplete?.(res.data?.data);
      } catch (err) {
        setSimulateError(err?.response?.data?.message || 'Simulation failed.');
      } finally {
        setSimulating(false);
      }
    };

    const step = (now) => {
      const t = Math.min((now - startTime) / SIMULATE_DURATION_MS, 1);
      const pos = interpolateAlongPath(path, t);
      if (pos) marker.setLngLat(pos);

      if (t < 1) {
        simulateRafRef.current = requestAnimationFrame(step);
      } else {
        finishSimulate();
      }
    };
    simulateRafRef.current = requestAnimationFrame(step);

    // Periodic gps_ping so anything polling GET /trips/:id/position (or
    // watching the checkpoint history) also sees the truck actually moving,
    // not just a status flip at the end — every 1s for a visibly smooth trail.
    if (config.allowGpsPing) {
      simulatePingTimerRef.current = setInterval(() => {
        const t = (performance.now() - startTime) / SIMULATE_DURATION_MS;
        if (t >= 1) return;
        const pos = interpolateAlongPath(path, t);
        if (pos) {
          storeCheckpoint(trip.id, { event_type: 'gps_ping', latitude: pos[1], longitude: pos[0] }).catch(() => {});
        }
      }, SIMULATE_PING_INTERVAL_MS);
    }
  };

  // Simulate Vessel: departure -> a randomly-chosen other-island port ->
  // arrival, all as one continuous action, mirroring how Simulate Arrival
  // handles a whole truck leg in one click. Fully independent of the truck's
  // own return-leg simulation (separate refs/state above) since in reality
  // the ship sails while the truck may already be driving home.
  const handleSimulateVessel = async () => {
    if (!trip || simulatingVessel || !mapRef.current || trip.status !== 'at_origin_port') return;
    if (!trip.ship_ref_id) {
      setVesselError('Set a vessel reference ID first (admin > Vessel tab).');
      return;
    }

    const from = trip.destination; // the truck's arrival port — where the ship departs from
    if (!from?.latitude || !from?.longitude) {
      setVesselError('Trip missing port coordinates.');
      return;
    }

    setSimulatingVessel(true);
    setVesselError(null);

    let toPort;
    try {
      const res = await getPorts({ per_page: 100 });
      const ports = res.data?.data ?? [];
      const originPort = ports.find((p) => p.id === from.id);
      const otherIslandPorts = originPort
        ? ports.filter((p) => p.country !== originPort.country)
        : ports.filter((p) => p.id !== from.id);
      if (otherIslandPorts.length === 0) throw new Error('No ports registered on the other island.');
      toPort = otherIslandPorts[Math.floor(Math.random() * otherIslandPorts.length)];
    } catch (err) {
      setVesselError(err?.response?.data?.message || err.message || 'Failed to pick a destination port.');
      setSimulatingVessel(false);
      return;
    }

    // Flips status to on_ship and overwrites ship_destination_port_id with
    // the port just picked, for the duration of this simulated crossing.
    try {
      await storeCheckpoint(trip.id, {
        event_type: 'ship_departed',
        latitude: from.latitude,
        longitude: from.longitude,
        destination_port_id: toPort.id,
      });
    } catch (err) {
      setVesselError(err?.response?.data?.message || 'Failed to start the vessel crossing.');
      setSimulatingVessel(false);
      return;
    }

    // Straight-line path, not a fetched route — TomTom's road routing has no
    // concept of a sea crossing (confirmed empirically: it 400s with
    // MAP_MATCHING_FAILURE/NO_ROUTE_FOUND over the Batam<->Singapore gap).
    const path = [
      [from.longitude, from.latitude],
      [toPort.longitude, toPort.latitude],
    ];

    const el = document.createElement('div');
    el.style.cssText = `width:22px;height:22px;border-radius:50%;background:${COLORS.navy};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);`;
    const marker = new window.tt.Marker({ element: el }).setLngLat(path[0]).addTo(mapRef.current);
    vesselMarkerRef.current = marker;

    const startTime = performance.now();

    const finishVessel = async () => {
      clearInterval(vesselPingTimerRef.current);
      try {
        await storeCheckpoint(trip.id, {
          event_type: 'ship_arrived',
          latitude: toPort.latitude,
          longitude: toPort.longitude,
        });
        const res = await getTrip(trip.id);
        onSimulateComplete?.(res.data?.data);
      } catch (err) {
        setVesselError(err?.response?.data?.message || 'Vessel simulation failed.');
      } finally {
        setSimulatingVessel(false);
      }
    };

    const step = (now) => {
      const t = Math.min((now - startTime) / SIMULATE_VESSEL_DURATION_MS, 1);
      const pos = interpolateAlongPath(path, t);
      if (pos) marker.setLngLat(pos);

      if (t < 1) {
        vesselRafRef.current = requestAnimationFrame(step);
      } else {
        finishVessel();
      }
    };
    vesselRafRef.current = requestAnimationFrame(step);

    // gps_ping is valid for on_ship now (backend change alongside this
    // feature) so GET /trips/:id/position picks up the crossing live, same
    // as the truck legs.
    vesselPingTimerRef.current = setInterval(() => {
      const t = (performance.now() - startTime) / SIMULATE_VESSEL_DURATION_MS;
      if (t >= 1) return;
      const pos = interpolateAlongPath(path, t);
      if (pos) {
        storeCheckpoint(trip.id, { event_type: 'gps_ping', latitude: pos[1], longitude: pos[0] }).catch(() => {});
      }
    }, SIMULATE_PING_INTERVAL_MS);
  };

  return (
    <div className="w-full h-full relative">
      {/* container is always mounted so mapElRef is available the instant the
          SDK finishes loading — it used to only render once a trip was
          selected, but trips load async and can resolve after the SDK,
          leaving the "init map" effect with a null ref and nothing to retry it */}
      <div ref={mapElRef} className="w-full h-full" />

      {!trip && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: `linear-gradient(160deg, ${COLORS.bg}, #E7F1F6)` }}
        >
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${COLORS.teal}14` }}
            >
              <MapPin size={26} style={{ color: COLORS.teal }} />
            </div>
            <p className="text-slate-500 text-sm">Select a trip to view the map</p>
          </div>
        </div>
      )}
      {!mapReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 z-50">
          <Loader2 className="animate-spin" size={30} style={{ color: COLORS.teal }} />
          <p className="text-xs text-slate-400">Loading map…</p>
        </div>
      )}
      {mapError && (
        <div className="absolute top-4 left-4 z-50 bg-red-50 border border-red-200 rounded-xl p-4 max-w-xs flex gap-3 shadow-sm">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900 text-sm">Map Error</p>
            <p className="text-xs text-red-700 mt-0.5">{mapError}</p>
          </div>
        </div>
      )}

      {trip && (() => {
        const s = statusStyle(trip.status);
        // chosen_departure_at is the planned time picked at /assign; once the
        // driver actually hits "Start Trip", actual_departure_at is stamped
        // (TripCheckpointController::recordDeparture) and becomes the real
        // value — showing the stale planned time afterward would be wrong,
        // e.g. the driver started later/earlier than planned.
        const hasDeparted = !!trip.actual_departure_at;
        const departure = hasDeparted ? trip.actual_departure_at : trip.chosen_departure_at;
        const isCompleted = trip.status === 'completed';
        const eta = routeSummary && departure
          ? new Date(new Date(departure).getTime() + routeSummary.durationMin * 60000)
          : null;
        const actualDurationMin = isCompleted && trip.actual_departure_at && trip.actual_arrival_at
          ? Math.round((new Date(trip.actual_arrival_at) - new Date(trip.actual_departure_at)) / 60000)
          : null;
        const simulateConfig = getSimulateConfig(trip);
        const isAtPort = trip.status === 'at_origin_port';
        const truckReturned = isAtPort && !!trip.truck_returned_at;
        // At port, reuse the exact same Start Trip action for the return
        // leg's departure — recordDeparture() already handles AT_ORIGIN_PORT
        // status generically (records the checkpoint, doesn't touch status),
        // it's the same call as leg 1, just fired a second time.
        const showStartTrip = trip.status === 'assigned' || (isAtPort && !truckReturned && !returnDeparted);
        const showSimulate = simulateConfig && !showStartTrip && !truckReturned;

        return (
          <div className="absolute top-4 left-4 z-30 bg-white rounded-2xl shadow-lg px-4 py-4 min-w-[220px]"
            style={{ animation: 'fade-in 0.2s ease-out' }}>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Trip Overview
            </p>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>
                {s.label}
              </span>
              {!isCompleted && routeSummary?.trafficDelayMin > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#C2703D' }}>
                  <Truck size={12} />+{routeSummary.trafficDelayMin}m traffic
                </span>
              )}
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400 flex items-center gap-1.5"><Clock size={12} />{isCompleted ? 'Duration' : 'Est. Duration'}</span>
                <span className="font-semibold text-slate-800">
                  {isCompleted ? fmtDur(actualDurationMin) : (routeSummary ? fmtDur(routeSummary.durationMin) : '—')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400 flex items-center gap-1.5"><Navigation size={12} />{hasDeparted ? 'Departed' : 'Departure'}</span>
                <span className="font-semibold text-slate-800">{departure ? fmt(departure) : 'Not yet assigned'}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400 flex items-center gap-1.5"><MapPin size={12} />Distance</span>
                <span className="font-semibold text-slate-800">{routeSummary ? `${routeSummary.distanceKm.toFixed(0)} km` : '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100">
                <span className="text-slate-400">{isCompleted ? 'Arrived' : 'Est. Arrival'}</span>
                <span className="font-semibold text-slate-800">
                  {isCompleted ? fmt(trip.actual_arrival_at) : (eta ? fmt(eta) : '—')}
                </span>
              </div>
            </div>

            {showStartTrip && (
              <button onClick={onStartTrip} disabled={starting}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition"
                style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})`, boxShadow: `0 2px 8px ${COLORS.teal}30` }}>
                {starting
                  ? <><Loader2 size={14} className="animate-spin" /> Starting…</>
                  : <><Navigation size={14} /> Start Trip</>}
              </button>
            )}

            {showSimulate && (
              <button onClick={handleSimulate} disabled={simulating}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition"
                style={{ background: 'linear-gradient(135deg, #C2703D, #D98C55)', boxShadow: '0 2px 8px rgba(194,112,61,0.25)' }}>
                {simulating
                  ? <><Loader2 size={14} className="animate-spin" /> Simulating…</>
                  : <><Zap size={14} /> {simulateConfig.label}</>}
              </button>
            )}

            {truckReturned && (
              <div className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-emerald-700 bg-emerald-50">
                <CheckCircle2 size={14} /> Truck Returned · {fmt(trip.truck_returned_at)}
              </div>
            )}

            {/* Vessel crossing is independent of the truck's return leg above —
                the ship sails on its own once cargo's at the port, whether or
                not the truck has started driving home yet. */}
            {isAtPort && trip.ship_destination_port && (
              trip.ship_ref_id ? (
                <button onClick={handleSimulateVessel} disabled={simulatingVessel}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.teal})` }}>
                  {simulatingVessel
                    ? <><Loader2 size={14} className="animate-spin" /> Sailing…</>
                    : <><Ship size={14} /> Simulate Vessel</>}
                </button>
              ) : (
                <p className="mt-3 text-[11px] text-slate-400 text-center">
                  Set a vessel reference (admin) to simulate the crossing.
                </p>
              )
            )}

            {simulateError && (
              <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{simulateError}</p>
            )}
            {vesselError && (
              <p className="mt-2 text-xs text-red-500">{vesselError}</p>
            )}
          </div>
        );
      })()}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════ */
const DriverDashboard = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);
  const driverName = localStorage.getItem('user_name') || 'Driver';

  useEffect(() => {
    fetchDriverTrips();
  }, []);

  const fetchDriverTrips = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getTrips({ per_page: 100 });
      const driverTrips = res.data?.data || [];
      console.log('Loaded trips:', driverTrips.length);
      setTrips(driverTrips);
      if (driverTrips.length > 0) {
        setSelectedTrip(driverTrips[0]);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load trips');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  // Shared by handleStartTrip and MapView's simulate-arrival flow — both end
  // with a re-fetched trip resource that needs to land in both the sidebar
  // list and whichever trip is currently selected.
  const syncTripUpdate = (updated) => {
    setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTrip(updated);
  };

  const handleStartTrip = () => {
    if (!selectedTrip || starting) return;

    if (!navigator.geolocation) {
      setStartError('Geolocation is not supported by this browser.');
      return;
    }

    setStarting(true);
    setStartError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await storeCheckpoint(selectedTrip.id, {
            event_type: 'departed',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          // Re-fetch rather than trust the checkpoint response's bare
          // trip_status string — need the full resource (actual_departure_at
          // etc.) to keep the map card and trip list in sync.
          const res = await getTrip(selectedTrip.id);
          syncTripUpdate(res.data?.data);
        } catch (err) {
          setStartError(err?.response?.data?.message || 'Failed to start trip.');
        } finally {
          setStarting(false);
        }
      },
      (geoErr) => {
        setStartError(`Could not get your location: ${geoErr.message}`);
        setStarting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="flex h-screen font-sans" style={{ backgroundColor: COLORS.bg }}>
      <style>{ANIM}</style>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-80 bg-white shadow-lg transform transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="px-6 py-6 border-b border-slate-100">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${COLORS.navy}14` }}
                >
                  <Anchor size={17} color={COLORS.navy} strokeWidth={2} />
                </div>
                <div>
                  <p className="font-semibold tracking-[0.18em] text-xs leading-none" style={{ color: COLORS.navy }}>
                    MARE NOSTRUM
                  </p>
                  <p className="text-[10px] italic mt-1 leading-none" style={{ color: COLORS.teal }}>
                    Our sea, our trade
                  </p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: COLORS.bg }}>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
                style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}
              >
                {driverName[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{driverName}</p>
                <p className="text-xs text-slate-400">Driver</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">My Trips</h2>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${COLORS.aqua}14`, color: COLORS.aqua }}
              >
                {trips.length}
              </span>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin" size={22} style={{ color: COLORS.teal }} />
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600">{error}</div>
            )}

            {!loading && trips.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: `${COLORS.navy}0D` }}
                >
                  <Navigation size={20} style={{ color: COLORS.navy, opacity: 0.5 }} />
                </div>
                <p className="text-sm">No trips assigned</p>
              </div>
            )}

            <div className="space-y-2.5">
              {trips.map(trip => (
                <TripCard key={trip.id} trip={trip} selected={selectedTrip?.id === trip.id} onClick={() => { setSelectedTrip(trip); setStartError(null); }} />
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 p-4">
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 font-medium text-sm transition">
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white shadow-sm border-b border-slate-100 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold truncate" style={{ color: COLORS.navy }}>Driver Dashboard</h1>
            </div>
          </div>
          {selectedTrip && (
            <span
              className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full shrink-0"
              style={{ backgroundColor: `${COLORS.teal}14`, color: COLORS.teal }}
            >
              Trip #{selectedTrip.id}
            </span>
          )}
        </div>

        {startError && (
          <div className="px-4 sm:px-6 py-2.5 bg-red-50 border-b border-red-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-red-700">
              <AlertCircle size={14} className="flex-shrink-0" />
              {startError}
            </div>
            <button onClick={() => setStartError(null)} className="text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <MapView trip={selectedTrip} onStartTrip={handleStartTrip} starting={starting} onSimulateComplete={syncTripUpdate} />
        </div>
      </div>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-slate-900/40 lg:hidden z-30" />
      )}
    </div>
  );
};

export default DriverDashboard;