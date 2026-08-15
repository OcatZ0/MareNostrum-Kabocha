import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Anchor, Plus, Search, RefreshCw,
  ChevronLeft, ChevronRight, Edit2, Trash2, MapPin,
} from 'lucide-react';
import DashboardSidebar from '../Componnent/dashboard/DashboardSidebar';
import DashboardTopbar from '../Componnent/dashboard/DashboardTopbar';
import { COLORS } from '../Componnent/dashboard/dashboardTheme';
import { getCompanies, deleteCompany } from '../api/companiesApi';
import { getPorts, deletePort } from '../api/portsApi';
import CompanyFormModal from '../Componnent/companies/CompanyFormModal';
import PortFormModal from '../Componnent/companies/PortFormModal';
import DeleteConfirmModal from '../Componnent/companies/DeleteConfirmModal';

/* ── page-level animation keyframes ─────────────────────────── */
const ANIM = `
  @keyframes row-in   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes card-in  { from{opacity:0;transform:translateY(10px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes fade-in  { from{opacity:0} to{opacity:1} }
  @keyframes highlight{ 0%{background:#E0F7F4} 100%{background:transparent} }
`;

/* ── shared badge ────────────────────────────────────────────── */
const TypeBadge = ({ type }) => (
  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize"
    style={{
      backgroundColor: type === 'internal' ? `${COLORS.navy}14` : `${COLORS.teal}14`,
      color: type === 'internal' ? COLORS.navy : COLORS.teal,
    }}>
    {type}
  </span>
);

const CountryBadge = ({ country }) => {
  const isIndo = country === 'indonesia';
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: isIndo ? '#FEF3C7' : '#DBEAFE', color: isIndo ? '#92400E' : '#1D4ED8' }}>
      {isIndo ? '🇮🇩' : '🇸🇬'} {isIndo ? 'Indonesia' : 'Singapore'}
    </span>
  );
};

/* ── page header sub-component (shared between tabs) ─────────── */
const PageHeader = ({ title, subtitle, loading, onRefresh, onAdd, addLabel }) => (
  <div className="flex items-center justify-between gap-3">
    <div>
      <h1 className="text-xl font-semibold" style={{ color: COLORS.navy }}>{title}</h1>
      <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <button onClick={onRefresh}
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
        title="Refresh">
        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
      </button>
      <button onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
        style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}>
        <Plus size={16} />
        <span className="hidden sm:inline">{addLabel}</span>
        <span className="sm:hidden">Add</span>
      </button>
    </div>
  </div>
);

/* ── filter bar sub-component ────────────────────────────────── */
const FilterBar = ({ searchValue, onSearchChange, pills, activePill, onPillChange, searchPlaceholder }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white">
      <Search size={15} className="text-slate-400 shrink-0" />
      <input type="text" placeholder={searchPlaceholder} value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400" />
    </div>
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-nowrap">
      {pills.map(({ key, label, activeStyle }) => (
        <button key={key} onClick={() => onPillChange(key)}
          className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition"
          style={activePill === key
            ? activeStyle
            : { backgroundColor: 'white', color: '#64748B', borderColor: '#E2E8F0' }}>
          {label}
        </button>
      ))}
    </div>
  </div>
);

/* ── pagination bar ──────────────────────────────────────────── */
const Pagination = ({ meta, page, totalPages, onPrev, onNext }) => (
  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
    <span>Page {meta.current_page} of {totalPages} · {meta.total} total</span>
    <div className="flex items-center gap-1">
      <button onClick={onPrev} disabled={page <= 1}
        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50 transition">
        <ChevronLeft size={15} />
      </button>
      <button onClick={onNext} disabled={page >= totalPages}
        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50 transition">
        <ChevronRight size={15} />
      </button>
    </div>
  </div>
);

/* ── empty / loading row ─────────────────────────────────────── */
const TableState = ({ loading, empty, cols }) => {
  if (loading) return (
    <tr><td colSpan={cols} className="px-4 py-14 text-center text-slate-400">
      <RefreshCw size={18} className="animate-spin inline mr-2" />Loading…
    </td></tr>
  );
  if (empty) return (
    <tr><td colSpan={cols} className="px-4 py-14 text-center text-slate-400 text-sm">
      No records found.
    </td></tr>
  );
  return null;
};

