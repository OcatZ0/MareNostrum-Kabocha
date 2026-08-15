<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use OpenApi\Attributes as OA;

class AuthController extends Controller
{
    use ApiResponse;

    #[OA\Post(
        path: '/login',
        summary: 'Authenticate user and obtain Sanctum Bearer token',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['username', 'password'],
                properties: [
                    new OA\Property(property: 'username', type: 'string', example: 'admin'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', example: 'password'),
                ]
            )
        ),
        tags: ['Auth'],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Login successful, returns token and user profile.',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'Login successful.'),
                        new OA\Property(
                            property: 'data',
                            properties: [
                                new OA\Property(property: 'token', type: 'string', example: '1|Q3w...'),
                                new OA\Property(property: 'user', ref: '#/components/schemas/User'),
                            ],
                            type: 'object'
                        ),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Invalid login credentials.'),
            new OA\Response(response: 422, description: 'Validation error.'),
        ]
    )]
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('username', $request->username)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return $this->error('Invalid login credentials. Please check your username and password.', 401);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return $this->success([
            'token' => $token,
            'user' => new UserResource($user),
        ], 'Login successful.');
    }

    #[OA\Post(
        path: '/logout',
        summary: 'Revoke active authentication token',
        security: [['sanctum' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Logout successful.'),
        ]
    )]
    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return $this->success(null, 'Logout successful.');
    }
}
