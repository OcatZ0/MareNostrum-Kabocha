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

const TripVolumeChart = ({ data = null, trips = [] }) => {
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
    <div className="bg-white rounded-xl border border-slate-100 p-5 sm:p-6">
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

      <div className="h-72 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={finalData} barGap={4} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#F1F5F9" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#94A3B8' }}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
            <Bar dataKey="domestic" fill={COLORS.aqua} radius={[4, 4, 0, 0]} />
            <Bar dataKey="crossBorder" fill={COLORS.navy} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TripVolumeChart;
