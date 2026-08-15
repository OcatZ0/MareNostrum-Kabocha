import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, Tag, Globe, AlertCircle, Check, Loader2 } from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import { createCompany, updateCompany } from '../../api/companiesApi';

/* ── simple labeled input ─────────────────────────────────────── */
const Field = ({ label, error, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
      {label}
    </label>
    {children}
    {error && (
      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
        <AlertCircle size={11} />{error}
      </p>
    )}
  </div>
);

const inputClass = (hasError, focused) =>
  `w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-700 outline-none transition-all ${
    hasError
      ? 'border-red-300 ring-2 ring-red-100'
      : focused
      ? 'border-slate-400 ring-2 ring-slate-100'
      : 'border-slate-200 hover:border-slate-300'
  }`;

/* ─────────────────────────────────────────────────────────────── */
const CompanyFormModal = ({ mode, company, onClose, onSaved }) => {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    name:      company?.name      ?? '',
    type:      company?.type      ?? 'internal',
    city:      company?.city      ?? '',
    address:   company?.address   ?? '',
    latitude:  company?.latitude  != null ? String(company.latitude)  : '',
    longitude: company?.longitude != null ? String(company.longitude) : '',
  });
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]     = useState(null);
  const [success, setSuccess]       = useState(false);
  const [focused, setFocused]       = useState(null);
  const [mounted, setMounted]       = useState(false);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  const set = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
    setApiError(null);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())      e.name      = 'Name is required';
    if (!form.city.trim())      e.city      = 'City is required';
    if (!form.type)             e.type      = 'Type is required';
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (form.latitude === '' || isNaN(lat) || lat < -90  || lat > 90)   e.latitude  = 'Valid latitude between -90 and 90';
    else if (lat === 0)                                                e.latitude  = 'Latitude cannot be 0 — enter the real coordinate';
    if (form.longitude === ''|| isNaN(lng) || lng < -180 || lng > 180) e.longitude = 'Valid longitude between -180 and 180';
    else if (lng === 0)                                                e.longitude = 'Longitude cannot be 0 — enter the real coordinate';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true); setApiError(null);
    const payload = {
      name:      form.name.trim(),
      type:      form.type,
      city:      form.city.trim(),
      address:   form.address.trim() || null,
      latitude:  parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
    };

    try {
      let saved;
      if (isEdit) { const r = await updateCompany(company.id, payload); saved = r.data?.data; }
      else        { const r = await createCompany(payload);              saved = r.data?.data; }
      setSuccess(true);
      setTimeout(() => onSaved(saved ?? payload), 600);
    } catch (err) {
      const d = err?.response?.data;
      if (d?.errors) {
        const m = {};
        Object.entries(d.errors).forEach(([k, v]) => { m[k] = Array.isArray(v) ? v[0] : v; });
        setErrors(m);
      } else {
        setApiError(d?.message ?? 'Something went wrong. Please try again.');
      }
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative z-10 w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col"
        style={{
          maxHeight: '92vh',
          animation: mounted ? 'company-modal-in 0.22s cubic-bezier(0.34,1.2,0.64,1)' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes company-modal-in {
            from { opacity:0; transform: translateY(16px) scale(0.98) }
            to   { opacity:1; transform: translateY(0)    scale(1)    }
          }
        `}</style>

        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${COLORS.teal}14` }}>
              <Building2 size={16} color={COLORS.teal} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                {isEdit ? 'Edit Company' : 'Add Company'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEdit ? `Editing ${company.name}` : 'Create a new logistics partner'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <X size={15} />
          </button>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* name */}
          <Field label="Company Name" error={errors.name}>
            <input
              type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
              placeholder="e.g. Batamindo Industrial Estate"
              className={inputClass(!!errors.name, focused === 'name')}
            />
          </Field>

          {/* type + city in a row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Type" error={errors.type}>
              <div className="grid grid-cols-2 gap-2">
                {['internal', 'partner'].map((t) => (
                  <button
                    key={t} type="button" onClick={() => set('type', t)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all"
                    style={
                      form.type === t
                        ? { borderColor: t === 'internal' ? COLORS.navy : COLORS.teal, backgroundColor: t === 'internal' ? `${COLORS.navy}0D` : `${COLORS.teal}0D`, color: t === 'internal' ? COLORS.navy : COLORS.teal }
                        : { borderColor: '#E2E8F0', color: '#64748B' }
                    }
                  >
                    <Tag size={13} />
                    <span className="capitalize">{t}</span>
                    {form.type === t && <Check size={12} className="ml-auto" />}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="City" error={errors.city}>
              <div className="relative">
                <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text" value={form.city} onChange={(e) => set('city', e.target.value)}
                  onFocus={() => setFocused('city')} onBlur={() => setFocused(null)}
                  placeholder="e.g. Batam"
                  className={`${inputClass(!!errors.city, focused === 'city')} pl-9`}
                />
              </div>
            </Field>
          </div>

          {/* address */}
          <Field label="Address (optional)" error={errors.address}>
            <textarea
              value={form.address} onChange={(e) => set('address', e.target.value)}
              onFocus={() => setFocused('address')} onBlur={() => setFocused(null)}
              placeholder="Full street address…"
              rows={2}
              className={`${inputClass(!!errors.address, focused === 'address')} resize-none`}
            />
          </Field>

          {/* coordinates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Latitude" error={errors.latitude}>
              <div className="relative">
                <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number" step="any" value={form.latitude}
                  onChange={(e) => set('latitude', e.target.value)}
                  onFocus={() => setFocused('lat')} onBlur={() => setFocused(null)}
                  placeholder="1.1234567"
                  className={`${inputClass(!!errors.latitude, focused === 'lat')} pl-9 font-mono`}
                />
              </div>
            </Field>
            <Field label="Longitude" error={errors.longitude}>
              <div className="relative">
                <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number" step="any" value={form.longitude}
                  onChange={(e) => set('longitude', e.target.value)}
                  onFocus={() => setFocused('lng')} onBlur={() => setFocused(null)}
                  placeholder="104.0123456"
                  className={`${inputClass(!!errors.longitude, focused === 'lng')} pl-9 font-mono`}
                />
              </div>
            </Field>
          </div>

          {/* coordinate hint */}
          <p className="text-[11px] text-slate-400 -mt-1">
            Coordinates are used for route planning and distance calculations.
          </p>

          {apiError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700">
              <AlertCircle size={13} className="shrink-0" />{apiError}
            </div>
          )}
        </form>

        {/* footer */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all">
            Cancel
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSubmit}
            disabled={submitting || success}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ backgroundColor: success ? COLORS.green : COLORS.teal, boxShadow: `0 2px 8px ${COLORS.teal}40` }}
          >
            {success ? (
              <><Check size={15} />{isEdit ? 'Saved!' : 'Created!'}</>
            ) : submitting ? (
              <><Loader2 size={15} className="animate-spin" />Saving…</>
            ) : (
              isEdit ? 'Save Changes' : 'Add Company'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyFormModal;
