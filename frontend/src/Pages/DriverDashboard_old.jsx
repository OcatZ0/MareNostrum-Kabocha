import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Truck, Clock, LogOut, Menu, X, AlertCircle } from 'lucide-react';
import { getTrips } from '../api/tripsApi';
import { COLORS, STATUS_STYLES } from '../Componnent/dashboard/dashboardTheme';

const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || 'MASUKKAN_API_KEY_TOMTOM';

/* ── Styles ──────────────────────────────────────────────────── */
const ANIM = `
  @keyframes fade-in { from{opacity:0} to{opacity:1} }
  @keyframes slide-in-left { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
  @keyframes slide-in-right { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
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

/* ── Trip Card ───────────────────────────────────────────────– */
const TripCard = ({ trip, selected, onClick }) => {
  const s = statusStyle(trip.status);
  const from = trip.origin?.name ?? 'Origin';
  const to = trip.destination?.name ?? 'Destination';

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
        {trip.truck?.license_plate && (
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

/* ── TomTom Map Component ────────────────────────────────────– */
const MapView = ({ trip }) => {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [mapError, setMapError] = useState(null);

  // Load TomTom SDK
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js';
    script.async = true;
    script.onload = () => {
      console.log('TomTom SDK loaded');
    };
    document.body.appendChild(script);

    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    if (typeof window.tt === 'undefined') return;

    try {
      mapRef.current = window.tt.map({
        key: TOMTOM_API_KEY,
        container: mapElRef.current,
        center: [104.0305, 1.1301], // Batam default
        zoom: 12,
      });

      mapRef.current.addControl(new window.tt.NavigationControl());
    } catch (err) {
      console.error('Map init error:', err);
      setMapError('Failed to initialize map');
    }
  }, []);

  // Calculate route when trip changes
  useEffect(() => {
    if (!trip || !mapRef.current || !window.tt) return;

    // Get coordinates from trip.origin and trip.destination (as returned by backend TripResource)
    const originLat = trip.origin?.latitude;
    const originLng = trip.origin?.longitude;
    const destLat = trip.destination?.latitude;
    const destLng = trip.destination?.longitude;

    if (!originLat || !originLng || !destLat || !destLng) {
      console.warn('Missing coordinates:', { originLat, originLng, destLat, destLng });
      setMapError('Origin or destination coordinates missing');
      return;
    }

    const from = trip.origin?.name ?? 'Origin';
    const to = trip.destination?.name ?? 'Destination';

    // Clear previous markers and route
    const map = mapRef.current;
    
    // Remove previous markers
    document.querySelectorAll('.tt-marker').forEach(m => {
      if (m._marker) m._marker.remove();
    });

    // Remove previous route layer
    if (map.getLayer('route')) map.removeLayer('route');
    if (map.getSource('route')) map.removeSource('route');

    // Add new markers
    new window.tt.Marker({ color: 'green' })
      .setLngLat([originLng, originLat])
      .setPopup(new window.tt.Popup().setHTML(`<strong>${from}</strong><br/>Origin`))
      .addTo(map);

    new window.tt.Marker({ color: 'red' })
      .setLngLat([destLng, destLat])
      .setPopup(new window.tt.Popup().setHTML(`<strong>${to}</strong><br/>Destination`))
      .addTo(map);

    // Calculate route using TomTom API
    // TomTom expects: lat,lng:lat,lng format
    const origin = `${originLat},${originLng}`;
    const destination = `${destLat},${destLng}`;
    const url =
      `https://api.tomtom.com/routing/1/calculateRoute/` +
      `${origin}:${destination}/json` +
      `?traffic=true&routeType=fastest&travelMode=car&sectionType=traffic` +
      `&key=${TOMTOM_API_KEY}`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('TomTom Route Response:', data);
        
        if (!data.routes || data.routes.length === 0) {
          throw new Error('No routes found');
        }

        const route = data.routes[0];
        const distance = (route.summary.lengthInMeters / 1000).toFixed(2);
        const timeMinutes = Math.ceil(route.summary.travelTimeInSeconds / 60);

        setRouteInfo({
          distance,
          time: timeMinutes,
          from,
          to,
        });

        // Draw route
        const points = route.legs[0].points;
        const coordinates = points.map(p => [p.longitude, p.latitude]);

        // Add route to map
        if (!map.getSource('route')) {
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates,
              },
            },
          });

          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
            },
            paint: {
              'line-color': COLORS.teal,
              'line-width': 6,
            },
          });
        }

        // Fit bounds
        const bounds = new window.tt.LngLatBounds();
        coordinates.forEach(coord => bounds.extend(coord));
        
        // Wait for map to load before fitting bounds
        if (map.loaded()) {
          map.fitBounds(bounds, { padding: 80, maxZoom: 14 });
        } else {
          map.on('load', () => {
            map.fitBounds(bounds, { padding: 80, maxZoom: 14 });
          });
        }
      })
      .catch(err => {
        console.error('Route calculation error:', err);
        setMapError(`Failed to calculate route: ${err.message}`);
      });
  }, [trip]);

  if (!trip) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <MapPin size={48} className="mx-auto mb-3 opacity-30" style={{ color: COLORS.teal }} />
          <p className="text-slate-500 text-sm">Select a trip to view route</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {mapError && (
        <div className="absolute top-4 left-4 z-50 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3 max-w-xs">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{mapError}</p>
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
      console.log('Fetched trips from backend:', driverTrips);
      if (driverTrips.length > 0) {
        console.log('Sample trip structure:', driverTrips[0]);
      }
      setTrips(driverTrips);
      if (driverTrips.length > 0) {
        setSelectedTrip(driverTrips[0]);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load trips');
      console.error('Error fetching trips:', err);
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
                  onClick={() => setSelectedTrip(trip)}
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
          <MapView trip={selectedTrip} />
        </div>

        {selectedTrip && (
          <div
            className="bg-white border-t border-slate-200 p-6 grid grid-cols-1 md:grid-cols-4 gap-6"
            style={{ animation: 'slide-in-right 0.3s ease-out' }}>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Status</p>
              <p className="text-sm font-semibold text-slate-900 capitalize">
                {selectedTrip.status?.replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Departure</p>
              <p className="text-sm font-semibold text-slate-900">
                {fmt(selectedTrip.chosen_departure_at || selectedTrip.created_at)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Estimated Duration</p>
              <p className="text-sm font-semibold text-slate-900">
                {fmtDur(selectedTrip.estimated_duration_min)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Distance</p>
              <p className="text-sm font-semibold text-slate-900">
                {selectedTrip.distance_km ? `${selectedTrip.distance_km} km` : '—'}
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