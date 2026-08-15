import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Truck, Clock, LogOut, Menu, X } from 'lucide-react';
import { getTrips } from '../api/tripsApi';
import { COLORS, STATUS_STYLES } from '../Componnent/dashboard/dashboardTheme';

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

/* ── Simple SVG Map Component ────────────────────────────────– */
const MapView = ({ trip }) => {
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

  const from = trip.origin?.name ?? trip.origin_company?.name ?? 'Origin';
  const to = trip.destination?.name ?? trip.destination_company?.name ?? 'Destination';

  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col items-center justify-center p-6">
      <style>{`
        @keyframes pulse-dot { 
          0%, 100% { r: 6; } 
          50% { r: 8; } 
        }
        .pulse-marker { animation: pulse-dot 2s infinite; }
      `}</style>

      <svg viewBox="0 0 500 500" className="w-full h-full max-w-lg max-h-lg mb-8">
        {/* Grid background */}
        <defs>
          <pattern id="grid-map" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#d1d5db" strokeWidth="0.5" />
          </pattern>
          <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: COLORS.teal, stopOpacity: 0.4 }} />
            <stop offset="100%" style={{ stopColor: COLORS.navy, stopOpacity: 0.4 }} />
          </linearGradient>
        </defs>

        {/* Background grid */}
        <rect width="500" height="500" fill="url(#grid-map)" />

        {/* Route line with animation */}
        <line 
          x1="100" y1="100" x2="400" y2="400" 
          stroke={COLORS.teal} 
          strokeWidth="4" 
          opacity="0.6"
          strokeDasharray="500"
          style={{
            animation: 'dash 2s linear infinite',
          }}
        />
        
        {/* Animated dashes */}
        <style>{`
          @keyframes dash {
            to { stroke-dashoffset: 500; }
          }
        `}</style>

        {/* Origin marker (pulsing) */}
        <g>
          <circle cx="100" cy="100" r="12" fill={COLORS.teal} opacity="0.2" />
          <circle cx="100" cy="100" r="8" fill={COLORS.teal} />
          <circle cx="100" cy="100" r="6" fill="white" strokeWidth="2" stroke={COLORS.teal} />
          <circle className="pulse-marker" cx="100" cy="100" fill="none" strokeWidth="2" stroke={COLORS.teal} opacity="0.6" />
        </g>

        {/* Destination marker (pulsing) */}
        <g>
          <circle cx="400" cy="400" r="12" fill={COLORS.navy} opacity="0.2" />
          <circle cx="400" cy="400" r="8" fill={COLORS.navy} />
          <circle cx="400" cy="400" r="6" fill="white" strokeWidth="2" stroke={COLORS.navy} />
          <circle className="pulse-marker" cx="400" cy="400" fill="none" strokeWidth="2" stroke={COLORS.navy} opacity="0.6" />
        </g>

        {/* Distance indicator */}
        <text x="250" y="245" textAnchor="middle" fontSize="16" fontWeight="bold" fill={COLORS.teal} opacity="0.5">
          {trip.distance_km ? `${trip.distance_km} km` : '~424 km'}
        </text>
      </svg>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-8 text-sm bg-white/60 backdrop-blur rounded-lg p-6 max-w-md">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full" style={{ backgroundColor: COLORS.teal }}></div>
          <div>
            <p className="font-semibold text-slate-900">{from}</p>
            <p className="text-xs text-slate-500">Origin</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full" style={{ backgroundColor: COLORS.navy }}></div>
          <div>
            <p className="font-semibold text-slate-900">{to}</p>
            <p className="text-xs text-slate-500">Destination</p>
          </div>
        </div>
      </div>
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
            className="bg-white border-t border-slate-200 p-6 grid grid-cols-1 md:grid-cols-3 gap-6"
            style={{ animation: 'slide-in-right 0.3s ease-out' }}>
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