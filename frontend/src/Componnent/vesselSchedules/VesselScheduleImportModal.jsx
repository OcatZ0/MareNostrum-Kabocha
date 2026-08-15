import React, { useState, useRef } from 'react';
import {
  X, FileSpreadsheet, UploadCloud, Download, CheckCircle2,
  AlertTriangle, AlertCircle, RefreshCw, FileText, ArrowRight,
  Info, Table
} from 'lucide-react';
import { COLORS } from '../dashboard/dashboardTheme';
import { importVesselSchedules } from '../../api/vesselSchedulesApi';

const TEMPLATE_COLUMNS = [
  { key: 'vessel_name', label: 'Nama Kapal', format: 'Teks (Contoh: Batam Fast 18)', required: true },
  { key: 'ship_ref_id', label: 'MMSI / IMO ID', format: '9 digit MMSI / 7 digit IMO (Contoh: 563123456)', required: true },
  { key: 'voyage_number', label: 'No. Pelayaran', format: 'Teks (Contoh: BF-2026-081)', required: false },
  { key: 'origin_port', label: 'Pelabuhan Asal', format: 'Nama Resmi / UNLOCODE (Contoh: Batu Ampar Port / IDBUR)', required: true },
  { key: 'destination_port', label: 'Pelabuhan Tujuan', format: 'Nama Resmi / UNLOCODE (Contoh: Port of Singapore (PSA) / SGSIN)', required: true },
  { key: 'scheduled_departure_at', label: 'Waktu Berangkat', format: 'YYYY-MM-DD HH:MM:SS (Contoh: 2026-08-17 08:00:00)', required: true },
  { key: 'scheduled_arrival_at', label: 'Waktu Tiba', format: 'YYYY-MM-DD HH:MM:SS (Contoh: 2026-08-17 10:00:00)', required: true },
  { key: 'tolerance_minutes', label: 'Toleransi Menit', format: 'Angka menit (Default: 30)', required: false },
  { key: 'notes', label: 'Catatan', format: 'Teks catatan operasional', required: false },
];

