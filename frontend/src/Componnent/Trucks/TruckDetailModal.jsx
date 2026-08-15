import React, { useState } from 'react';
import { X, Pencil, Trash2, Truck as TruckIcon } from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import { updateTruck, deleteTruck } from '../../api/trucksApi';

const FUEL_LABELS = { diesel: 'Diesel', petrol: 'Petrol', electric: 'Electric' };
const STATUS_STYLES = {
  active: { label: 'Active', bg: '#E7F5EC', color: '#38A169' },
  maintenance: { label: 'Maintenance', bg: '#FBF1DE', color: '#C08A1E' },
};

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
    <span className="text-xs text-slate-400">{label}</span>
    <span className="text-sm font-medium text-slate-700">{value}</span>
  </div>
);

const TruckDetailModal = ({ truck, onClose, onRefresh, onTruckUpdated }) => {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    plate_number: truck.plate_number,
    brand: truck.brand,
    model: truck.model ?? '',
    year: truck.year,
    fuel_type: truck.fuel_type,
    status: truck.status,
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const s = STATUS_STYLES[truck.status] ?? { label: truck.status, bg: '#F1F5F9', color: '#64748B' };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await updateTruck(truck.id, { ...form, year: Number(form.year) });
      onTruckUpdated(res.data?.data ?? { ...truck, ...form });
      setEditing(false);
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await deleteTruck(truck.id);
      onRefresh();
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to delete truck.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(11,32,56,0.45)' }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <TruckIcon size={16} color={COLORS.teal} />
            <h2 className="text-base font-semibold" style={{ color: COLORS.navy }}>
              {editing ? `Edit Truck #${truck.id}` : `Truck #${truck.id}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 mb-4">{error}</div>
          )}

          {!editing && !confirmingDelete && (
            <>
              <div className="mb-4">
                <Row label="Plate Number" value={truck.plate_number} />
                <Row label="Brand" value={truck.brand} />
                <Row label="Model" value={truck.model ?? '—'} />
                <Row label="Year" value={truck.year} />
                <Row label="Fuel Type" value={FUEL_LABELS[truck.fuel_type] ?? truck.fuel_type} />
                <Row label="Total Trips" value={truck.trips_count ?? 0} />
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-slate-400">Status</span>
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition"
                >
                  <Trash2 size={14} /> Delete
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                  style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}
                >
                  <Pencil size={14} /> Edit
                </button>
              </div>
            </>
          )}

          {confirmingDelete && (
            <>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Delete <strong>{truck.plate_number}</strong> from fleet? Trip history for this truck will be preserved, but
                the truck can no longer be assigned to new trips.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Deleting…' : 'Delete Truck'}
                </button>
              </div>
            </>
          )}

          {editing && (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Plate Number</label>
                <input
                  required
                  value={form.plate_number}
                  onChange={set('plate_number')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand</label>
                  <input
                    required
                    value={form.brand}
                    onChange={set('brand')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Model</label>
                  <input
                    value={form.model}
                    onChange={set('model')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Year</label>
                  <input
                    required
                    type="number"
                    value={form.year}
                    onChange={set('year')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fuel Type</label>
                  <select
                    value={form.fuel_type}
                    onChange={set('fuel_type')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition bg-white"
                  >
                    <option value="diesel">Diesel</option>
                    <option value="petrol">Petrol</option>
                    <option value="electric">Electric</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={set('status')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition bg-white"
                >
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}
                >
                  {submitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default TruckDetailModal;
