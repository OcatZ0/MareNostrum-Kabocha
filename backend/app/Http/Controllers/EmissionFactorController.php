<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEmissionFactorRequest;
use App\Http\Requests\UpdateEmissionFactorRequest;
use App\Http\Resources\EmissionFactorResource;
use App\Models\EmissionFactor;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class EmissionFactorController extends Controller
{
    use ApiResponse;

    #[OA\Get(
        path: '/emission-factors',
        summary: 'Get list of emission factors',
        tags: ['Emission Factors'],
        parameters: [
            new OA\Parameter(name: 'truck_category', in: 'query', required: false, schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'List of emission factors retrieved successfully.'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = EmissionFactor::query();

        if ($request->filled('truck_category')) {
            $query->where('truck_category', $request->query('truck_category'));
        }

        $perPage = (int) $request->query('per_page', 15);
        $factors = $query->orderBy('truck_category')->orderBy('age_min_year')->paginate($perPage);

        return $this->success(
            EmissionFactorResource::collection($factors),
            'Daftar faktor emisi berhasil diambil.'
        );
    }

    #[OA\Post(
        path: '/emission-factors',
        summary: 'Create a new emission factor reference',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['truck_category', 'age_min_year', 'factor_kg_per_km'],
                properties: [
                    new OA\Property(property: 'truck_category', type: 'string', example: 'medium'),
                    new OA\Property(property: 'age_min_year', type: 'integer', example: 0),
                    new OA\Property(property: 'age_max_year', type: 'integer', nullable: true, example: 5),
                    new OA\Property(property: 'factor_kg_per_km', type: 'number', format: 'float', example: 0.5500),
                ]
            )
        ),
        tags: ['Emission Factors'],
        responses: [
            new OA\Response(response: 201, description: 'Emission factor created successfully.'),
            new OA\Response(response: 422, description: 'Validation error.'),
        ]
    )]
    public function store(StoreEmissionFactorRequest $request): JsonResponse
    {
        $factor = EmissionFactor::create($request->validated());

        return $this->success(
            new EmissionFactorResource($factor),
            'Faktor emisi berhasil ditambahkan.',
            201
        );
    }

    #[OA\Get(
        path: '/emission-factors/{id}',
        summary: 'Get single emission factor details',
        tags: ['Emission Factors'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Emission factor details retrieved successfully.'),
            new OA\Response(response: 404, description: 'Emission factor not found.'),
        ]
    )]
    public function show(EmissionFactor $emissionFactor): JsonResponse
    {
        return $this->success(
            new EmissionFactorResource($emissionFactor),
            'Detail faktor emisi berhasil diambil.'
        );
    }

    #[OA\Put(
        path: '/emission-factors/{id}',
        summary: 'Update existing emission factor details',
        tags: ['Emission Factors'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Emission factor updated successfully.'),
            new OA\Response(response: 422, description: 'Validation error.'),
        ]
    )]
    public function update(UpdateEmissionFactorRequest $request, EmissionFactor $emissionFactor): JsonResponse
    {
        $emissionFactor->update($request->validated());

        return $this->success(
            new EmissionFactorResource($emissionFactor),
            'Faktor emisi berhasil diperbarui.'
        );
    }

    #[OA\Delete(
        path: '/emission-factors/{id}',
        summary: 'Delete an emission factor',
        tags: ['Emission Factors'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Emission factor deleted successfully.'),
        ]
    )]
    public function destroy(EmissionFactor $emissionFactor): JsonResponse
    {
        $emissionFactor->delete();

        return $this->success(
            null,
            'Faktor emisi berhasil dihapus.'
        );
    }
}
