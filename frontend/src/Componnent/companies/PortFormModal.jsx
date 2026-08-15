import React, { useState, useEffect } from 'react';
import { X, Anchor, Globe, Hash, AlertCircle, Check, Loader2 } from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import { createPort, updatePort } from '../../api/portsApi';

/* ── constants ───────────────────────────────────────────────── */
const COUNTRY_OPTIONS = [
  { value: 'indonesia', label: 'Indonesia', flag: '🇮🇩' },
  { value: 'singapore', label: 'Singapore', flag: '🇸🇬' },
];

const ANIM = `
  @keyframes port-modal-in {
    from { opacity:0; transform: translateY(16px) scale(0.98) }
    to   { opacity:1; transform: translateY(0)    scale(1)    }
  }
`;

/* ── tiny helpers ────────────────────────────────────────────── */
const Field = ({ label, required, error, hint, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
    {hint && !error && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    {error && (
      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
        <AlertCircle size={11} />{error}
      </p>
    )}
  </div>
);

const inputCls = (err, focused) =>
  `w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-700 outline-none bg-white transition-all ${
    err     ? 'border-red-300 ring-2 ring-red-100'
    : focused ? 'border-slate-400 ring-2 ring-slate-100'
    : 'border-slate-200 hover:border-slate-300'
  }`;

/* ═══════════════════════════════════════════════════════════════ */
const PortFormModal = ({ mode, port, onClose, onSaved }) => {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    name:      port?.name      ?? '',
    country:   port?.country   ?? 'indonesia',
    unlocode:  port?.unlocode  ?? '',
    latitude:  port?.latitude  != null ? String(port.latitude)  : '',
    longitude: port?.longitude != null ? String(port.longitude) : '',
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
    if (!form.name.trim())    e.name    = 'Name is required';
    if (!form.country)        e.country = 'Country is required';
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (form.latitude === ''  || isNaN(lat) || lat < -90  || lat > 90)   e.latitude  = 'Valid latitude between -90 and 90';
    else if (lat === 0)                                                 e.latitude  = 'Latitude cannot be 0 — enter the real coordinate';
    if (form.longitude === '' || isNaN(lng) || lng < -180 || lng > 180) e.longitude = 'Valid longitude between -180 and 180';
    else if (lng === 0)                                                 e.longitude = 'Longitude cannot be 0 — enter the real coordinate';
    if (form.unlocode && !/^[A-Z]{2}[A-Z0-9]{3}$/i.test(form.unlocode.trim())) {
      e.unlocode = 'Must be 5 characters: 2-letter country code + 3 alphanumeric (e.g. IDBTH)';
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true); setApiError(null);
    const payload = {
      name:      form.name.trim(),
      country:   form.country,
      latitude:  parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      ...(form.unlocode.trim() ? { unlocode: form.unlocode.trim().toUpperCase() } : {}),
    };

    try {
      let saved;
      if (isEdit) { const r = await updatePort(port.id, payload); saved = r.data?.data; }
      else        { const r = await createPort(payload);           saved = r.data?.data; }
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

  const selectedCountry = COUNTRY_OPTIONS.find((c) => c.value === form.country);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <style>{ANIM}</style>

      <div
        className="relative z-10 w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh', animation: mounted ? 'port-modal-in 0.22s cubic-bezier(0.34,1.2,0.64,1)' : 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${COLORS.teal}14` }}>
              <Anchor size={16} color={COLORS.teal} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                {isEdit ? 'Edit Port' : 'Add Port'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEdit ? `Editing ${port.name}` : 'Register a new port location'}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <X size={15} />
          </button>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* name */}
          <Field label="Port Name" required error={errors.name}>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
              placeholder="e.g. Batu Ampar Port"
              className={inputCls(!!errors.name, focused === 'name')} />
          </Field>

          {/* country */}
          <Field label="Country" required error={errors.country}>
            <div className="grid grid-cols-2 gap-2">
              {COUNTRY_OPTIONS.map(({ value, label, flag }) => (
                <button key={value} type="button" onClick={() => set('country', value)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all"
                  style={
                    form.country === value
                      ? { borderColor: COLORS.teal, backgroundColor: `${COLORS.teal}0D`, color: COLORS.teal }
                      : { borderColor: '#E2E8F0', color: '#64748B' }
                  }>
                  <span className="text-lg leading-none">{flag}</span>
                  <span>{label}</span>
                  {form.country === value && <Check size={13} className="ml-auto" style={{ color: COLORS.teal }} />}
                </button>
              ))}
            </div>
          </Field>

          {/* unlocode */}
          <Field label="UNLOCODE" error={errors.unlocode}
            hint="Optional. 5-character UN/LOCODE (e.g. IDBTH, SGSIN)">
            <div className="relative">
              <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={form.unlocode}
                onChange={(e) => set('unlocode', e.target.value.toUpperCase())}
                onFocus={() => setFocused('unlocode')} onBlur={() => setFocused(null)}
                placeholder="IDBTH"
                maxLength={5}
                className={`${inputCls(!!errors.unlocode, focused === 'unlocode')} pl-9 font-mono uppercase`} />
            </div>
          </Field>

          {/* coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" required error={errors.latitude}>
              <div className="relative">
                <Globe size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="number" step="any" value={form.latitude}
                  onChange={(e) => set('latitude', e.target.value)}
                  onFocus={() => setFocused('lat')} onBlur={() => setFocused(null)}
                  placeholder="1.16713"
                  className={`${inputCls(!!errors.latitude, focused === 'lat')} pl-9 font-mono`} />
              </div>
            </Field>
            <Field label="Longitude" required error={errors.longitude}>
              <div className="relative">
                <Globe size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="number" step="any" value={form.longitude}
                  onChange={(e) => set('longitude', e.target.value)}
                  onFocus={() => setFocused('lng')} onBlur={() => setFocused(null)}
                  placeholder="103.99680"
                  className={`${inputCls(!!errors.longitude, focused === 'lng')} pl-9 font-mono`} />
              </div>
            </Field>
          </div>

          {/* country-aware hint */}
          {selectedCountry && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
              style={{ backgroundColor: `${COLORS.teal}08`, color: COLORS.teal }}>
              <span className="text-base leading-none">{selectedCountry.flag}</span>
              This port will be listed under{' '}
              <strong>{selectedCountry.label}</strong> and available for{' '}
              {form.country === 'indonesia' ? 'Batam-side' : 'Singapore-side'} trips.
            </div>
          )}

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
          <button type="submit" onClick={handleSubmit} disabled={submitting || success}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ backgroundColor: success ? COLORS.green : COLORS.teal, boxShadow: `0 2px 8px ${COLORS.teal}30` }}>
            {success   ? <><Check size={15} />{isEdit ? 'Saved!' : 'Added!'}</>
             : submitting ? <><Loader2 size={15} className="animate-spin" />Saving…</>
             : isEdit   ? 'Save Changes'
             : 'Add Port'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PortFormModal;
