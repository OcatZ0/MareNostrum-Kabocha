<?php

namespace App\Http\Controllers;

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
            'List of emission factors retrieved successfully.'
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
            'Emission factor details retrieved successfully.'
        );
    }
}
