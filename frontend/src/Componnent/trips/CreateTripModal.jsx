import React, { useState } from 'react';
import { X, Plus, Route, Ship, Building2, Anchor, AlertCircle } from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import { createTrip } from '../../api/tripsApi';

/* ── combo type descriptions ────────────────────────────────── */
const COMBO_TYPES = [
  {
    key: 'domestic',
    label: 'Domestik',
    desc: 'Company → Company (kota yang sama)',
    icon: Route,
    fields: ['origin_company_id', 'destination_company_id'],
  },
  {
    key: 'cross_border_outbound',
    label: 'Lintas Negara (Outbound)',
    desc: 'Company → Port (truck) + Port kapal (tujuan akhir)',
    icon: Ship,
    fields: ['origin_company_id', 'destination_port_id', 'ship_destination_port_id'],
  },
  {
    key: 'port_to_company',
    label: 'Port ke Company',
    desc: 'Port → Company (barang tiba dari pelabuhan)',
    icon: Anchor,
    fields: ['origin_port_id', 'destination_company_id'],
  },
];

const FIELD_LABELS = {
  origin_company_id: 'ID Company Asal',
  destination_company_id: 'ID Company Tujuan',
  origin_port_id: 'ID Port Asal',
  destination_port_id: 'ID Port Tujuan (Truk)',
  ship_destination_port_id: 'ID Port Tujuan Kapal',
};

/* ── form input ─────────────────────────────────────────────── */
const Field = ({ name, value, onChange, error }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">
      {FIELD_LABELS[name]}
    </label>
    <input
      type="number"
      min={1}
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
      placeholder="masukkan ID angka"
      className="w-full px-3 py-2 rounded-lg border text-sm text-slate-700 outline-none transition"
      style={{
        borderColor: error ? '#EF4444' : '#E2E8F0',
        boxShadow: error ? '0 0 0 2px #FEE2E2' : 'none',
      }}
      onFocus={(e) => !error && (e.target.style.boxShadow = `0 0 0 2px ${COLORS.aqua}40`)}
      onBlur={(e) => !error && (e.target.style.boxShadow = 'none')}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

/* ── main ─────────────────────────────────────────────────────── */
const CreateTripModal = ({ onClose, onCreated }) => {
  const [comboType, setComboType] = useState('domestic');
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  const activeCombo = COMBO_TYPES.find((c) => c.key === comboType);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleComboChange = (key) => {
    setComboType(key);
    setFormData({});
    setErrors({});
    setApiError(null);
  };

  const validate = () => {
    const errs = {};
    activeCombo.fields.forEach((field) => {
      const v = formData[field];
      if (!v || isNaN(Number(v)) || Number(v) < 1) {
        errs[field] = 'Harus berupa ID angka yang valid (> 0)';
      }
    });
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    setApiError(null);

    const payload = {};
    activeCombo.fields.forEach((field) => {
      payload[field] = Number(formData[field]);
    });

    try {
      const res = await createTrip(payload);
      onCreated(res.data?.data);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.errors) {
        const mapped = {};
        Object.entries(data.errors).forEach(([k, msgs]) => {
          mapped[k] = Array.isArray(msgs) ? msgs[0] : msgs;
        });
        setErrors(mapped);
      } else {
        setApiError(data?.message ?? 'Gagal membuat trip. Coba lagi.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div
          className="flex items-center justify-between px-5 py-4 text-white"
          style={{
            background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.teal} 100%)`,
          }}
        >
          <div className="flex items-center gap-2">
            <Plus size={18} />
            <h2 className="text-base font-semibold">Buat Trip Baru</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* combo type selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Tipe Rute
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {COMBO_TYPES.map(({ key, label, desc, icon: Icon }) => {
                const active = comboType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleComboChange(key)}
                    className="flex flex-col items-start gap-1 px-3 py-3 rounded-xl border text-left transition"
                    style={{
                      borderColor: active ? COLORS.aqua : '#E2E8F0',
                      backgroundColor: active ? `${COLORS.aqua}0D` : 'white',
                    }}
                  >
                    <Icon size={16} color={active ? COLORS.aqua : '#94A3B8'} />
                    <span
                      className="text-xs font-semibold"
                      style={{ color: active ? COLORS.navy : '#475569' }}
                    >
                      {label}
                    </span>
                    <span className="text-[11px] text-slate-400 leading-tight">{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* dynamic fields */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Data Rute
            </p>
            {activeCombo.fields.map((field) => (
              <Field
                key={field}
                name={field}
                value={formData[field] ?? ''}
                onChange={handleChange}
                error={errors[field]}
              />
            ))}
          </div>

          {/* info note */}
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs text-slate-500"
            style={{ backgroundColor: `${COLORS.navy}08` }}
          >
            <Building2 size={13} className="shrink-0 mt-0.5" style={{ color: COLORS.teal }} />
            <span>
              Trip baru dibuat dengan status <strong>draft</strong>. Panggil{' '}
              <strong>/recommend</strong> lalu <strong>/assign</strong> untuk menetapkan driver
              dan jadwal keberangkatan.
            </span>
          </div>

          {/* API error */}
          {apiError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
              <AlertCircle size={13} className="shrink-0" />
              {apiError}
            </div>
          )}

          {/* actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-70"
              style={{
                background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})`,
              }}
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Menyimpan…
                </>
              ) : (
                <>
                  <Plus size={15} /> Buat Trip
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTripModal;
