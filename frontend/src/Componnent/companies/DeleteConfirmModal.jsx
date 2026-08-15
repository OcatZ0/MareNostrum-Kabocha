import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';

/**
 * Generic delete confirmation modal.
 * Props:
 *   entity     – { id, name, … }
 *   entityType – 'company' | 'port'
 *   onClose    – close without deleting
 *   onConfirm  – async function that performs the delete; should throw on failure
 */
const DeleteConfirmModal = ({ entity, entityType = 'company', onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const isPort = entityType === 'port';
  const label  = isPort ? 'Port' : 'Company';

  const handle = async () => {
    setLoading(true); setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(
        err?.response?.data?.message ??
        `Cannot delete this ${label.toLowerCase()}. It may be referenced by existing trips.`
      );
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'delete-modal-in 0.18s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes delete-modal-in { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }`}</style>

        {/* close btn */}
        <button onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition">
          <X size={14} />
        </button>

        <div className="p-6 pt-8">
          {/* icon */}
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={22} color="#EF4444" />
          </div>

          <h3 className="text-base font-semibold text-slate-800 text-center">
            Delete {label}
          </h3>
          <p className="text-sm text-slate-500 text-center mt-2 leading-relaxed">
            Are you sure you want to delete{' '}
            <strong className="text-slate-700">{entity.name}</strong>?
            This cannot be undone.
          </p>

          {/* warning */}
          <div className="flex items-start gap-2 mt-4 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            {isPort
              ? 'Ports linked to existing trips cannot be deleted.'
              : 'Companies linked to existing trips cannot be deleted.'}
            {' '}If this {label.toLowerCase()} is in use, the request will be rejected.
          </div>

          {error && (
            <div className="mt-3 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 pb-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={handle} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ backgroundColor: '#EF4444' }}>
            {loading
              ? <><Loader2 size={14} className="animate-spin" />Deleting…</>
              : <><Trash2 size={14} />Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
