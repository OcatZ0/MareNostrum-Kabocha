import React, { useState } from 'react';
import { X } from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import { createUser } from '../../api/usersApi';

const initialForm = {
  name: '',
  username: '',
  phone: '',
  role: 'driver',
  password: '',
};

const CreateDriverModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createUser(form);
      onCreated();
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Gagal menyimpan user.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(11,32,56,0.45)' }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold" style={{ color: COLORS.navy }}>Buat User</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama Lengkap</label>
            <input
              required
              value={form.name}
              onChange={set('name')}
              placeholder="Budi Santoso"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Username</label>
            <input
              required
              value={form.username}
              onChange={set('username')}
              placeholder="budi.santoso"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Telepon</label>
            <input
              value={form.phone}
              onChange={set('phone')}
              placeholder="0813-xxxx-xxxx"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role</label>
              <select
                value={form.role}
                onChange={set('role')}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition bg-white"
              >
                <option value="driver">Driver</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
              <input
                required
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
              />
            </div>
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
              {submitting ? 'Menyimpan…' : 'Simpan User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDriverModal;
