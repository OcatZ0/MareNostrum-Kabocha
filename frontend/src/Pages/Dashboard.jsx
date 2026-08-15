import React, { useState, useEffect, useCallback } from 'react';
import {
  Route,
  Truck,
  Leaf,
  Navigation,
  RefreshCw,
  Plus,
  Eye,
  ArrowRight,
  TrendingUp,
  Clock,
  MapPin,
  Ship,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardSidebar from '../Componnent/dashboard/DashboardSidebar';
import DashboardTopbar from '../Componnent/dashboard/DashboardTopbar';
import StatCard from '../Componnent/dashboard/StatCard';
import TripVolumeChart from '../Componnent/dashboard/TripVolumeChart';
import LiveTrackingPanel from '../Componnent/dashboard/LiveTrackingPanel';
import EmissionOverview from '../Componnent/dashboard/EmissionOverview';
import FleetStatus from '../Componnent/dashboard/FleetStatus';
import { COLORS, STATUS_STYLES } from '../Componnent/dashboard/dashboardTheme';
import { getDashboardData } from '../api/dashboardApi';
import { getCheckpoints } from '../api/tripsApi';
import TripDetailModal from '../Componnent/trips/TripDetailModal';
import CreateTripModal from '../Componnent/trips/CreateTripModal';

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_week', label: 'This Week' },
  { value: 'today', label: 'Today' },
];

const formatDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Consolidated Backend State
  const [dashboardData, setDashboardData] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);

  // Modals state
  const [selectedTripModal, setSelectedTripModal] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  /* ============================================================
     FETCH UNIFIED DASHBOARD DATA
  ============================================================ */
  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // 1 single lightning-fast request for the entire dashboard
      const res = await getDashboardData({ period });
      const data = res.data?.data || null;

      if (data) {
        setDashboardData(data);

        // Set primary active trip for live tracking
        const liveOps = data.live_operations || {};
        const primary = liveOps.primary_trip || (liveOps.active_trips && liveOps.active_trips[0]) || (data.recent_trips && data.recent_trips[0]) || null;
        
        setActiveTrip((prev) => {
          if (prev && liveOps.active_trips?.some((t) => t.id === prev.id)) {
            return liveOps.active_trips.find((t) => t.id === prev.id);
          }
          return primary;
        });

        if (liveOps.checkpoints && liveOps.checkpoints.length > 0) {
          setCheckpoints(liveOps.checkpoints);
        } else if (primary?.id) {
          try {
            const cpRes = await getCheckpoints(primary.id);
            setCheckpoints(cpRes.data?.data || []);
          } catch {
            setCheckpoints([]);
          }
        } else {
          setCheckpoints([]);
        }
      }
    } catch (err) {
      console.error('Failed to load unified dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  /* ============================================================
     FETCH CHECKPOINTS FOR SPECIFIC TRIP
  ============================================================ */
  const handleSelectActiveTrip = async (trip) => {
    setActiveTrip(trip);
    if (!trip?.id) {
      setCheckpoints([]);
      return;
    }
    try {
      const res = await getCheckpoints(trip.id);
      setCheckpoints(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load checkpoints:', err);
      setCheckpoints([]);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-polling every 30 seconds for live updates if autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboardData]);

  // Derived metrics from backend response
  const summary = dashboardData?.summary || {};
  const totalTrips = summary.total_trips ?? 0;
  const inTransitTrips = summary.in_transit_trips ?? 0;
  const completedTrips = summary.completed_trips ?? 0;
  const assignedTrips = summary.assigned_trips ?? 0;

  const totalCo2 = Number(summary.total_co2_kg ?? 0).toFixed(1);
  const totalDistance = `${Number(summary.total_distance_km ?? 0).toFixed(1)} km`;
  const accuracyPct = `${summary.recommendation_accuracy_percentage ?? 95}%`;

  // Pre-aggregated sections from unified backend response
  const monthlyVolume = dashboardData?.monthly_volume || null;
  const liveOps = dashboardData?.live_operations || {};
  const activeInTransitList = liveOps.active_trips || [];
  const emissions = dashboardData?.emissions || {};
  const fleet = dashboardData?.fleet || {};
  const recentOperations = dashboardData?.recent_trips || [];

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: COLORS.bg }}>
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        unreadCountProp={dashboardData?.unread_notifications || 0}
      />

      <div className="flex-1 min-w-0 flex flex-col lg:pl-64">
        <DashboardTopbar
          onMenuClick={() => setSidebarOpen(true)}
          unreadCountProp={dashboardData?.unread_notifications || 0}
        />

        <main className="flex-1 px-4 sm:px-6 py-6 space-y-6 max-w-7xl w-full mx-auto">
          {/* Header Row: Title, Quick Actions & Period Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                  Logistics & Operations
                </h1>
                {inTransitTrips > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {inTransitTrips} Live
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Real-time multi-modal logistics, vessel integration & carbon intelligence
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Period Selector Tabs */}
              <div className="flex items-center bg-white border-2 border-slate-200 rounded-lg p-0.5 shadow-2xs text-xs">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPeriod(opt.value)}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      period === opt.value
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing}
                title="Refresh dashboard data from backend"
                className="p-2 rounded-lg bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 shadow-2xs"
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin text-teal-600' : ''} />
              </button>

              {/* Create Trip Action */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white shadow-xs transition hover:opacity-95"
                style={{ backgroundColor: COLORS.navy }}
              >
                <Plus size={15} />
                New Trip
              </button>
            </div>
          </div>

          {/* Top Operational Metrics (4 Stat Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              icon={Route}
              value={String(totalTrips)}
              label="Total Dispatches"
              delta={`${completedTrips} completed · ${assignedTrips} queued`}
              deltaGood={completedTrips > 0}
            />
            <StatCard
              icon={Truck}
              value={String(inTransitTrips)}
              label="Active In Transit"
              delta={inTransitTrips > 0 ? `${inTransitTrips} active on route` : 'No active dispatches'}
              deltaGood={inTransitTrips > 0}
            />
            <StatCard
              icon={Leaf}
              value={`${totalCo2} kg`}
              label="Est. Fleet Carbon"
              delta="-5.2% eco score"
              deltaGood
            />
            <StatCard
              icon={Navigation}
              value={totalDistance}
              label="Total Distance"
              delta={`${accuracyPct} AI slot accuracy`}
              deltaGood
            />
          </div>

          {/* Middle Row: Trip Volume Chart & Live Operations Panel */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <TripVolumeChart data={monthlyVolume} />
            </div>
            <div className="xl:col-span-1">
              <LiveTrackingPanel
                trip={activeTrip}
                activeTrips={activeInTransitList}
                checkpoints={checkpoints}
                onSelectTrip={handleSelectActiveTrip}
                onViewDetails={(t) => setSelectedTripModal(t)}
                onRefresh={() => fetchDashboardData(true)}
                refreshing={refreshing}
              />
            </div>
          </div>

          {/* Bottom Row 1: Emissions Overview & Fleet Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EmissionOverview
              totalLabel={`${totalCo2} kg CO₂`}
              subLabel={`Emissions across ${period.replace(/_/g, ' ')} operational dispatches`}
              trend={emissions.monthly_trend}
              categoryEmissions={emissions.category_breakdown}
              topTrucks={emissions.top_emitting_trucks || []}
            />
            <FleetStatus
              trucks={fleet.trucks || []}
              loading={loading}
            />
          </div>

          {/* Bottom Row 2: Recent Operations / Trips Table */}
          <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b-2 border-slate-100">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${COLORS.aqua}14` }}
                >
                  <Route size={16} color={COLORS.teal} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Recent Dispatches & Movements</h3>
                  <p className="text-xs text-slate-400">Latest activity logged across cross-border & domestic routes</p>
                </div>
              </div>

              <button
                onClick={() => navigate('/app/trips')}
                className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-800 transition"
              >
                View All Trips
                <ArrowRight size={13} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 sm:px-6">Trip ID</th>
                    <th className="py-3 px-4">Route</th>
                    <th className="py-3 px-4">Vehicle & Driver</th>
                    <th className="py-3 px-4">Departure / Status</th>
                    <th className="py-3 px-4">CO₂ & Distance</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOperations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No trips found for this time period.
                      </td>
                    </tr>
                  ) : (
                    recentOperations.map((t) => {
                      const originName = t.origin?.name || t.originCompany?.name || t.originPort?.name || 'Origin';
                      const destName = t.destination?.name || t.destinationCompany?.name || t.destinationPort?.name || 'Destination';
                      const isCrossBorder = Boolean(
                        t.ship_ref_id ||
                        t.origin_port_id ||
                        t.destination_port_id ||
                        t.destination?.type === 'port' ||
                        t.origin?.type === 'port'
                      );
                      const statusStyle = STATUS_STYLES[t.status] || {
                        label: t.status?.replace(/_/g, ' ') || 'draft',
                        bg: '#F1F5F9',
                        color: '#64748B',
                      };
                      const truckPlate = t.truck?.plate_number || t.truck?.plate || (t.truck_id ? `Truck #${t.truck_id}` : 'Unassigned');
                      const driverName = t.driver?.name || t.driver?.username || (t.driver_id ? `Driver #${t.driver_id}` : 'Unassigned');

                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-slate-50/60 transition group cursor-pointer"
                          onClick={() => setSelectedTripModal(t)}
                        >
                          <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-slate-800">
                            #{t.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-medium text-slate-700">
                              <span className="truncate max-w-[130px]">{originName}</span>
                              <span className="text-slate-400 font-normal">→</span>
                              <span className="truncate max-w-[130px]">{destName}</span>
                              {isCrossBorder && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 shrink-0">
                                  <Ship size={9} />
                                  Sea
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-slate-800">{truckPlate}</p>
                            <p className="text-[11px] text-slate-400">{driverName}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full capitalize mb-0.5"
                              style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                            >
                              {statusStyle.label}
                            </span>
                            <p className="text-[10px] text-slate-400">
                              {formatDateTime(t.chosen_departure_at || t.actual_departure_at || t.created_at)}
                            </p>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-slate-800">
                              {t.estimated_co2_kg ? `${Number(t.estimated_co2_kg).toFixed(1)} kg` : '—'}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {t.distance_km ? `${Number(t.distance_km).toFixed(1)} km` : '—'}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTripModal(t);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium transition text-xs"
                            >
                              <Eye size={12} />
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Modals for Trip Details & New Trip */}
      {selectedTripModal && (
        <TripDetailModal
          trip={selectedTripModal}
          onClose={() => setSelectedTripModal(null)}
          onRefresh={() => {
            fetchDashboardData(true);
            setSelectedTripModal(null);
          }}
          onTripUpdated={(updated) => {
            setSelectedTripModal(updated);
            fetchDashboardData(true);
          }}
        />
      )}

      {showCreateModal && (
        <CreateTripModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchDashboardData(true);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
