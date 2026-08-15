<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCompanyRequest;
use App\Http\Requests\UpdateCompanyRequest;
use App\Http\Resources\CompanyResource;
use App\Models\Company;
use App\Models\Trip;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class CompanyController extends Controller
{
    use ApiResponse;

    #[OA\Get(
        path: '/api/companies',
        summary: 'Get paginated list of companies',
        tags: ['Companies'],
        parameters: [
            new OA\Parameter(name: 'type', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['internal', 'partner'])),
            new OA\Parameter(name: 'search', in: 'query', required: false, schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'List of companies retrieved successfully.'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = Company::query();

        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('city', 'like', "%{$search}%");
            });
        }

        $perPage = (int) $request->query('per_page', 15);
        $companies = $query->latest('id')->paginate($perPage);

        return $this->success(
            CompanyResource::collection($companies),
            'Daftar perusahaan berhasil diambil.'
        );
    }

    #[OA\Post(
        path: '/api/companies',
        summary: 'Create a new company',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'type', 'city', 'latitude', 'longitude'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Company B Logistics'),
                    new OA\Property(property: 'type', type: 'string', enum: ['internal', 'partner'], example: 'partner'),
                    new OA\Property(property: 'city', type: 'string', example: 'Batam'),
                    new OA\Property(property: 'address', type: 'string', example: 'Kawasan Industri Mukakuning'),
                    new OA\Property(property: 'latitude', type: 'number', format: 'float', example: 1.08234),
                    new OA\Property(property: 'longitude', type: 'number', format: 'float', example: 104.03214),
                ]
            )
        ),
        tags: ['Companies'],
        responses: [
            new OA\Response(response: 201, description: 'Company created successfully.'),
            new OA\Response(response: 422, description: 'Validation error.'),
        ]
    )]
    public function store(StoreCompanyRequest $request): JsonResponse
    {
        $company = Company::create($request->validated());

        return $this->success(
            new CompanyResource($company),
            'Perusahaan berhasil ditambahkan.',
            201
        );
    }

    #[OA\Get(
        path: '/api/companies/{company}',
        summary: 'Get single company details',
        tags: ['Companies'],
        parameters: [
            new OA\Parameter(name: 'company', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Company details retrieved successfully.'),
            new OA\Response(response: 404, description: 'Company not found.'),
        ]
    )]
    public function show(Company $company): JsonResponse
    {
        return $this->success(
            new CompanyResource($company),
            'Detail perusahaan berhasil diambil.'
        );
    }

    #[OA\Put(
        path: '/api/companies/{company}',
        summary: 'Update existing company details',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Company B Logistics Updated'),
                    new OA\Property(property: 'type', type: 'string', enum: ['internal', 'partner']),
                    new OA\Property(property: 'city', type: 'string'),
                    new OA\Property(property: 'address', type: 'string'),
                    new OA\Property(property: 'latitude', type: 'number', format: 'float'),
                    new OA\Property(property: 'longitude', type: 'number', format: 'float'),
                ]
            )
        ),
        tags: ['Companies'],
        parameters: [
            new OA\Parameter(name: 'company', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Company updated successfully.'),
            new OA\Response(response: 422, description: 'Validation error.'),
        ]
    )]
    public function update(UpdateCompanyRequest $request, Company $company): JsonResponse
    {
        $company->update($request->validated());

        return $this->success(
            new CompanyResource($company),
            'Data perusahaan berhasil diperbarui.'
        );
    }

    #[OA\Delete(
        path: '/api/companies/{company}',
        summary: 'Delete a company',
        tags: ['Companies'],
        parameters: [
            new OA\Parameter(name: 'company', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Company deleted successfully.'),
            new OA\Response(response: 422, description: 'Cannot delete company referenced in trips.'),
        ]
    )]
    public function destroy(Company $company): JsonResponse
    {
        $hasTrips = Trip::where('origin_company_id', $company->id)
            ->orWhere('destination_company_id', $company->id)
            ->exists();

        if ($hasTrips) {
            return $this->error(
                'Tidak dapat menghapus perusahaan yang masih terhubung dengan data trip.',
                422
            );
        }

        $company->delete();

        return $this->success(
            null,
            'Perusahaan berhasil dihapus.'
        );
    }
}
