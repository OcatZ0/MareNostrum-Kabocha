import React, { useState, useEffect } from 'react';
import {
  X, Plus, Route, Ship, Anchor, AlertCircle,
  ArrowRight, Info, Loader2,
} from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import { createTrip } from '../../api/tripsApi';
import { useRouteComboForm, CompanyDropdown, PortDropdown } from './routeCombo';

/* ── keyframes ───────────────────────────────────────────────── */
const KEYFRAMES = `
  @keyframes modal-backdrop-in { from{opacity:0} to{opacity:1} }
  @keyframes modal-slide-in    { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes slide-left        { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
  @keyframes slide-right       { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:translateX(0)} }
  @keyframes fade-up           { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse-ring        { 0%,100%{box-shadow:0 0 0 0 rgba(42,111,138,0.18)} 50%{box-shadow:0 0 0 7px rgba(42,111,138,0)} }
`;

/* ── step-1 picker presentation (icon/color/description) — the underlying
   field definitions themselves come from the shared routeCombo module ── */
const COMBO_PRESENTATION = {
  domestic:        { label: 'Domestic',        desc: 'Company → Company',         sub: 'Delivery within the same city',    icon: Route,  color: COLORS.navy },
  cross_border:    { label: 'Cross-border',    desc: 'Company → Port → Ship Port', sub: 'Batam ↔ Singapore via vessel',      icon: Ship,   color: COLORS.teal },
  port_to_company: { label: 'Port → Company',  desc: 'Port → Company',             sub: 'Goods arriving from a port',        icon: Anchor, color: COLORS.aqua },
};

