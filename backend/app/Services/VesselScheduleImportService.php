<?php

namespace App\Services;

use App\Context\VesselScheduleStatus;
use App\Models\Port;
use App\Models\VesselSchedule;
use Carbon\Carbon;
use Exception;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VesselScheduleImportService
{
    /**
     * Parse and import schedules from Excel (.xlsx, .xls) or CSV (.csv).
     */
    public function import(UploadedFile $file, ?int $userId = null): array
    {
        $filePath = $file->getRealPath();
        $extension = strtolower($file->getClientOriginalExtension());

        $rows = [];

        if (in_array($extension, ['xlsx', 'xls'], true)) {
            $rows = $this->readExcel($filePath);
        } else {
            $rows = $this->readCsv($filePath);
        }

        if (empty($rows)) {
            throw new Exception('The uploaded file is empty or could not be read.');
        }

        // Find header row (skips title banners if user used the styled Excel template)
        $headerRowIndex = $this->findHeaderRowIndex($rows);
        $headerRow = $rows[$headerRowIndex];
        $headers = array_map(fn ($h) => strtolower(trim((string) $h)), $headerRow);

        $dataRows = array_slice($rows, $headerRowIndex + 1);

        $portsCache = Port::all();

        $imported = [];
        $errors = [];
        $rowNumber = $headerRowIndex + 1;

        foreach ($dataRows as $row) {
            $rowNumber++;

            // Skip empty rows
            if (empty(array_filter($row, fn ($v) => $v !== null && trim((string) $v) !== ''))) {
                continue;
            }

            $data = $this->mapRowToAttributes($headers, $row);

            $validation = $this->validateRow($data, $rowNumber, $portsCache);
            if (! empty($validation['errors'])) {
                $errors[] = [
                    'row' => $rowNumber,
                    'errors' => $validation['errors'],
                    'raw_data' => $data,
                ];
                continue;
            }

            $originPort = $validation['origin_port'];
            $destPort = $validation['destination_port'];

            $schedule = VesselSchedule::create([
                'vessel_name' => $data['vessel_name'],
                'ship_ref_id' => $data['ship_ref_id'],
                'voyage_number' => $data['voyage_number'] ?? null,
                'origin_port_id' => $originPort->id,
                'destination_port_id' => $destPort->id,
                'scheduled_departure_at' => $data['scheduled_departure_at'],
                'scheduled_arrival_at' => $data['scheduled_arrival_at'],
                'status' => $data['status'] ?? VesselScheduleStatus::SCHEDULED,
                'tolerance_minutes' => ! empty($data['tolerance_minutes']) ? (int) $data['tolerance_minutes'] : 30,
                'notes' => $data['notes'] ?? null,
                'created_by' => $userId,
            ]);

            // Compute initial distance if origin port coordinates are available
            if ($originPort->latitude && $originPort->longitude) {
                $schedule->updatePunctualityAndAlert(
                    (float) $originPort->latitude,
                    (float) $originPort->longitude,
                    0,
                    false
                );
            }

            $imported[] = $schedule->load(['originPort', 'destinationPort']);
        }

        return [
            'total_rows_processed' => count($dataRows),
            'imported_count' => count($imported),
            'skipped_count' => count($errors),
            'errors' => $errors,
            'imported' => $imported,
        ];
    }

    /**
     * Find index of the actual header row (handles banner rows gracefully).
     */
    protected function findHeaderRowIndex(array $rows): int
    {
        $targetKeywords = ['vessel_name', 'nama_kapal', 'ship_ref_id', 'mmsi', 'origin_port', 'pelabuhan_asal'];

        foreach ($rows as $index => $row) {
            $rowText = strtolower(implode(' ', array_filter(array_map('strval', $row))));
            foreach ($targetKeywords as $kw) {
                if (str_contains($rowText, $kw)) {
                    return $index;
                }
            }
        }

        return 0; // Default to first row
    }

    /**
     * Read rows using PhpSpreadsheet for Excel files.
     */
    protected function readExcel(string $filePath): array
    {
        $spreadsheet = IOFactory::load($filePath);
        $worksheet = $spreadsheet->getActiveSheet();
        $rawRows = $worksheet->toArray(null, true, true, false);

        $parsedRows = [];
        foreach ($rawRows as $rIndex => $row) {
            $parsedRow = [];
            foreach ($row as $cIndex => $val) {
                // If cell was an Excel serial date number
                if (is_numeric($val) && $rIndex > 0 && ($cIndex === 5 || $cIndex === 6)) {
                    try {
                        $dt = ExcelDate::excelToDateTimeObject($val);
                        $parsedRow[] = $dt->format('Y-m-d H:i:s');
                        continue;
                    } catch (Exception) {
                        // fallback to raw value
                    }
                }
                $parsedRow[] = $val !== null ? trim((string) $val) : null;
            }
            $parsedRows[] = $parsedRow;
        }

        return $parsedRows;
    }

    /**
     * Read rows for CSV files.
     */
    protected function readCsv(string $filePath): array
    {
        $rows = [];
        if (($handle = fopen($filePath, 'r')) !== false) {
            while (($data = fgetcsv($handle, 2000, ',')) !== false) {
                $rows[] = array_map(fn ($v) => trim((string) $v), $data);
            }
            fclose($handle);
        }

        return $rows;
    }

    /**
     * Normalize mapped column headers to attribute keys.
     */
    protected function mapRowToAttributes(array $headers, array $row): array
    {
        $data = [];

        foreach ($headers as $index => $header) {
            $value = $row[$index] ?? null;

            if (in_array($header, ['vessel_name', 'nama_kapal', 'vessel', 'ship_name', 'nama kapal'], true)) {
                $data['vessel_name'] = $value;
            } elseif (in_array($header, ['ship_ref_id', 'mmsi', 'imo', 'mmsi_imo', 'id_kapal', 'ship_id', 'mmsi / imo'], true)) {
                $data['ship_ref_id'] = $value;
            } elseif (in_array($header, ['voyage_number', 'voyage', 'no_pelayaran', 'trip_no', 'no pelayaran'], true)) {
                $data['voyage_number'] = $value;
            } elseif (in_array($header, ['origin_port', 'origin_port_id', 'pelabuhan_asal', 'origin', 'from_port', 'pelabuhan asal'], true)) {
                $data['origin_port'] = $value;
            } elseif (in_array($header, ['destination_port', 'destination_port_id', 'pelabuhan_tujuan', 'destination', 'to_port', 'pelabuhan tujuan'], true)) {
                $data['destination_port'] = $value;
            } elseif (in_array($header, ['scheduled_departure_at', 'etd', 'departure_time', 'waktu_keberangkatan', 'berangkat', 'waktu keberangkatan'], true)) {
                $data['scheduled_departure_at'] = $value;
            } elseif (in_array($header, ['scheduled_arrival_at', 'eta', 'arrival_time', 'waktu_kedatangan', 'tiba', 'waktu kedatangan'], true)) {
                $data['scheduled_arrival_at'] = $value;
            } elseif (in_array($header, ['tolerance_minutes', 'tolerance', 'toleransi_menit', 'toleransi menit'], true)) {
                $data['tolerance_minutes'] = $value;
            } elseif (in_array($header, ['status'], true)) {
                $data['status'] = $value;
            } elseif (in_array($header, ['notes', 'catatan', 'keterangan'], true)) {
                $data['notes'] = $value;
            }
        }

        return $data;
    }

    /**
     * Validate an individual row's data.
     */
    protected function validateRow(array &$data, int $rowNumber, $portsCache): array
    {
        $errors = [];

        if (empty($data['vessel_name'])) {
            $errors[] = 'Nama kapal wajib diisi.';
        }

        if (empty($data['ship_ref_id'])) {
            $errors[] = 'Nomor MMSI / IMO kapal wajib diisi.';
        }

        // Match origin port
        $originPort = $this->resolvePort($data['origin_port'] ?? null, $portsCache);
        if (! $originPort) {
            $errors[] = "Pelabuhan asal '{$data['origin_port']}' tidak ditemukan (gunakan nama pelabuhan resmi atau UNLOCODE).";
        }

        // Match destination port
        $destPort = $this->resolvePort($data['destination_port'] ?? null, $portsCache);
        if (! $destPort) {
            $errors[] = "Pelabuhan tujuan '{$data['destination_port']}' tidak ditemukan.";
        }

        if ($originPort && $destPort && $originPort->id === $destPort->id) {
            $errors[] = 'Pelabuhan asal dan pelabuhan tujuan tidak boleh sama.';
        }

        // Parse departure date
        $departureDate = null;
        if (empty($data['scheduled_departure_at'])) {
            $errors[] = 'Waktu keberangkatan wajib diisi.';
        } else {
            try {
                $departureDate = Carbon::parse($data['scheduled_departure_at']);
                $data['scheduled_departure_at'] = $departureDate;
            } catch (Exception) {
                $errors[] = "Format tanggal keberangkatan salah: '{$data['scheduled_departure_at']}'. Gunakan format YYYY-MM-DD HH:MM:SS.";
            }
        }

        // Parse arrival date
        if (empty($data['scheduled_arrival_at'])) {
            $errors[] = 'Waktu kedatangan wajib diisi.';
        } else {
            try {
                $arrivalDate = Carbon::parse($data['scheduled_arrival_at']);
                $data['scheduled_arrival_at'] = $arrivalDate;

                if ($departureDate && $arrivalDate->lessThanOrEqualTo($departureDate)) {
                    $errors[] = 'Waktu kedatangan harus setelah waktu keberangkatan.';
                }
            } catch (Exception) {
                $errors[] = "Format tanggal kedatangan salah: '{$data['scheduled_arrival_at']}'. Gunakan format YYYY-MM-DD HH:MM:SS.";
            }
        }

        // Status
        if (! empty($data['status'])) {
            $status = strtolower(trim($data['status']));
            if (! in_array($status, VesselScheduleStatus::all(), true)) {
                $data['status'] = VesselScheduleStatus::SCHEDULED;
            } else {
                $data['status'] = $status;
            }
        } else {
            $data['status'] = VesselScheduleStatus::SCHEDULED;
        }

        return [
            'errors' => $errors,
            'origin_port' => $originPort,
            'destination_port' => $destPort,
        ];
    }

    /**
     * Resolve port by ID, UNLOCODE, or exact/partial name.
     */
    protected function resolvePort(?string $identifier, $portsCache): ?Port
    {
        if (! $identifier) {
            return null;
        }

        $idClean = trim($identifier);

        // 1. Direct ID match
        if (is_numeric($idClean)) {
            $port = $portsCache->firstWhere('id', (int) $idClean);
            if ($port) {
                return $port;
            }
        }

        // 2. Direct UNLOCODE match
        $port = $portsCache->first(function ($p) use ($idClean) {
            return strcasecmp($p->unlocode ?? '', $idClean) === 0;
        });
        if ($port) {
            return $port;
        }

        // 3. Exact Name match
        $port = $portsCache->first(function ($p) use ($idClean) {
            return strcasecmp($p->name, $idClean) === 0;
        });
        if ($port) {
            return $port;
        }

        // 4. Partial Name match
        $port = $portsCache->first(function ($p) use ($idClean) {
            return stripos($p->name, $idClean) !== false || stripos($idClean, $p->name) !== false;
        });

        return $port;
    }

    /**
     * Generate a professionally styled Excel (.xlsx) template with broad column widths,
     * header branding, and an official port reference sheet.
     */
    public function generateExcelTemplate(): StreamedResponse
    {
        $spreadsheet = new Spreadsheet();

        // ── Sheet 1: Input Data ──────────────────────────────────────
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Jadwal Kapal');
        $sheet->setShowGridLines(true);

        // Header Title Banner
        $sheet->mergeCells('A1:I1');
        $sheet->setCellValue('A1', 'MARE NOSTRUM — TEMPLATE IMPORT JADWAL PELAYARAN KAPAL');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(13)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FFFFFFFF'));
        $sheet->getStyle('A1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF0F2942'); // Mare Nostrum Navy
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
        $sheet->getRowDimension(1)->setRowHeight(32);

        // Instruction Subtitle
        $sheet->mergeCells('A2:I2');
        $sheet->setCellValue('A2', 'Petunjuk: Isi data mulai baris 5. Format tanggal wajib YYYY-MM-DD HH:MM:SS. Lihat sheet "Daftar Pelabuhan Resmi" untuk nama pelabuhan.');
        $sheet->getStyle('A2')->getFont()->setSize(10)->setItalic(true)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF334155'));
        $sheet->getStyle('A2')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFF1F5F9');
        $sheet->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT)->setVertical(Alignment::VERTICAL_CENTER)->setIndent(1);
        $sheet->getRowDimension(2)->setRowHeight(22);

        // Empty separator row 3
        $sheet->getRowDimension(3)->setRowHeight(10);

        // Table Column Headers (Row 4)
        $headers = [
            'A4' => ['vessel_name', 'Nama Kapal (Wajib)', 26],
            'B4' => ['ship_ref_id', 'MMSI / IMO (Wajib)', 20],
            'C4' => ['voyage_number', 'No. Pelayaran (Opsional)', 22],
            'D4' => ['origin_port', 'Pelabuhan Asal (Wajib)', 30],
            'E4' => ['destination_port', 'Pelabuhan Tujuan (Wajib)', 30],
            'F4' => ['scheduled_departure_at', 'Waktu Berangkat (Wajib)', 25],
            'G4' => ['scheduled_arrival_at', 'Waktu Tiba (Wajib)', 25],
            'H4' => ['tolerance_minutes', 'Toleransi Menit (Default 30)', 24],
            'I4' => ['notes', 'Catatan Operasional', 35],
        ];

        $sheet->getRowDimension(4)->setRowHeight(28);

        foreach ($headers as $cell => [$colKey, $colLabel, $colWidth]) {
            $sheet->setCellValue($cell, $colKey);
            $colLetter = substr($cell, 0, 1);
            $sheet->getColumnDimension($colLetter)->setWidth($colWidth);
        }

        // Style header row 4
        $headerStyle = [
            'font' => [
                'bold' => true,
                'size' => 11,
                'color' => ['argb' => 'FFFFFFFF'],
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['argb' => 'FF0D9488'], // Mare Nostrum Teal
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
                'wrapText' => false,
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['argb' => 'FF047857'],
                ],
            ],
        ];
        $sheet->getStyle('A4:I4')->applyFromArray($headerStyle);

        // Sample Data Rows (Row 5 - 7)
        $now = Carbon::now();
        $sampleRows = [
            [
                'Batam Fast 18',
                '563123456',
                'BF-2026-081',
                'Batu Ampar Port',
                'Port of Singapore (PSA)',
                $now->copy()->addDays(1)->setTime(8, 0)->format('Y-m-d H:i:s'),
                $now->copy()->addDays(1)->setTime(10, 0)->format('Y-m-d H:i:s'),
                30,
                'Layanan shuttle kontainer reguler Batam - Singapura',
            ],
            [
                'Majestic Pride',
                '563987654',
                'MJ-2026-104',
                'Port of Singapore (PSA)',
                'Batu Ampar Port',
                $now->copy()->addDays(1)->setTime(13, 30)->format('Y-m-d H:i:s'),
                $now->copy()->addDays(1)->setTime(15, 30)->format('Y-m-d H:i:s'),
                25,
                'Prioritas kargo industri Batamindo',
            ],
            [
                'Asian Express 2',
                '563554433',
                'AE-2026-042',
                'Sekupang Port',
                'Jurong Port',
                $now->copy()->addDays(2)->setTime(9, 0)->format('Y-m-d H:i:s'),
                $now->copy()->addDays(2)->setTime(11, 30)->format('Y-m-d H:i:s'),
                20,
                'Feri kargo berkecepatan tinggi (22+ knots)',
            ],
        ];

        $rowIndex = 5;
        foreach ($sampleRows as $row) {
            $sheet->getRowDimension($rowIndex)->setRowHeight(22);

            $sheet->setCellValueExplicit("A{$rowIndex}", $row[0], DataType::TYPE_STRING);
            $sheet->setCellValueExplicit("B{$rowIndex}", $row[1], DataType::TYPE_STRING);
            $sheet->setCellValueExplicit("C{$rowIndex}", $row[2], DataType::TYPE_STRING);
            $sheet->setCellValueExplicit("D{$rowIndex}", $row[3], DataType::TYPE_STRING);
            $sheet->setCellValueExplicit("E{$rowIndex}", $row[4], DataType::TYPE_STRING);
            $sheet->setCellValueExplicit("F{$rowIndex}", $row[5], DataType::TYPE_STRING);
            $sheet->setCellValueExplicit("G{$rowIndex}", $row[6], DataType::TYPE_STRING);
            $sheet->setCellValueExplicit("H{$rowIndex}", (string) $row[7], DataType::TYPE_NUMERIC);
            $sheet->setCellValueExplicit("I{$rowIndex}", $row[8], DataType::TYPE_STRING);

            // Row style
            $sheet->getStyle("A{$rowIndex}:I{$rowIndex}")->applyFromArray([
                'font' => ['size' => 10],
                'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
                'borders' => [
                    'allBorders' => [
                        'borderStyle' => Border::BORDER_THIN,
                        'color' => ['argb' => 'FFE2E8F0'],
                    ],
                ],
            ]);

            // Alignment tweaks
            $sheet->getStyle("B{$rowIndex}:C{$rowIndex}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle("F{$rowIndex}:H{$rowIndex}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

            $rowIndex++;
        }

        // ── Sheet 2: Daftar Pelabuhan Resmi ─────────────────────────
        $refSheet = $spreadsheet->createSheet();
        $refSheet->setTitle('Daftar Pelabuhan Resmi');
        $refSheet->setShowGridLines(true);

        $refSheet->mergeCells('A1:E1');
        $refSheet->setCellValue('A1', 'DAFTAR NAMA PELABUHAN TERDAFTAR (REFERENSI RESMI)');
        $refSheet->getStyle('A1')->getFont()->setBold(true)->setSize(12)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FFFFFFFF'));
        $refSheet->getStyle('A1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF0F2942');
        $refSheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
        $refSheet->getRowDimension(1)->setRowHeight(28);

        $refHeaders = ['A2' => 'ID Pelabuhan', 'B2' => 'Nama Pelabuhan Resmi', 'C2' => 'Negara', 'D2' => 'Kode UN/LOCODE', 'E2' => 'Koordinat'];
        $refSheet->getRowDimension(2)->setRowHeight(24);
        foreach ($refHeaders as $cell => $val) {
            $refSheet->setCellValue($cell, $val);
        }
        $refSheet->getStyle('A2:E2')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF0D9488']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);

        $refSheet->getColumnDimension('A')->setWidth(16);
        $refSheet->getColumnDimension('B')->setWidth(35);
        $refSheet->getColumnDimension('C')->setWidth(18);
        $refSheet->getColumnDimension('D')->setWidth(20);
        $refSheet->getColumnDimension('E')->setWidth(30);

        $ports = Port::all();
        $refRowIndex = 3;
        foreach ($ports as $port) {
            $refSheet->getRowDimension($refRowIndex)->setRowHeight(20);
            $refSheet->setCellValue("A{$refRowIndex}", $port->id);
            $refSheet->setCellValue("B{$refRowIndex}", $port->name);
            $refSheet->setCellValue("C{$refRowIndex}", $port->country === 'singapore' ? 'Singapura 🇸🇬' : 'Indonesia 🇮🇩');
            $refSheet->setCellValue("D{$refRowIndex}", $port->unlocode ?: '-');
            $refSheet->setCellValue("E{$refRowIndex}", "{$port->latitude}, {$port->longitude}");

            $refSheet->getStyle("A{$refRowIndex}:E{$refRowIndex}")->applyFromArray([
                'font' => ['size' => 10],
                'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
                'borders' => [
                    'allBorders' => [
                        'borderStyle' => Border::BORDER_THIN,
                        'color' => ['argb' => 'FFE2E8F0'],
                    ],
                ],
            ]);
            $refSheet->getStyle("A{$refRowIndex}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $refSheet->getStyle("D{$refRowIndex}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $refRowIndex++;
        }

        // Set active sheet back to Sheet 1
        $spreadsheet->setActiveSheetIndex(0);

        $filename = 'template_jadwal_kapal_marenostrum.xlsx';
        $headers = [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'max-age=0',
        ];

        $callback = function () use ($spreadsheet) {
            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Generate a clean UTF-8 CSV template with BOM so Excel opens it with clean separate columns.
     */
    public function generateCsvTemplate(): StreamedResponse
    {
        $filename = 'template_jadwal_kapal_marenostrum.csv';
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $sample = $this->getSampleTemplate();

        $callback = function () use ($sample) {
            $file = fopen('php://output', 'w');
            // Write UTF-8 BOM so Microsoft Excel automatically recognizes encoding and delimiters
            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($file, $sample['headers']);
            foreach ($sample['sample_rows'] as $row) {
                fputcsv($file, array_values($row));
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Provide sample template rows for documentation and CSV generation.
     */
    public function getSampleTemplate(): array
    {
        $now = Carbon::now();

        return [
            'headers' => [
                'vessel_name',
                'ship_ref_id',
                'voyage_number',
                'origin_port',
                'destination_port',
                'scheduled_departure_at',
                'scheduled_arrival_at',
                'tolerance_minutes',
                'notes',
            ],
            'sample_rows' => [
                [
                    'vessel_name' => 'Batam Fast 18',
                    'ship_ref_id' => '563123456',
                    'voyage_number' => 'BF-2026-081',
                    'origin_port' => 'Batu Ampar Port',
                    'destination_port' => 'Port of Singapore (PSA)',
                    'scheduled_departure_at' => $now->copy()->addDays(1)->setTime(8, 0)->format('Y-m-d H:i:s'),
                    'scheduled_arrival_at' => $now->copy()->addDays(1)->setTime(10, 0)->format('Y-m-d H:i:s'),
                    'tolerance_minutes' => 30,
                    'notes' => 'Layanan shuttle kontainer reguler Batam - Singapura',
                ],
                [
                    'vessel_name' => 'Majestic Pride',
                    'ship_ref_id' => '563987654',
                    'voyage_number' => 'MJ-2026-104',
                    'origin_port' => 'Port of Singapore (PSA)',
                    'destination_port' => 'Batu Ampar Port',
                    'scheduled_departure_at' => $now->copy()->addDays(1)->setTime(13, 30)->format('Y-m-d H:i:s'),
                    'scheduled_arrival_at' => $now->copy()->addDays(1)->setTime(15, 30)->format('Y-m-d H:i:s'),
                    'tolerance_minutes' => 25,
                    'notes' => 'Prioritas kargo industri Batamindo',
                ],
                [
                    'vessel_name' => 'Asian Express 2',
                    'ship_ref_id' => '563554433',
                    'voyage_number' => 'AE-2026-042',
                    'origin_port' => 'Sekupang Port',
                    'destination_port' => 'Jurong Port',
                    'scheduled_departure_at' => $now->copy()->addDays(2)->setTime(9, 0)->format('Y-m-d H:i:s'),
                    'scheduled_arrival_at' => $now->copy()->addDays(2)->setTime(11, 30)->format('Y-m-d H:i:s'),
                    'tolerance_minutes' => 20,
                    'notes' => 'Feri kargo berkecepatan tinggi (22+ knots)',
                ],
            ],
        ];
    }
}