const VesselScheduleImportModal = ({ open, onClose, onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showSchemaHelp, setShowSchemaHelp] = useState(false);
  const fileInputRef = useRef(null);

  if (!open) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    setErrorMsg(null);
    setResult(null);

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const name = selectedFile.name.toLowerCase();
    const isValid = validExtensions.some((ext) => name.endsWith(ext));

    if (!isValid) {
      setErrorMsg('Format file tidak didukung. Harap unggah file .xlsx, .xls, atau .csv');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrorMsg('Ukuran file melebihi batas maksimal 10MB.');
      return;
    }

    setFile(selectedFile);
  };

  const handleDownloadTemplate = (format = 'xlsx') => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    window.open(`${baseUrl}/api/vessel-schedules/template?format=${format}`, '_blank');
  };

  const handleUpload = async () => {
    if (!file) {
      setErrorMsg('Pilih file Excel atau CSV terlebih dahulu.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await importVesselSchedules(formData);
      const resData = response.data?.data;
      setResult(resData);
      if (resData?.imported_count > 0 && onImportSuccess) {
        onImportSuccess(`Berhasil mengimpor ${resData.imported_count} jadwal kapal.`);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Gagal mengimpor file Excel/CSV.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8"
        style={{ animation: 'modal-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Modal Header */}
        <div
          className="px-6 py-5 flex items-center justify-between border-b"
          style={{
            background: `linear-gradient(135deg, ${COLORS.navy} 0%, #1e293b 100%)`,
            color: '#fff',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Import Jadwal Kapal via Spreadsheet</h2>
              <p className="text-xs text-slate-300">
                Unggah berkas Excel (.xlsx) atau CSV dengan format kolom rapi dan tidak menimpa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Template Download Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-teal-50/40 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-100 text-teal-700 shrink-0">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Unduh Template Resmi Mare Nostrum
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Template telah diatur lebar kolomnya agar tidak saling menimpa & dilengkapi daftar pelabuhan resmi.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                onClick={() => handleDownloadTemplate('xlsx')}
                type="button"
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
                title="Format Excel dengan lebar kolom rapi dan sheet referensi pelabuhan"
              >
                <Download size={13} />
                <span>Excel (.XLSX)</span>
              </button>

              <button
                onClick={() => handleDownloadTemplate('csv')}
                type="button"
                className="flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition flex items-center justify-center gap-1.5 shadow-sm"
                title="Format CSV standar dengan encoding UTF-8 BOM"
              >
                <Download size={13} />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Collapsible Schema Guide */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSchemaHelp(!showSchemaHelp)}
              className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 transition"
            >
              <span className="flex items-center gap-2">
                <Table size={15} className="text-teal-600" />
                <span>Panduan Struktur Kolom ({TEMPLATE_COLUMNS.length} Kolom)</span>
              </span>
              <span className="text-[11px] text-teal-600 font-bold">
                {showSchemaHelp ? 'Tutup Panduan ▲' : 'Lihat Rincian Kolom ▼'}
              </span>
            </button>

            {showSchemaHelp && (
              <div className="p-3 bg-white overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase">
                      <th className="py-2 px-2.5">Header Kolom</th>
                      <th className="py-2 px-2.5">Nama Field</th>
                      <th className="py-2 px-2.5">Format / Contoh Nilai</th>
                      <th className="py-2 px-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {TEMPLATE_COLUMNS.map((col) => (
                      <tr key={col.key} className="hover:bg-slate-50/60">
                        <td className="py-2 px-2.5 font-mono font-bold text-slate-800">{col.key}</td>
                        <td className="py-2 px-2.5 font-medium text-slate-700">{col.label}</td>
                        <td className="py-2 px-2.5 text-slate-500">{col.format}</td>
                        <td className="py-2 px-2.5 text-center">
                          {col.required ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                              Wajib
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                              Opsional
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle size={18} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Import Results Box */}
          {result && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">
                      Proses Impor Selesai!
                    </p>
                    <p className="text-xs text-emerald-700">
                      Total baris diproses: <b>{result.total_rows}</b> | Berhasil disimpan: <b>{result.imported_count}</b> | Dilewati: <b>{result.skipped_count}</b>
                    </p>
                  </div>
                </div>
              </div>

              {/* Errors Breakdown */}
              {result.errors && result.errors.length > 0 && (
                <div className="border border-amber-200 rounded-xl bg-amber-50/50 p-4 space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle size={15} className="text-amber-600" />
                    Baris yang Memiliki Kesalahan ({result.errors.length} baris):
                  </p>
                  <div className="space-y-1.5">
                    {result.errors.map((errItem, idx) => (
                      <div key={idx} className="text-[11px] p-2 bg-white rounded-lg border border-amber-200/80 text-slate-700">
                        <span className="font-semibold text-rose-600">Baris {errItem.row}:</span>{' '}
                        {errItem.errors?.join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dropzone */}
          {!result && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                id="excel-file-input"
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  p-8 rounded-2xl border-2 border-dashed text-center cursor-pointer transition flex flex-col items-center justify-center gap-3
                  ${
                    isDragging
                      ? 'border-teal-500 bg-teal-50/50'
                      : file
                      ? 'border-emerald-400 bg-emerald-50/20'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                  }
                `}
              >
                <div
                  className={`p-4 rounded-2xl ${
                    file ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <UploadCloud size={32} />
                </div>

                {file ? (
                  <div>
                    <p className="text-sm font-bold text-slate-800">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB — Klik atau drag file lain untuk mengganti
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Tarik & lepas file Excel/CSV di sini, atau <span className="text-teal-600 underline">pilih berkas</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Mendukung format .XLSX, .XLS, .CSV (Maksimal 10MB)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={result ? handleReset : onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
          >
            {result ? 'Impor File Lain' : 'Tutup'}
          </button>

          {!result ? (
            <button
              type="button"
              disabled={!file || loading}
              onClick={handleUpload}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition flex items-center gap-2 shadow-lg disabled:opacity-50"
              style={{
                backgroundColor: COLORS.teal,
                boxShadow: `0 4px 14px ${COLORS.teal}40`,
              }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Mengimpor Data...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={16} />
                  <span>Mulai Impor Jadwal</span>

                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 transition flex items-center gap-1.5"
            >
              <span>Selesai</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VesselScheduleImportModal;
