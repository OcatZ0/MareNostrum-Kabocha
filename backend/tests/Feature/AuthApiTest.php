<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Demo Admin',
            'username' => 'admin_demo',
            'password' => Hash::make('secret12345'),
            'role' => 'admin',
        ]);
    }

    public function test_can_login_with_valid_credentials(): void
    {
        $payload = [
            'username' => 'admin_demo',
            'password' => 'secret12345',
        ];

        $response = $this->postJson('/api/login', $payload);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'token',
                    'user' => ['id', 'name', 'username', 'role', 'phone'],
                ],
            ])
            ->assertJson([
                'success' => true,
                'message' => 'Login berhasil.',
                'data' => [
                    'user' => [
                        'username' => 'admin_demo',
                        'role' => 'admin',
                    ],
                ],
            ]);

        $this->assertNotEmpty($response->json('data.token'));
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        $payload = [
            'username' => 'admin_demo',
            'password' => 'wrongpassword',
        ];

        $response = $this->postJson('/api/login', $payload);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Kredensial login tidak valid. Silakan periksa kembali username dan password Anda.',
            ]);
    }

    public function test_login_fails_on_missing_fields(): void
    {
        $response = $this->postJson('/api/login', []);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors' => ['username', 'password'],
            ]);
    }

    public function test_can_logout(): void
    {
        $token = $this->user->createToken('auth_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/logout');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Logout berhasil.',
            ]);

        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $this->user->id,
        ]);
    }
}
