import React, { useState } from 'react';
import { X } from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import { createTruck } from '../../api/trucksApi';

const initialForm = {
  plate_number: '',
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  fuel_type: 'diesel',
  status: 'active',
};

const CreateTruckModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createTruck({ ...form, year: Number(form.year) });
      onCreated();
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Gagal menyimpan truk.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(11,32,56,0.45)' }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold" style={{ color: COLORS.navy }}>Buat Truk</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Plat Nomor</label>
            <input
              required
              value={form.plate_number}
              onChange={set('plate_number')}
              placeholder="BP 1234 XX"
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
                placeholder="Hino"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Model</label>
              <input
                value={form.model}
                onChange={set('model')}
                placeholder="Dutro 130 HD"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tahun Pembuatan</label>
              <input
                required
                type="number"
                value={form.year}
                onChange={set('year')}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Bahan Bakar</label>
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
              <option value="active">Aktif</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}
            >
              {submitting ? 'Menyimpan…' : 'Simpan Truk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTruckModal;
