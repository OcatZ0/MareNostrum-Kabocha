import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Truck, Clock, LogOut, Menu, X, AlertCircle, Loader2 } from 'lucide-react';
import { getTrips } from '../api/tripsApi';
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

/* ── Trip Card Component ─────────────────────────────────────── */
const TripCard = ({ trip, selected, onClick }) => {
  const s = statusStyle(trip.status);
  const from = trip.origin?.name ?? 'Origin';
  const to = trip.destination?.name ?? 'Destination';

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg cursor-pointer transition-all border-2`}
      style={{
        backgroundColor: selected ? `${COLORS.teal}10` : '#f8f9fa',
        borderColor: selected ? COLORS.teal : 'transparent',
        animation: 'slide-in-left 0.3s ease-out',
      }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 text-sm">Trip #{trip.id}</h3>
          <p className="text-xs text-slate-500">{s.label}</p>
        </div>
        <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>
          {s.label}
        </span>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <MapPin size={14} style={{ color: COLORS.teal }} />
          <span className="text-slate-600"><strong>From:</strong> {from}</span>
        </div>
        <div className="flex items-center gap-2">
          <Navigation size={14} style={{ color: COLORS.teal }} />
          <span className="text-slate-600"><strong>To:</strong> {to}</span>
        </div>
      </div>
    </div>
  );
};

/* ── Map Component ───────────────────────────────────────────── */
const MapView = ({ trip }) => {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const sdkLoadingRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);

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

    const from = trip.origin?.name || 'Origin';
    const to = trip.destination?.name || 'Destination';

    // Add markers
    const markerA = document.createElement('div');
    markerA.style.cssText = `width:30px; height:30px; background:#10b981; border:3px solid white; border-radius:50%; box-shadow:0 2px 8px rgba(0,0,0,0.3);`;
    new window.tt.Marker({ element: markerA })
      .setLngLat([originLng, originLat])
      .setPopup(new window.tt.Popup().setHTML(`<strong>${from}</strong>`))
      .addTo(map);

    const markerB = document.createElement('div');
    markerB.style.cssText = `width:30px; height:30px; background:#1e40af; border:3px solid white; border-radius:50%; box-shadow:0 2px 8px rgba(0,0,0,0.3);`;
    new window.tt.Marker({ element: markerB })
      .setLngLat([destLng, destLat])
      .setPopup(new window.tt.Popup().setHTML(`<strong>${to}</strong>`))
      .addTo(map);

    // Calculate route
    const originStr = `${originLat},${originLng}`;
    const destStr = `${destLat},${destLng}`;
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${originStr}:${destStr}/json?traffic=true&routeType=fastest&travelMode=car&key=${TOMTOM_API_KEY}`;

    console.log('Fetching route...');

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!data.routes?.[0]) throw new Error('No route found');

        const route = data.routes[0];
        const coords = route.legs[0].points.map(p => [p.longitude, p.latitude]);

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

        console.log('✓ Route drawn');
        setMapError(null);
      })
      .catch(err => {
        console.error('Route error:', err);
        setMapError(err.message);
      });
  }, [trip, mapReady]);

  if (!trip) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <MapPin size={48} className="mx-auto mb-3 opacity-30" style={{ color: COLORS.teal }} />
          <p className="text-slate-500">Select a trip to view map</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-50">
          <Loader2 className="animate-spin" size={32} style={{ color: COLORS.teal }} />
        </div>
      )}
      {mapError && (
        <div className="absolute top-4 left-4 z-50 bg-red-50 border border-red-300 rounded-lg p-4 max-w-xs flex gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Map Error</p>
            <p className="text-sm text-red-700">{mapError}</p>
          </div>
        </div>
      )}
      <div ref={mapElRef} className="w-full h-full" />
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

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <style>{ANIM}</style>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-80 bg-white shadow-lg transform transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="px-6 py-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold" style={{ color: COLORS.navy }}>⚓ MareNostrum</h1>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: COLORS.teal }}>
                {driverName[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{driverName}</p>
                <p className="text-xs text-slate-500">Driver</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">My Trips ({trips.length})</h2>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: `${COLORS.teal}40`, borderTopColor: COLORS.teal }}></div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
            )}

            {!loading && trips.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Navigation size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No trips assigned</p>
              </div>
            )}

            <div className="space-y-3">
              {trips.map(trip => (
                <TripCard key={trip.id} trip={trip} selected={selectedTrip?.id === trip.id} onClick={() => setSelectedTrip(trip)} />
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 p-4">
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium text-sm">
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white shadow-sm border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
            <Menu size={24} />
          </button>
          <h1 className="text-2xl font-bold" style={{ color: COLORS.navy }}>Driver Dashboard</h1>
          <div className="text-sm text-slate-600">{selectedTrip && `Trip #${selectedTrip.id}`}</div>
        </div>

        <div className="flex-1 overflow-hidden">
          <MapView trip={selectedTrip} />
        </div>

        {selectedTrip && (
          <div className="bg-white border-t border-slate-200 p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Status</p>
              <p className="text-sm font-semibold text-slate-900 capitalize">{selectedTrip.status?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Departure</p>
              <p className="text-sm font-semibold text-slate-900">{fmt(selectedTrip.chosen_departure_at || selectedTrip.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Estimated Duration</p>
              <p className="text-sm font-semibold text-slate-900">{fmtDur(selectedTrip.estimated_duration_min)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Distance</p>
              <p className="text-sm font-semibold text-slate-900">{selectedTrip.distance_km ? `${selectedTrip.distance_km} km` : '—'}</p>
            </div>
          </div>
        )}
      </div>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/50 lg:hidden z-30" />
      )}
    </div>
  );
};

export default DriverDashboard;
