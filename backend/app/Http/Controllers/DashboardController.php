<?php

namespace App\Http\Controllers;

use App\Context\StatusTrips;
use App\Http\Resources\TripCheckpointResource;
use App\Models\Company;
use App\Models\Notification;
use App\Models\Port;
use App\Models\Trip;
use App\Models\Truck;
use App\Models\User;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use OpenApi\Attributes as OA;

class DashboardController extends Controller
{
    use ApiResponse;

    #[OA\Get(
        path: '/dashboard',
        summary: 'Get unified consolidated data payload for the entire operational dashboard',
        description: 'Returns operational metrics, live operations, recent dispatches, monthly volume chart data, emissions analytics, and fleet status. Supports progressive tiered loading via section parameter (primary | secondary | all).',
        tags: ['Dashboard'],
        parameters: [
            new OA\Parameter(name: 'period', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['today', 'this_week', 'this_month', 'all'], default: 'all')),
            new OA\Parameter(name: 'section', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['primary', 'secondary', 'all'], default: 'all')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Dashboard data retrieved successfully.'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $period = $request->query('period', 'all');
        $section = $request->query('section', 'all');
        $userId = $request->user()?->id ?? 1;

        if ($section === 'primary') {
            $cacheKey = "unified_dashboard_primary_{$period}_user_{$userId}";
            $data = Cache::remember($cacheKey, 20, fn () => $this->getPrimaryData($period, $userId));
        } elseif ($section === 'secondary') {
            $cacheKey = "unified_dashboard_secondary_{$period}";
            $data = Cache::remember($cacheKey, 45, fn () => $this->getSecondaryData($period));
        } else {
            $cacheKey = "unified_dashboard_all_{$period}_user_{$userId}";
            $data = Cache::remember($cacheKey, 30, function () use ($period, $userId) {
                $primary = $this->getPrimaryData($period, $userId);
                $secondary = $this->getSecondaryData($period);
                return array_merge($primary, $secondary);
            });
        }

