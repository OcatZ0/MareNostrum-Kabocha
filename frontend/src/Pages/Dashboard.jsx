import React, { useState, useEffect } from 'react';
import { Route, Truck, Leaf } from 'lucide-react';
import DashboardSidebar from '../Componnent/dashboard/DashboardSidebar';
import DashboardTopbar from '../Componnent/dashboard/DashboardTopbar';
import StatCard from '../Componnent/dashboard/StatCard';
import TripVolumeChart from '../Componnent/dashboard/TripVolumeChart';
import LiveTrackingPanel from '../Componnent/dashboard/LiveTrackingPanel';
import EmissionOverview from '../Componnent/dashboard/EmissionOverview';
import FleetStatus from '../Componnent/dashboard/FleetStatus';
import { COLORS } from '../Componnent/dashboard/dashboardTheme';
import { getTrips } from '../api/tripsApi';

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, inTransit: 0, co2: 0 });

  useEffect(() => {
    getTrips({ per_page: 100, page: 1 })
      .then((res) => {
        const trips = res.data?.data ?? [];
        const meta = res.data?.meta ?? {};
        const inTransit = trips.filter(
          (t) =>
            t.status === 'in_transit_origin' ||
            t.status === 'in_transit_destination' ||
            t.status === 'on_ship',
        ).length;
        const co2 = trips
          .reduce((sum, t) => sum + (Number(t.estimated_co2_kg) || 0), 0)
          .toFixed(1);
        setStats({ total: meta.total ?? trips.length, inTransit, co2 });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: COLORS.bg }}>
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col lg:pl-64">
        <DashboardTopbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 px-4 sm:px-6 py-6 space-y-6">
          {/* top metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <StatCard
              icon={Route}
              value={String(stats.total)}
              label="Total Trips"
              delta="+12%"
            />
            <StatCard
              icon={Truck}
              value={String(stats.inTransit)}
              label="In Transit"
              delta="+8%"
            />
            <StatCard
              icon={Leaf}
              value={`${stats.co2} kg`}
              label="Est. CO₂ (semua trip)"
              delta="-5%"
              deltaGood
            />
          </div>

          {/* chart + live tracking */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <TripVolumeChart />
            </div>
            <div className="xl:col-span-1">
              <LiveTrackingPanel />
            </div>
          </div>

          {/* bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EmissionOverview />
            <FleetStatus />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
