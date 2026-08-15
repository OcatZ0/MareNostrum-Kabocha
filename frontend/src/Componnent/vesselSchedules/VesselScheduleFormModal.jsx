import React, { useState, useEffect } from 'react';
import {
  X, Ship, Anchor, Calendar, Clock, AlertCircle,
  Save, Navigation, ShieldCheck, MapPin, Gauge
} from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import { createVesselSchedule, updateVesselSchedule } from '../../api/vesselSchedulesApi';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'departed', label: 'Departed' },
  { value: 'on_time', label: 'On Time' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'early', label: 'Early' },
  { value: 'berthing', label: 'Berthing' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'cancelled', label: 'Cancelled' },
];

const formatForInput = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const VesselScheduleFormModal = ({
  open,
  onClose,
  schedule = null,
  ports = [],
  onSaved,
}) => {
  const isEdit = Boolean(schedule);

  const [formData, setFormData] = useState({
    vessel_name: '',
    ship_ref_id: '',
    voyage_number: '',
    origin_port_id: '',
    destination_port_id: '',
    scheduled_departure_at: '',
    scheduled_arrival_at: '',
    status: 'scheduled',
    tolerance_minutes: 30,
    notes: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setErrors({});
      if (schedule) {
        setFormData({
          vessel_name: schedule.vessel_name || '',
          ship_ref_id: schedule.ship_ref_id || '',
          voyage_number: schedule.voyage_number || '',
          origin_port_id: schedule.origin_port_id ? String(schedule.origin_port_id) : '',
          destination_port_id: schedule.destination_port_id ? String(schedule.destination_port_id) : '',
          scheduled_departure_at: formatForInput(schedule.scheduled_departure_at),
          scheduled_arrival_at: formatForInput(schedule.scheduled_arrival_at),
          status: schedule.status || 'scheduled',
          tolerance_minutes: schedule.tolerance_minutes ?? 30,
          notes: schedule.notes || '',
        });
      } else {
        const now = new Date();
        const departure = new Date(now.getTime() + 60 * 60 * 1000);
        const arrival = new Date(now.getTime() + 3 * 60 * 60 * 1000);

        setFormData({
          vessel_name: '',
          ship_ref_id: '',
          voyage_number: '',
          origin_port_id: ports.length > 0 ? String(ports[0].id) : '',
          destination_port_id: ports.length > 1 ? String(ports[1].id) : '',
          scheduled_departure_at: formatForInput(departure.toISOString()),
          scheduled_arrival_at: formatForInput(arrival.toISOString()),
          status: 'scheduled',
          tolerance_minutes: 30,
          notes: '',
        });
      }
    }
  }, [open, schedule, ports]);

  if (!open) return null;

  const validate = () => {
    const errs = {};
    if (!formData.vessel_name.trim()) {
      errs.vessel_name = 'Vessel name is required.';
    }
    if (!formData.ship_ref_id.trim()) {
      errs.ship_ref_id = 'MMSI / IMO number is required.';
    }
    if (!formData.origin_port_id) {
      errs.origin_port_id = 'Origin port must be selected.';
    }
    if (!formData.destination_port_id) {
      errs.destination_port_id = 'Destination port must be selected.';
    }
    if (formData.origin_port_id && formData.destination_port_id && formData.origin_port_id === formData.destination_port_id) {
      errs.destination_port_id = 'Destination port cannot be the same as the origin port.';
    }
    if (!formData.scheduled_departure_at) {
      errs.scheduled_departure_at = 'Departure time is required.';
    }
    if (!formData.scheduled_arrival_at) {
      errs.scheduled_arrival_at = 'Arrival time is required.';
    }
    if (formData.scheduled_departure_at && formData.scheduled_arrival_at) {
      if (new Date(formData.scheduled_arrival_at) <= new Date(formData.scheduled_departure_at)) {
        errs.scheduled_arrival_at = 'Arrival time must be after the departure time.';
      }
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    const payload = {
      ...formData,
      origin_port_id: parseInt(formData.origin_port_id, 10),
      destination_port_id: parseInt(formData.destination_port_id, 10),
      tolerance_minutes: parseInt(formData.tolerance_minutes, 10) || 30,
      scheduled_departure_at: new Date(formData.scheduled_departure_at).toISOString(),
      scheduled_arrival_at: new Date(formData.scheduled_arrival_at).toISOString(),
    };

    try {
      if (isEdit) {
        await updateVesselSchedule(schedule.id, payload);
      } else {
        await createVesselSchedule(payload);
      }
      onSaved(isEdit ? 'Vessel schedule updated successfully.' : 'Vessel schedule added successfully.');
      onClose();
    } catch (err) {
      if (err.response?.status === 422 && err.response.data?.errors) {
        const serverErrs = {};
        Object.entries(err.response.data.errors).forEach(([k, v]) => {
          serverErrs[k] = Array.isArray(v) ? v[0] : v;
        });
        setErrors(serverErrs);
      } else {
        setErrors({ general: err.response?.data?.message || 'Failed to save vessel schedule.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8"
        style={{ animation: 'modal-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Modal Header */}
        <div
          className="px-6 py-5 flex items-center justify-between border-b"
          style={{
            background: `linear-gradient(135deg, ${COLORS.navy} 0%, #1a365d 100%)`,
            color: '#fff',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 text-cyan-300">
              <Ship size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {isEdit ? 'Edit Vessel Schedule' : 'Add New Vessel Schedule'}
              </h2>
              <p className="text-xs text-slate-300">
                {isEdit
                  ? `Editing voyage details for ${schedule?.vessel_name}`
                  : 'Plan a vessel schedule for the Batam ↔ Singapore route'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errors.general && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* Row 1: Vessel Name & Ship Reference MMSI/IMO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Vessel Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Batam Fast 18"
                  value={formData.vessel_name}
                  onChange={(e) => setFormData({ ...formData, vessel_name: e.target.value })}
                  className={`w-full text-sm px-3.5 py-2.5 rounded-xl border bg-slate-50 focus:bg-white transition outline-none ${
                    errors.vessel_name ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200 focus:border-cyan-500'
                  }`}
                />
              </div>
              {errors.vessel_name && <p className="text-[11px] text-rose-600 mt-1">{errors.vessel_name}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Vessel MMSI / IMO ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 563123456"
                value={formData.ship_ref_id}
                onChange={(e) => setFormData({ ...formData, ship_ref_id: e.target.value })}
                className={`w-full text-sm px-3.5 py-2.5 rounded-xl border bg-slate-50 focus:bg-white transition outline-none ${
                  errors.ship_ref_id ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200 focus:border-cyan-500'
                }`}
              />
              {errors.ship_ref_id && <p className="text-[11px] text-rose-600 mt-1">{errors.ship_ref_id}</p>}
            </div>
          </div>

          {/* Row 2: Voyage Number & Tolerance Threshold */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Voyage Number
              </label>
              <input
                type="text"
                placeholder="e.g. BF-2026-081"
                value={formData.voyage_number}
                onChange={(e) => setFormData({ ...formData, voyage_number: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-cyan-500 transition outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Delay / Early Arrival Tolerance
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min="1"
                  max="360"
                  value={formData.tolerance_minutes}
                  onChange={(e) => setFormData({ ...formData, tolerance_minutes: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-cyan-500 transition outline-none"
                />
                <span className="absolute right-3.5 text-xs text-slate-400 pointer-events-none">Minutes</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">An automatic notification is sent if the deviation exceeds this limit.</p>
            </div>
          </div>

          {/* Row 3: Origin & Destination Ports */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Anchor size={14} className="text-teal-600" />
                Origin Port <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.origin_port_id}
                onChange={(e) => setFormData({ ...formData, origin_port_id: e.target.value })}
                className={`w-full text-sm px-3 py-2 rounded-xl border bg-white transition outline-none ${
                  errors.origin_port_id ? 'border-rose-400' : 'border-slate-300 focus:border-cyan-500'
                }`}
              >
                <option value="">-- Select Origin Port --</option>
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.country === 'singapore' ? '🇸🇬' : '🇮🇩'} {p.name} {p.unlocode ? `(${p.unlocode})` : ''}
                  </option>
                ))}
              </select>
              {errors.origin_port_id && <p className="text-[11px] text-rose-600 mt-1">{errors.origin_port_id}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Navigation size={14} className="text-cyan-600" />
                Destination Port <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.destination_port_id}
                onChange={(e) => setFormData({ ...formData, destination_port_id: e.target.value })}
                className={`w-full text-sm px-3 py-2 rounded-xl border bg-white transition outline-none ${
                  errors.destination_port_id ? 'border-rose-400' : 'border-slate-300 focus:border-cyan-500'
                }`}
              >
                <option value="">-- Select Destination Port --</option>
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.country === 'singapore' ? '🇸🇬' : '🇮🇩'} {p.name} {p.unlocode ? `(${p.unlocode})` : ''}
                  </option>
                ))}
              </select>
              {errors.destination_port_id && <p className="text-[11px] text-rose-600 mt-1">{errors.destination_port_id}</p>}
            </div>
          </div>

          {/* Row 4: Departure and Arrival Datetime */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-500" />
                Scheduled Departure Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.scheduled_departure_at}
                onChange={(e) => setFormData({ ...formData, scheduled_departure_at: e.target.value })}
                className={`w-full text-sm px-3.5 py-2.5 rounded-xl border bg-slate-50 focus:bg-white transition outline-none ${
                  errors.scheduled_departure_at ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200 focus:border-cyan-500'
                }`}
              />
              {errors.scheduled_departure_at && <p className="text-[11px] text-rose-600 mt-1">{errors.scheduled_departure_at}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Clock size={14} className="text-slate-500" />
                Scheduled Arrival Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.scheduled_arrival_at}
                onChange={(e) => setFormData({ ...formData, scheduled_arrival_at: e.target.value })}
                className={`w-full text-sm px-3.5 py-2.5 rounded-xl border bg-slate-50 focus:bg-white transition outline-none ${
                  errors.scheduled_arrival_at ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200 focus:border-cyan-500'
                }`}
              />
              {errors.scheduled_arrival_at && <p className="text-[11px] text-rose-600 mt-1">{errors.scheduled_arrival_at}</p>}
            </div>
          </div>

          {/* Row 5: Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Vessel Schedule Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-cyan-500 transition outline-none"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Row 6: Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Operational Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Special container cargo notes, weather information, loading/unloading instructions..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full text-sm px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-cyan-500 transition outline-none resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition flex items-center gap-2 shadow-lg disabled:opacity-50"
              style={{
                backgroundColor: COLORS.teal,
                boxShadow: `0 4px 14px ${COLORS.teal}40`,
              }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{isEdit ? 'Save Changes' : 'Add Schedule'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VesselScheduleFormModal;
