import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Phone, Mail, Shield, User, Loader2, AlertCircle } from 'lucide-react';
import DashboardSidebar from '../Componnent/dashboard/DashboardSidebar';
import DashboardTopbar from '../Componnent/dashboard/DashboardTopbar';
import { COLORS } from '../Componnent/dashboard/dashboardTheme';
import { getUser, updateUser, deleteUser } from '../api/usersApi';

/* ── keyframes ───────────────────────────────────────────────── */
const ANIM = `
  @keyframes fade-in { from{opacity:0} to{opacity:1} }
  @keyframes slide-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
`;

/* ── Avatar ──────────────────────────────────────────────── */
const Avatar = ({ name, role }) => (
  <div className="w-20 h-20 rounded-xl flex items-center justify-center text-2xl font-bold text-white"
    style={{ backgroundColor: role === 'admin' ? COLORS.navy : COLORS.teal }}>
    {name?.[0]?.toUpperCase() ?? '?'}
  </div>
);

/* ── Info Card ──────────────────────────────────────────────– */
const InfoCard = ({ label, value, icon: Icon }) => (
  <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
    <div className="p-2 rounded-lg" style={{ backgroundColor: `${COLORS.teal}20` }}>
      <Icon size={20} style={{ color: COLORS.teal }} />
    </div>
    <div className="flex-1">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">{value || '-'}</p>
    </div>
  </div>
);

/* ── Role Badge ──────────────────────────────────────────────– */
const RoleBadge = ({ role }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full capitalize"
    style={
      role === 'admin'
        ? { backgroundColor: `${COLORS.navy}20`, color: COLORS.navy }
        : { backgroundColor: `${COLORS.teal}20`, color: COLORS.teal }
    }>
    {role === 'admin' ? <Shield size={14} /> : <User size={14} />}
    {role}
  </span>
);

/* ═══════════════════════════════════════════════════════════════ */
const DriverActorPage = () => {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    role: 'driver',
  });

  // Fetch driver data on mount
  useEffect(() => {
    fetchDriver();
  }, [driverId]);

  const fetchDriver = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getUser(driverId);
      const userData = response.data?.data ?? response.data;
      setDriver(userData);
      setForm({
        name: userData.name || '',
        username: userData.username || '',
        email: userData.email || '',
        phone: userData.phone || '',
        role: userData.role || 'driver',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load driver information');
      console.error('Error fetching driver:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const response = await updateUser(driverId, form);
      const updatedData = response.data?.data ?? response.data;
      setDriver(updatedData);
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update driver');
      console.error('Error updating driver:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await deleteUser(driverId);
      navigate('/app/drivers');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete driver');
      console.error('Error deleting driver:', err);
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <style>{ANIM}</style>
      <DashboardSidebar open={sidebarOpen} onToggle={setSidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardTopbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            {/* Back Button */}
            <button
              onClick={() => navigate('/app/drivers')}
              className="inline-flex items-center gap-2 text-sm font-medium mb-6"
              style={{ color: COLORS.teal }}>
              <ArrowLeft size={18} />
              Back to Drivers
            </button>

            {/* Loading State */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 size={40} className="animate-spin" style={{ color: COLORS.teal }} />
                <p className="text-slate-500">Loading driver information...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Driver Content */}
            {!loading && driver && (
              <>
                {/* Header Card */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-slate-200" style={{ animation: 'slide-in 0.3s ease-out' }}>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-start gap-4">
                      <Avatar name={driver.name} role={driver.role} />
                      <div>
                        <h1 className="text-3xl font-bold text-slate-900">{driver.name}</h1>
                        <p className="text-slate-500 text-sm mt-1">@{driver.username}</p>
                        <div className="mt-3">
                          <RoleBadge role={driver.role} />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {!isEditing && (
                        <>
                          <button
                            onClick={() => setIsEditing(true)}
                            className="p-2 rounded-lg hover:bg-blue-50 transition-colors"
                            style={{ color: COLORS.teal }}>
                            <Edit2 size={20} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="p-2 rounded-lg hover:bg-red-50 transition-colors text-red-500">
                            <Trash2 size={20} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Information Grid */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-slate-200">
                  <h2 className="text-lg font-bold text-slate-900 mb-4">Personal Information</h2>
                  
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                        <input
                          type="text"
                          name="name"
                          value={form.name}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2"
                          style={{ focusRingColor: COLORS.teal }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                        <input
                          type="text"
                          name="username"
                          value={form.username}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2"
                          style={{ focusRingColor: COLORS.teal }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                        <input
                          type="email"
                          name="email"
                          value={form.email}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2"
                          style={{ focusRingColor: COLORS.teal }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                        <input
                          type="tel"
                          name="phone"
                          value={form.phone}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2"
                          style={{ focusRingColor: COLORS.teal }}
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium flex items-center justify-center gap-2">
                          {isSaving ? <Loader2 size={18} className="animate-spin" /> : null}
                          Save Changes
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoCard label="Full Name" value={driver.name} icon={User} />
                      <InfoCard label="Email" value={driver.email} icon={Mail} />
                      <InfoCard label="Phone" value={driver.phone} icon={Phone} />
                      <InfoCard label="Username" value={driver.username} icon={Shield} />
                    </div>
                  )}
                </div>

                {/* Meta Information */}
                {driver.created_at && (
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Account Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">Created:</span>
                        <p className="text-slate-900 font-medium">
                          {new Date(driver.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      {driver.updated_at && (
                        <div>
                          <span className="text-slate-500">Last Updated:</span>
                          <p className="text-slate-900 font-medium">
                            {new Date(driver.updated_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Driver</h3>
            <p className="text-slate-600 text-sm mb-6">
              Are you sure you want to delete <strong>{driver?.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-medium flex items-center justify-center gap-2">
                {isDeleting ? <Loader2 size={18} className="animate-spin" /> : null}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverActorPage;
