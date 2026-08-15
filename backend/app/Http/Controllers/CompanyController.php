<?php

namespace App\Http\Controllers;

use App\Http\Resources\CompanyResource;
use App\Models\Company;
use App\Traits\ApiResponse;
use OpenApi\Attributes as OA;

class CompanyController extends Controller
{
    use ApiResponse;

    #[OA\Get(
        path: '/companies',
        summary: 'List all companies',
        description: 'Master data — every company (internal and partner, both Batam and Singapore side). '
            .'Small, bounded dataset (not paginated), meant for populating a dropdown/select when creating a '
            .'trip (PRD Bagian 5.1) or plotting on a map.',
        security: [['sanctum' => []]],
        tags: ['Companies'],
        responses: [
            new OA\Response(
                response: 200,
                description: 'OK',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'OK'),
                        new OA\Property(property: 'data', type: 'array', items: new OA\Items(ref: '#/components/schemas/Company')),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
        ]
    )]
    public function index()
    {
        return $this->success(CompanyResource::collection(Company::all()));
    }
}
