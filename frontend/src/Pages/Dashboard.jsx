import React, { useState } from 'react';
import { Route, Truck, Leaf } from 'lucide-react';
import DashboardSidebar from '../Componnent/dashboard/DashboardSidebar';
import DashboardTopbar from '../Componnent/dashboard/DashboardTopbar';
import StatCard from '../Componnent/dashboard/StatCard';
import TripVolumeChart from '../Componnent/dashboard/TripVolumeChart';
import LiveTrackingPanel from '../Componnent/dashboard/LiveTrackingPanel';
import EmissionOverview from '../Componnent/dashboard/EmissionOverview';
import FleetStatus from '../Componnent/dashboard/FleetStatus';
import { COLORS } from '../Componnent/dashboard/dashboardTheme';

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: COLORS.bg }}>
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col lg:pl-0">
        <DashboardTopbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 px-4 sm:px-6 py-6 space-y-6">
          {/* top metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <StatCard icon={Route} value="128" label="Active Trips" delta="+12%" />
            <StatCard icon={Truck} value="42" label="In Transit" delta="+8%" />
            <StatCard
              icon={Leaf}
              value="3.2t"
              label="CO₂ Emitted (MTD)"
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
