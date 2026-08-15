import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, Loader2, MapPin } from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import axiosClient from '../../axios';

// CompanyDropdown/PortDropdown animate with these — injected by each dropdown
// itself (not relying on the parent modal to define them) since both
// CreateTripModal and TripDetailModal render these components and only
// CreateTripModal happened to already define matching keyframes locally.
const DROPDOWN_KEYFRAMES = `
  @keyframes dropdown-in { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fade-up     { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
`;

/**
 * Shared between CreateTripModal (new trip, step 2) and TripDetailModal's
 * Edit Route tab — same origin/destination dropdown UX and region-matching
 * rules in both places (PRD Bagian 5.1 combo validation), so a trip created
 * via one flow looks and behaves identically when edited via the other.
 */

/* ── static port data ────────────────────────────────────────── */
export const PORTS = [
  { id: 1, name: 'Batu Ampar Port',            country: 'indonesia', region: 'batam',     flag: '🇮🇩' },
  { id: 2, name: 'Batam Centre Ferry Terminal', country: 'indonesia', region: 'batam',     flag: '🇮🇩' },
  { id: 3, name: 'Sekupang Port',               country: 'indonesia', region: 'batam',     flag: '🇮🇩' },
  { id: 4, name: 'Port of Singapore (PSA)',      country: 'singapore', region: 'singapore', flag: '🇸🇬' },
  { id: 5, name: 'Jurong Port',                 country: 'singapore', region: 'singapore', flag: '🇸🇬' },
  { id: 6, name: 'Tuas Port',                   country: 'singapore', region: 'singapore', flag: '🇸🇬' },
  { id: 7, name: 'Sembawang Wharves',           country: 'singapore', region: 'singapore', flag: '🇸🇬' },
];

/* ── region helpers ──────────────────────────────────────────── */
// Companies use `city` field; normalise to 'batam' or 'singapore'
export const companyRegion = (c) => {
  if (!c) return null;
  const city = (c.city ?? '').toLowerCase();
  if (city.includes('singapore') || city.includes('singapura')) return 'singapore';
  return 'batam'; // everything else (Batam, any Indonesian city) → batam
};
export const portRegion = (p) => p?.region ?? null;

/* ── combo field definitions (shared shape, no icon/color — those are
   CreateTripModal-only, used for the step-1 type picker) ────────── */
