<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class UserController extends Controller
{
    use ApiResponse;

    #[OA\Get(
        path: '/users',
        summary: 'Get paginated list of users',
        security: [['sanctum' => []]],
        tags: ['Users'],
        parameters: [
            new OA\Parameter(name: 'role', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['admin', 'driver'])),
            new OA\Parameter(name: 'search', in: 'query', required: false, schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'List of users retrieved successfully.'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = User::query();

        if ($request->filled('role')) {
            $query->where('role', $request->query('role'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('username', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $perPage = (int) $request->query('per_page', 15);
        $users = $query->latest('id')->paginate($perPage);

        return $this->success(
            UserResource::collection($users),
            'Daftar pengguna berhasil diambil.'
        );
    }

    #[OA\Post(
        path: '/users',
        summary: 'Create a new user/driver',
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'username', 'password', 'role'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Budi Santoso'),
                    new OA\Property(property: 'username', type: 'string', example: 'driver_budi'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', example: 'password123'),
                    new OA\Property(property: 'role', type: 'string', enum: ['admin', 'driver'], example: 'driver'),
                    new OA\Property(property: 'phone', type: 'string', example: '+6281234567890'),
                ]
            )
        ),
        tags: ['Users'],
        responses: [
            new OA\Response(response: 201, description: 'User created successfully.'),
            new OA\Response(response: 422, description: 'Validation error.'),
        ]
    )]
    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = User::create($request->validated());

        return $this->success(
            new UserResource($user),
            'Pengguna berhasil ditambahkan.',
            201
        );
    }

    #[OA\Get(
        path: '/users/{id}',
        summary: 'Get single user details',
        security: [['sanctum' => []]],
        tags: ['Users'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', description: 'User ID', required: true, schema: new OA\Schema(type: 'integer', example: 1)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'User details retrieved successfully.'),
            new OA\Response(response: 404, description: 'User not found.'),
        ]
    )]
    public function show(User $user): JsonResponse
    {
        return $this->success(
            new UserResource($user),
            'Detail pengguna berhasil diambil.'
        );
    }

    #[OA\Put(
        path: '/users/{id}',
        summary: 'Update existing user details',
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Budi Santoso Updated'),
                    new OA\Property(property: 'username', type: 'string', example: 'driver_budi_updated'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', nullable: true, example: 'newpassword123'),
                    new OA\Property(property: 'role', type: 'string', enum: ['admin', 'driver']),
                    new OA\Property(property: 'phone', type: 'string', example: '+6281234567890'),
                ]
            )
        ),
        tags: ['Users'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', description: 'User ID', required: true, schema: new OA\Schema(type: 'integer', example: 1)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'User updated successfully.'),
            new OA\Response(response: 422, description: 'Validation error.'),
        ]
    )]
    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $validated = $request->validated();

        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        $user->update($validated);

        return $this->success(
            new UserResource($user),
            'Data pengguna berhasil diperbarui.'
        );
    }

    #[OA\Delete(
        path: '/users/{id}',
        summary: 'Delete a user',
        security: [['sanctum' => []]],
        tags: ['Users'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', description: 'User ID', required: true, schema: new OA\Schema(type: 'integer', example: 1)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'User deleted successfully.'),
            new OA\Response(response: 422, description: 'Cannot delete user with assigned trips or own account.'),
        ]
    )]
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user() && $request->user()->id === $user->id) {
            return $this->error('Tidak dapat menghapus akun Anda sendiri yang sedang aktif.', 422);
        }

        $hasTrips = $user->driverTrips()->exists() || $user->createdTrips()->exists();

        if ($hasTrips) {
            return $this->error(
                'Tidak dapat menghapus pengguna yang masih terhubung dengan riwayat trip logistik.',
                422
            );
        }

        $user->delete();

        return $this->success(
            null,
            'Pengguna berhasil dihapus.'
        );
    }
}