/* ═══════════════════════════════════════════════════════════════
   Main modal
═══════════════════════════════════════════════════════════════ */
const CreateTripModal = ({ onClose, onCreated }) => {
  const [step, setStep]             = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]     = useState(null);
  const [mounted, setMounted]       = useState(false);

  const {
    comboType, setComboType, activeCombo,
    formData, errors, setErrors,
    handleFieldChange, getAllowedRegion, getDisabledIds, validate, previewLabel, allFilled,
  } = useRouteComboForm();

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  const presentation = comboType ? COMBO_PRESENTATION[comboType] : null;

  const pickType = (key) => { setComboType(key); setStep(2); setApiError(null); };
  const goBack   = () => { setStep(1); setApiError(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true); setApiError(null);
    const payload = {};
    activeCombo.fields.forEach(({ key }) => { payload[key] = Number(formData[key]); });

    try {
      const res = await createTrip(payload);
      onCreated(res.data?.data);
    } catch (err) {
      const d = err?.response?.data;
      if (d?.errors) {
        const m = {};
        Object.entries(d.errors).forEach(([k, v]) => { m[k] = Array.isArray(v) ? v[0] : v; });
        setErrors(m);
      } else {
        setApiError(d?.message ?? 'Failed to create trip. Please try again.');
      }
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ zIndex: 9990, animation: 'modal-backdrop-in 0.2s ease-out' }}>
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col"
          style={{ zIndex: 9991, animation: mounted ? 'modal-slide-in 0.25s cubic-bezier(0.34,1.56,0.64,1)' : 'none', maxHeight: '92vh' }}
          onClick={(e) => e.stopPropagation()}>

          {/* header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0 rounded-t-2xl">
            <div className="flex items-center gap-3">
              {step === 2 && (
                <button type="button" onClick={goBack}
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all"
                  style={{ animation: 'fade-up 0.2s ease-out' }}>
                  <ArrowRight size={14} className="rotate-180" />
                </button>
              )}
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  {step === 1 ? 'New Trip' : `${presentation?.label} Trip`}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {step === 1 ? 'Select a route type to get started' : presentation?.sub}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                {[1, 2].map((s) => (
                  <div key={s} className="rounded-full transition-all duration-300"
                    style={{ width: step === s ? 18 : 6, height: 6, backgroundColor: step >= s ? COLORS.teal : '#E2E8F0' }} />
                ))}
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* body */}
          <div className="flex-1 overflow-y-auto">
            {/* STEP 1 — pick type */}
            {step === 1 && (
              <div className="p-5 space-y-3" style={{ animation: 'slide-right 0.2s ease-out' }}>
                <p className="text-xs text-slate-400">Each type defines the allowed origin and destination combination.</p>
                {Object.entries(COMBO_PRESENTATION).map(([key, { label, desc, sub, icon: Icon, color }], i) => (
                  <button key={key} type="button" onClick={() => pickType(key)}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border border-slate-200 text-left hover:border-slate-300 hover:shadow-sm transition-all duration-150 group"
                    style={{ animation: `fade-up 0.2s ease-out ${i * 60}ms both` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110" style={{ backgroundColor: `${color}14` }}>
                      <Icon size={18} color={color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 italic">{sub}</p>
                    </div>
                    <ArrowRight size={15} className="text-slate-300 shrink-0 transition-all duration-150 group-hover:text-slate-500 group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            )}

            {/* STEP 2 — fill fields */}
            {step === 2 && activeCombo && (
              <form id="create-trip-form" onSubmit={handleSubmit} className="p-5 space-y-4" style={{ animation: 'slide-left 0.22s ease-out' }}>

                {/* route preview chip */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium flex-wrap"
                  style={{ backgroundColor: `${presentation.color}0E`, color: presentation.color }}>
                  <presentation.icon size={13} />
                  {activeCombo.fields.map((f, i) => (
                    <React.Fragment key={f.key}>
                      <span className={!formData[f.key] ? 'opacity-50' : ''}>{previewLabel(f)}</span>
                      {i < activeCombo.fields.length - 1 && <ArrowRight size={11} className="opacity-50 shrink-0" />}
                    </React.Fragment>
                  ))}
                </div>

                {/* dynamic fields */}
                {activeCombo.fields.map(({ key, type, label, placeholder }, i) => {
                  const isPrevEmpty = activeCombo.fields.slice(0, i).some(({ key: k }) => !formData[k]);
                  const allowedRegion = getAllowedRegion(key);
                  const blockedIds    = getDisabledIds(key);

                  return (
                    <div key={key} style={{ animation: `fade-up 0.2s ease-out ${i * 80}ms both` }}>
                      {type === 'company' ? (
                        <CompanyDropdown
                          label={label} placeholder={placeholder}
                          value={formData[key] ?? null}
                          onSelectMeta={(meta) => handleFieldChange(key, meta.id, meta)}
                          error={errors[key]}
                          disabled={isPrevEmpty}
                          allowedRegion={allowedRegion}
                          disabledIds={blockedIds}
                        />
                      ) : (
                        <PortDropdown
                          label={label} placeholder={placeholder}
                          value={formData[key] ?? null}
                          onSelectMeta={(meta) => handleFieldChange(key, meta.id, meta)}
                          error={errors[key]}
                          disabled={isPrevEmpty}
                          allowedRegion={allowedRegion}
                          disabledIds={blockedIds}
                        />
                      )}
                    </div>
                  );
                })}

                {/* region rule hint */}
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-xs text-slate-500"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', animation: 'fade-up 0.2s ease-out 0.25s both' }}>
                  <Info size={13} className="shrink-0 mt-0.5" style={{ color: COLORS.teal }} />
                  <span>
                    {comboType === 'domestic' && 'Both companies must be in the same region (both Batam or both Singapore). '}
                    {comboType === 'cross_border' && 'Truck port: same region as origin. Ship port: opposite region (the crossing). '}
                    {comboType === 'port_to_company' && 'Origin port and destination company must be in the same region. '}
                    Trip is created as <strong className="text-slate-700">draft</strong>. Continue to <strong className="text-slate-700">Recommend</strong> → <strong className="text-slate-700">Assign</strong>.
                  </span>
                </div>

                {apiError && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700"
                    style={{ animation: 'fade-up 0.15s ease-out' }}>
                    <AlertCircle size={13} className="shrink-0" />{apiError}
                  </div>
                )}
              </form>
            )}
          </div>

          {/* footer */}
          <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all">
              Cancel
            </button>
            {step === 2 && (
              <button type="submit" form="create-trip-form" disabled={submitting || !allFilled}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: COLORS.teal,
                  boxShadow: (submitting || !allFilled) ? 'none' : `0 2px 8px ${COLORS.teal}40`,
                  animation: allFilled && !submitting ? 'pulse-ring 2s ease-in-out infinite' : 'none',
                }}>
                {submitting
                  ? <><Loader2 size={15} className="animate-spin" />Saving…</>
                  : <><Plus size={15} />Create Trip</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateTripModal;
