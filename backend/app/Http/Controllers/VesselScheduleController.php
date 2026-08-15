<?php

namespace App\Http\Controllers;

use App\Context\Role;
use App\Context\VesselScheduleStatus;
use App\Http\Requests\CheckVesselStatusRequest;
use App\Http\Requests\ImportVesselScheduleRequest;
use App\Http\Requests\StoreVesselScheduleRequest;
use App\Http\Requests\UpdateVesselScheduleRequest;
use App\Http\Resources\VesselScheduleResource;
use App\Models\VesselSchedule;
use App\Services\VesselScheduleImportService;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VesselScheduleController extends Controller
{
    use ApiResponse;

    protected array $with = ['originPort', 'destinationPort'];

    #[OA\Get(
        path: '/vessel-schedules',
        summary: 'Get paginated list of vessel shipping schedules',
        tags: ['Vessel Schedules'],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', required: false, schema: new OA\Schema(type: 'string'), description: 'Search vessel name, MMSI, or voyage number'),
            new OA\Parameter(name: 'origin_port_id', in: 'query', required: false, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'destination_port_id', in: 'query', required: false, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'status', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: [
                VesselScheduleStatus::SCHEDULED,
                VesselScheduleStatus::DEPARTED,
                VesselScheduleStatus::ON_TIME,
                VesselScheduleStatus::DELAYED,
                VesselScheduleStatus::EARLY,
                VesselScheduleStatus::BERTHING,
                VesselScheduleStatus::ARRIVED,
                VesselScheduleStatus::CANCELLED,
            ])),
            new OA\Parameter(name: 'date', in: 'query', required: false, schema: new OA\Schema(type: 'string', format: 'date'), description: 'Filter by specific scheduled date (YYYY-MM-DD)'),
            new OA\Parameter(name: 'from_date', in: 'query', required: false, schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to_date', in: 'query', required: false, schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'List of vessel schedules retrieved successfully.'),
            new OA\Response(response: 401, description: 'Unauthenticated.'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = VesselSchedule::query()->with($this->with);

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('vessel_name', 'like', "%{$search}%")
                  ->orWhere('ship_ref_id', 'like', "%{$search}%")
                  ->orWhere('voyage_number', 'like', "%{$search}%");
            });
        }

        if ($request->filled('origin_port_id')) {
            $query->where('origin_port_id', $request->query('origin_port_id'));
        }

        if ($request->filled('destination_port_id')) {
            $query->where('destination_port_id', $request->query('destination_port_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('date')) {
            $query->whereDate('scheduled_arrival_at', $request->query('date'));
        }

        if ($request->filled('from_date')) {
            $query->whereDate('scheduled_arrival_at', '>=', $request->query('from_date'));
        }

        if ($request->filled('to_date')) {
            $query->whereDate('scheduled_arrival_at', '<=', $request->query('to_date'));
        }

        $perPage = (int) $request->query('per_page', 15);
        $schedules = $query->orderBy('scheduled_arrival_at', 'asc')->paginate($perPage);

        return $this->success(
            VesselScheduleResource::collection($schedules),
            'Vessel schedules retrieved successfully.'
        );
    }

    #[OA\Post(
        path: '/vessel-schedules',
        summary: 'Create a new vessel schedule record',
        tags: ['Vessel Schedules'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['vessel_name', 'ship_ref_id', 'origin_port_id', 'destination_port_id', 'scheduled_departure_at', 'scheduled_arrival_at'],
                properties: [
                    new OA\Property(property: 'vessel_name', type: 'string', example: 'Batam Fast 18'),
                    new OA\Property(property: 'ship_ref_id', type: 'string', example: '563123456'),
                    new OA\Property(property: 'voyage_number', type: 'string', nullable: true, example: 'BF-2026-081'),
                    new OA\Property(property: 'origin_port_id', type: 'integer', example: 1),
                    new OA\Property(property: 'destination_port_id', type: 'integer', example: 4),
                    new OA\Property(property: 'scheduled_departure_at', type: 'string', format: 'date-time', example: '2026-08-16T08:00:00Z'),
                    new OA\Property(property: 'scheduled_arrival_at', type: 'string', format: 'date-time', example: '2026-08-16T10:00:00Z'),
                    new OA\Property(property: 'status', type: 'string', enum: [
                        VesselScheduleStatus::SCHEDULED,
                        VesselScheduleStatus::DEPARTED,
                        VesselScheduleStatus::ON_TIME,
                        VesselScheduleStatus::DELAYED,
                        VesselScheduleStatus::EARLY,
                        VesselScheduleStatus::BERTHING,
                        VesselScheduleStatus::ARRIVED,
                        VesselScheduleStatus::CANCELLED,
                    ], example: 'scheduled'),
                    new OA\Property(property: 'tolerance_minutes', type: 'integer', example: 30),
                    new OA\Property(property: 'notes', type: 'string', nullable: true, example: 'Regular container batch'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Vessel schedule created successfully.'),
            new OA\Response(response: 422, description: 'Validation error.'),
        ]
    )]
    public function store(StoreVesselScheduleRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['created_by'] = $request->user()?->id;

        $schedule = VesselSchedule::create($data);

        // Compute initial distance if origin port has coordinates
        $originPort = $schedule->originPort;
        if ($originPort && $originPort->latitude && $originPort->longitude) {
            $schedule->updatePunctualityAndAlert(
                (float) $originPort->latitude,
                (float) $originPort->longitude,
                0,
                false
            );
        }

        return $this->success(
            new VesselScheduleResource($schedule->load($this->with)),
            'Vessel schedule created successfully.',
            201
        );
    }

    #[OA\Get(
        path: '/vessel-schedules/{id}',
        summary: 'Get single vessel schedule details',
        tags: ['Vessel Schedules'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Vessel schedule details retrieved successfully.'),
            new OA\Response(response: 404, description: 'Vessel schedule not found.'),
        ]
    )]
    public function show(VesselSchedule $vesselSchedule): JsonResponse
    {
        return $this->success(
            new VesselScheduleResource($vesselSchedule->load($this->with)),
            'Vessel schedule details retrieved successfully.'
        );
    }

    #[OA\Put(
        path: '/vessel-schedules/{id}',
        summary: 'Update existing vessel schedule',
        tags: ['Vessel Schedules'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'vessel_name', type: 'string'),
                    new OA\Property(property: 'ship_ref_id', type: 'string'),
                    new OA\Property(property: 'voyage_number', type: 'string', nullable: true),
                    new OA\Property(property: 'origin_port_id', type: 'integer'),
                    new OA\Property(property: 'destination_port_id', type: 'integer'),
                    new OA\Property(property: 'scheduled_departure_at', type: 'string', format: 'date-time'),
                    new OA\Property(property: 'scheduled_arrival_at', type: 'string', format: 'date-time'),
                    new OA\Property(property: 'actual_departure_at', type: 'string', format: 'date-time', nullable: true),
                    new OA\Property(property: 'actual_arrival_at', type: 'string', format: 'date-time', nullable: true),
                    new OA\Property(property: 'status', type: 'string'),
                    new OA\Property(property: 'tolerance_minutes', type: 'integer'),
                    new OA\Property(property: 'notes', type: 'string', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Vessel schedule updated successfully.'),
            new OA\Response(response: 422, description: 'Validation error.'),
        ]
    )]
    public function update(UpdateVesselScheduleRequest $request, VesselSchedule $vesselSchedule): JsonResponse
    {
        $vesselSchedule->update($request->validated());

        return $this->success(
            new VesselScheduleResource($vesselSchedule->load($this->with)),
            'Vessel schedule updated successfully.'
        );
    }

    #[OA\Delete(
        path: '/vessel-schedules/{id}',
        summary: 'Delete a vessel schedule',
        tags: ['Vessel Schedules'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Vessel schedule deleted successfully.'),
            new OA\Response(response: 403, description: 'Forbidden.'),
        ]
    )]
    public function destroy(Request $request, VesselSchedule $vesselSchedule): JsonResponse
    {
        if ($request->user()?->role !== Role::ADMIN) {
            abort(403, 'Only admin can delete vessel schedules.');
        }

        $vesselSchedule->delete();

        return $this->success(
            null,
            'Vessel schedule deleted successfully.'
        );
    }

    #[OA\Post(
        path: '/vessel-schedules/import',
        summary: 'Import vessel schedules via Excel (.xlsx, .xls) or CSV (.csv) file',
        tags: ['Vessel Schedules'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\MediaType(
                mediaType: 'multipart/form-data',
                schema: new OA\Schema(
                    required: ['file'],
                    properties: [
                        new OA\Property(property: 'file', type: 'string', format: 'binary', description: 'Excel (.xlsx/.xls) or CSV file containing vessel schedule rows'),
                    ]
                )
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'File imported successfully.'),
            new OA\Response(response: 422, description: 'Validation or file parsing error.'),
        ]
    )]
    public function import(ImportVesselScheduleRequest $request, VesselScheduleImportService $importer): JsonResponse
    {
        try {
            $file = $request->file('file');
            $userId = $request->user()?->id;

            $result = $importer->import($file, $userId);

            return $this->success([
                'total_rows' => $result['total_rows_processed'],
                'imported_count' => $result['imported_count'],
                'skipped_count' => $result['skipped_count'],
                'errors' => $result['errors'],
                'data' => VesselScheduleResource::collection(collect($result['imported'])),
            ], "Successfully imported {$result['imported_count']} vessel schedule(s).");
        } catch (Exception $e) {
            return $this->error('Failed to import file: ' . $e->getMessage(), 422);
        }
    }

    #[OA\Get(
        path: '/vessel-schedules/template',
        summary: 'Get import template structure or download styled Excel (.xlsx) or CSV template file',
        tags: ['Vessel Schedules'],
        parameters: [
            new OA\Parameter(name: 'format', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['xlsx', 'csv']), description: 'Download format (xlsx or csv)'),
            new OA\Parameter(name: 'download', in: 'query', required: false, schema: new OA\Schema(type: 'boolean'), description: 'Directly download template file'),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Template structure or downloaded spreadsheet file.'),
        ]
    )]
    public function template(Request $request, VesselScheduleImportService $importer): JsonResponse|StreamedResponse
    {
        $format = strtolower($request->query('format', ''));
        $download = $request->boolean('download');

        if ($format === 'csv') {
            return $importer->generateCsvTemplate();
        }

        if ($download || $format === 'xlsx' || $format === 'excel') {
            return $importer->generateExcelTemplate();
        }

        return $this->success($importer->getSampleTemplate(), 'Vessel schedule import template retrieved.');
    }


    #[OA\Post(
        path: '/vessel-schedules/{id}/check-status',
        summary: 'Check vessel live distance to destination port, calculate punctuality and trigger alerts',
        tags: ['Vessel Schedules'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: false,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'latitude', type: 'number', format: 'float', description: 'Manual current latitude (optional, fallback to live AIS)'),
                    new OA\Property(property: 'longitude', type: 'number', format: 'float', description: 'Manual current longitude (optional, fallback to live AIS)'),
                    new OA\Property(property: 'speed_knots', type: 'number', format: 'float', description: 'Current speed in knots'),
                    new OA\Property(property: 'notify', type: 'boolean', default: true, description: 'Whether to fire in-app notification if delay or early arrival exceeds tolerance threshold'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Vessel status, distance, and punctuality evaluated successfully.'),
            new OA\Response(response: 404, description: 'Vessel schedule not found.'),
        ]
    )]
    public function checkStatus(CheckVesselStatusRequest $request, VesselSchedule $vesselSchedule): JsonResponse
    {
        $lat = $request->input('latitude');
        $lng = $request->input('longitude');
        $speed = $request->input('speed_knots');
        $shouldNotify = $request->boolean('notify', true);

        // If coordinates not provided, try querying live AIS from VesselAPI by ship_ref_id
        if ($lat === null && $lng === null && $vesselSchedule->ship_ref_id) {
            $liveAis = $this->queryLiveAisPosition($vesselSchedule->ship_ref_id);
            if ($liveAis) {
                $lat = $liveAis['lat'];
                $lng = $liveAis['lng'];
                if ($speed === null && isset($liveAis['speed_knots'])) {
                    $speed = $liveAis['speed_knots'];
                }
            }
        }

        $result = $vesselSchedule->updatePunctualityAndAlert(
            $lat !== null ? (float) $lat : null,
            $lng !== null ? (float) $lng : null,
            $speed !== null ? (float) $speed : null,
            $shouldNotify
        );

        return $this->success([
            'schedule' => new VesselScheduleResource($vesselSchedule->fresh($this->with)),
            'analysis' => [
                'status' => $result['status'],
                'distance_to_destination_km' => $result['distance_to_destination_km'],
                'distance_to_destination_nm' => $result['distance_to_destination_nm'],
                'current_speed_knots' => $vesselSchedule->current_speed_knots,
                'variance_minutes' => $result['variance_minutes'],
                'tolerance_minutes' => $vesselSchedule->tolerance_minutes,
                'is_delayed' => $result['status'] === VesselScheduleStatus::DELAYED,
                'is_early' => $result['status'] === VesselScheduleStatus::EARLY,
                'is_on_time' => in_array($result['status'], [VesselScheduleStatus::ON_TIME, VesselScheduleStatus::BERTHING, VesselScheduleStatus::ARRIVED], true),
                'notification_sent' => $result['notification_triggered'] !== null,
                'notification_type' => $result['notification_triggered'],
            ],
        ], 'Vessel punctuality and distance evaluated successfully.');
    }

    /**
     * Helper to query live AIS data from VesselAPI.
     */
    protected function queryLiveAisPosition(string $shipRefId): ?array
    {
        $id = preg_replace('/^IMO/i', '', trim($shipRefId));
        $idType = strlen($id) === 7 ? 'imo' : 'mmsi';
        $apiKey = config('services.vesselapi.key');

        if (! $apiKey) {
            return null;
        }

        try {
            $response = Http::withHeaders(['Authorization' => "Bearer {$apiKey}"])
                ->timeout(5)
                ->get("https://api.vesselapi.com/v1/vessel/{$id}/position", ['filter.idType' => $idType]);

            if ($response->successful()) {
                $data = $response->json('vesselPosition');
                if ($data && isset($data['latitude'], $data['longitude'])) {
                    return [
                        'lat' => (float) $data['latitude'],
                        'lng' => (float) $data['longitude'],
                        'speed_knots' => isset($data['speedOverGround']) ? (float) $data['speedOverGround'] : null,
                    ];
                }
            }
        } catch (Exception) {
            // gracefully return null on network timeout
        }

        return null;
    }
}
