<?php

namespace App\Http\Controllers;

use App\Context\Country;
use App\Http\Requests\StorePortRequest;
use App\Http\Requests\UpdatePortRequest;
use App\Http\Resources\PortResource;
use App\Models\Port;
use App\Models\Trip;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class PortController extends Controller
{
    use ApiResponse;

    #[OA\Get(
        path: '/ports',
        summary: 'Get paginated list of ports',
        tags: ['Ports'],
        parameters: [
            new OA\Parameter(name: 'country', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: [Country::INDONESIA, Country::SINGAPORE])),
            new OA\Parameter(name: 'search', in: 'query', required: false, schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'List of ports retrieved successfully.'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = Port::query();

        if ($request->filled('country')) {
            $query->where('country', $request->query('country'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('unlocode', 'like', "%{$search}%");
            });
        }

        $perPage = (int) $request->query('per_page', 15);
        $ports = $query->latest('id')->paginate($perPage);

        return $this->success(
            PortResource::collection($ports),
            'List of ports retrieved successfully.'
        );
    }

    #[OA\Post(
        path: '/ports',
        summary: 'Create a new port',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'country', 'latitude', 'longitude'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Batam Centre Ferry Terminal'),
                    new OA\Property(property: 'country', type: 'string', enum: [Country::INDONESIA, Country::SINGAPORE], example: Country::INDONESIA),
                    new OA\Property(property: 'unlocode', type: 'string', example: 'IDBTH'),
                    new OA\Property(property: 'latitude', type: 'number', format: 'float', example: 1.1312345),
                    new OA\Property(property: 'longitude', type: 'number', format: 'float', example: 104.0532145),
                ]
            )
        ),
        tags: ['Ports'],
        responses: [
            new OA\Response(response: 201, description: 'Port created successfully.'),
            new OA\Response(response: 422, description: 'Validation error.'),
        ]
    )]
    public function store(StorePortRequest $request): JsonResponse
    {
        $port = Port::create($request->validated());

        return $this->success(
            new PortResource($port),
            'Port created successfully.',
            201
        );
    }

    #[OA\Get(
        path: '/ports/{id}',
        summary: 'Get single port details',
        tags: ['Ports'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', description: 'Port ID', required: true, schema: new OA\Schema(type: 'integer', example: 1)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Port details retrieved successfully.'),
            new OA\Response(response: 404, description: 'Port not found.'),
        ]
    )]
    public function show(Port $port): JsonResponse
    {
        return $this->success(
            new PortResource($port),
            'Port details retrieved successfully.'
        );
    }

    #[OA\Put(
        path: '/ports/{id}',
        summary: 'Update existing port details',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Batam Centre Ferry Terminal Updated'),
                    new OA\Property(property: 'country', type: 'string', enum: [Country::INDONESIA, Country::SINGAPORE]),
                    new OA\Property(property: 'unlocode', type: 'string', example: 'IDBTH'),
                    new OA\Property(property: 'latitude', type: 'number', format: 'float'),
                    new OA\Property(property: 'longitude', type: 'number', format: 'float'),
                ]
            )
        ),
        tags: ['Ports'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', description: 'Port ID', required: true, schema: new OA\Schema(type: 'integer', example: 1)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Port updated successfully.'),
            new OA\Response(response: 422, description: 'Validation error.'),
        ]
    )]
    public function update(UpdatePortRequest $request, Port $port): JsonResponse
    {
        $port->update($request->validated());

        return $this->success(
            new PortResource($port),
            'Port updated successfully.'
        );
    }

    #[OA\Delete(
        path: '/ports/{id}',
        summary: 'Delete a port',
        tags: ['Ports'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', description: 'Port ID', required: true, schema: new OA\Schema(type: 'integer', example: 1)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Port deleted successfully.'),
            new OA\Response(response: 422, description: 'Cannot delete port referenced in trips.'),
        ]
    )]
    public function destroy(Port $port): JsonResponse
    {
        $hasTrips = Trip::where('origin_port_id', $port->id)
            ->orWhere('destination_port_id', $port->id)
            ->orWhere('ship_destination_port_id', $port->id)
            ->exists();

        if ($hasTrips) {
            return $this->error(
                'Cannot delete port referenced in trips.',
                422
            );
        }

        $port->delete();

        return $this->success(
            null,
            'Port deleted successfully.'
        );
    }
}
