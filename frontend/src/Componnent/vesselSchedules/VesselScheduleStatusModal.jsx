import React, { useState, useEffect } from 'react';
import {
  X, Radio, Navigation, Gauge, Clock, AlertTriangle,
  CheckCircle2, Bell, RefreshCw, MapPin, Zap, Info, ShieldAlert
} from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import { checkVesselScheduleStatus } from '../../api/vesselSchedulesApi';

const STATUS_PILLS = {
  on_time: { label: 'Tepat Waktu (On Time)', bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  delayed: { label: 'Terlambat (Delayed)', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  early: { label: 'Kedatangan Cepat (Early Arrival)', bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  berthing: { label: 'Proses Sandar (Berthing)', bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
  arrived: { label: 'Tiba di Dermaga (Arrived)', bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  scheduled: { label: 'Terjadwal (Scheduled)', bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
  departed: { label: 'Sedang Berlayar (Departed)', bg: '#F0FDFA', color: '#0D9488', border: '#99F6E4' },
  cancelled: { label: 'Dibatalkan (Cancelled)', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
};

const VesselScheduleStatusModal = ({ open, onClose, schedule, onStatusUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [telemetry, setTelemetry] = useState({
    latitude: '',
    longitude: '',
    speed_knots: '',
    notify: true,
  });
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (open && schedule) {
      setTelemetry({
        latitude: schedule.current_latitude !== null ? String(schedule.current_latitude) : '',
        longitude: schedule.current_longitude !== null ? String(schedule.current_longitude) : '',
        speed_knots: schedule.current_speed_knots !== null ? String(schedule.current_speed_knots) : '18.0',
        notify: true,
      });
      setAnalysisResult(null);
      setErrorMsg(null);
    }
  }, [open, schedule]);

  if (!open || !schedule) return null;

  const currentStatusKey = analysisResult?.status || schedule.status || 'scheduled';
  const statusBadge = STATUS_PILLS[currentStatusKey] || STATUS_PILLS.scheduled;

  const handleEvaluate = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const payload = {
      latitude: telemetry.latitude !== '' ? parseFloat(telemetry.latitude) : null,
      longitude: telemetry.longitude !== '' ? parseFloat(telemetry.longitude) : null,
      speed_knots: telemetry.speed_knots !== '' ? parseFloat(telemetry.speed_knots) : null,
      notify: Boolean(telemetry.notify),
    };

    try {
      const res = await checkVesselScheduleStatus(schedule.id, payload);
      setAnalysisResult(res.data?.data?.analysis);
      if (onStatusUpdated) {
        onStatusUpdated(res.data?.data?.schedule);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Gagal mengevaluasi status dan jarak kapal.');
    } finally {
      setLoading(false);
    }
  };

  const distanceKm = analysisResult?.distance_to_destination_km ?? schedule.distance_to_destination_km ?? '-';
  const distanceNm = analysisResult?.distance_to_destination_nm ?? schedule.distance_to_destination_nm ?? '-';
  const varianceMin = analysisResult?.variance_minutes ?? schedule.variance_minutes ?? 0;
  const tolerance = analysisResult?.tolerance_minutes ?? schedule.tolerance_minutes ?? 30;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8"
        style={{ animation: 'modal-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between border-b"
          style={{
            background: `linear-gradient(135deg, ${COLORS.navy} 0%, #0f172a 100%)`,
            color: '#fff',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300">
              <Radio size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{schedule.vessel_name}</h2>
                {schedule.voyage_number && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/10 text-cyan-200">
                    {schedule.voyage_number}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                MMSI/IMO: <span className="font-mono text-cyan-300">{schedule.ship_ref_id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Route & Ports Strip */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Pelabuhan Asal</p>
              <p className="text-sm font-bold text-slate-800">
                {schedule.origin_port?.name || 'Pelabuhan Asal'}
              </p>
              <p className="text-[10px] text-slate-500">{schedule.origin_port?.unlocode || ''}</p>
            </div>

            <div className="flex flex-col items-center px-4">
              <div className="flex items-center gap-1.5 text-xs text-teal-600 font-semibold">
                <Navigation size={14} className="rotate-90" />
                <span>Selat Batam - Singapura</span>
              </div>
              <div className="w-24 h-0.5 bg-slate-200 my-1 relative">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-teal-500" />
              </div>
            </div>

            <div className="text-right">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Pelabuhan Tujuan</p>
              <p className="text-sm font-bold text-slate-800">
                {schedule.destination_port?.name || 'Pelabuhan Tujuan'}
              </p>
              <p className="text-[10px] text-slate-500">{schedule.destination_port?.unlocode || ''}</p>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Sisa Jarak (KM)</p>
              <p className="text-lg font-black text-slate-800 mt-1">
                {distanceKm !== '-' ? `${distanceKm} km` : '-'}
              </p>
              <p className="text-[10px] text-slate-400">
                {distanceNm !== '-' ? `(${distanceNm} NM)` : ''}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Kecepatan</p>
              <p className="text-lg font-black text-cyan-700 mt-1">
                {schedule.current_speed_knots ? `${schedule.current_speed_knots} Knots` : '-'}
              </p>
              <p className="text-[10px] text-slate-400">AIS live speed</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Deviasi Waktu</p>
              <p
                className={`text-lg font-black mt-1 ${
                  varianceMin > tolerance
                    ? 'text-rose-600'
                    : varianceMin < -tolerance
                    ? 'text-blue-600'
                    : 'text-emerald-600'
                }`}
              >
                {varianceMin > 0 ? `+${varianceMin} mnt` : `${varianceMin} mnt`}
              </p>
              <p className="text-[10px] text-slate-400">Toleransi: ±{tolerance} m</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Status Evaluasi</p>
              <span
                className="inline-flex items-center justify-center text-[11px] font-bold px-2 py-1 rounded-lg border text-center mt-1"
                style={{
                  backgroundColor: statusBadge.bg,
                  color: statusBadge.color,
                  borderColor: statusBadge.border,
                }}
              >
                {statusBadge.label.split('(')[0]}
              </span>
            </div>
          </div>

          {/* Alert Trigger Result Banner */}
          {analysisResult && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                analysisResult.is_delayed
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : analysisResult.is_early
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {analysisResult.is_delayed ? (
                <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
              ) : analysisResult.is_early ? (
                <Zap size={20} className="text-blue-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-1">
                <p className="font-bold">
                  {analysisResult.is_delayed
                    ? `⚠️ Terdeteksi Keterlambatan: Melebihi Toleransi (+${analysisResult.variance_minutes} Menit)`
                    : analysisResult.is_early
                    ? `⚡ Terdeteksi Kedatangan Lebih Cepat (${Math.abs(analysisResult.variance_minutes)} Menit Lebih Awal)`
                    : ' Jadwal Terpantau Tepat Waktu (Dalam Rentang Toleransi)'}
                </p>
                <p className="leading-relaxed opacity-90">
                  {analysisResult.notification_sent
                    ? `Notifikasi otomatis (${analysisResult.notification_type}) berhasil dipicu dan dikirimkan ke Admin.`
                    : 'Kondisi pelayaran saat ini terpantau stabil sesuai jadwal.'}
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Telemetry Input Form */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MapPin size={14} className="text-teal-600" />
                Telemetri Posisi Kapal / Simulasi Radar
              </p>
              <span className="text-[10px] text-slate-500">Kosongkan untuk otomatis ambil AIS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Contoh: 1.2050"
                  value={telemetry.latitude}
                  onChange={(e) => setTelemetry({ ...telemetry, latitude: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Contoh: 103.8800"
                  value={telemetry.longitude}
                  onChange={(e) => setTelemetry({ ...telemetry, longitude: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kecepatan (Knots)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Contoh: 18.5"
                  value={telemetry.speed_knots}
                  onChange={(e) => setTelemetry({ ...telemetry, speed_knots: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={telemetry.notify}
                onChange={(e) => setTelemetry({ ...telemetry, notify: e.target.checked })}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
              />
              <span className="flex items-center gap-1">
                <Bell size={13} className="text-teal-600" />
                Kirimkan notifikasi in-app otomatis jika telat atau datang lebih cepat dari toleransi
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
          >
            Tutup
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleEvaluate}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition flex items-center gap-2 shadow-lg disabled:opacity-50"
            style={{
              backgroundColor: COLORS.teal,
              boxShadow: `0 4px 14px ${COLORS.teal}40`,
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Mengevaluasi Status...</span>
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                <span>Cek & Hitung Ketepatan Waktu</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VesselScheduleStatusModal;