export const COMBO_TYPES = [
  {
    key: 'domestic',
    label: 'Domestic',
    fields: [
      { key: 'origin_company_id',      type: 'company', label: 'Origin Company',      placeholder: 'Select origin company' },
      { key: 'destination_company_id', type: 'company', label: 'Destination Company', placeholder: 'Select destination company' },
    ],
  },
  {
    key: 'cross_border',
    label: 'Cross-border',
    fields: [
      { key: 'origin_company_id',        type: 'company', label: 'Origin Company',         placeholder: 'Select origin company' },
      { key: 'destination_port_id',      type: 'port',    label: 'Truck Destination Port', placeholder: 'Select truck destination port' },
      { key: 'ship_destination_port_id', type: 'port',    label: 'Ship Destination Port',  placeholder: 'Select ship destination port' },
    ],
  },
  {
    key: 'port_to_company',
    label: 'Port → Company',
    fields: [
      { key: 'origin_port_id',         type: 'port',    label: 'Origin Port',         placeholder: 'Select origin port' },
      { key: 'destination_company_id', type: 'company', label: 'Destination Company', placeholder: 'Select destination company' },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   useRouteComboForm — comboType/formData/metaData state + the region
   filtering/blocking/validation rules, shared so both modals apply the
   exact same combo rules instead of drifting apart over time.
═══════════════════════════════════════════════════════════════ */
export const useRouteComboForm = (initialComboType = null, initialFormData = {}, initialMetaData = {}) => {
  const [comboType, setComboType] = useState(initialComboType);
  const [formData, setFormData]   = useState(initialFormData);
  const [metaData, setMetaData]   = useState(initialMetaData);
  const [errors, setErrors]       = useState({});

  const activeCombo = COMBO_TYPES.find((c) => c.key === comboType);

  const resetTo = (key) => { setComboType(key); setFormData({}); setMetaData({}); setErrors({}); };

  const handleFieldChange = (fieldKey, id, meta) => {
    const nextData = { ...formData, [fieldKey]: id };
    const nextMeta = { ...metaData, [fieldKey]: meta };

    // Clear any downstream fields that may now be invalid (e.g. origin
    // changes → destination might now be in the wrong region).
    const fieldIndex = activeCombo.fields.findIndex((f) => f.key === fieldKey);
    activeCombo.fields.slice(fieldIndex + 1).forEach(({ key }) => {
      delete nextData[key];
      delete nextMeta[key];
    });

    setFormData(nextData);
    setMetaData(nextMeta);
    setErrors((prev) => {
      const cleared = { ...prev };
      activeCombo.fields.slice(fieldIndex).forEach(({ key }) => { delete cleared[key]; });
      return cleared;
    });
  };

  const getAllowedRegion = (fieldKey) => {
    if (!activeCombo) return null;
    if (comboType === 'domestic' && fieldKey === 'destination_company_id') {
      return metaData['origin_company_id']?.region ?? null;
    }
    if (comboType === 'cross_border') {
      if (fieldKey === 'destination_port_id') return metaData['origin_company_id']?.region ?? null;
      if (fieldKey === 'ship_destination_port_id') {
        const originRegion = metaData['origin_company_id']?.region;
        return originRegion ? (originRegion === 'batam' ? 'singapore' : 'batam') : null;
      }
    }
    if (comboType === 'port_to_company' && fieldKey === 'destination_company_id') {
      return metaData['origin_port_id']?.region ?? null;
    }
    return null;
  };

  const getDisabledIds = (fieldKey) => {
    const blocked = new Set();
    if (comboType === 'domestic' && fieldKey === 'destination_company_id' && formData['origin_company_id']) {
      blocked.add(formData['origin_company_id']);
    }
    if (comboType === 'cross_border' && fieldKey === 'ship_destination_port_id' && formData['destination_port_id']) {
      blocked.add(formData['destination_port_id']);
    }
    return blocked;
  };

  const validate = () => {
    const errs = {};
    activeCombo.fields.forEach(({ key }) => { if (!formData[key]) errs[key] = 'Required'; });
    if (Object.keys(errs).length) return errs;

    if (comboType === 'domestic') {
      const originMeta = metaData['origin_company_id'];
      const destMeta   = metaData['destination_company_id'];
      if (originMeta?.id === destMeta?.id) {
        errs['destination_company_id'] = 'Origin and destination cannot be the same company.';
      } else if (originMeta?.region !== destMeta?.region) {
        errs['destination_company_id'] = `Both companies must be in the same region. Origin is in ${originMeta?.region ?? '?'} — select a company there, or switch to Cross-border.`;
      }
    }

    if (comboType === 'cross_border') {
      const originRegion    = metaData['origin_company_id']?.region;
      const truckPortRegion = metaData['destination_port_id']?.region;
      const shipPortRegion  = metaData['ship_destination_port_id']?.region;

      if (originRegion && truckPortRegion && originRegion !== truckPortRegion) {
        errs['destination_port_id'] = `Truck destination port must be in the same region as the origin company (${originRegion}).`;
      }
      if (originRegion && shipPortRegion && originRegion === shipPortRegion) {
        errs['ship_destination_port_id'] = 'Ship destination port must be in a different region than the origin company.';
      }
      if (metaData['destination_port_id']?.id === metaData['ship_destination_port_id']?.id) {
        errs['ship_destination_port_id'] = 'Ship destination port cannot be the same as the truck destination port.';
      }
    }

    if (comboType === 'port_to_company') {
      const portRegion_    = metaData['origin_port_id']?.region;
      const companyRegion_ = metaData['destination_company_id']?.region;
      if (portRegion_ && companyRegion_ && portRegion_ !== companyRegion_) {
        errs['destination_company_id'] = `Destination company must be in the same region as the origin port (${portRegion_}).`;
      }
    }

    return errs;
  };

  const previewLabel = (f) => {
    if (!formData[f.key]) return f.label;
    return metaData[f.key]?.name ?? `ID ${formData[f.key]}`;
  };

  const allFilled = activeCombo?.fields.every(({ key }) => !!formData[key]) ?? false;

  return {
    comboType, setComboType: resetTo, activeCombo,
    formData, metaData, setMetaData, errors, setErrors,
    handleFieldChange, getAllowedRegion, getDisabledIds, validate, previewLabel, allFilled,
  };
};

/* ═══════════════════════════════════════════════════════════════
   Portal dropdown
═══════════════════════════════════════════════════════════════ */
export const DropdownPortal = ({ triggerRef, open, children }) => {
  const [style, setStyle] = useState({});

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const reposition = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropHeight = 280;
      if (spaceBelow < dropHeight && spaceAbove > spaceBelow) {
        setStyle({ position: 'fixed', left: rect.left, bottom: window.innerHeight - rect.top + 4, width: rect.width, zIndex: 9999 });
      } else {
        setStyle({ position: 'fixed', left: rect.left, top: rect.bottom + 4, width: rect.width, zIndex: 9999 });
      }
    };
    reposition();
    window.addEventListener('resize', reposition, { passive: true });
    window.addEventListener('scroll', reposition, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, { capture: true });
    };
  }, [open, triggerRef]);

  if (!open) return null;
  return createPortal(<div style={style}>{children}</div>, document.body);
};

