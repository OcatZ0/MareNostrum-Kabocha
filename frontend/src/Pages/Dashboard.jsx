import React, { useState, useEffect, useCallback } from 'react';
import { Route, Truck, Leaf, Navigation, RefreshCw, Calendar, CheckCircle2 } from 'lucide-react';
import DashboardSidebar from '../Componnent/dashboard/DashboardSidebar';
import DashboardTopbar from '../Componnent/dashboard/DashboardTopbar';
import StatCard from '../Componnent/dashboard/StatCard';
import TripVolumeChart from '../Componnent/dashboard/TripVolumeChart';
import LiveTrackingPanel from '../Componnent/dashboard/LiveTrackingPanel';
import EmissionOverview from '../Componnent/dashboard/EmissionOverview';
import FleetStatus from '../Componnent/dashboard/FleetStatus';
import { COLORS } from '../Componnent/dashboard/dashboardTheme';
import { getAnalyticsDashboard } from '../api/analyticsApi';
import { getTrucks } from '../api/trucksApi';
import { getTrips, getCheckpoints } from '../api/tripsApi';

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_week', label: 'This Week' },
  { value: 'today', label: 'Today' },
];

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Backend state
  const [analytics, setAnalytics] = useState(null);
  const [trucks, setTrucks] = useState([]);
  const [trips, setTrips] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // 1. Fetch analytics, trucks, and trips concurrently
      const [analyticsRes, trucksRes, tripsRes] = await Promise.allSettled([
        getAnalyticsDashboard({ period }),
        getTrucks({ per_page: 50 }),
        getTrips({ per_page: 100 }),
      ]);

      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value.data?.data || null);
      }

      if (trucksRes.status === 'fulfilled') {
        setTrucks(trucksRes.value.data?.data || []);
      }

      let loadedTrips = [];
      if (tripsRes.status === 'fulfilled') {
        loadedTrips = tripsRes.value.data?.data || [];
        setTrips(loadedTrips);
      }

      // 2. Determine active / most relevant trip for live tracking
      const live = loadedTrips.find((t) =>
        ['in_transit_origin', 'in_transit_destination', 'on_ship', 'at_origin_port', 'assigned'].includes(t.status)
      ) || loadedTrips[0] || null;

      setActiveTrip(live);

      // 3. If there is a live trip, fetch checkpoints
      if (live?.id) {
        try {
          const cpRes = await getCheckpoints(live.id);
          setCheckpoints(cpRes.data?.data || []);
        } catch {
          setCheckpoints([]);
        }
      } else {
        setCheckpoints([]);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Derived metrics with fallback
  const summary = analytics?.summary || {};
  const totalTrips = summary.total_trips ?? trips.length;
  const inTransitTrips = summary.in_transit_trips ?? trips.filter((t) =>
    ['in_transit_origin', 'in_transit_destination', 'on_ship'].includes(t.status)
  ).length;
  const totalCo2 = summary.total_co2_kg !== undefined
    ? Number(summary.total_co2_kg).toFixed(1)
    : trips.reduce((sum, t) => sum + (Number(t.estimated_co2_kg) || 0), 0).toFixed(1);
  const totalDistance = summary.total_distance_km !== undefined
    ? `${Number(summary.total_distance_km).toFixed(1)} km`
    : `${trips.reduce((sum, t) => sum + (Number(t.distance_km) || 0), 0).toFixed(1)} km`;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: COLORS.bg }}>
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col lg:pl-64">
        <DashboardTopbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 px-4 sm:px-6 py-6 space-y-6">
          {/* Header row with Period selector & Refresh */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Operational Overview</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time multi-modal logistics & carbon intelligence
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white border-2 border-slate-200 rounded-lg p-0.5 shadow-sm text-xs">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPeriod(opt.value)}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      period === opt.value
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing}
                title="Refresh dashboard data"
                className="p-2 rounded-lg bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin text-teal-600' : ''} />
              </button>
            </div>
          </div>

          {/* Top metrics (4 cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              icon={Route}
              value={String(totalTrips)}
              label="Total Trips"
              delta={summary.total_trips ? `${summary.completed_trips || 0} completed` : null}
            />
            <StatCard
              icon={Truck}
              value={String(inTransitTrips)}
              label="In Transit"
              delta={inTransitTrips > 0 ? 'Active on route' : 'No active trips'}
              deltaGood={inTransitTrips > 0}
            />
            <StatCard
              icon={Leaf}
              value={`${totalCo2} kg`}
              label="Total Est. CO₂"
              delta="-5% eco score"
              deltaGood
            />
            <StatCard
              icon={Navigation}
              value={totalDistance}
              label="Total Distance"
              delta={summary.recommendation_accuracy_percentage ? `${summary.recommendation_accuracy_percentage}% accuracy` : null}
            />
          </div>

          {/* Chart + Live tracking */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <TripVolumeChart trips={trips} />
            </div>
            <div className="xl:col-span-1">
              <LiveTrackingPanel
                trip={activeTrip}
                checkpoints={checkpoints}
              />
            </div>
          </div>

          {/* Bottom row: Emissions & Fleet status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EmissionOverview
              totalLabel={`${totalCo2} kg CO₂`}
              subLabel={`Emitted across ${period.replace(/_/g, ' ')} trips`}
              categoryEmissions={analytics?.emissions_by_truck_category}
            />
            <FleetStatus
              trucks={trucks}
              loading={loading}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
