import React, { useState } from 'react';
import {
  Trash2, X, AlertTriangle, AlertCircle, Loader2, Truck,
} from 'lucide-react';
import { deleteTruck } from '../../api/trucksApi';

const TruckDeleteModal = ({ truck, onClose, onDeleted }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    if (!truck?.id) return;
    setLoading(true);
    setError(null);

    try {
      await deleteTruck(truck.id);
      onDeleted?.(truck.id);
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Failed to delete truck. Please try again.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-[modal-in_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <X size={16} />
        </button>

        <div className="p-6 pt-7">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-red-50/50">
            <Trash2 size={24} />
          </div>

          <h3 className="text-lg font-bold text-slate-900 text-center">
            Delete Truck
          </h3>

          <p className="text-sm text-slate-500 text-center mt-2">
            Are you sure you want to remove this vehicle from your fleet?
          </p>

          {/* Truck Card Preview */}
          <div className="my-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-200/70 text-slate-600 flex items-center justify-center shrink-0">
              <Truck size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono font-bold text-slate-900 text-sm tracking-wide">
                {truck?.plate_number}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {truck?.brand} {truck?.model} · Year {truck?.year}
              </p>
            </div>
          </div>

          {/* Warning Note */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-800">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
            <span>
              <strong>Note:</strong> Trucks associated with existing or historical trips cannot be deleted to preserve carbon calculation history.
            </span>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex gap-3 px-6 pb-6 pt-2 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition shadow-md shadow-red-200 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete Truck
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TruckDeleteModal;