        return $this->success($data, 'Dashboard unified data retrieved successfully.');
    }

    /**
     * Tier 1: Essential & high-priority operational data (instant response).
     */
    private function getPrimaryData(string $period, int $userId): array
    {
        $query = Trip::query();
        if ($period === 'today') {
            $query->whereDate('created_at', Carbon::today());
        } elseif ($period === 'this_week') {
            $query->whereBetween('created_at', [Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek()]);
        } elseif ($period === 'this_month') {
            $query->whereMonth('created_at', Carbon::now()->month)->whereYear('created_at', Carbon::now()->year);
        }

        // Single Aggregate SQL for Summary
        $summaryStats = (clone $query)->selectRaw("
            COUNT(*) as total_trips,
            COUNT(CASE WHEN status IN ('completed', 'arrived') THEN 1 END) as completed_trips,
            COUNT(CASE WHEN status IN ('in_transit_origin', 'at_origin_port', 'on_ship', 'at_destination_port', 'in_transit_destination') THEN 1 END) as in_transit_trips,
            COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned_trips,
            COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_trips,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_trips,
            COALESCE(SUM(distance_km), 0) as total_distance_km,
            COALESCE(SUM(estimated_co2_kg), 0) as total_co2_kg
        ")->first();

        $totalTrips = (int) ($summaryStats->total_trips ?? 0);
        $completedTrips = (int) ($summaryStats->completed_trips ?? 0);
        $inTransitTrips = (int) ($summaryStats->in_transit_trips ?? 0);
        $assignedTrips = (int) ($summaryStats->assigned_trips ?? 0);
        $draftTrips = (int) ($summaryStats->draft_trips ?? 0);
        $cancelledTrips = (int) ($summaryStats->cancelled_trips ?? 0);
        $totalDistanceKm = round((float) ($summaryStats->total_distance_km ?? 0), 2);
        $totalCo2Kg = round((float) ($summaryStats->total_co2_kg ?? 0), 2);

        // Delay & Accuracy metrics for completed trips
        $completedTripsData = (clone $query)
            ->whereIn('status', [StatusTrips::COMPLETED, StatusTrips::ARRIVED])
            ->whereNotNull('actual_departure_at')
            ->whereNotNull('actual_arrival_at')
            ->whereNotNull('estimated_duration_min')
            ->select(['id', 'status', 'actual_departure_at', 'actual_arrival_at', 'estimated_duration_min'])
            ->get();

        $delays = [];
        $accurateCount = 0;

        foreach ($completedTripsData as $trip) {
            $actualDurationMin = round(($trip->actual_arrival_at->timestamp - $trip->actual_departure_at->timestamp) / 60);
            $delay = $actualDurationMin - $trip->estimated_duration_min;
            $delays[] = $delay;

            if (abs($delay) <= 15) {
                $accurateCount++;
            }
        }

        $averageDelayMinutes = count($delays) > 0 ? round(array_sum($delays) / count($delays), 1) : 0;
        $accuracyPercentage = count($completedTripsData) > 0 ? round(($accurateCount / count($completedTripsData)) * 100, 2) : 100;

        // References lookup
        $companies = Company::select(['id', 'name', 'latitude', 'longitude'])->get()->keyBy('id');
        $ports = Port::select(['id', 'name', 'latitude', 'longitude'])->get()->keyBy('id');
        $trucks = Truck::select(['id', 'plate_number', 'brand', 'model'])->get()->keyBy('id');
        $users = User::select(['id', 'name'])->get()->keyBy('id');

        $formatTrip = function ($trip) use ($companies, $ports, $trucks, $users) {
            $origComp = $trip->origin_company_id ? $companies->get($trip->origin_company_id) : null;
            $origPort = $trip->origin_port_id ? $ports->get($trip->origin_port_id) : null;
            $destComp = $trip->destination_company_id ? $companies->get($trip->destination_company_id) : null;
            $destPort = $trip->destination_port_id ? $ports->get($trip->destination_port_id) : null;
            $shipPort = $trip->ship_destination_port_id ? $ports->get($trip->ship_destination_port_id) : null;
            $truck = $trip->truck_id ? $trucks->get($trip->truck_id) : null;
            $driver = $trip->driver_id ? $users->get($trip->driver_id) : null;

            return [
                'id' => $trip->id,
                'origin' => $origComp
                    ? ['type' => 'company', 'id' => $origComp->id, 'name' => $origComp->name, 'latitude' => (float) $origComp->latitude, 'longitude' => (float) $origComp->longitude]
                    : ($origPort ? ['type' => 'port', 'id' => $origPort->id, 'name' => $origPort->name, 'latitude' => (float) $origPort->latitude, 'longitude' => (float) $origPort->longitude] : null),
                'destination' => $destComp
                    ? ['type' => 'company', 'id' => $destComp->id, 'name' => $destComp->name, 'latitude' => (float) $destComp->latitude, 'longitude' => (float) $destComp->longitude]
                    : ($destPort ? ['type' => 'port', 'id' => $destPort->id, 'name' => $destPort->name, 'latitude' => (float) $destPort->latitude, 'longitude' => (float) $destPort->longitude] : null),
                'ship_destination_port' => $shipPort ? ['id' => $shipPort->id, 'name' => $shipPort->name, 'latitude' => (float) $shipPort->latitude, 'longitude' => (float) $shipPort->longitude] : null,
                'truck_id' => $trip->truck_id,
                'driver_id' => $trip->driver_id,
                'truck' => $truck ? ['id' => $truck->id, 'plate_number' => $truck->plate_number, 'brand' => $truck->brand, 'model' => $truck->model] : null,
                'driver' => $driver ? ['id' => $driver->id, 'name' => $driver->name] : null,
                'ship_ref_id' => $trip->ship_ref_id,
                'recommended_slots' => $trip->recommended_slots,
                'chosen_departure_at' => $trip->chosen_departure_at?->toISOString(),
                'status' => $trip->status,
                'distance_km' => $trip->distance_km,
                'estimated_co2_kg' => $trip->estimated_co2_kg,
                'estimated_duration_min' => $trip->estimated_duration_min,
                'actual_departure_at' => $trip->actual_departure_at?->toISOString(),
                'actual_arrival_at' => $trip->actual_arrival_at?->toISOString(),
                'truck_returned_at' => $trip->truck_returned_at?->toISOString(),
                'created_by' => $trip->created_by,
                'created_at' => $trip->created_at?->toISOString(),
                'updated_at' => $trip->updated_at?->toISOString(),
            ];
        };

        // Active Trips & Live Operations
        $activeTrips = Trip::with(['checkpoints' => fn ($q) => $q->latest('id')->take(20)])
            ->whereIn('status', [
                StatusTrips::IN_TRANSIT_ORIGIN,
                StatusTrips::AT_ORIGIN_PORT,
                StatusTrips::ON_SHIP,
                StatusTrips::AT_DESTINATION_PORT,
                StatusTrips::IN_TRANSIT_DESTINATION,
                StatusTrips::ASSIGNED,
            ])
            ->latest('updated_at')
            ->take(10)
            ->get();

        $primaryTrip = $activeTrips->first();
        $checkpoints = $primaryTrip ? $primaryTrip->checkpoints : collect();

        // Recent Dispatches
        $recentTrips = (clone $query)
            ->latest('id')
            ->take(8)
            ->get();

        // Notification badge counter
        $unreadNotificationsCount = Notification::where('is_read', false)
            ->where('user_id', $userId)
            ->count();

        return [
            'period' => $period,
            'summary' => [
                'total_trips' => $totalTrips,
                'completed_trips' => $completedTrips,
                'in_transit_trips' => $inTransitTrips,
                'assigned_trips' => $assignedTrips,
                'draft_trips' => $draftTrips,
                'cancelled_trips' => $cancelledTrips,
                'total_distance_km' => $totalDistanceKm,
                'total_co2_kg' => $totalCo2Kg,
                'average_delay_minutes' => $averageDelayMinutes,
                'recommendation_accuracy_percentage' => $accuracyPercentage,
            ],
            'live_operations' => [
                'active_trips' => $activeTrips->map($formatTrip)->values(),
                'primary_trip' => $primaryTrip ? $formatTrip($primaryTrip) : null,
                'checkpoints' => TripCheckpointResource::collection($checkpoints)->resolve(),
            ],
            'recent_trips' => $recentTrips->map($formatTrip)->values(),
            'unread_notifications' => $unreadNotificationsCount,
        ];
    }

    /**
     * Tier 2: Heavy analytics & fleet listings (loaded progressively in background).
     */
    private function getSecondaryData(string $period): array
    {
        $query = Trip::query();
        if ($period === 'today') {
            $query->whereDate('created_at', Carbon::today());
        } elseif ($period === 'this_week') {
            $query->whereBetween('created_at', [Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek()]);
        } elseif ($period === 'this_month') {
            $query->whereMonth('created_at', Carbon::now()->month)->whereYear('created_at', Carbon::now()->year);
        }

        $allTrucks = Truck::orderBy('plate_number')->get();
        $trucksById = $allTrucks->keyBy('id');

        $fleetStatusCounts = [
            'total' => $allTrucks->count(),
            'active' => $allTrucks->where('status', 'active')->count(),
            'idle' => $allTrucks->where('status', 'idle')->count(),
            'maintenance' => $allTrucks->where('status', 'maintenance')->count(),
        ];

        // 12-Month Volume Calculation (Domestic vs Cross-border)
        $monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        $monthlyVolume = [];
        $monthlyCo2Trend = array_fill(0, 12, 0.0);

        foreach ($monthNames as $m) {
            $monthlyVolume[$m] = ['month' => $m, 'domestic' => 0, 'crossBorder' => 0];
        }

        $allTripsForYear = Trip::whereYear('created_at', Carbon::now()->year)
            ->select(['id', 'origin_port_id', 'destination_port_id', 'ship_ref_id', 'estimated_co2_kg', 'created_at'])
            ->get();

        foreach ($allTripsForYear as $t) {
            if (!$t->created_at) continue;
            $mIndex = $t->created_at->month - 1;
            $mName = $monthNames[$mIndex] ?? 'Jan';
            $isCrossBorder = (bool) ($t->ship_ref_id || $t->origin_port_id || $t->destination_port_id);

            if ($isCrossBorder) {
                $monthlyVolume[$mName]['crossBorder']++;
            } else {
                $monthlyVolume[$mName]['domestic']++;
            }

            if ($t->estimated_co2_kg) {
                $monthlyCo2Trend[$mIndex] += (float) $t->estimated_co2_kg;
            }
        }

        // Fleet Emissions Intelligence
        $categoryEmissions = [
            'light' => ['total_co2_kg' => 0.0, 'trips_count' => 0],
            'medium' => ['total_co2_kg' => 0.0, 'trips_count' => 0],
            'heavy' => ['total_co2_kg' => 0.0, 'trips_count' => 0],
        ];

        $tripsWithTruck = (clone $query)
            ->whereNotNull('truck_id')
            ->whereNotNull('estimated_co2_kg')
            ->select(['id', 'truck_id', 'estimated_co2_kg'])
            ->get();

        $totalCo2Sum = 0.0;
        foreach ($tripsWithTruck as $trip) {
            $totalCo2Sum += (float) $trip->estimated_co2_kg;
            $truck = $trucksById->get($trip->truck_id);
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

        // Top Emitting Trucks
        $topTrucks = Trip::selectRaw('truck_id, SUM(estimated_co2_kg) as total_co2, COUNT(*) as trips_count')
            ->whereNotNull('truck_id')
            ->groupBy('truck_id')
            ->orderByDesc('total_co2')
            ->take(5)
            ->get()
            ->map(function ($row) use ($trucksById) {
                $truck = $trucksById->get($row->truck_id);
                return [
                    'truck_id' => $row->truck_id,
                    'plate_number' => $truck?->plate_number,
                    'brand' => $truck?->brand,
                    'model' => $truck?->model,
                    'total_co2_kg' => round((float) $row->total_co2, 2),
                    'trips_count' => (int) $row->trips_count,
                ];
            });

        return [
            'monthly_volume' => array_values($monthlyVolume),
            'emissions' => [
                'total_co2_kg' => round($totalCo2Sum, 2),
                'category_breakdown' => $categoryEmissions,
                'top_emitting_trucks' => $topTrucks,
                'monthly_trend' => array_map(fn ($v) => round($v, 1), $monthlyCo2Trend),
            ],
            'fleet' => [
                'summary' => $fleetStatusCounts,
                'trucks' => $allTrucks->map(fn ($t) => [
                    'id' => $t->id,
                    'plate_number' => $t->plate_number,
                    'brand' => $t->brand,
                    'model' => $t->model,
                    'fuel_type' => $t->fuel_type,
                    'year' => $t->year,
                    'status' => $t->status,
                ]),
            ],
        ];
    }
}
