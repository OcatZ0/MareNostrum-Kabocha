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
        description: 'Returns pre-aggregated operational metrics, monthly domestic vs cross-border volume chart data, live operations with checkpoints, emissions analytics, fleet status, and recent dispatches in a single fast response.',
        tags: ['Dashboard'],
        parameters: [
            new OA\Parameter(name: 'period', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['today', 'this_week', 'this_month', 'all'], default: 'all')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Dashboard data retrieved successfully.'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $period = $request->query('period', 'all');
        $userId = $request->user()?->id ?? 1;
        $cacheKey = "unified_dashboard_{$period}_user_{$userId}";

        // Cache for 30 seconds to maximize speed on concurrent or frequent component interactions
        $data = Cache::remember($cacheKey, 30, function () use ($period, $userId) {
            // ── 1. Base Query with Period Filter ─────────────────────────────
            $query = Trip::query();

            if ($period === 'today') {
                $query->whereDate('created_at', Carbon::today());
            } elseif ($period === 'this_week') {
                $query->whereBetween('created_at', [Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek()]);
            } elseif ($period === 'this_month') {
                $query->whereMonth('created_at', Carbon::now()->month)->whereYear('created_at', Carbon::now()->year);
            }

            // ── 2. Single Aggregate SQL for Summary & Performance Metrics ─────
            $summaryStats = (clone $query)->selectRaw("
                COUNT(*) as total_trips,
                COUNT(CASE WHEN status IN ('completed', 'arrived') THEN 1 END) as completed_trips,
                COUNT(CASE WHEN status IN ('in_transit_origin', 'at_origin_port', 'on_ship', 'at_destination_port', 'in_transit_destination') THEN 1 END) as in_transit_trips,
                COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned_trips,
                COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_trips,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_trips,
                COALESCE(SUM(distance_km), 0) as total_distance_km,
                COALESCE(SUM(estimated_co2_kg), 0) as total_co2_kg,
                AVG(CASE 
                    WHEN status IN ('completed', 'arrived') 
                     AND actual_departure_at IS NOT NULL 
                     AND actual_arrival_at IS NOT NULL 
                     AND estimated_duration_min IS NOT NULL 
                    THEN (EXTRACT(EPOCH FROM (actual_arrival_at - actual_departure_at))/60.0 - estimated_duration_min)
                END) as avg_delay_minutes,
                COUNT(CASE 
                    WHEN status IN ('completed', 'arrived') 
                     AND actual_departure_at IS NOT NULL 
                     AND actual_arrival_at IS NOT NULL 
                     AND estimated_duration_min IS NOT NULL 
                     AND ABS((EXTRACT(EPOCH FROM (actual_arrival_at - actual_departure_at))/60.0 - estimated_duration_min)) <= 15
                    THEN 1
                END) as accurate_count,
                COUNT(CASE 
                    WHEN status IN ('completed', 'arrived') 
                     AND actual_departure_at IS NOT NULL 
                     AND actual_arrival_at IS NOT NULL 
                     AND estimated_duration_min IS NOT NULL 
                    THEN 1
                END) as evaluated_count
            ")->first();

            $totalTrips = (int) ($summaryStats->total_trips ?? 0);
            $completedTrips = (int) ($summaryStats->completed_trips ?? 0);
            $inTransitTrips = (int) ($summaryStats->in_transit_trips ?? 0);
            $assignedTrips = (int) ($summaryStats->assigned_trips ?? 0);
            $draftTrips = (int) ($summaryStats->draft_trips ?? 0);
            $cancelledTrips = (int) ($summaryStats->cancelled_trips ?? 0);
            $totalDistanceKm = round((float) ($summaryStats->total_distance_km ?? 0), 2);
            $totalCo2Kg = round((float) ($summaryStats->total_co2_kg ?? 0), 2);
            $averageDelayMinutes = round((float) ($summaryStats->avg_delay_minutes ?? 0), 1);
            
            $evaluatedCount = (int) ($summaryStats->evaluated_count ?? 0);
            $accurateCount = (int) ($summaryStats->accurate_count ?? 0);
            $accuracyPercentage = $evaluatedCount > 0 ? round(($accurateCount / $evaluatedCount) * 100, 2) : 100;

            // ── 3. Reference Lookup Collections (Loaded once, 0 N+1) ──────────
            $allTrucks = Truck::orderBy('plate_number')->get();
            $trucksById = $allTrucks->keyBy('id');
            $companies = Company::select(['id', 'name', 'latitude', 'longitude'])->get()->keyBy('id');
            $ports = Port::select(['id', 'name', 'latitude', 'longitude'])->get()->keyBy('id');
            $users = User::select(['id', 'name'])->get()->keyBy('id');

            $fleetStatusCounts = [
                'total' => $allTrucks->count(),
                'active' => $allTrucks->where('status', 'active')->count(),
                'idle' => $allTrucks->where('status', 'idle')->count(),
                'maintenance' => $allTrucks->where('status', 'maintenance')->count(),
            ];

            // ── 4. Monthly Volume Calculation (Domestic vs Cross-border) ─────
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

            // ── 5. Helper to Format Trip Using In-Memory References ──────────
            $formatTrip = function ($trip) use ($companies, $ports, $trucksById, $users) {
                $origComp = $trip->origin_company_id ? $companies->get($trip->origin_company_id) : null;
                $origPort = $trip->origin_port_id ? $ports->get($trip->origin_port_id) : null;
                $destComp = $trip->destination_company_id ? $companies->get($trip->destination_company_id) : null;
                $destPort = $trip->destination_port_id ? $ports->get($trip->destination_port_id) : null;
                $shipPort = $trip->ship_destination_port_id ? $ports->get($trip->ship_destination_port_id) : null;
                $truck = $trip->truck_id ? $trucksById->get($trip->truck_id) : null;
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

            // ── 6. Live Operations & Active Trip Checkpoints ─────────────────
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

            // ── 7. Fleet Emissions Intelligence (Using In-Memory Map) ─────────
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

            foreach ($tripsWithTruck as $trip) {
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

            // Top emitting vehicles (Using In-Memory Map)
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

            // ── 8. Recent Operational Dispatches ─────────────────────────────
            $recentTrips = (clone $query)
                ->latest('id')
                ->take(8)
                ->get();

            // ── 9. Notification Badge Counter ────────────────────────────────
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
                'monthly_volume' => array_values($monthlyVolume),
                'live_operations' => [
                    'active_trips' => $activeTrips->map($formatTrip)->values(),
                    'primary_trip' => $primaryTrip ? $formatTrip($primaryTrip) : null,
                    'checkpoints' => TripCheckpointResource::collection($checkpoints)->resolve(),
                ],
                'emissions' => [
                    'total_co2_kg' => $totalCo2Kg,
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
                'recent_trips' => $recentTrips->map($formatTrip)->values(),
                'unread_notifications' => $unreadNotificationsCount,
            ];
        });

        return $this->success($data, 'Dashboard unified data retrieved successfully.');
    }
}
