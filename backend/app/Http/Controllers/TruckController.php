<?php

namespace App\Http\Controllers;

use App\Context\FuelType;
use App\Context\Status;
use App\Http\Requests\StoreTruckRequest;
use App\Http\Requests\UpdateTruckRequest;
use App\Http\Resources\TruckResource;
use App\Models\EmissionFactor;
use App\Models\Trip;
use App\Models\Truck;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class TruckController extends Controller
{
    use ApiResponse;

    #[OA\Get(
        path: '/trucks',
        summary: 'Get paginated list of trucks',
        tags: ['Trucks'],
        parameters: [
            new OA\Parameter(name: 'status', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: [Status::ACTIVE, Status::MAINTENANCE])),
            new OA\Parameter(name: 'fuel_type', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: [FuelType::DIESEL, FuelType::GASOLINE, FuelType::ELECTRIC])),
            new OA\Parameter(name: 'search', in: 'query', required: false, schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'List of trucks retrieved successfully.'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = Truck::query();

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('fuel_type')) {
            $query->where('fuel_type', $request->query('fuel_type'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('plate_number', 'like', "%{$search}%")
                  ->orWhere('brand', 'like', "%{$search}%")
                  ->orWhere('model', 'like', "%{$search}%");
            });
        }

        $perPage = (int) $request->query('per_page', 15);
        $trucks = $query->latest('id')->paginate($perPage);

        return $this->success(
            TruckResource::collection($trucks),
            'List of trucks retrieved successfully.'
        );
    }

    #[OA\Post(
        path: '/trucks',
        summary: 'Create a new truck',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['plate_number', 'brand', 'year', 'fuel_type'],
                properties: [
                    new OA\Property(property: 'plate_number', type: 'string', example: 'BP 1004 XY'),
                    new OA\Property(property: 'brand', type: 'string', example: 'Hino'),
                    new OA\Property(property: 'model', type: 'string', example: 'Dutro 130 HD'),
                    new OA\Property(property: 'year', type: 'integer', example: 2022),
                    new OA\Property(property: 'fuel_type', type: 'string', enum: [FuelType::DIESEL, FuelType::GASOLINE, FuelType::ELECTRIC], example: FuelType::DIESEL),
                    new OA\Property(property: 'status', type: 'string', enum: [Status::ACTIVE, Status::MAINTENANCE], example: Status::ACTIVE),
                ]
            )
        ),
        tags: ['Trucks'],
        responses: [
            new OA\Response(response: 201, description: 'Truck created successfully.'),
            new OA\Response(response: 422, description: 'Validation error.'),
        ]
    )]
    public function store(StoreTruckRequest $request): JsonResponse
    {
        $truck = Truck::create($request->validated());

        return $this->success(
            new TruckResource($truck),
            'Truck created successfully.',
            201
        );
    }

    #[OA\Get(
        path: '/trucks/{id}',
        summary: 'Get single truck details',
        tags: ['Trucks'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Truck details retrieved successfully.'),
            new OA\Response(response: 404, description: 'Truck not found.'),
        ]
    )]
    public function show(Truck $truck): JsonResponse
    {
        return $this->success(
            new TruckResource($truck),
            'Truck details retrieved successfully.'
        );
    }

    #[OA\Put(
        path: '/trucks/{id}',
        summary: 'Update existing truck details',
        tags: ['Trucks'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Truck updated successfully.'),
            new OA\Response(response: 422, description: 'Validation error.'),
        ]
    )]
    public function update(UpdateTruckRequest $request, Truck $truck): JsonResponse
    {
        $truck->update($request->validated());

        return $this->success(
            new TruckResource($truck),
            'Truck updated successfully.'
        );
    }

    #[OA\Delete(
        path: '/trucks/{id}',
        summary: 'Delete a truck',
        tags: ['Trucks'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Truck deleted successfully.'),
            new OA\Response(response: 422, description: 'Cannot delete truck assigned to trips.'),
        ]
    )]
    public function destroy(Truck $truck): JsonResponse
    {
        $hasTrips = Trip::where('truck_id', $truck->id)->exists();

        if ($hasTrips) {
            return $this->error(
                'Cannot delete truck referenced in trip history.',
                422
            );
        }

        $truck->delete();

        return $this->success(
            null,
            'Truck deleted successfully.'
        );
    }

    #[OA\Get(
        path: '/trucks/{id}/emissions',
        summary: 'Get total CO2 emissions and trip breakdown for a truck',
        tags: ['Trucks'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Truck emissions calculated successfully.'),
            new OA\Response(response: 404, description: 'Truck not found.'),
        ]
    )]
    public function emissions(Truck $truck): JsonResponse
    {
        $tripsQuery = Trip::where('truck_id', $truck->id);

        $totalTrips = (clone $tripsQuery)->count();
        $totalDistanceKm = (float) (clone $tripsQuery)->sum('distance_km');
        $totalCo2Kg = (float) (clone $tripsQuery)->sum('estimated_co2_kg');
        $emissionFactorKgPerKm = EmissionFactor::getFactorForTruck($truck);

        $trips = (clone $tripsQuery)
            ->latest('id')
            ->select(['id', 'status', 'distance_km', 'estimated_co2_kg', 'chosen_departure_at', 'actual_departure_at', 'actual_arrival_at', 'created_at'])
            ->get();

        return $this->success([
            'truck' => new TruckResource($truck),
            'emission_factor_kg_per_km' => $emissionFactorKgPerKm,
            'summary' => [
                'total_trips' => $totalTrips,
                'total_distance_km' => round($totalDistanceKm, 2),
                'total_co2_kg' => round($totalCo2Kg, 2),
                'average_co2_per_trip_kg' => $totalTrips > 0 ? round($totalCo2Kg / $totalTrips, 2) : 0,
            ],
            'trips' => $trips,
        ], 'Truck CO2 emissions data retrieved successfully.');
    }
}
