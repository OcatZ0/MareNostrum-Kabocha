import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { MapPin, Navigation, Truck, Calendar, Anchor, Clock, LogOut, Menu, X } from 'lucide-react';
import { getTrips } from '../api/tripsApi';
import { COLORS, STATUS_STYLES } from '../Componnent/dashboard/dashboardTheme';

/* ── Config ──────────────────────────────────────────────────── */
const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || '';
const TOMTOM_BASE = 'https://api.tomtom.com';
// Runtime log to help diagnose 401 / missing-key issues
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.info('Runtime TomTom API key:', import.meta.env.VITE_TOMTOM_API_KEY);
}

/* ── Styles ──────────────────────────────────────────────────── */
const ANIM = `
  @keyframes fade-in { from{opacity:0} to{opacity:1} }
  @keyframes slide-in-left { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
  @keyframes slide-in-right { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

/* ── Helpers ─────────────────────────────────────────────────── */
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

const fmtDurSec = (sec) => (sec || sec === 0 ? fmtDur(Math.round(sec / 60)) : '—');
const fmtKm = (meters) => (meters || meters === 0 ? `${(meters / 1000).toFixed(1)} km` : '—');

/* ── Web Mercator projection helpers ────────────────────────────
   TomTom's Static Image API uses EPSG:3857 (Web Mercator), same as
   the projection below, so pixel positions line up with the image. */
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

function buildBBox(points, containerW, containerH) {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLon = Math.min(...lons);
  let maxLon = Math.max(...lons);

  // Padding so markers aren't glued to the edge; floor to avoid a
  // zero-size bbox when origin and destination are identical.
  const latPad = Math.max((maxLat - minLat) * 0.25, 0.03);
  const lonPad = Math.max((maxLon - minLon) * 0.25, 0.03);
  minLat -= latPad; maxLat += latPad;
  minLon -= lonPad; maxLon += lonPad;

  // Expand the shorter axis so the bbox aspect ratio matches the
  // container — otherwise the requested image would be stretched.
  const containerAspect = containerW / containerH;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  const currentAspect = lonSpan / latSpan;
  const midLat = (minLat + maxLat) / 2;
  const midLon = (minLon + maxLon) / 2;

  if (currentAspect < containerAspect) {
    const newLonSpan = latSpan * containerAspect;
    minLon = midLon - newLonSpan / 2;
    maxLon = midLon + newLonSpan / 2;
  } else {
    const newLatSpan = lonSpan / containerAspect;
    minLat = midLat - newLatSpan / 2;
    maxLat = midLat + newLatSpan / 2;
  }

  return { minLon, minLat, maxLon, maxLat };
}

function project(lat, lon, bbox, containerW, containerH) {
  const xFrac = (lon - bbox.minLon) / (bbox.maxLon - bbox.minLon);
  const yFrac =
    (mercY(bbox.maxLat) - mercY(lat)) / (mercY(bbox.maxLat) - mercY(bbox.minLat));
  return { x: xFrac * containerW, y: yFrac * containerH };
}

/* ── Trip Card ───────────────────────────────────────────────– */
const TripCard = ({ trip, selected, onClick }) => {
  const s = statusStyle(trip.status);
  const from = trip.origin?.name ?? trip.origin_company?.name ?? '—';
  const to = trip.destination?.name ?? trip.destination_company?.name ?? '—';

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg cursor-pointer transition-all border-2 ${
        selected ? 'border-opacity-100' : 'border-opacity-0'
      }`}
      style={{
        backgroundColor: selected ? `${COLORS.teal}10` : '#f8f9fa',
        borderColor: selected ? COLORS.teal : 'transparent',
        animation: 'slide-in-left 0.3s ease-out',
      }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 text-sm">Trip #{trip.id}</h3>
          <p className="text-xs text-slate-500">Status: {s.label}</p>
        </div>
        <span
          className="text-xs font-bold px-2 py-1 rounded-full"
          style={{ backgroundColor: s.bg, color: s.color }}>
          {s.label}
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <MapPin size={14} style={{ color: COLORS.teal }} />
          <span className="text-slate-600">
            <strong>From:</strong> {from}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Navigation size={14} style={{ color: COLORS.teal }} />
          <span className="text-slate-600">
            <strong>To:</strong> {to}
          </span>
        </div>
        {trip.truck && (
          <div className="flex items-center gap-2">
            <Truck size={14} style={{ color: COLORS.teal }} />
            <span className="text-slate-600">
              <strong>Truck:</strong> {trip.truck.license_plate}
            </span>
          </div>
        )}
        {trip.estimated_duration_min && (
          <div className="flex items-center gap-2">
            <Clock size={14} style={{ color: COLORS.teal }} />
            <span className="text-slate-600">
              <strong>Duration:</strong> {fmtDur(trip.estimated_duration_min)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Map View (REST-only: Static Image API + Routing API) ─────── */
const MapView = ({ trip, onRouteInfo }) => {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [imgUrl, setImgUrl] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [routePoints, setRoutePoints] = useState([]); // [{lat, lon}, ...]
  const [bbox, setBbox] = useState(null);
  const [markers, setMarkers] = useState(null); // {origin:{lat,lon,name}, dest:{...}}
  const [mapError, setMapError] = useState(null);

  // Track container size responsively
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setSize({ w: Math.round(width), h: Math.round(height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const loadMap = useCallback(async () => {
    if (!TOMTOM_API_KEY) {
      setMapError('TomTom API key is missing. Set VITE_TOMTOM_API_KEY in your .env file.');
      return;
    }
    if (!trip || size.w === 0 || size.h === 0) return;

    const originLat = trip.origin?.latitude;
    const originLng = trip.origin?.longitude;
    const destLat = trip.destination?.latitude;
    const destLng = trip.destination?.longitude;
    const from = trip.origin?.name ?? 'Origin';
    const to = trip.destination?.name ?? 'Destination';

    if (!originLat || !originLng || !destLat || !destLng) {
      setMapError('This trip is missing origin/destination coordinates.');
      setImgUrl(null);
      return;
    }

    setMapError(null);
    setImgLoaded(false);
    onRouteInfo?.(null);

    const box = buildBBox(
      [{ lat: originLat, lon: originLng }, { lat: destLat, lon: destLng }],
      size.w,
      size.h
    );
    setBbox(box);
    setMarkers({
      origin: { lat: originLat, lon: originLng, name: from },
      dest: { lat: destLat, lon: destLng, name: to },
    });

    // 1) Static base map image — pure REST call, no SDK
    const staticUrl =
      `${TOMTOM_BASE}/map/1/staticimage?key=${TOMTOM_API_KEY}` +
      `&layer=basic&style=main&format=png` +
      `&bbox=${box.minLon},${box.minLat},${box.maxLon},${box.maxLat}` +
      `&width=${Math.min(size.w, 8192)}&height=${Math.min(size.h, 8192)}`;
    setImgUrl(staticUrl);

    // 2) Real driving route — Routing API (POST)
    try {
      const res = await axios.post(
        `https://api.tomtom.com/maps/orbis/routing/routes/calculate?key=${TOMTOM_API_KEY}`,
        {
          routePlanningLocations: {
            origin: {
              type: 'Point',
              coordinates: [originLng, originLat],
            },
            destination: {
              type: 'Point',
              coordinates: [destLng, destLat],
            },
          },
          routeType: 'efficient',
          maxPathAlternativeRoutes: 1,
        }
      );

      const route = res.data?.routes?.[0];
      const points = route?.legs?.flatMap((leg) => leg.points) ?? [];
      setRoutePoints(points.map((p) => ({ lat: p.latitude, lon: p.longitude })));

      if (route?.summary) {
        onRouteInfo?.({
          distanceMeters: route.summary.lengthInMeters,
          durationSeconds: route.summary.travelTimeInSeconds,
          trafficDelaySeconds: route.summary.trafficDelayInSeconds ?? 0,
        });
      }
    } catch (err) {
      console.error('TomTom routing error:', err);
      setRoutePoints([]);
    }
  }, [trip, size.w, size.h, onRouteInfo]);

  useEffect(() => {
    loadMap();
  }, [loadMap]);

  if (mapError) {
    return (
      <div ref={containerRef} className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-slate-400">
        <div className="text-center px-6">
          <MapPin size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm text-red-500">{mapError}</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div ref={containerRef} className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <MapPin size={48} className="mx-auto mb-3 opacity-30" />
          <p>Select a trip to view route</p>
        </div>
      </div>
    );
  }

  const polylinePoints =
    bbox && size.w && size.h
      ? routePoints.map((p) => {
          const { x, y } = project(p.lat, p.lon, bbox, size.w, size.h);
          return `${x},${y}`;
        }).join(' ')
      : '';

  const originPx = markers && bbox ? project(markers.origin.lat, markers.origin.lon, bbox, size.w, size.h) : null;
  const destPx = markers && bbox ? project(markers.dest.lat, markers.dest.lon, bbox, size.w, size.h) : null;

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-100 overflow-hidden">
      {imgUrl && (
        <img
          src={imgUrl}
          width={size.w}
          height={size.h}
          alt="Route map"
          onLoad={() => setImgLoaded(true)}
          onError={() => setMapError('Failed to load the map image. Check the API key and network access.')}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
        />
      )}

      {!imgLoaded && (
        <div className="absolute inset-0 bg-slate-50 flex items-center justify-center">
          <div
            className="w-8 h-8 border-2 rounded-full"
            style={{ borderColor: `${COLORS.teal}30`, borderTopColor: COLORS.teal, animation: 'spin 0.8s linear infinite' }}
          />
        </div>
      )}

      {imgLoaded && size.w > 0 && size.h > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}>
          {polylinePoints && (
            <>
              <polyline points={polylinePoints} fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
              <polyline points={polylinePoints} fill="none" stroke={COLORS.teal} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
            </>
          )}
        </svg>
      )}

      {imgLoaded && originPx && (
        <div
          className="absolute"
          style={{ left: originPx.x, top: originPx.y, transform: 'translate(-50%, -50%)' }}
          title={markers.origin.name}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: COLORS.teal, border: '3px solid white', boxShadow: '0 0 4px rgba(0,0,0,.3)' }} />
        </div>
      )}
      {imgLoaded && destPx && (
        <div
          className="absolute"
          style={{ left: destPx.x, top: destPx.y, transform: 'translate(-50%, -50%)' }}
          title={markers.dest.name}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: COLORS.navy, border: '3px solid white', boxShadow: '0 0 4px rgba(0,0,0,.3)' }} />
        </div>
      )}
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
  const [routeInfo, setRouteInfo] = useState(null);
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

  const handleSelectTrip = (trip) => {
    setRouteInfo(null);
    setSelectedTrip(trip);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <style>{ANIM}</style>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-white shadow-lg transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="h-full flex flex-col">
          <div className="px-6 py-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold" style={{ color: COLORS.navy }}>
                ⚓ MareNostrum
              </h1>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: COLORS.teal }}>
                {driverName[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{driverName}</p>
                <p className="text-xs text-slate-500">Driver</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">
              My Trips ({trips.length})
            </h2>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <div
                  className="w-6 h-6 border-2 rounded-full animate-spin"
                  style={{ borderColor: `${COLORS.teal}40`, borderTopColor: COLORS.teal }}></div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {error}
              </div>
            )}

            {!loading && trips.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Navigation size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No trips assigned</p>
              </div>
            )}

            <div className="space-y-3">
              {trips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  selected={selectedTrip?.id === trip.id}
                  onClick={() => handleSelectTrip(trip)}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 p-4 space-y-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium text-sm transition-colors">
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white shadow-sm border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
            <Menu size={24} />
          </button>
          <div className="flex-1 flex items-center justify-center lg:justify-start">
            <h1 className="text-2xl font-bold" style={{ color: COLORS.navy }}>
              Driver Dashboard
            </h1>
          </div>
          <div className="text-sm text-slate-600">
            {selectedTrip && `Trip #${selectedTrip.id}`}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <MapView trip={selectedTrip} onRouteInfo={setRouteInfo} />
        </div>

        {selectedTrip && (
          <div
            className="bg-white border-t border-slate-200 p-6 grid grid-cols-1 md:grid-cols-4 gap-6"
            style={{ animation: 'slide-in-right 0.3s ease-out' }}>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Departure</p>
              <p className="text-sm font-semibold text-slate-900">
                {fmt(selectedTrip.chosen_departure_at || selectedTrip.created_at)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">
                Duration {routeInfo && <span className="normal-case font-normal text-teal-600">(live)</span>}
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {routeInfo ? fmtDurSec(routeInfo.durationSeconds) : fmtDur(selectedTrip.estimated_duration_min)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">
                Distance {routeInfo && <span className="normal-case font-normal text-teal-600">(live)</span>}
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {routeInfo ? fmtKm(routeInfo.distanceMeters) : (selectedTrip.distance_km ? `${selectedTrip.distance_km} km` : '—')}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Traffic Delay</p>
              <p className="text-sm font-semibold text-slate-900">
                {routeInfo ? (routeInfo.trafficDelaySeconds > 0 ? fmtDurSec(routeInfo.trafficDelaySeconds) : 'None') : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 lg:hidden z-30"
          style={{ animation: 'fade-in 0.2s ease-out' }}
        />
      )}
    </div>
  );
};

export default DriverDashboard;