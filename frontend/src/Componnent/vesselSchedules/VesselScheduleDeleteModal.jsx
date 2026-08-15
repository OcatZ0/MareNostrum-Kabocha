import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, AlertCircle } from 'lucide-react';
import { deleteVesselSchedule } from '../../api/vesselSchedulesApi';

const VesselScheduleDeleteModal = ({ open, onClose, schedule, onDeleted }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!open || !schedule) return null;

  const handleDelete = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      await deleteVesselSchedule(schedule.id);
      onDeleted('Jadwal kapal berhasil dihapus.');
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Gagal menghapus jadwal kapal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
        style={{ animation: 'modal-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 shrink-0">
              <Trash2 size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-800">
                Hapus Jadwal Kapal?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Anda akan menghapus jadwal pelayaran untuk kapal{' '}
                <span className="font-bold text-slate-700">{schedule.vessel_name}</span>{' '}
                ({schedule.voyage_number || schedule.ship_ref_id}). Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition"
            >
              <X size={18} />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
            <p className="text-slate-500">
              Rute: <b className="text-slate-700">{schedule.origin_port?.name}</b> ➔ <b className="text-slate-700">{schedule.destination_port?.name}</b>
            </p>
            <p className="text-slate-500">
              Waktu Tiba: <span className="font-mono text-slate-700">{new Date(schedule.scheduled_arrival_at).toLocaleString('id-ID')}</span>
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleDelete}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition flex items-center gap-2 shadow-lg shadow-rose-600/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <>
                  <Trash2 size={15} />
                  <span>Hapus Jadwal</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VesselScheduleDeleteModal;
