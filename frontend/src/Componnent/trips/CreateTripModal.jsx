import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Plus, Route, Ship, Anchor, AlertCircle,
  Search, ChevronDown, Check, Loader2,
  MapPin, ArrowRight, Info, ShieldAlert,
} from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import { createTrip } from '../../api/tripsApi';
import axiosClient from '../../axios';

/* ── keyframes ───────────────────────────────────────────────── */
const KEYFRAMES = `
  @keyframes modal-backdrop-in { from{opacity:0} to{opacity:1} }
  @keyframes modal-slide-in    { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes dropdown-in       { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slide-left        { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
  @keyframes slide-right       { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:translateX(0)} }
  @keyframes fade-up           { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse-ring        { 0%,100%{box-shadow:0 0 0 0 rgba(42,111,138,0.18)} 50%{box-shadow:0 0 0 7px rgba(42,111,138,0)} }
  @keyframes shake             { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
`;

/* ── static port data ────────────────────────────────────────── */
const PORTS = [
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
const companyRegion = (c) => {
  if (!c) return null;
  const city = (c.city ?? '').toLowerCase();
  if (city.includes('singapore') || city.includes('singapura')) return 'singapore';
  return 'batam'; // everything else (Batam, any Indonesian city) → batam
};
const portRegion = (p) => p?.region ?? null;

/* ── cross-field validation ──────────────────────────────────── */
// Returns null if valid, or an error string if not.
// `meta` = { id, region } objects for origin and destination
const validateCombo = (comboKey, originMeta, destMeta) => {
  if (!originMeta || !destMeta) return null; // incomplete — caught by required check

  /* 1. Same entity */
  if (originMeta.id === destMeta.id) {
    return 'Origin and destination cannot be the same.';
  }

  if (comboKey === 'domestic') {
    /* 2. Domestic: both must be in the same region */
    if (originMeta.region !== destMeta.region) {
      return `For domestic trips, both companies must be in the same region (${originMeta.region}). Switch to Cross-border for inter-region trips.`;
    }
  }

  if (comboKey === 'cross_border') {
    /* 3. Cross-border: truck port must be in SAME region as origin company */
    if (originMeta.region !== destMeta.truckPortRegion) {
      return `The truck destination port must be in the same region as the origin company (${originMeta.region}).`;
    }
    /* 4. Ship port must be in the OTHER region */
    if (destMeta.shipPortRegion && originMeta.region === destMeta.shipPortRegion) {
      return `The ship destination port must be in a different region than the origin company.`;
    }
  }

  if (comboKey === 'port_to_company') {
    /* 5. Port → Company: port and company must be in the SAME region */
    if (originMeta.region !== destMeta.region) {
      return `The origin port and destination company must be in the same region. Use Cross-border for inter-region trips.`;
    }
  }

  return null;
};

/* ── combo types ─────────────────────────────────────────────── */
const COMBO_TYPES = [
  {
    key: 'domestic',
    label: 'Domestic',
    desc: 'Company → Company',
    sub: 'Delivery within the same city',
    icon: Route,
    color: COLORS.navy,
    fields: [
      { key: 'origin_company_id',      type: 'company', label: 'Origin Company',      placeholder: 'Select origin company' },
      { key: 'destination_company_id', type: 'company', label: 'Destination Company', placeholder: 'Select destination company' },
    ],
  },
  {
    key: 'cross_border',
    label: 'Cross-border',
    desc: 'Company → Port → Ship Port',
    sub: 'Batam ↔ Singapore via vessel',
    icon: Ship,
    color: COLORS.teal,
    fields: [
      { key: 'origin_company_id',        type: 'company', label: 'Origin Company',         placeholder: 'Select origin company' },
      { key: 'destination_port_id',      type: 'port',    label: 'Truck Destination Port', placeholder: 'Select truck destination port' },
      { key: 'ship_destination_port_id', type: 'port',    label: 'Ship Destination Port',  placeholder: 'Select ship destination port' },
    ],
  },
  {
    key: 'port_to_company',
    label: 'Port → Company',
    desc: 'Port → Company',
    sub: 'Goods arriving from a port',
    icon: Anchor,
    color: COLORS.aqua,
    fields: [
      { key: 'origin_port_id',         type: 'port',    label: 'Origin Port',         placeholder: 'Select origin port' },
      { key: 'destination_company_id', type: 'company', label: 'Destination Company', placeholder: 'Select destination company' },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   Portal dropdown
═══════════════════════════════════════════════════════════════ */
const DropdownPortal = ({ triggerRef, open, children }) => {
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
const LockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   Company dropdown
   Extra props:
     disabledIds  – Set of company IDs that should be greyed-out/unselectable
     allowedRegion – if set, only show companies in this region
═══════════════════════════════════════════════════════════════ */
const CompanyDropdown = ({
  label, placeholder, value, onChange, onSelectMeta,
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

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    if (!fetched) { setFetched(true); fetchCompanies(''); }
  };

  const handleSelect = (company) => {
    onChange(company.id);
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
            ) : placeholder}
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
   Extra props:
     allowedRegion  – if set, mark incompatible ports as greyed-out
     disabledIds    – Set of port IDs to block (same entity guard)
═══════════════════════════════════════════════════════════════ */
const PortDropdown = ({
  label, placeholder, value, onChange, onSelectMeta,
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
    onChange(port.id);
    onSelectMeta?.({ id: port.id, region: portRegion(port), name: port.name });
    setOpen(false);
  };

  return (
    <div ref={containerRef}>
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
            {selected ? <>{selected.flag} {selected.name}</> : placeholder}
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

/* ═══════════════════════════════════════════════════════════════
   Main modal
═══════════════════════════════════════════════════════════════ */
const CreateTripModal = ({ onClose, onCreated }) => {
  const [step, setStep]             = useState(1);
  const [comboType, setComboType]   = useState(null);
  const [formData, setFormData]     = useState({});   // key → numeric ID
  const [metaData, setMetaData]     = useState({});   // key → { id, region, name, city? }
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]     = useState(null);
  const [mounted, setMounted]       = useState(false);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  const activeCombo = COMBO_TYPES.find((c) => c.key === comboType);

  const pickType = (key) => { setComboType(key); setFormData({}); setMetaData({}); setErrors({}); setApiError(null); setStep(2); };
  const goBack   = () => { setStep(1); setErrors({}); setApiError(null); };

  /* ── field change: save both ID and meta, then re-validate cross-field ── */
  const handleFieldChange = (fieldKey, id, meta) => {
    const nextData = { ...formData, [fieldKey]: id };
    const nextMeta = { ...metaData, [fieldKey]: meta };

    // Clear any downstream fields that may now be invalid
    // e.g. if origin changes, destination might be wrong region
    const fieldIndex = activeCombo.fields.findIndex((f) => f.key === fieldKey);
    activeCombo.fields.slice(fieldIndex + 1).forEach(({ key }) => {
      delete nextData[key];
      delete nextMeta[key];
    });

    setFormData(nextData);
    setMetaData(nextMeta);
    setErrors((prev) => {
      const cleared = { ...prev };
      // clear this field and all downstream
      activeCombo.fields.slice(fieldIndex).forEach(({ key }) => { delete cleared[key]; });
      delete cleared['_combo'];
      return cleared;
    });
  };

  /* ── compute allowed region per field (for filtering) ── */
  const getAllowedRegion = (fieldKey) => {
    if (!activeCombo) return null;

    if (comboType === 'domestic') {
      // destination must match origin's region
      if (fieldKey === 'destination_company_id') {
        return metaData['origin_company_id']?.region ?? null;
      }
    }
    if (comboType === 'cross_border') {
      // truck port must be same region as origin company
      if (fieldKey === 'destination_port_id') {
        return metaData['origin_company_id']?.region ?? null;
      }
      // ship port must be OPPOSITE region to origin company
      if (fieldKey === 'ship_destination_port_id') {
        const originRegion = metaData['origin_company_id']?.region;
        if (!originRegion) return null;
        return originRegion === 'batam' ? 'singapore' : 'batam';
      }
    }
    if (comboType === 'port_to_company') {
      // company must be same region as port
      if (fieldKey === 'destination_company_id') {
        return metaData['origin_port_id']?.region ?? null;
      }
    }
    return null;
  };

  /* ── blocked IDs per field ── */
  const getDisabledIds = (fieldKey) => {
    const blocked = new Set();
    if (comboType === 'domestic') {
      // origin and destination can't be the same company
      if (fieldKey === 'destination_company_id' && formData['origin_company_id']) {
        blocked.add(formData['origin_company_id']);
      }
    }
    if (comboType === 'cross_border') {
      // truck port and ship port can't be the same
      if (fieldKey === 'ship_destination_port_id' && formData['destination_port_id']) {
        blocked.add(formData['destination_port_id']);
      }
    }
    if (comboType === 'port_to_company') {
      // no same-entity risk (port ≠ company type), nothing to block
    }
    return blocked;
  };

  /* ── validate all fields before submit ── */
  const validate = () => {
    const errs = {};

    // Required check
    activeCombo.fields.forEach(({ key }) => { if (!formData[key]) errs[key] = 'Required'; });
    if (Object.keys(errs).length) return errs;

    // Cross-field checks per combo type
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
        errs['ship_destination_port_id'] = `Ship destination port must be in a different region than the origin company.`;
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

  /* ── route preview labels ── */
  const previewLabel = (f) => {
    if (!formData[f.key]) return f.label;
    return metaData[f.key]?.name ?? `ID ${formData[f.key]}`;
  };

  /* ── is form ready to submit ── */
  const allFilled = activeCombo?.fields.every(({ key }) => !!formData[key]) ?? false;

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
                  {step === 1 ? 'New Trip' : `${activeCombo?.label} Trip`}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {step === 1 ? 'Select a route type to get started' : activeCombo?.sub}
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
                {COMBO_TYPES.map(({ key, label, desc, sub, icon: Icon, color }, i) => (
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
                  style={{ backgroundColor: `${activeCombo.color}0E`, color: activeCombo.color }}>
                  <activeCombo.icon size={13} />
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
                          onChange={(id) => {}} // handled via onSelectMeta
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
                          onChange={(id) => {}} // handled via onSelectMeta
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

                {/* combo-level validation error */}
                {errors['_combo'] && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-700"
                    style={{ animation: 'shake 0.4s ease-out' }}>
                    <ShieldAlert size={13} className="shrink-0" />{errors['_combo']}
                  </div>
                )}

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
