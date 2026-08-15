<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTruckRequest;
use App\Http\Requests\UpdateTruckRequest;
use App\Http\Resources\TruckResource;
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
            new OA\Parameter(name: 'status', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['active', 'maintenance'])),
            new OA\Parameter(name: 'fuel_type', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['diesel', 'petrol', 'electric'])),
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
            'Daftar truk berhasil diambil.'
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
                    new OA\Property(property: 'fuel_type', type: 'string', enum: ['diesel', 'petrol', 'electric'], example: 'diesel'),
                    new OA\Property(property: 'status', type: 'string', enum: ['active', 'maintenance'], example: 'active'),
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
            'Truk berhasil ditambahkan.',
            201
        );
    }

    #[OA\Get(
        path: '/trucks/{truck}',
        summary: 'Get single truck details',
        tags: ['Trucks'],
        parameters: [
            new OA\Parameter(name: 'truck', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
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
            'Detail truk berhasil diambil.'
        );
    }

    #[OA\Put(
        path: '/trucks/{truck}',
        summary: 'Update existing truck details',
        tags: ['Trucks'],
        parameters: [
            new OA\Parameter(name: 'truck', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
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
            'Data truk berhasil diperbarui.'
        );
    }

    #[OA\Delete(
        path: '/trucks/{truck}',
        summary: 'Delete a truck',
        tags: ['Trucks'],
        parameters: [
            new OA\Parameter(name: 'truck', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
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
                'Tidak dapat menghapus truk yang sudah terhubung dengan data riwayat trip.',
                422
            );
        }

        $truck->delete();

        return $this->success(
            null,
            'Truk berhasil dihapus.'
        );
    }
}
