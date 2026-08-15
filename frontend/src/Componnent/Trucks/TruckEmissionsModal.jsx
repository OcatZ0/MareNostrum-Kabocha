import React, { useState, useEffect } from 'react';
import {
  BarChart2, X, Leaf, Route, Navigation, RefreshCw,
  Calendar, AlertCircle, Fuel, Zap, Clock,
} from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import { truckEmissions } from '../../api/trucksApi';

const FUEL_BADGES = {
  diesel: { label: 'Diesel', color: '#64748B', bg: '#F1F5F9', icon: Fuel },
  gasoline: { label: 'Gasoline', color: '#C2703D', bg: '#FDF2E9', icon: Fuel },
  electric: { label: 'Electric', color: '#0284C7', bg: '#E0F2FE', icon: Zap },
};

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const formatStatus = (status) => {
  if (!status) return '—';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const TruckEmissionsModal = ({ truck, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = () => {
    if (!truck?.id) return;
    setLoading(true);
    setError(null);

    truckEmissions(truck.id)
      .then((res) => {
        setData(res.data?.data ?? null);
      })
      .catch((err) => {
        setError(err?.response?.data?.message ?? 'Failed to load emission analytics.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [truck?.id]);

  const fuelConfig = FUEL_BADGES[truck?.fuel_type] ?? FUEL_BADGES.diesel;
  const FuelIcon = fuelConfig.icon;

  const summary = data?.summary ?? {
    total_trips: 0,
    total_distance_km: 0,
    total_co2_kg: 0,
    average_co2_per_trip_kg: 0,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className="relative z-10 w-full sm:max-w-2xl bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] animate-[modal-in_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}
            >
              <Leaf size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  CO₂ Emissions & Fleet Carbon Intelligence
                </h2>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span className="font-mono font-bold text-slate-800">{truck?.plate_number}</span>
                <span>•</span>
                <span>{truck?.brand} {truck?.model}</span>
                <span>•</span>
                <span
                  className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[11px]"
                  style={{ backgroundColor: fuelConfig.bg, color: fuelConfig.color }}
                >
                  <FuelIcon size={11} /> {fuelConfig.label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={loadData}
              title="Refresh"
              className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <RefreshCw size={24} className="animate-spin mx-auto text-teal-600" />
              <p className="text-sm font-medium">Calculating emissions and aggregating trip history…</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-3">
              <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to load emissions data</p>
                <p className="mt-0.5">{error}</p>
                <button
                  onClick={loadData}
                  className="mt-2 font-semibold text-red-800 underline hover:no-underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Emission Factor Spotlight Banner */}
              <div
                className="p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border"
                style={{
                  backgroundColor: `${COLORS.teal}08`,
                  borderColor: `${COLORS.teal}30`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${COLORS.teal}18`, color: COLORS.teal }}
                  >
                    <BarChart2 size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Standard Emission Factor
                    </p>
                    <p className="text-sm text-slate-700 mt-0.5">
                      Calculated dynamically based on vehicle brand, fuel type, and age.
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-2xl font-black font-mono" style={{ color: COLORS.teal }}>
                    {data.emission_factor_kg_per_km ?? 0}
                  </span>
                  <span className="text-xs font-medium text-slate-500 ml-1">kg CO₂ / km</span>
                </div>
              </div>

              {/* Summary 4-Grid Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
                    <Route size={14} className="text-slate-400" />
                    <span>Total Trips</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800 font-mono">
                    {summary.total_trips}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
                    <Navigation size={14} className="text-slate-400" />
                    <span>Total Distance</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800 font-mono">
                    {summary.total_distance_km} <span className="text-xs font-normal text-slate-500">km</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
                    <Leaf size={14} className="text-green-600" />
                    <span>Total CO₂</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800 font-mono">
                    {summary.total_co2_kg} <span className="text-xs font-normal text-slate-500">kg</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
                    <Clock size={14} className="text-teal-600" />
                    <span>Avg CO₂ / Trip</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800 font-mono">
                    {summary.average_co2_per_trip_kg} <span className="text-xs font-normal text-slate-500">kg</span>
                  </p>
                </div>
              </div>

              {/* Trip Breakdown Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Trip Emission History ({data.trips?.length ?? 0})
                  </h3>
                </div>

                {(!data.trips || data.trips.length === 0) ? (
                  <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200">
                    <Route size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-600">No recorded trips for this truck yet</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Once this truck completes cross-border or domestic trips, their carbon footprint will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {data.trips.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-3 hover:bg-slate-50 transition text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                              #{t.id}
                            </span>
                            <div>
                              <p className="font-semibold text-slate-800">
                                {formatStatus(t.status)}
                              </p>
                              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Calendar size={11} />
                                {formatDate(t.chosen_departure_at || t.actual_departure_at || t.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="font-mono font-bold text-slate-800">
                              {t.estimated_co2_kg != null ? `${t.estimated_co2_kg} kg CO₂` : '—'}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {t.distance_km != null ? `${t.distance_km} km` : '—'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/50 sm:rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TruckEmissionsModal;
