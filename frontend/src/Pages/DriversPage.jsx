import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Search, RefreshCw, Edit2, Trash2,
  ChevronLeft, ChevronRight, Phone, Shield, User,
  X, Check, Loader2, AlertCircle, AlertTriangle, Eye, EyeOff,
} from 'lucide-react';
import DashboardSidebar from '../Componnent/dashboard/DashboardSidebar';
import DashboardTopbar  from '../Componnent/dashboard/DashboardTopbar';
import { COLORS }       from '../Componnent/dashboard/dashboardTheme';
import { getUsers, createUser, updateUser, deleteUser } from '../api/usersApi';

/* ── keyframes ───────────────────────────────────────────────── */
const ANIM = `
  @keyframes row-in     { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
  @keyframes modal-in   { from{opacity:0;transform:translateY(16px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes highlight  { 0%{background:#E0F7F4} 100%{background:transparent} }
`;

/* ── role badge ──────────────────────────────────────────────── */
const RoleBadge = ({ role }) => (
  <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize"
    style={
      role === 'admin'
        ? { backgroundColor: `${COLORS.navy}14`, color: COLORS.navy }
        : { backgroundColor: `${COLORS.teal}14`,  color: COLORS.teal }
    }>
    {role === 'admin' ? <Shield size={10} /> : <User size={10} />}
    {role}
  </span>
);

/* ── avatar ──────────────────────────────────────────────────── */
const Avatar = ({ name, role }) => (
  <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
    style={{ backgroundColor: role === 'admin' ? COLORS.navy : COLORS.teal }}>
    {name?.[0]?.toUpperCase() ?? '?'}
  </span>
);