/* ── lock icon SVG ───────────────────────────────────────────── */
export const LockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   Company dropdown
═══════════════════════════════════════════════════════════════ */
export const CompanyDropdown = ({
  label, placeholder, value, onSelectMeta,
  error, disabled, disabledIds = new Set(), allowedRegion = null,
}) => {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [selectedCity, setSelectedCity]   = useState(null);

  const triggerRef   = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const panel = document.getElementById('company-dp-' + label);
      if (containerRef.current && !containerRef.current.contains(e.target) && !(panel && panel.contains(e.target))) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, label]);

  const fetchCompanies = useCallback(async (search = '') => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/api/companies', { params: { per_page: 100, ...(search ? { search } : {}) } });
      setOptions(res.data?.data ?? []);
    } catch (_) { setOptions([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchCompanies(query), 300);
    return () => clearTimeout(t);
  }, [query, open, fetchCompanies]);

  // If we're handed an initial value (editing an existing trip) but haven't
  // fetched/selected a label yet, fetch once quietly so the button shows the
  // company's name instead of just its bare ID.
  useEffect(() => {
    if (value && !selectedLabel && !fetched) {
      setFetched(true);
      (async () => {
        try {
          const res = await axiosClient.get('/api/companies', { params: { per_page: 100 } });
          const match = (res.data?.data ?? []).find((c) => c.id === value);
          if (match) { setSelectedLabel(match.name); setSelectedCity(match.city); }
        } catch (_) {}
      })();
    }
  }, [value, selectedLabel, fetched]);

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    if (!fetched) { setFetched(true); fetchCompanies(''); }
  };

  const handleSelect = (company) => {
    onSelectMeta?.({ id: company.id, region: companyRegion(company), city: company.city, name: company.name });
    setSelectedLabel(company.name);
    setSelectedCity(company.city);
    setOpen(false);
    setQuery('');
  };

  // Filter options: hide region-incompatible companies
  const visible = options.filter((c) => {
    if (!allowedRegion) return true;
    return companyRegion(c) === allowedRegion;
  });

  return (
    <div ref={containerRef}>
      <style>{DROPDOWN_KEYFRAMES}</style>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide transition-colors"
        style={{ color: disabled ? '#CBD5E1' : '#64748B' }}>
        {label}
      </label>
      <div className="relative" title={disabled ? 'Select the previous field first' : undefined}>
        <button ref={triggerRef} type="button" onClick={handleOpen} disabled={disabled}
          className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-sm text-left transition-all duration-150 ${
            disabled ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'
            : error ? 'bg-white border-red-300 ring-2 ring-red-100'
            : open ? 'bg-white border-slate-400 ring-2 ring-slate-100'
            : 'bg-white border-slate-200 hover:border-slate-300'
          }`}>
          <span className={value && selectedLabel ? 'text-slate-800 font-medium flex items-center gap-2 min-w-0' : disabled ? 'text-slate-300' : 'text-slate-400'}>
            {value && selectedLabel ? (
              <>
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: COLORS.teal }}>
                  {selectedLabel[0]}
                </span>
                <span className="truncate">{selectedLabel}</span>
                {selectedCity && <span className="text-xs text-slate-400 shrink-0">{selectedCity}</span>}
              </>
            ) : (value && !selectedLabel ? `ID ${value}` : placeholder)}
          </span>
          <ChevronDown size={15} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${disabled ? 'text-slate-300' : 'text-slate-400'}`} />
        </button>
        {disabled && <div className="absolute inset-0 flex items-center justify-end pr-3.5 pointer-events-none"><LockIcon /></div>}
      </div>
      {error && !disabled && <p className="mt-1 text-xs text-red-500" style={{ animation: 'fade-up 0.15s ease-out' }}>{error}</p>}

      <DropdownPortal triggerRef={triggerRef} open={open}>
        <div id={`company-dp-${label}`} className="bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden" style={{ animation: 'dropdown-in 0.15s ease-out' }}>
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or city…"
              className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 outline-none bg-transparent" />
            {loading && <Loader2 size={13} className="animate-spin text-slate-400 shrink-0" />}
          </div>
          {allowedRegion && (
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${COLORS.teal}14`, color: COLORS.teal }}>
                Showing: {allowedRegion === 'batam' ? '🇮🇩 Batam' : '🇸🇬 Singapore'} only
              </span>
            </div>
          )}
          <ul className="max-h-48 overflow-y-auto">
            {!loading && visible.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400 text-center">No compatible companies</li>
            )}
            {visible.map((company) => {
              const isBlocked = disabledIds.has(company.id);
              return (
                <li key={company.id}>
                  <button type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => !isBlocked && handleSelect(company)}
                    disabled={isBlocked}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${isBlocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                    title={isBlocked ? 'Same as origin — choose a different company' : undefined}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: company.type === 'internal' ? COLORS.navy : COLORS.teal }}>
                      {company.name[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{company.name}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} />{company.city}
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ backgroundColor: company.type === 'internal' ? `${COLORS.navy}14` : `${COLORS.teal}14`, color: company.type === 'internal' ? COLORS.navy : COLORS.teal }}>
                          {company.type}
                        </span>
                      </p>
                    </div>
                    {value === company.id && <Check size={14} color={COLORS.green} className="shrink-0" />}
                    {isBlocked && <LockIcon />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </DropdownPortal>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Port dropdown
═══════════════════════════════════════════════════════════════ */
export const PortDropdown = ({
  label, placeholder, value, onSelectMeta,
  error, disabled, allowedRegion = null, disabledIds = new Set(),
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef   = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const panel = document.getElementById('port-dp-' + label);
      if (containerRef.current && !containerRef.current.contains(e.target) && !(panel && panel.contains(e.target))) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, label]);

  const selected = PORTS.find((p) => p.id === value) ?? null;

  const handleSelect = (port) => {
    onSelectMeta?.({ id: port.id, region: portRegion(port), name: port.name });
    setOpen(false);
  };

  return (
    <div ref={containerRef}>
      <style>{DROPDOWN_KEYFRAMES}</style>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide transition-colors"
        style={{ color: disabled ? '#CBD5E1' : '#64748B' }}>
        {label}
      </label>
      <div className="relative" title={disabled ? 'Select the previous field first' : undefined}>
        <button ref={triggerRef} type="button" onClick={() => !disabled && setOpen((v) => !v)} disabled={disabled}
          className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-sm text-left transition-all duration-150 ${
            disabled ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'
            : error ? 'bg-white border-red-300 ring-2 ring-red-100'
            : open ? 'bg-white border-slate-400 ring-2 ring-slate-100'
            : 'bg-white border-slate-200 hover:border-slate-300'
          }`}>
          <span className={selected ? 'text-slate-800 font-medium flex items-center gap-2' : disabled ? 'text-slate-300' : 'text-slate-400'}>
            {selected ? <>{selected.flag} {selected.name}</> : (value && !selected ? `ID ${value}` : placeholder)}
          </span>
          <ChevronDown size={15} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${disabled ? 'text-slate-300' : 'text-slate-400'}`} />
        </button>
        {disabled && <div className="absolute inset-0 flex items-center justify-end pr-3.5 pointer-events-none"><LockIcon /></div>}
      </div>
      {error && !disabled && <p className="mt-1 text-xs text-red-500" style={{ animation: 'fade-up 0.15s ease-out' }}>{error}</p>}

      <DropdownPortal triggerRef={triggerRef} open={open}>
        <div id={`port-dp-${label}`} className="bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden" style={{ animation: 'dropdown-in 0.15s ease-out' }}>
          {allowedRegion && (
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${COLORS.teal}14`, color: COLORS.teal }}>
                Showing: {allowedRegion === 'batam' ? '🇮🇩 Batam' : '🇸🇬 Singapore'} only
              </span>
            </div>
          )}
          <ul className="max-h-52 overflow-y-auto py-1">
            {PORTS.map((port) => {
              const isBlocked    = disabledIds.has(port.id);
              const isWrongRegion = allowedRegion && portRegion(port) !== allowedRegion;
              const dimmed = isBlocked || isWrongRegion;
              return (
                <li key={port.id}>
                  <button type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => !dimmed && handleSelect(port)}
                    disabled={dimmed}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${dimmed ? 'opacity-35 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                    title={isWrongRegion ? `Must be in same region as origin — switch to ${allowedRegion === 'batam' ? 'Batam' : 'Singapore'} ports` : isBlocked ? 'Already selected' : undefined}>
                    <span className="text-lg leading-none shrink-0">{port.flag}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{port.name}</p>
                      <p className="text-xs text-slate-400 capitalize">{port.country}</p>
                    </div>
                    {value === port.id && <Check size={14} color={COLORS.green} className="shrink-0" />}
                    {isWrongRegion && (
                      <span className="text-[10px] text-slate-300 shrink-0">wrong region</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </DropdownPortal>
    </div>
  );
};
