<?php

namespace App\Http\Controllers;

use App\Context\StatusTrips;
use App\Http\Resources\TripResource;
use App\Models\EmissionFactor;
use App\Models\Trip;
use App\Models\Truck;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class AnalyticsController extends Controller
{
    use ApiResponse;

    #[OA\Get(
        path: '/analytics/dashboard',
        summary: 'Get dashboard overview analytics summary',
        tags: ['Analytics'],
        parameters: [
            new OA\Parameter(name: 'period', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['today', 'this_week', 'this_month', 'all'], default: 'all')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Dashboard analytics summary retrieved successfully.'),
        ]
    )]
    public function dashboard(Request $request): JsonResponse
    {
        $period = $request->query('period', 'all');
        $query = Trip::query();

        if ($period === 'today') {
            $query->whereDate('created_at', Carbon::today());
        } elseif ($period === 'this_week') {
            $query->whereBetween('created_at', [Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek()]);
        } elseif ($period === 'this_month') {
            $query->whereMonth('created_at', Carbon::now()->month)->whereYear('created_at', Carbon::now()->year);
        }

        $totalTrips = (clone $query)->count();
        $completedTrips = (clone $query)->whereIn('status', [StatusTrips::COMPLETED, StatusTrips::ARRIVED])->count();
        $inTransitTrips = (clone $query)->whereIn('status', [
            StatusTrips::IN_TRANSIT_ORIGIN,
            StatusTrips::AT_ORIGIN_PORT,
            StatusTrips::ON_SHIP,
            StatusTrips::AT_DESTINATION_PORT,
            StatusTrips::IN_TRANSIT_DESTINATION,
        ])->count();
        $assignedTrips = (clone $query)->where('status', StatusTrips::ASSIGNED)->count();
        $draftTrips = (clone $query)->where('status', StatusTrips::DRAFT)->count();
        $cancelledTrips = (clone $query)->where('status', StatusTrips::CANCELLED)->count();

        $totalDistanceKm = (float) (clone $query)->sum('distance_km');
        $totalCo2Kg = (float) (clone $query)->sum('estimated_co2_kg');

        // Calculate average delay and recommendation accuracy for completed trips
        $completedQueryTrips = (clone $query)
            ->whereIn('status', [StatusTrips::COMPLETED, StatusTrips::ARRIVED])
            ->whereNotNull('actual_departure_at')
            ->whereNotNull('actual_arrival_at')
            ->whereNotNull('estimated_duration_min')
            ->get();

        $delays = [];
        $accurateCount = 0;

        foreach ($completedQueryTrips as $trip) {
            $actualDurationMin = round(($trip->actual_arrival_at->timestamp - $trip->actual_departure_at->timestamp) / 60);
            $delay = $actualDurationMin - $trip->estimated_duration_min;
            $delays[] = $delay;

            // Accurate if delay is within 15 minutes
            if (abs($delay) <= 15) {
                $accurateCount++;
            }
        }

        $averageDelayMinutes = count($delays) > 0 ? round(array_sum($delays) / count($delays), 1) : 0;
        $accuracyPercentage = count($completedQueryTrips) > 0 ? round(($accurateCount / count($completedQueryTrips)) * 100, 2) : 100;

        // Group emissions by truck brand/category
        $trucks = Truck::all();
        $categoryEmissions = [
            'light' => ['total_co2_kg' => 0.0, 'trips_count' => 0],
            'medium' => ['total_co2_kg' => 0.0, 'trips_count' => 0],
            'heavy' => ['total_co2_kg' => 0.0, 'trips_count' => 0],
        ];

        $tripsWithTruck = (clone $query)->whereNotNull('truck_id')->whereNotNull('estimated_co2_kg')->get();
        foreach ($tripsWithTruck as $trip) {
            $truck = $trucks->find($trip->truck_id);
            if (!$truck) continue;

            $brandLower = strtolower($truck->brand . ' ' . ($truck->model ?? ''));
            if (str_contains($brandLower, 'light') || str_contains($brandLower, 'dutro') || str_contains($brandLower, 'canter') || str_contains($brandLower, 'elf')) {
                $cat = 'light';
            } elseif (str_contains($brandLower, 'heavy') || str_contains($brandLower, 'giga') || str_contains($brandLower, 'fighter') || str_contains($brandLower, 'tronton')) {
                $cat = 'heavy';
            } else {
                $cat = 'medium';
            }

            $categoryEmissions[$cat]['total_co2_kg'] += (float) $trip->estimated_co2_kg;
            $categoryEmissions[$cat]['trips_count']++;
        }

        foreach ($categoryEmissions as $cat => $val) {
            $categoryEmissions[$cat]['total_co2_kg'] = round($val['total_co2_kg'], 2);
        }

        // Top emitting trucks
        $topTrucks = Trip::selectRaw('truck_id, SUM(estimated_co2_kg) as total_co2, COUNT(*) as trips_count')
            ->whereNotNull('truck_id')
            ->groupBy('truck_id')
            ->orderByDesc('total_co2')
            ->take(5)
            ->get()
            ->map(function ($row) use ($trucks) {
                $t = $trucks->find($row->truck_id);
                return [
                    'truck_id' => $row->truck_id,
                    'plate_number' => $t?->plate_number,
                    'brand' => $t?->brand,
                    'model' => $t?->model,
                    'total_co2_kg' => round((float) $row->total_co2, 2),
                    'trips_count' => (int) $row->trips_count,
                ];
            });

        // Recent trips
        $recentTrips = (clone $query)
            ->with(['originCompany', 'originPort', 'destinationCompany', 'destinationPort', 'truck', 'driver'])
            ->latest('id')
            ->take(5)
            ->get();

        return $this->success([
            'period' => $period,
            'summary' => [
                'total_trips' => $totalTrips,
                'completed_trips' => $completedTrips,
                'in_transit_trips' => $inTransitTrips,
                'assigned_trips' => $assignedTrips,
                'draft_trips' => $draftTrips,
                'cancelled_trips' => $cancelledTrips,
                'total_distance_km' => round($totalDistanceKm, 2),
                'total_co2_kg' => round($totalCo2Kg, 2),
                'average_delay_minutes' => $averageDelayMinutes,
                'recommendation_accuracy_percentage' => $accuracyPercentage,
            ],
            'emissions_by_truck_category' => $categoryEmissions,
            'top_emitting_trucks' => $topTrucks,
            'recent_trips' => TripResource::collection($recentTrips),
        ], 'Ringkasan analitik dashboard berhasil diambil.');
    }

    #[OA\Get(
        path: '/analytics/trips',
        summary: 'Get detailed trip estimation vs actual performance analytics',
        tags: ['Analytics'],
        parameters: [
            new OA\Parameter(name: 'status', in: 'query', required: false, schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'search', in: 'query', required: false, schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Detailed trip analytics retrieved successfully.'),
        ]
    )]
    public function trips(Request $request): JsonResponse
    {
        $query = Trip::with(['originCompany', 'originPort', 'destinationCompany', 'destinationPort', 'truck', 'driver']);

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('id', 'like', "%{$search}%")
                  ->orWhereHas('truck', fn($tr) => $tr->where('plate_number', 'like', "%{$search}%")->orWhere('brand', 'like', "%{$search}%"))
                  ->orWhereHas('driver', fn($dr) => $dr->where('name', 'like', "%{$search}%"));
            });
        }

        $perPage = (int) $request->query('per_page', 15);
        $paginator = $query->latest('id')->paginate($perPage);

        $transformedItems = collect($paginator->items())->map(function (Trip $trip) {
            $originName = $trip->originCompany?->name ?? $trip->originPort?->name;
            $originType = $trip->origin_company_id ? 'company' : 'port';

            $destName = $trip->destinationCompany?->name ?? $trip->destinationPort?->name;
            $destType = $trip->destination_company_id ? 'company' : 'port';

            $actualDurationMin = null;
            $delayMinutes = null;

            if ($trip->actual_departure_at && $trip->actual_arrival_at) {
                $actualDurationMin = (int) round(($trip->actual_arrival_at->timestamp - $trip->actual_departure_at->timestamp) / 60);
                if ($trip->estimated_duration_min !== null) {
                    $delayMinutes = $actualDurationMin - $trip->estimated_duration_min;
                }
            }

            return [
                'id' => $trip->id,
                'origin' => [
                    'name' => $originName,
                    'type' => $originType,
                ],
                'destination' => [
                    'name' => $destName,
                    'type' => $destType,
                ],
                'truck' => $trip->truck ? [
                    'id' => $trip->truck->id,
                    'plate_number' => $trip->truck->plate_number,
                    'brand' => $trip->truck->brand,
                    'model' => $trip->truck->model,
                ] : null,
                'driver' => $trip->driver ? [
                    'id' => $trip->driver->id,
                    'name' => $trip->driver->name,
                    'username' => $trip->driver->username,
                ] : null,
                'status' => $trip->status,
                'distance_km' => $trip->distance_km !== null ? (float) $trip->distance_km : null,
                'estimated_co2_kg' => $trip->estimated_co2_kg !== null ? (float) $trip->estimated_co2_kg : null,
                'estimated_duration_min' => $trip->estimated_duration_min,
                'actual_duration_min' => $actualDurationMin,
                'delay_minutes' => $delayMinutes,
                'is_delayed' => $delayMinutes !== null ? ($delayMinutes > 5) : false,
                'chosen_departure_at' => $trip->chosen_departure_at?->toISOString(),
                'actual_departure_at' => $trip->actual_departure_at?->toISOString(),
                'actual_arrival_at' => $trip->actual_arrival_at?->toISOString(),
                'created_at' => $trip->created_at?->toISOString(),
            ];
        });

        return $this->success(
            new \Illuminate\Http\Resources\Json\AnonymousResourceCollection(
                $transformedItems,
                $paginator
            ),
            'Detail analitik trip berhasil diambil.'
        );
    }
}
