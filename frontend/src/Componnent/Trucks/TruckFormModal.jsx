import React, { useState, useEffect } from 'react';
import {
  Truck, X, Check, AlertCircle, Loader2,
  Calendar, Fuel, Zap, Hash, Tag, Wrench,
} from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import { createTruck, updateTruck } from '../../api/trucksApi';

const FUEL_OPTIONS = [
  { key: 'diesel', label: 'Diesel', icon: Fuel, color: '#64748B', bg: '#F1F5F9' },
  { key: 'gasoline', label: 'Gasoline', icon: Fuel, color: '#C2703D', bg: '#FDF2E9' },
  { key: 'electric', label: 'Electric', icon: Zap, color: '#0284C7', bg: '#E0F2FE' },
];

const STATUS_OPTIONS = [
  { key: 'active', label: 'Active', desc: 'Available for trips', color: COLORS.green, bg: '#ECFDF5' },
  { key: 'maintenance', label: 'Maintenance', desc: 'Under service/repair', color: '#C2703D', bg: '#FDF2E9' },
];

const currentYear = new Date().getFullYear();

const TruckFormModal = ({ mode = 'create', truck = null, onClose, onSaved }) => {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    plate_number: truck?.plate_number ?? '',
    brand: truck?.brand ?? '',
    model: truck?.model ?? '',
    year: truck?.year != null ? String(truck.year) : String(currentYear),
    fuel_type: truck?.fuel_type ?? 'diesel',
    status: truck?.status ?? 'active',
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setApiError(null);
  };

  const validate = () => {
    const errs = {};
    if (!form.plate_number.trim()) {
      errs.plate_number = 'Plate number is required (e.g. BP 1004 XY)';
    } else if (form.plate_number.trim().length > 20) {
      errs.plate_number = 'Plate number cannot exceed 20 characters';
    }

    if (!form.brand.trim()) {
      errs.brand = 'Brand / Manufacturer is required (e.g. Hino, Isuzu)';
    }

    const yr = parseInt(form.year, 10);
    if (!form.year || isNaN(yr)) {
      errs.year = 'Manufacturing year is required';
    } else if (yr < 1990 || yr > currentYear + 1) {
      errs.year = `Year must be between 1990 and ${currentYear + 1}`;
    }

    if (!form.fuel_type) {
      errs.fuel_type = 'Please select a fuel type';
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    setApiError(null);

    const payload = {
      plate_number: form.plate_number.trim().toUpperCase(),
      brand: form.brand.trim(),
      model: form.model.trim() || undefined,
      year: parseInt(form.year, 10),
      fuel_type: form.fuel_type,
      status: form.status,
    };

    try {
      let result;
      if (isEdit && truck?.id) {
        const res = await updateTruck(truck.id, payload);
        result = res.data?.data ?? { ...truck, ...payload };
      } else {
        const res = await createTruck(payload);
        result = res.data?.data ?? payload;
      }

      setSuccess(true);
      setTimeout(() => {
        onSaved?.(result);
      }, 500);
    } catch (err) {
      const respData = err?.response?.data;
      if (respData?.errors) {
        const serverErrs = {};
        Object.entries(respData.errors).forEach(([k, v]) => {
          serverErrs[k] = Array.isArray(v) ? v[0] : v;
        });
        setErrors(serverErrs);
      } else {
        setApiError(respData?.message ?? 'Failed to save truck. Please check your network or inputs.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field) => `
    w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 outline-none transition-all
    ${errors[field]
      ? 'border-red-300 ring-2 ring-red-100 bg-red-50/20'
      : 'border-slate-200 hover:border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-50 bg-white'
    }
  `;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className={`
          relative z-10 w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col
          transition-all duration-200 max-h-[92vh]
          ${mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{ background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.teal})` }}
            >
              <Truck size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isEdit ? 'Edit Truck' : 'Register New Truck'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEdit ? `Updating vehicle details for #${truck?.id} (${truck?.plate_number})` : 'Add a vehicle to your cross-border logistics fleet'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {apiError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{apiError}</span>
            </div>
          )}

          {/* License Plate */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              <Hash size={13} className="text-slate-400" />
              Plate Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.plate_number}
              onChange={(e) => handleChange('plate_number', e.target.value.toUpperCase())}
              placeholder="e.g. BP 1004 XY"
              className={`${inputClass('plate_number')} font-mono uppercase font-medium tracking-wide`}
              autoFocus={!isEdit}
            />
            {errors.plate_number ? (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.plate_number}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-400">
                Unique identifier used for port gate clearance and dispatching.
              </p>
            )}
          </div>

          {/* Brand & Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                <Tag size={13} className="text-slate-400" />
                Brand / Make <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
                placeholder="e.g. Hino, Isuzu, Mitsubishi"
                className={inputClass('brand')}
              />
              {errors.brand && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.brand}
                </p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Model (Optional)
              </label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => handleChange('model', e.target.value)}
                placeholder="e.g. Dutro 130 HD, Giga FVM"
                className={inputClass('model')}
              />
            </div>
          </div>

          {/* Manufacture Year */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              <Calendar size={13} className="text-slate-400" />
              Manufacture Year <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1990}
              max={currentYear + 1}
              value={form.year}
              onChange={(e) => handleChange('year', e.target.value)}
              placeholder={`e.g. ${currentYear}`}
              className={inputClass('year')}
            />
            {errors.year && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.year}
              </p>
            )}
          </div>

          {/* Fuel Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Fuel & Propulsion Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {FUEL_OPTIONS.map(({ key, label, icon: Icon, color, bg }) => {
                const selected = form.fuel_type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleChange('fuel_type', key)}
                    className={`
                      relative flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold
                      transition-all text-center gap-1.5
                      ${selected
                        ? 'border-teal-500 bg-teal-50/40 text-teal-900 shadow-sm ring-1 ring-teal-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }
                    `}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: bg, color }}
                    >
                      <Icon size={16} />
                    </div>
                    <span>{label}</span>
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {errors.fuel_type && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.fuel_type}
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Operational Status
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STATUS_OPTIONS.map(({ key, label, desc, color, bg }) => {
                const selected = form.status === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleChange('status', key)}
                    className={`
                      flex items-center justify-between p-3 rounded-xl border text-left transition-all
                      ${selected
                        ? 'border-teal-500 bg-white shadow-sm ring-1 ring-teal-500'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-600'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-800">{label}</p>
                        <p className="text-[11px] text-slate-400">{desc}</p>
                      </div>
                    </div>
                    {selected && (
                      <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 sm:rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200/60 transition"
          >
            Cancel
          </button>

          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting || success}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition disabled:opacity-60"
            style={{
              backgroundColor: success ? COLORS.green : COLORS.teal,
            }}
          >
            {success ? (
              <>
                <Check size={16} />
                {isEdit ? 'Saved!' : 'Created!'}
              </>
            ) : submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {isEdit ? 'Updating…' : 'Registering…'}
              </>
            ) : (
              <>
                <Truck size={16} />
                {isEdit ? 'Save Changes' : 'Register Truck'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TruckFormModal;