/* ═══════════════════════════════════════════════════════════════ */
const CompaniesPortsPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab]     = useState('companies');

  /* ── companies state ── */
  const [companies, setCompanies]   = useState([]);
  const [compMeta, setCompMeta]     = useState({ current_page: 1, total: 0, per_page: 15 });
  const [compLoading, setCompLoading] = useState(true);
  const [compError, setCompError]   = useState(null);
  const [compPage, setCompPage]     = useState(1);
  const [compSearch, setCompSearch] = useState('');
  const [compSearchInput, setCompSearchInput] = useState('');
  const [compType, setCompType]     = useState('all');

  /* ── ports state ── */
  const [ports, setPorts]           = useState([]);
  const [portMeta, setPortMeta]     = useState({ current_page: 1, total: 0, per_page: 15 });
  const [portLoading, setPortLoading] = useState(true);
  const [portError, setPortError]   = useState(null);
  const [portPage, setPortPage]     = useState(1);
  const [portSearch, setPortSearch] = useState('');
  const [portSearchInput, setPortSearchInput] = useState('');
  const [portCountry, setPortCountry] = useState('all');

  /* ── modals ── */
  const [showCreateComp, setShowCreateComp] = useState(false);
  const [editComp, setEditComp]             = useState(null);
  const [deleteComp, setDeleteComp]         = useState(null);
  const [showCreatePort, setShowCreatePort] = useState(false);
  const [editPort, setEditPort]             = useState(null);
  const [deletePortTarget, setDeletePortTarget] = useState(null);
  const [newCompId, setNewCompId]           = useState(null);
  const [newPortId, setNewPortId]           = useState(null);

  /* ── fetch companies ── */
  const fetchCompanies = useCallback(async () => {
    setCompLoading(true); setCompError(null);
    try {
      const res = await getCompanies({
        page: compPage, per_page: 15,
        ...(compSearch ? { search: compSearch } : {}),
        ...(compType !== 'all' ? { type: compType } : {}),
      });
      setCompanies(res.data?.data ?? []);
      if (res.data?.meta) setCompMeta(res.data.meta);
    } catch (err) {
      setCompError(err?.response?.data?.message ?? 'Failed to load companies.');
    } finally { setCompLoading(false); }
  }, [compPage, compSearch, compType]);

  /* ── fetch ports ── */
  const fetchPorts = useCallback(async () => {
    setPortLoading(true); setPortError(null);
    try {
      const res = await getPorts({
        page: portPage, per_page: 15,
        ...(portSearch ? { search: portSearch } : {}),
        ...(portCountry !== 'all' ? { country: portCountry } : {}),
      });
      setPorts(res.data?.data ?? []);
      if (res.data?.meta) setPortMeta(res.data.meta);
    } catch (err) {
      setPortError(err?.response?.data?.message ?? 'Failed to load ports.');
    } finally { setPortLoading(false); }
  }, [portPage, portSearch, portCountry]);

  useEffect(() => { if (activeTab === 'companies') fetchCompanies(); }, [fetchCompanies, activeTab]);
  useEffect(() => { if (activeTab === 'ports')     fetchPorts();     }, [fetchPorts,     activeTab]);

  /* debounce company search */
  useEffect(() => {
    const t = setTimeout(() => { setCompSearch(compSearchInput); setCompPage(1); }, 350);
    return () => clearTimeout(t);
  }, [compSearchInput]);

  /* debounce port search */
  useEffect(() => {
    const t = setTimeout(() => { setPortSearch(portSearchInput); setPortPage(1); }, 350);
    return () => clearTimeout(t);
  }, [portSearchInput]);

  const compTotalPages = Math.ceil(compMeta.total / 15) || 1;
  const portTotalPages = Math.ceil(portMeta.total / 15) || 1;

  /* ── pill configs ── */
  const compPills = [
    { key: 'all',      label: 'All',      activeStyle: { backgroundColor: `${COLORS.navy}14`, color: COLORS.navy, borderColor: COLORS.navy } },
    { key: 'internal', label: 'Internal', activeStyle: { backgroundColor: `${COLORS.navy}14`, color: COLORS.navy, borderColor: COLORS.navy } },
    { key: 'partner',  label: 'Partner',  activeStyle: { backgroundColor: `${COLORS.teal}14`, color: COLORS.teal, borderColor: COLORS.teal } },
  ];
  const portPills = [
    { key: 'all',       label: 'All',         activeStyle: { backgroundColor: `${COLORS.teal}14`, color: COLORS.teal, borderColor: COLORS.teal } },
    { key: 'indonesia', label: '🇮🇩 Indonesia', activeStyle: { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#D97706' } },
    { key: 'singapore', label: '🇸🇬 Singapore', activeStyle: { backgroundColor: '#DBEAFE', color: '#1D4ED8', borderColor: '#3B82F6' } },
  ];

  /* ─── render ─── */
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: COLORS.bg }}>
      <style>{ANIM}</style>
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        <DashboardTopbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 px-4 sm:px-6 py-6 space-y-5">

          {/* ── tabs ── */}
          <div className="flex items-center gap-1 border-b border-slate-200">
            {[
              { key: 'companies', label: 'Companies', icon: Building2 },
              { key: 'ports',     label: 'Ports',     icon: Anchor },
            ].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px"
                style={activeTab === key
                  ? { borderColor: COLORS.teal, color: COLORS.navy }
                  : { borderColor: 'transparent', color: '#94A3B8' }}>
                <Icon size={15} />{label}
              </button>
            ))}
          </div>

          {/* ══════════════ COMPANIES TAB ══════════════ */}
          {activeTab === 'companies' && (
            <div className="space-y-4" style={{ animation: 'fade-in 0.2s ease-out' }}>
              <PageHeader
                title="Companies"
                subtitle={`${compMeta.total} logistics partner${compMeta.total !== 1 ? 's' : ''} registered`}
                loading={compLoading}
                onRefresh={fetchCompanies}
                onAdd={() => setShowCreateComp(true)}
                addLabel="Add Company"
              />

              <FilterBar
                searchValue={compSearchInput}
                onSearchChange={setCompSearchInput}
                searchPlaceholder="Search by name or city…"
                pills={compPills}
                activePill={compType}
                onPillChange={(v) => { setCompType(v); setCompPage(1); }}
              />

              {compError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{compError}</div>
              )}

              {/* table card */}
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                {/* desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['ID', 'Name', 'Type', 'City', 'Address', ''].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <TableState loading={compLoading} empty={!compLoading && companies.length === 0} cols={6} />
                      {!compLoading && companies.map((c, i) => (
                        <tr key={c.id}
                          className="hover:bg-slate-50 transition-colors group"
                          style={{
                            animation: c.id === newCompId
                              ? 'highlight 1.8s ease-out forwards'
                              : `row-in 0.18s ease-out ${i * 30}ms both`,
                          }}>
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">#{c.id}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                                style={{ backgroundColor: c.type === 'internal' ? COLORS.navy : COLORS.teal }}>
                                {c.name[0]}
                              </span>
                              <span className="font-medium text-slate-800">{c.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3"><TypeBadge type={c.type} /></td>
                          <td className="px-4 py-3 text-slate-600 text-xs">
                            <div className="flex items-center gap-1">
                              <MapPin size={11} className="text-slate-400 shrink-0" />{c.city}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px] truncate">
                            {c.address ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditComp(c)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" title="Edit">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => setDeleteComp(c)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* mobile */}
                <div className="md:hidden divide-y divide-slate-100">
                  {compLoading && <div className="py-12 text-center text-slate-400"><RefreshCw size={18} className="animate-spin inline mr-2" />Loading…</div>}
                  {!compLoading && companies.length === 0 && <div className="py-12 text-center text-slate-400 text-sm">No companies found.</div>}
                  {!compLoading && companies.map((c, i) => (
                    <div key={c.id} className="px-4 py-4"
                      style={{
                        animation: c.id === newCompId
                          ? 'highlight 1.8s ease-out forwards'
                          : `row-in 0.18s ease-out ${i * 30}ms both`,
                      }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                            style={{ backgroundColor: c.type === 'internal' ? COLORS.navy : COLORS.teal }}>
                            {c.name[0]}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <TypeBadge type={c.type} />
                              <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin size={10} />{c.city}</span>
                            </div>
                            {c.address && <p className="text-xs text-slate-400 mt-0.5 truncate">{c.address}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setEditComp(c)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleteComp(c)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {!compLoading && (
                  <Pagination meta={compMeta} page={compPage} totalPages={compTotalPages}
                    onPrev={() => setCompPage((p) => Math.max(1, p - 1))}
                    onNext={() => setCompPage((p) => Math.min(compTotalPages, p + 1))} />
                )}
              </div>
            </div>
          )}

          {/* ══════════════ PORTS TAB ══════════════ */}
          {activeTab === 'ports' && (
            <div className="space-y-4" style={{ animation: 'fade-in 0.2s ease-out' }}>
              <PageHeader
                title="Ports"
                subtitle={`${portMeta.total} port${portMeta.total !== 1 ? 's' : ''} registered`}
                loading={portLoading}
                onRefresh={fetchPorts}
                onAdd={() => setShowCreatePort(true)}
                addLabel="Add Port"
              />

              <FilterBar
                searchValue={portSearchInput}
                onSearchChange={setPortSearchInput}
                searchPlaceholder="Search by name or UNLOCODE…"
                pills={portPills}
                activePill={portCountry}
                onPillChange={(v) => { setPortCountry(v); setPortPage(1); }}
              />

              {portError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{portError}</div>
              )}

              {/* table card */}
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                {/* desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['ID', 'Name', 'Country', 'UNLOCODE', ''].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <TableState loading={portLoading} empty={!portLoading && ports.length === 0} cols={5} />
                      {!portLoading && ports.map((p, i) => (
                        <tr key={p.id}
                          className="hover:bg-slate-50 transition-colors group"
                          style={{
                            animation: p.id === newPortId
                              ? 'highlight 1.8s ease-out forwards'
                              : `row-in 0.18s ease-out ${i * 30}ms both`,
                          }}>
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">#{p.id}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl leading-none shrink-0">
                                {p.country === 'indonesia' ? '🇮🇩' : '🇸🇬'}
                              </span>
                              <span className="font-medium text-slate-800">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3"><CountryBadge country={p.country} /></td>
                          <td className="px-4 py-3">
                            {p.unlocode
                              ? <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-lg"
                                  style={{ backgroundColor: `${COLORS.navy}0A`, color: COLORS.navy }}>
                                  {p.unlocode}
                                </span>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditPort(p)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" title="Edit">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => setDeletePortTarget(p)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* mobile */}
                <div className="md:hidden divide-y divide-slate-100">
                  {portLoading && <div className="py-12 text-center text-slate-400"><RefreshCw size={18} className="animate-spin inline mr-2" />Loading…</div>}
                  {!portLoading && ports.length === 0 && <div className="py-12 text-center text-slate-400 text-sm">No ports found.</div>}
                  {!portLoading && ports.map((p, i) => (
                    <div key={p.id} className="px-4 py-4" style={{ animation: `row-in 0.18s ease-out ${i * 30}ms both` }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl leading-none shrink-0">
                            {p.country === 'indonesia' ? '🇮🇩' : '🇸🇬'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <CountryBadge country={p.country} />
                              {p.unlocode && (
                                <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: `${COLORS.navy}0A`, color: COLORS.navy }}>
                                  {p.unlocode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setEditPort(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"><Edit2 size={14} /></button>
                          <button onClick={() => setDeletePortTarget(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {!portLoading && (
                  <Pagination meta={portMeta} page={portPage} totalPages={portTotalPages}
                    onPrev={() => setPortPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPortPage((p) => Math.min(portTotalPages, p + 1))} />
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── company modals ── */}
      {showCreateComp && (
        <CompanyFormModal mode="create"
          onClose={() => setShowCreateComp(false)}
          onSaved={(c) => {
            setShowCreateComp(false);
            setCompanies((prev) => [c, ...prev]);
            setCompMeta((m) => ({ ...m, total: m.total + 1 }));
            setNewCompId(c.id);
          }} />
      )}
      {editComp && (
        <CompanyFormModal mode="edit" company={editComp}
          onClose={() => setEditComp(null)}
          onSaved={(c) => {
            setEditComp(null);
            setCompanies((prev) => prev.map((x) => x.id === c.id ? c : x));
            setNewCompId(c.id);
          }} />
      )}
      {deleteComp && (
        <DeleteConfirmModal
          entity={deleteComp} entityType="company"
          onClose={() => setDeleteComp(null)}
          onConfirm={async () => {
            await deleteCompany(deleteComp.id);
            setCompanies((prev) => prev.filter((x) => x.id !== deleteComp.id));
            setCompMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) }));
            setDeleteComp(null);
          }} />
      )}

      {/* ── port modals ── */}
      {showCreatePort && (
        <PortFormModal mode="create"
          onClose={() => setShowCreatePort(false)}
          onSaved={(p) => {
            setShowCreatePort(false);
            setPorts((prev) => [p, ...prev]);
            setPortMeta((m) => ({ ...m, total: m.total + 1 }));
            setNewPortId(p.id);
          }} />
      )}
      {editPort && (
        <PortFormModal mode="edit" port={editPort}
          onClose={() => setEditPort(null)}
          onSaved={(p) => {
            setEditPort(null);
            setPorts((prev) => prev.map((x) => x.id === p.id ? p : x));
            setNewPortId(p.id);
          }} />
      )}
      {deletePortTarget && (
        <DeleteConfirmModal
          entity={deletePortTarget} entityType="port"
          onClose={() => setDeletePortTarget(null)}
          onConfirm={async () => {
            await deletePort(deletePortTarget.id);
            setPorts((prev) => prev.filter((x) => x.id !== deletePortTarget.id));
            setPortMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) }));
            setDeletePortTarget(null);
          }} />
      )}
    </div>
  );
};

export default CompaniesPortsPage;
