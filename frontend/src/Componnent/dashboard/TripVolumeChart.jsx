import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ChevronDown } from 'lucide-react';
import { COLORS } from './dashboardTheme';

const DEFAULT_DATA = [
  { month: 'Jan', domestic: 58, crossBorder: 24 },
  { month: 'Feb', domestic: 45, crossBorder: 19 },
  { month: 'Mar', domestic: 62, crossBorder: 28 },
  { month: 'Apr', domestic: 38, crossBorder: 15 },
  { month: 'May', domestic: 70, crossBorder: 33 },
  { month: 'Jun', domestic: 64, crossBorder: 30 },
  { month: 'Jul', domestic: 72, crossBorder: 36 },
  { month: 'Aug', domestic: 80, crossBorder: 41 },
  { month: 'Sep', domestic: 55, crossBorder: 22 },
  { month: 'Oct', domestic: 68, crossBorder: 31 },
  { month: 'Nov', domestic: 76, crossBorder: 38 },
  { month: 'Dec', domestic: 82, crossBorder: 44 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey === 'domestic' ? 'Domestic' : 'Cross-border'}: {p.value}
        </p>
      ))}
    </div>
  );
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TripVolumeChart = ({ data = null, trips = [], loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border-2 border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between h-full min-h-[380px]">
        <div>
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="space-y-1.5 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-32" />
              <div className="h-3.5 bg-slate-100 rounded w-48" />
            </div>
            <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              Loading chart...
            </span>
          </div>

          <div className="flex items-center gap-5 mb-4 animate-pulse">
            <div className="h-3 bg-slate-100 rounded w-20" />
            <div className="h-3 bg-slate-100 rounded w-24" />
          </div>
        </div>

        {/* Shimmering Bar Chart Skeleton */}
        <div className="h-64 flex items-end justify-between gap-2 pt-6 px-2 animate-pulse">
          {[45, 60, 35, 75, 50, 80, 65, 90, 40, 70, 85, 95].map((h, i) => (
            <div key={i} className="flex-1 flex items-end justify-center gap-1 h-full">
              <div
                className="w-1/2 rounded-t bg-slate-100"
                style={{ height: `${h * 0.7}%` }}
              />
              <div
                className="w-1/2 rounded-t bg-slate-200"
                style={{ height: `${h * 0.45}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  let chartData = data;

  if (!chartData && trips && trips.length > 0) {
    const monthlyMap = {};
    MONTHS.forEach((m) => {
      monthlyMap[m] = { month: m, domestic: 0, crossBorder: 0 };
    });

    trips.forEach((t) => {
      const d = t.created_at ? new Date(t.created_at) : new Date();
      const monthName = MONTHS[d.getMonth()];
      const isCrossBorder = Boolean(
        t.ship_ref_id ||
        t.origin_port_id ||
        t.destination_port_id ||
        t.destination?.type === 'port' ||
        t.origin?.type === 'port'
      );

      if (monthlyMap[monthName]) {
        if (isCrossBorder) {
          monthlyMap[monthName].crossBorder += 1;
        } else {
          monthlyMap[monthName].domestic += 1;
        }
      }
    });

    const hasAny = Object.values(monthlyMap).some((m) => m.domestic > 0 || m.crossBorder > 0);
    chartData = hasAny ? Object.values(monthlyMap) : DEFAULT_DATA;
  } else if (!chartData) {
    chartData = DEFAULT_DATA;
  }

  const finalData = Array.isArray(chartData) && chartData.length > 0 ? chartData : DEFAULT_DATA;
  const total = finalData.reduce((sum, d) => sum + (d.domestic || 0) + (d.crossBorder || 0), 0);

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-5 sm:p-6 shadow-sm h-full flex flex-col justify-between">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Trip Volume</h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Total recorded trips: {total.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-5 mb-4">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.aqua }} />
          Domestic
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.navy }} />
          Cross-border
        </span>
      </div>

      <div className="h-72 -ml-2 outline-none select-none focus:outline-none [&_*]:outline-none">
        <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
          <BarChart
            data={finalData}
            barGap={4}
            barCategoryGap="28%"
            accessibilityLayer={false}
            style={{ outline: 'none' }}
          >
            <CartesianGrid vertical={false} stroke="#F1F5F9" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#94A3B8' }}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} wrapperStyle={{ outline: 'none' }} />
            <Bar dataKey="domestic" fill={COLORS.aqua} radius={[4, 4, 0, 0]} style={{ outline: 'none' }} />
            <Bar dataKey="crossBorder" fill={COLORS.navy} radius={[4, 4, 0, 0]} style={{ outline: 'none' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TripVolumeChart;