/* ═══════════════════════════════════════════════════════════════ */
const DriversPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [users, setUsers]             = useState([]);
  const [meta, setMeta]               = useState({ current_page: 1, total: 0 });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [page, setPage]               = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [roleFilter, setRoleFilter]   = useState('driver'); // default to drivers

  const [showCreate, setShowCreate]   = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newId, setNewId]             = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await getUsers({
        page, per_page: 15,
        ...(search             ? { search }          : {}),
        ...(roleFilter !== 'all' ? { role: roleFilter } : {}),
      });
      setUsers(res.data?.data ?? []);
      if (res.data?.meta) setMeta(res.data.meta);
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to load users.');
    } finally { setLoading(false); }
  }, [page, search, roleFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.ceil(meta.total / 15) || 1;

  const ROLE_PILLS = [
    { key: 'all',    label: 'All Users' },
    { key: 'driver', label: 'Drivers' },
    { key: 'admin',  label: 'Admins' },
  ];

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: COLORS.bg }}>
      <style>{ANIM}</style>
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col lg:pl-64">
        <DashboardTopbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 px-4 sm:px-6 py-6 space-y-5">

          {/* header */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold" style={{ color: COLORS.navy }}>Drivers</h1>
              <p className="text-sm text-slate-400 mt-0.5">{meta.total} user{meta.total !== 1 ? 's' : ''} registered</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={fetch} title="Refresh"
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})` }}>
                <Plus size={16} /><span className="hidden sm:inline">Add User</span><span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>

          {/* filter bar */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input type="text" placeholder="Search name, username, phone…"
                value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400" />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-nowrap">
              {ROLE_PILLS.map(({ key, label }) => (
                <button key={key} onClick={() => { setRoleFilter(key); setPage(1); }}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition"
                  style={roleFilter === key
                    ? { backgroundColor: `${COLORS.navy}14`, color: COLORS.navy, borderColor: COLORS.navy }
                    : { backgroundColor: 'white', color: '#64748B', borderColor: '#E2E8F0' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          {/* table */}
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['ID', 'Name', 'Username', 'Role', 'Phone', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading && <tr><td colSpan={6} className="px-4 py-14 text-center text-slate-400"><RefreshCw size={18} className="animate-spin inline mr-2" />Loading…</td></tr>}
                  {!loading && users.length === 0 && <tr><td colSpan={6} className="px-4 py-14 text-center text-slate-400 text-sm">No users found.</td></tr>}
                  {!loading && users.map((u, i) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors group"
                      style={{
                        animation: u.id === newId
                          ? 'highlight 1.8s ease-out forwards'
                          : `row-in 0.16s ease-out ${i * 25}ms both`,
                      }}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">#{u.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.name} role={u.role} />
                          <span className="font-medium text-slate-800">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{u.username}</td>
                      <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {u.phone
                          ? <span className="flex items-center gap-1"><Phone size={11} />{u.phone}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditTarget(u)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" title="Edit"><Edit2 size={13} /></button>
                          <button onClick={() => setDeleteTarget(u)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition" title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {loading && <div className="py-12 text-center text-slate-400"><RefreshCw size={18} className="animate-spin inline mr-2" />Loading…</div>}
              {!loading && users.length === 0 && <div className="py-12 text-center text-slate-400 text-sm">No users found.</div>}
              {!loading && users.map((u, i) => (
                <div key={u.id} className="px-4 py-4"
                  style={{
                    animation: u.id === newId
                      ? 'highlight 1.8s ease-out forwards'
                      : `row-in 0.16s ease-out ${i * 25}ms both`,
                  }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={u.name} role={u.role} />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{u.name}</p>
                        <p className="font-mono text-xs text-slate-400">@{u.username}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <RoleBadge role={u.role} />
                          {u.phone && <span className="text-xs text-slate-400 flex items-center gap-1"><Phone size={10} />{u.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditTarget(u)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"><Edit2 size={14} /></button>
                      <button onClick={() => setDeleteTarget(u)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!loading && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
                <span>Page {meta.current_page} of {totalPages} · {meta.total} total</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50 transition"><ChevronLeft size={15} /></button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50 transition"><ChevronRight size={15} /></button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {showCreate   && <UserFormModal mode="create"              onClose={() => setShowCreate(false)}   onSaved={(u) => { setShowCreate(false); setUsers((prev) => [u, ...prev]); setMeta((m) => ({ ...m, total: m.total + 1 })); setNewId(u.id); }} />}
      {editTarget   && <UserFormModal mode="edit" user={editTarget} onClose={() => setEditTarget(null)} onSaved={(u) => { setEditTarget(null);   setUsers((prev) => prev.map((x) => x.id === u.id ? u : x)); setNewId(u.id); }} />}
      {deleteTarget && <UserDeleteModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => { setDeleteTarget(null); setUsers((prev) => prev.filter((x) => x.id !== deleteTarget.id)); setMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) })); }} />}
    </div>
  );
};

/* ── UserFormModal ───────────────────────────────────────────── */
const UserFormModal = ({ mode, user, onClose, onSaved }) => {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    name:     user?.name     ?? '',
    username: user?.username ?? '',
    password: '',
    role:     user?.role     ?? 'driver',
    phone:    user?.phone    ?? '',
  });
  const [showPw, setShowPw]         = useState(false);
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]     = useState(null);
  const [success, setSuccess]       = useState(false);
  const [mounted, setMounted]       = useState(false);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setErrors((p) => { const n = { ...p }; delete n[k]; return n; }); setApiError(null); };

  const validate = () => {
    const e = {};
    if (!form.name.trim())     e.name     = 'Name is required';
    if (!form.username.trim()) e.username = 'Username is required';
    if (!/^[a-zA-Z0-9_-]+$/.test(form.username)) e.username = 'Only letters, numbers, - and _ allowed';
    if (!isEdit && !form.password) e.password = 'Password is required';
    if (form.password && form.password.length < 6) e.password = 'Minimum 6 characters';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true); setApiError(null);
    const payload = { name: form.name, username: form.username, role: form.role, phone: form.phone || undefined };
    if (form.password) payload.password = form.password;
    try {
      let saved;
      if (isEdit) { const r = await updateUser(user.id, payload); saved = r.data?.data; }
      else        { const r = await createUser(payload);           saved = r.data?.data; }
      setSuccess(true);
      setTimeout(() => onSaved(saved ?? payload), 600);
    } catch (err) {
      const d = err?.response?.data;
      if (d?.errors) { const m = {}; Object.entries(d.errors).forEach(([k, v]) => { m[k] = Array.isArray(v) ? v[0] : v; }); setErrors(m); }
      else setApiError(d?.message ?? 'Something went wrong.');
    } finally { setSubmitting(false); }
  };

  const inputCls = (k) => `w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-700 outline-none transition-all ${errors[k] ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200 hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh', animation: mounted ? 'modal-in 0.22s cubic-bezier(0.34,1.2,0.64,1)' : 'none' }}
        onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${COLORS.teal}14` }}>
              <Users size={16} color={COLORS.teal} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">{isEdit ? 'Edit User' : 'Add User'}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{isEdit ? `Editing @${user.username}` : 'Create a new driver or admin account'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* role */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Role *</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'driver', icon: User,   label: 'Driver' },
                { key: 'admin',  icon: Shield, label: 'Admin' },
              ].map(({ key, icon: Icon, label }) => (
                <button key={key} type="button" onClick={() => set('role', key)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all"
                  style={form.role === key
                    ? { borderColor: COLORS.teal, backgroundColor: `${COLORS.teal}0D`, color: COLORS.teal }
                    : { borderColor: '#E2E8F0', color: '#64748B' }}>
                  <Icon size={14} />{label}
                  {form.role === key && <Check size={12} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Full Name *</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Budi Santoso" className={inputCls('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-500"><AlertCircle size={11} className="inline mr-1" />{errors.name}</p>}
          </div>

          {/* username */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Username *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
              <input type="text" value={form.username} onChange={(e) => set('username', e.target.value)}
                placeholder="driver_budi" className={`${inputCls('username')} pl-8`} />
            </div>
            {errors.username && <p className="mt-1 text-xs text-red-500"><AlertCircle size={11} className="inline mr-1" />{errors.username}</p>}
          </div>

          {/* password */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Password {isEdit && <span className="text-slate-400 font-normal normal-case">(leave blank to keep current)</span>}
              {!isEdit && '*'}
            </label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder={isEdit ? '••••••' : 'min. 6 characters'}
                className={`${inputCls('password')} pr-10`} />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-500"><AlertCircle size={11} className="inline mr-1" />{errors.password}</p>}
          </div>

          {/* phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Phone (optional)</label>
            <div className="relative">
              <Phone size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)}
                placeholder="+62 812 3456 7890" className={`${inputCls('phone')} pl-9`} />
            </div>
          </div>

          {apiError && <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700"><AlertCircle size={13} />{apiError}</div>}
        </form>

        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 transition">Cancel</button>
          <button type="submit" onClick={handleSubmit} disabled={submitting || success}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ backgroundColor: success ? COLORS.green : COLORS.teal, boxShadow: `0 2px 8px ${COLORS.teal}30` }}>
            {success ? <><Check size={15} />{isEdit ? 'Saved!' : 'Created!'}</> : submitting ? <><Loader2 size={15} className="animate-spin" />Saving…</> : isEdit ? 'Save Changes' : 'Add User'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── UserDeleteModal ─────────────────────────────────────────── */
const UserDeleteModal = ({ user, onClose, onDeleted }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handle = async () => {
    setLoading(true); setError(null);
    try { await deleteUser(user.id); onDeleted(); }
    catch (e) { setError(e?.response?.data?.message ?? 'Cannot delete this user.'); setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ animation: 'modal-in 0.18s ease-out' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"><X size={14} /></button>
        <div className="p-6 pt-8">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4"><Trash2 size={22} color="#EF4444" /></div>
          <h3 className="text-base font-semibold text-slate-800 text-center">Delete User</h3>
          <p className="text-sm text-slate-500 text-center mt-2">Delete <strong className="text-slate-700">{user.name}</strong> (@{user.username})?</p>
          <div className="flex items-start gap-2 mt-4 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />Users linked to trips or your own account cannot be deleted.
          </div>
          {error && <div className="mt-3 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700">{error}</div>}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handle} disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: '#EF4444' }}>
            {loading ? <><Loader2 size={14} className="animate-spin" />Deleting…</> : <><Trash2 size={14} />Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriversPage;
